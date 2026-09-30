#!/usr/bin/env python3
"""
Assembles dashboard/public/data/application-funnel-ad-spend.json from a raw
Meta MCP campaign-level insights dump (JSON array, the exact shape
`ads_get_ad_entities` returns for `fields=[campaign_name, amount_spent,
impressions, link_click, lead]`).

Meta pulls happen via Claude's Meta MCP tool inside a sync session — not
scriptable standalone, same reason fetch_ghl.py/fetch_application_funnel.py
don't touch Meta either. This script only does the "turn the raw MCP JSON
into the file shape" step, so a future sync doesn't have to reinvent the
parsing/merging logic as a one-off inline script each time.

CAMPAIGN_NAMES below is the **explicit campaign-ID allowlist** for the
Application Funnel — confirmed by the user 2026-09-30 after reviewing the
full account's ~45 campaigns. Campaign naming across this account's history
is inconsistent (some say "Application Funnel", some "Submit Application",
some are ambiguous top-of-funnel Awareness campaigns that may or may not
feed this funnel) — a name-pattern rule was not safe to guess, so this is a
literal ID list, not a `contains()` check. Edit this dict (and re-run) if
the campaign roster for this funnel changes.

Usage:
    python3 sync/build_application_funnel_ad_spend.py raw_meta_pull.json > /dev/null
    # (writes dashboard/public/data/application-funnel-ad-spend.json directly)
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = REPO_ROOT / "dashboard" / "public" / "data" / "application-funnel-ad-spend.json"

CAMPAIGN_NAMES: dict[str, str] = {
    "120255384275490285": "FA | Submit Application | VSL Funnel | Mixed Creatives | Mixed Audiences",
    "120255281254990285": "FA | SubmitApplication | Optin Funnel | 10k-Guarantee | Mixed Audiences",
    "120250367962050285": "PUR | FA | Application Funnel | Purchases",
    "120252512362330285": "Relaunch | AUS | PUR | Application Funnel",
    "120252123422660285": "Winner Ad | FA | Application Funnel | Schedule",
    "120251493796750285": "Ugly Ads | FA | Broad 20-50 | Application Funnel",
    "120255291772900285": "FA | MOF | Submit Application | VSL Funnel | Mixed Creatives",
    "120255356743120285": "FA | MOF | Submit Application | VSL Funnel | Comment TRAINING",
}


def parse_amount(v) -> float:
    if isinstance(v, dict):
        return float(v.get("value") or 0)
    return 0.0


def build(raw_rows: list[dict]) -> dict:
    by_campaign_date: dict[tuple[str, str], dict] = {}
    for r in raw_rows:
        cid = r.get("id")
        if cid not in CAMPAIGN_NAMES:
            continue  # not one of the 8 confirmed campaigns — skip
        key = (cid, r["date_start"])
        by_campaign_date[key] = {
            "campaignId": cid,
            "campaignName": CAMPAIGN_NAMES[cid],
            "date": r["date_start"],
            "spend": round(parse_amount(r.get("amount_spent")), 2),
            "impressions": int(r.get("impressions") or 0),
            "linkClicks": int(r.get("link_click") or 0),
            "leads": int(r.get("lead") or 0),
        }

    rows_out = sorted(by_campaign_date.values(), key=lambda r: (r["date"], r["campaignId"]))

    by_date: dict[str, dict] = {}
    for r in rows_out:
        d = by_date.setdefault(r["date"], {"date": r["date"], "spend": 0.0, "impressions": 0, "linkClicks": 0, "leads": 0})
        d["spend"] += r["spend"]
        d["impressions"] += r["impressions"]
        d["linkClicks"] += r["linkClicks"]
        d["leads"] += r["leads"]
    daily_total = [dict(v, spend=round(v["spend"], 2)) for v in sorted(by_date.values(), key=lambda x: x["date"])]

    return {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "Meta MCP direct pull (act_1185223312884959), campaign-level, scoped to 8 confirmed Application Funnel campaigns — no BigQuery",
            "campaignFilter": "Explicit campaign ID list, confirmed by user 2026-09-30 (naming alone is not reliable across this account's history)",
            "campaignIds": list(CAMPAIGN_NAMES.keys()),
            "dataWindow": f"{daily_total[0]['date']} to {daily_total[-1]['date']}" if daily_total else "no data",
            "totalDays": len(daily_total),
            "totalSpend": round(sum(d["spend"] for d in daily_total), 2),
        },
        "byCampaignDaily": rows_out,
        "dailyTotal": daily_total,
    }


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    raw_rows = json.loads(Path(sys.argv[1]).read_text())
    # Merge onto whatever's already committed, so a partial-range sync
    # doesn't wipe out history outside the pulled window.
    existing_rows: list[dict] = []
    if OUT_PATH.exists():
        existing = json.loads(OUT_PATH.read_text())
        existing_rows = [
            {
                "date_start": r["date"],
                "id": r["campaignId"],
                "amount_spent": {"value": str(r["spend"])},
                "impressions": str(r["impressions"]),
                "link_click": str(r["linkClicks"]),
                "lead": str(r["leads"]),
            }
            for r in existing.get("byCampaignDaily", [])
        ]
    merged_by_key = {(r["id"], r["date_start"]): r for r in existing_rows}
    for r in raw_rows:
        merged_by_key[(r.get("id"), r.get("date_start"))] = r

    out = build(list(merged_by_key.values()))
    OUT_PATH.write_text(json.dumps(out, indent=2))
    print(f"Wrote {len(out['byCampaignDaily'])} campaign-day rows, {len(out['dailyTotal'])} daily-total rows, total spend A${out['meta']['totalSpend']:,.2f}", file=sys.stderr)


if __name__ == "__main__":
    main()
