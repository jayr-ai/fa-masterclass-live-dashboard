#!/usr/bin/env python3
"""
Pulls the Accelerator Application Funnel's GHL pipeline opportunities and
Meta Ads campaign spend, for the new "Application Funnel" tab. FA only —
this funnel and its dashboard tab do not exist for Heart Smart.

Architecture note: like the rest of this dashboard, there is no live
backend. This script writes static JSON that the React app fetches at
runtime; Meta pulls happen separately via Claude's Meta MCP tool inside a
sync session (not scriptable standalone), same as the Masterclass/Marketing
sync. This script only handles the GHL side plus assembling the final
composite once the Meta JSON has been written alongside it.

Pipeline stages, confirmed 2026-09-30 (`list-stages`), have NO separate
"Applied" or "Showed" stage — every opportunity is created directly at
"Appointment Set". Per user decision 2026-09-30, funnel steps are:
  - Applied = Booked = "Appointment Set" (every opportunity counts as both)
  - Showed = progressed to Pending Payment, Lost, or Won (i.e. did NOT end
    in No Show / Cancelled / Needs To Reschedule)
  - Closed = Won

Token lives in sync/.env (FA_GHL_PIT=...), same as fetch_ghl.py.

Usage:
    python3 fetch_application_funnel.py opportunities   # -> prints all opportunities (paginated fetch)
    python3 fetch_application_funnel.py build-data       # -> writes application-funnel-opportunities.json directly
    python3 fetch_application_funnel.py build-transactions  # -> writes application-funnel-transactions.json (needs build-data run first)
    python3 fetch_application_funnel.py list-stages      # -> setup helper, re-run if stages change
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OPPORTUNITIES_OUT = REPO_ROOT / "dashboard" / "public" / "data" / "application-funnel-opportunities.json"
TRANSACTIONS_OUT = REPO_ROOT / "dashboard" / "public" / "data" / "application-funnel-transactions.json"

GHL_API_BASE = "https://services.leadconnectorhq.com"
GHL_API_VERSION = "2021-07-28"
USER_AGENT = "curl/8.7.1"  # Cloudflare blocks the default urllib UA outright

LOCATION_ID = "ZwP47P1XZZ8TSazVZMxc"
PIPELINE_ID = "o3UfP72baKpNIhXMW2oV"
PIPELINE_NAME = "Accelerator Application Pipeline"

# Fetched live via `list-stages` on 2026-09-30.
STAGE_IDS: dict[str, str] = {
    "Appointment Set": "48b46d82-6220-4961-91fb-99f5d52e8b9c",
    "Needs To Reschedule": "9668bb06-9897-4a0a-9637-1ef88e2160e6",
    "No Show": "d4649de0-6220-4364-8c6f-6249a1b8989a",
    "Cancelled": "affa9fc3-6248-41c8-9d3c-99c564520d46",
    "Pending Payment": "d5e475e4-a034-4358-9ad0-2dab5d5ad679",
    "Lost": "0c4399d6-9fea-4f0f-841a-65ba56b6789d",
    "Won": "aedca79c-3a47-440c-a572-29f8989de4dd",
}
STAGE_NAME_BY_ID = {v: k for k, v in STAGE_IDS.items()}

SHOWED_STAGES = {STAGE_IDS["Pending Payment"], STAGE_IDS["Lost"], STAGE_IDS["Won"]}
CLOSED_STAGES = {STAGE_IDS["Won"]}


def _get_token() -> str:
    token = os.environ.get("FA_GHL_PIT")
    if not token:
        print(
            "FA_GHL_PIT is not set. Load it first:\n"
            "    set -a; source sync/.env; set +a",
            file=sys.stderr,
        )
        sys.exit(1)
    return token


def _request(url: str, token: str) -> dict:
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Version": GHL_API_VERSION,
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GHL API error {e.code} for {url}: {body}") from e


def list_stages() -> dict:
    """Setup/refresh helper — camelCase locationId here, unlike opportunities/search."""
    token = _get_token()
    params = urllib.parse.urlencode({"locationId": LOCATION_ID})
    data = _request(f"{GHL_API_BASE}/opportunities/pipelines?{params}", token)
    for p in data.get("pipelines", []):
        if p["id"] == PIPELINE_ID:
            return {s["name"]: s["id"] for s in p["stages"]}
    raise RuntimeError(f"Pipeline {PIPELINE_ID} not found in location {LOCATION_ID}")


def fetch_all_opportunities() -> list[dict]:
    """Paginated fetch of every opportunity in the Accelerator Application
    Pipeline. Cursor-based pagination via the last result's `sort` array
    (GHL v2 convention) — `startAfter`/`startAfterId`, not page numbers."""
    token = _get_token()
    out: list[dict] = []
    start_after: str | None = None
    start_after_id: str | None = None
    page = 0

    while True:
        page += 1
        params = {
            "location_id": LOCATION_ID,
            "pipeline_id": PIPELINE_ID,
            "limit": "100",
        }
        if start_after and start_after_id:
            params["startAfter"] = start_after
            params["startAfterId"] = start_after_id
        url = f"{GHL_API_BASE}/opportunities/search?{urllib.parse.urlencode(params)}"
        data = _request(url, token)
        opps = data.get("opportunities", [])
        if not opps:
            break

        for o in opps:
            contact = o.get("contact") or {}
            attributions = o.get("attributions") or []
            attr = attributions[0] if attributions else {}
            out.append({
                "id": o.get("id"),
                "contactId": o.get("contactId"),
                "name": contact.get("name") or o.get("name"),
                "email": (contact.get("email") or "").strip().lower(),
                "stageId": o.get("pipelineStageId"),
                "stageName": STAGE_NAME_BY_ID.get(o.get("pipelineStageId"), "Unknown"),
                "status": o.get("status"),
                "monetaryValue": o.get("monetaryValue") or 0,
                "createdAt": o.get("createdAt"),
                "lastStageChangeAt": o.get("lastStageChangeAt"),
                "utmCampaign": attr.get("utmCampaign"),
                "utmMedium": attr.get("utmMedium"),
                "fbclid": attr.get("utmFbclid") or attr.get("fbclid"),
                "fbc": attr.get("fbc"),
                "sessionSource": attr.get("utmSessionSource"),
            })

        total = data.get("meta", {}).get("total", 0)
        print(f"  page {page}: {len(opps)} opportunities ({len(out)}/{total})", file=sys.stderr)

        last = opps[-1]
        sort_vals = last.get("sort")
        if not sort_vals or len(opps) < 100:
            break
        start_after, start_after_id = sort_vals[0], sort_vals[1]

    return out


def build_funnel_snapshot(opportunities: list[dict]) -> dict:
    """Point-in-time snapshot: how many opportunities are currently at each
    step, cumulative (an opportunity anywhere in the pipeline counts as both
    Applied and Booked; Showed/Closed require having reached those stages)."""
    total = len(opportunities)
    showed = sum(1 for o in opportunities if o["stageId"] in SHOWED_STAGES)
    closed = sum(1 for o in opportunities if o["stageId"] in CLOSED_STAGES)
    lost_after_show = sum(1 for o in opportunities if o["stageId"] == STAGE_IDS["Lost"])
    no_show_or_resched = sum(
        1 for o in opportunities
        if o["stageId"] in (STAGE_IDS["No Show"], STAGE_IDS["Needs To Reschedule"], STAGE_IDS["Cancelled"])
    )
    by_current_stage = {name: sum(1 for o in opportunities if o["stageId"] == sid) for name, sid in STAGE_IDS.items()}

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "pipelineId": PIPELINE_ID,
        "pipelineName": PIPELINE_NAME,
        "totalOpportunities": total,
        "applied": total,
        "booked": total,
        "showed": showed,
        "closed": closed,
        "lostAfterShow": lost_after_show,
        "noShowOrReschedule": no_show_or_resched,
        "byCurrentStage": by_current_stage,
        "note": "This pipeline has no separate Applied/Showed stage — every opportunity is created at 'Appointment Set', so Applied=Booked=total. Showed is inferred as reaching Pending Payment/Lost/Won.",
    }


def build_and_write_opportunities() -> list[dict]:
    opps = fetch_all_opportunities()
    snap = build_funnel_snapshot(opps)
    out = {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "GHL REST API direct (Private Integration Token), Accelerator Application Pipeline — no BigQuery, no MCP",
            "pipelineId": PIPELINE_ID,
            "pipelineName": PIPELINE_NAME,
            "totalOpportunities": len(opps),
        },
        "funnelSnapshot": snap,
        "opportunities": opps,
    }
    OPPORTUNITIES_OUT.parent.mkdir(parents=True, exist_ok=True)
    OPPORTUNITIES_OUT.write_text(json.dumps(out, indent=2))
    print(f"Wrote {len(opps)} opportunities to {OPPORTUNITIES_OUT}", file=sys.stderr)
    return opps


def build_and_write_transactions() -> None:
    """Match CONSOLIDATED sheet transactions against opportunity emails.
    Requires application-funnel-opportunities.json to already exist (run
    build-data first) and fetch_sheets.py to be importable (same dir)."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import fetch_sheets  # noqa: E402

    if not OPPORTUNITIES_OUT.exists():
        print("application-funnel-opportunities.json not found — run 'build-data' first.", file=sys.stderr)
        sys.exit(1)
    opps = json.loads(OPPORTUNITIES_OUT.read_text())["opportunities"]

    all_txns = fetch_sheets.build_transactions()
    earliest_by_email: dict[str, str] = {}
    for o in opps:
        email = o["email"]
        if not email:
            continue
        created = o["createdAt"][:10]
        if email not in earliest_by_email or created < earliest_by_email[email]:
            earliest_by_email[email] = created

    matched = []
    for t in all_txns:
        email = t["email"]
        if email not in earliest_by_email:
            continue
        app_date = earliest_by_email[email]
        if t["date"] < app_date:
            continue
        matched.append({**t, "applicationDate": app_date})

    matched_emails = set(m["email"] for m in matched)
    total_matched = sum(m["amount"] for m in matched)
    out = {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "Google Sheet 'CONSOLIDATED', matched by email against Accelerator Application Pipeline opportunities (no product-name filter — same product sells through both Masterclass and this funnel, so email+pipeline match is the only reliable signal, per user decision 2026-09-30)",
            "matchRule": "email present in pipeline AND sale date >= that contact's earliest opportunity createdAt",
            "totalMatchedTransactions": len(matched),
            "totalMatchedRevenue": round(total_matched, 2),
            "distinctMatchedCustomers": len(matched_emails),
        },
        "transactions": matched,
    }
    TRANSACTIONS_OUT.write_text(json.dumps(out, indent=2))
    print(f"Wrote {len(matched)} matched transactions (${total_matched:,.2f}) from {len(matched_emails)} customers to {TRANSACTIONS_OUT}", file=sys.stderr)


def main():
    valid = ("opportunities", "build-data", "build-transactions", "list-stages")
    if len(sys.argv) < 2 or sys.argv[1] not in valid:
        print(__doc__)
        sys.exit(1)

    if sys.argv[1] == "list-stages":
        print(json.dumps(list_stages(), indent=2))
        return

    if sys.argv[1] == "build-data":
        build_and_write_opportunities()
        return

    if sys.argv[1] == "build-transactions":
        build_and_write_transactions()
        return

    opps = fetch_all_opportunities()
    print(json.dumps(opps, indent=2))


if __name__ == "__main__":
    main()
