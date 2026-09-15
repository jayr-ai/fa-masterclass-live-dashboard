#!/usr/bin/env python3
"""
Pulls the two Google Sheets that feed this dashboard, straight to JSON — no
BigQuery, no Apps Script, no auth (both sheets are link-viewable, pulled via
the gviz CSV export endpoint, same no-credential pattern already used in
../../terraslate-ceo-dashboard/scripts/fetch_data.py).

This script only touches the two Google Sheets. Meta Ads and GHL data (funnel
stages, attendance) are pulled separately by Claude via the Meta MCP / GHL
MCP tools inside the sync-fa-masterclass-live skill — those aren't callable
from a standalone script, only from within a Claude Code session. Revenue
attribution (Paid/Organic) comes straight from the CONSOLIDATED sheet's own
'Attribution' column now — no GHL cross-reference needed for that any more.

Usage:
    python3 fetch_sheets.py registrations   # -> prints masterclass-registrations.json shape
    python3 fetch_sheets.py attendance      # -> prints masterclass-attendance.json shape (Column N)
    python3 fetch_sheets.py applications    # -> prints masterclass-applications.json shape (Columns I+M)
    python3 fetch_sheets.py transactions    # -> prints CONSOLIDATED rows with source attribution
"""

from __future__ import annotations

import csv
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path

REGISTRATIONS_SHEET_ID = "1g4h0IHwz0_BZ90nslU7NNKwIsENJw9hzgbk3A52dcQo"  # FA | Webinar Lead Tracker
REGISTRATIONS_TAB = "X - AUTO"

REVENUE_SHEET_ID = "1LKIwjIpzn1jNSaIzzLAWLkkiODJUuKReKkw3QUT9c8A"  # FA revenue tracker
REVENUE_TAB = "CONSOLIDATED"

REPO_ROOT = Path(__file__).resolve().parent.parent
ROW_COUNT_BASELINE_PATH = REPO_ROOT / "sync" / "row_count_baseline.json"


def _fetch_csv_once(sheet_id: str, tab: str) -> list[dict[str, str]]:
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv&sheet={urllib.parse.quote(tab)}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        raw = resp.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(raw))
    # Sheet headers/values often carry stray whitespace (e.g. "Name ", " Amount ")
    return [{(k or "").strip(): (v or "").strip() for k, v in row.items()} for row in reader]


def _load_row_count_baseline() -> dict[str, int]:
    if ROW_COUNT_BASELINE_PATH.exists():
        return json.loads(ROW_COUNT_BASELINE_PATH.read_text())
    return {}


def _save_row_count_baseline(baseline: dict[str, int]) -> None:
    ROW_COUNT_BASELINE_PATH.write_text(json.dumps(baseline, indent=2))


class SuspiciousReadError(RuntimeError):
    """Raised when a sheet pull comes back much smaller than its last known
    good size — almost always someone's Filter (not Filter View) is active
    on the sheet, hiding rows from every reader including this script, not
    an actual data loss. Filter Views are per-viewer and don't affect this;
    the regular Filter does, for everyone, until it's cleared."""


def fetch_csv_rows(sheet_id: str, tab: str, attempts: int = 4, retry_delay_seconds: float = 8.0) -> list[dict[str, str]]:
    """Retries spaced several seconds apart, not back-to-back — a person
    filtering the sheet to check something typically clears it within
    seconds to a couple minutes, so back-to-back retries (all landing inside
    the same filtered window) don't help, but a few seconds' gap gives a
    real chance of catching it unfiltered. Keeps the largest result seen.

    Then checks the result against a persisted per-(sheet,tab) row-count
    baseline (sync/row_count_baseline.json). If the best result is still
    under 70% of the last known-good count, raises SuspiciousReadError
    instead of silently returning a partial dataset — almost certainly an
    active Filter on the sheet (not a Filter View, which wouldn't affect
    this), and merging a filtered-down pull into committed history would
    quietly overwrite good numbers with undercounts. A healthy pull updates
    the baseline forward, so real sheet growth doesn't trip this later.
    """
    key = f"{sheet_id}:{tab}"
    baseline = _load_row_count_baseline()
    last_good = baseline.get(key)

    best: list[dict[str, str]] = []
    for i in range(attempts):
        rows = _fetch_csv_once(sheet_id, tab)
        if len(rows) > len(best):
            best = rows
        # Early exit the moment a healthy-looking read shows up — no baseline
        # yet (first-ever run) or this attempt already clears the bar. Saves
        # calling this 3x back-to-back (registrations/attendance/applications
        # all hit the same sheet) from paying the full retry/delay cost when
        # the sheet isn't currently filtered, which is the common case.
        if last_good is None or len(best) >= last_good * 0.7:
            break
        if i < attempts - 1:
            time.sleep(retry_delay_seconds)
    if last_good is not None and len(best) < last_good * 0.7:
        raise SuspiciousReadError(
            f"'{tab}' returned {len(best)} rows across {attempts} spaced attempts, "
            f"but the last known-good pull had {last_good}. This almost always means "
            f"someone has a Filter (not a Filter View) active on the sheet right now, "
            f"hiding rows from every reader. Ask them to clear it (Data > Remove filter, "
            f"or check the filter icon in the toolbar) and re-run the sync — do not "
            f"proceed with this data, it would overwrite good history with undercounts."
        )

    baseline[key] = max(len(best), int(last_good * 0.9)) if last_good else len(best)
    _save_row_count_baseline(baseline)
    return best


def parse_webinar_date(raw: str, today: datetime | None = None) -> str | None:
    """Mirrors apps-script-masterclass-sync.gs's parseWebinarDate: sheet values
    like "Tue Sep 1" carry no year, so the current year is assumed (same
    behavior as JS `new Date("Tue Sep 1")`, which is what production does)."""
    raw = (raw or "").strip()
    if not raw:
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw
    today = today or datetime.now()
    for year in (today.year, today.year + 1, today.year - 1):
        try:
            dt = datetime.strptime(f"{raw} {year}", "%a %b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _webinar_metrics_by_date() -> dict[str, dict]:
    """One pass over X - AUTO, keyed by Webinar Date (Column F), each value a
    dict of per-date sets of unique emails for registered/attended/application
    — the three metrics this sheet drives, all counted the same way (unique
    Column C email per date) per the mapping doc.

    NOTE: this sheet only holds the most recent Masterclass batch's raw rows
    — older dates get pruned. Every metric here needs the same merge-forward
    treatment onto the previously-committed JSON as registrations already
    gets, or a pruned date silently loses whatever wasn't captured before it
    disappeared.
    """
    rows = fetch_csv_rows(REGISTRATIONS_SHEET_ID, REGISTRATIONS_TAB)
    by_date: dict[str, dict[str, set[str]]] = defaultdict(lambda: {"registered": set(), "attended": set(), "application": set()})
    for row in rows:
        email = (row.get("Email Address") or "").strip().lower()
        webinar_date = parse_webinar_date(row.get("Webinar Date", ""))
        if not email or not webinar_date:
            continue
        by_date[webinar_date]["registered"].add(email)

        # ATTENDED — Column N (Attended Webinar), any non-empty value counts
        # as checked (sheet renders a checkmark, exact glyph not load-bearing).
        if (row.get("Attended Webinar") or "").strip():
            by_date[webinar_date]["attended"].add(email)

        # APPLICATION — Column I (Call Booked Event) contains "application"
        # (case-insensitive) AND Column M (Booking Status) is BOOKED.
        cbe = (row.get("Call Booked Event") or "").strip().lower()
        booking_status = (row.get("Booking Status") or "").strip().upper()
        if "application" in cbe and booking_status == "BOOKED":
            by_date[webinar_date]["application"].add(email)

    return by_date


def build_registrations() -> dict:
    by_date = _webinar_metrics_by_date()
    runs = []
    for date, metrics in sorted(by_date.items()):
        dt = datetime.strptime(date, "%Y-%m-%d")
        runs.append({
            "date": date,
            "label": dt.strftime("%d %b %Y"),
            "registered": len(metrics["registered"]),
        })
    runs.sort(key=lambda r: r["date"], reverse=True)

    return {
        "meta": {
            "generatedAt": datetime.utcnow().isoformat() + "Z",
            "source": "Google Sheet 'FA | Webinar Lead Tracker' (X - AUTO tab, direct pull) — unique emails (Column C) per Webinar Date (Column F)",
            "dataWindow": f"{runs[-1]['date']} to {runs[0]['date']}" if runs else "no data",
            "totalRegistrations": sum(r["registered"] for r in runs),
        },
        "masterclassRegistrations": runs,
    }


def build_attendance() -> dict:
    by_date = _webinar_metrics_by_date()
    rows_out = []
    for date, metrics in sorted(by_date.items()):
        rows_out.append({"date": date, "attended": len(metrics["attended"])})
    rows_out.sort(key=lambda r: r["date"], reverse=True)

    return {
        "meta": {
            "generatedAt": datetime.utcnow().isoformat() + "Z",
            "source": "Google Sheet 'FA | Webinar Lead Tracker' (X - AUTO tab, Column N 'Attended Webinar') — unique emails per Webinar Date",
            "dataWindow": f"{rows_out[-1]['date']} to {rows_out[0]['date']}" if rows_out else "no data",
            "totalAttendees": sum(r["attended"] for r in rows_out),
        },
        "masterclassAttendance": rows_out,
    }


def build_applications() -> dict:
    by_date = _webinar_metrics_by_date()
    rows_out = []
    for date, metrics in sorted(by_date.items()):
        rows_out.append({"date": date, "applications": len(metrics["application"])})
    rows_out.sort(key=lambda r: r["date"], reverse=True)

    return {
        "meta": {
            "generatedAt": datetime.utcnow().isoformat() + "Z",
            "source": "Google Sheet 'FA | Webinar Lead Tracker' (X - AUTO tab, Column I 'Call Booked Event' contains 'application' + Column M 'Booking Status' = BOOKED) — unique emails per Webinar Date",
            "dataWindow": f"{rows_out[-1]['date']} to {rows_out[0]['date']}" if rows_out else "no data",
            "totalApplications": sum(r["applications"] for r in rows_out),
        },
        "applications": rows_out,
    }


MODE_VALUES = {"Stripe", "Finance", "EFT"}


def parse_amount(raw: str) -> float | None:
    cleaned = re.sub(r"[^0-9.\-]", "", raw or "")
    if not cleaned:
        return None
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


def parse_transaction_date(raw: str) -> str | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    for fmt in ("%b-%d-%Y", "%Y-%m-%d", "%d-%b-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


ATTRIBUTION_MAP = {"PAID": "Paid", "ORGANIC": "Organic"}


def build_transactions() -> list[dict]:
    """Raw CONSOLIDATED rows, source-attributed straight from the sheet's own
    'Attribution' column (PAID/ORGANIC) — added to the sheet 2026-09-15, no
    GHL cross-reference needed any more. Every row with a valid amount is
    included; there is no closer-assigned filter (per the mapping doc, the
    Cash Attribution cards are a straight sync of the sheet, not a subset)."""
    rows = fetch_csv_rows(REVENUE_SHEET_ID, REVENUE_TAB)
    out = []
    for row in rows:
        date = parse_transaction_date(row.get("Date", ""))
        amount = parse_amount(row.get("Amount", ""))
        email = (row.get("Email") or "").strip().lower()
        attribution = ATTRIBUTION_MAP.get((row.get("Attribution") or "").strip().upper())
        if not date or amount is None or amount == 0 or not email or not attribution:
            continue
        out.append({
            "date": date,
            "name": (row.get("Name") or "").strip(),
            "email": email,
            "product": (row.get("Product") or "").strip(),
            "amount": amount,
            "closer": (row.get("Closer") or "").strip(),
            "mode": (row.get("Mode") or "").strip() if row.get("Mode") in MODE_VALUES else "",
            "source": attribution,
        })
    return out


def main():
    valid = ("registrations", "attendance", "applications", "transactions")
    if len(sys.argv) < 2 or sys.argv[1] not in valid:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "registrations":
        print(json.dumps(build_registrations(), indent=2))
    elif cmd == "attendance":
        print(json.dumps(build_attendance(), indent=2))
    elif cmd == "applications":
        print(json.dumps(build_applications(), indent=2))
    elif cmd == "transactions":
        print(json.dumps(build_transactions(), indent=2))


if __name__ == "__main__":
    main()
