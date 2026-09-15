#!/usr/bin/env python3
"""
Pulls the GHL Masterclass Pipeline funnel-stage snapshot straight from the
GHL REST API using a location-scoped Private Integration Token (PIT) — no
GHL MCP connector involved. This replaces the earlier GHL-MCP-based pull
specifically because MCP connectors are bound to one agency account; a PIT
is scoped per-location instead, so this same script (with a different
token/pipeline/stage config) works for any other client's GHL location too.

Auth: `Authorization: Bearer <PIT>` + `Version: 2021-07-28` header. The API
requires `location_id`, `pipeline_id`, `pipeline_stage_id` as snake_case
query params (NOT camelCase — the API 422s on camelCase with a "property
should not exist" error, which is the opposite of most other GHL v2
endpoints and cost real trial-and-error to find).

Token lives in sync/.env (FA_GHL_PIT=...), git-ignored, never hardcoded here
and never committed. Load it with:
    set -a; source sync/.env; set +a

Usage:
    python3 fetch_ghl.py funnel-stages   # -> prints funnel-stages.json shape
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

GHL_API_BASE = "https://services.leadconnectorhq.com"
GHL_API_VERSION = "2021-07-28"

LOCATION_ID = "ZwP47P1XZZ8TSazVZMxc"
PIPELINE_ID = "djiSwm3hJsW7Rv9tyqSl"
PIPELINE_NAME = "Masterclass Pipeline"

STAGE_IDS: dict[str, str] = {
    "Registered": "3ed7c5ec-576c-4a5c-a718-a8cbc4cb075f",
    "VIP Upgrade": "b61eadcc-448c-4e0e-ac5c-d9366cf6f065",
    "Replay Optin": "85aa722f-621d-4694-88f2-91e15d71dab2",
    "Appointment Booked": "7a309bcf-6b76-4901-aaf2-d9b39fe28b10",
    "No-Showed": "b76a0454-f3f1-40b9-90b4-f977cf7e03d9",
    "Bad Fit": "fba1583e-385c-43ef-be6a-8f10394bf168",
    "Call Cancelled / Not Interested": "1ebc3719-a759-4199-a679-26ebb366566a",
    "Call Cancelled / Need To Reschedule": "7376dc2f-0731-49c9-bd20-25a01258fc5e",
    "Pending Sale": "3812deaf-b462-4299-a048-ba68c0e7b8e9",
    "Close Lost": "0a2c8dd0-1592-4fa7-b75d-e30c4528e726",
    "Close Won": "720dd586-4766-4bf4-bf9e-6c87dcb2e758",
}


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


def _stage_count(token: str, pipeline_id: str, stage_id: str) -> int:
    params = urllib.parse.urlencode({
        "location_id": LOCATION_ID,
        "pipeline_id": pipeline_id,
        "pipeline_stage_id": stage_id,
        "limit": "1",
    })
    url = f"{GHL_API_BASE}/opportunities/search?{params}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Version": GHL_API_VERSION,
        "Accept": "application/json",
        # Cloudflare in front of services.leadconnectorhq.com blocks the
        # default Python-urllib user agent outright (403, "browser_signature_banned").
        "User-Agent": "curl/8.7.1",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GHL API error {e.code} for stage {stage_id}: {body}") from e
    return data["meta"]["total"]


def build_funnel_stages() -> dict:
    token = _get_token()
    counts = {name: _stage_count(token, PIPELINE_ID, stage_id) for name, stage_id in STAGE_IDS.items()}
    total = sum(counts.values())
    ordered = sorted(counts.items(), key=lambda kv: -kv[1])

    stages = [
        {
            "name": name,
            "count": count,
            "position": i,
            "winProbability": round(count / total * 100, 2) if total else 0,
        }
        for i, (name, count) in enumerate(ordered)
    ]

    return {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "GHL REST API direct (Private Integration Token, no MCP, no BigQuery)",
            "dataWindow": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "totalOpportunities": total,
            "pipelineId": PIPELINE_ID,
            "pipelineName": PIPELINE_NAME,
        },
        "stages": stages,
    }


def main():
    if len(sys.argv) < 2 or sys.argv[1] != "funnel-stages":
        print(__doc__)
        sys.exit(1)
    print(json.dumps(build_funnel_stages(), indent=2))


if __name__ == "__main__":
    main()
