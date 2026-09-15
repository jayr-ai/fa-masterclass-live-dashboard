# Implementation Guide

Step-by-step for what Claude executes on `/sync-fa-masterclass-live`. All
Meta/GHL calls are Claude tool calls made from inside the session — they
can't be scripted standalone. Only the Google Sheets pull is a real script
(`sync/fetch_sheets.py`), since it needs no session-bound credential.

## Config (confirmed real, safe to hardcode)

- Meta ad account: `1185223312884959` (Shane Da Costa AU / Freedom Academy, AUD)
- GHL location: `ZwP47P1XZZ8TSazVZMxc`
- GHL Masterclass Pipeline: `djiSwm3hJsW7Rv9tyqSl`
- Registrations sheet: `1g4h0IHwz0_BZ90nslU7NNKwIsENJw9hzgbk3A52dcQo`, tab `X - AUTO`
- Revenue sheet: `1LKIwjIpzn1jNSaIzzLAWLkkiODJUuKReKkw3QUT9c8A`, tab `CONSOLIDATED`

### 11 pipeline stage IDs

| Stage | pipelineStageId |
|---|---|
| Registered | `3ed7c5ec-576c-4a5c-a718-a8cbc4cb075f` |
| VIP Upgrade | `b61eadcc-448c-4e0e-ac5c-d9366cf6f065` |
| Replay Optin | `85aa722f-621d-4694-88f2-91e15d71dab2` |
| Appointment Booked | `7a309bcf-6b76-4901-aaf2-d9b39fe28b10` |
| No-Showed | `b76a0454-f3f1-40b9-90b4-f977cf7e03d9` |
| Bad Fit | `fba1583e-385c-43ef-be6a-8f10394bf168` |
| Call Cancelled / Not Interested | `1ebc3719-a759-4199-a679-26ebb366566a` |
| Call Cancelled / Need To Reschedule | `7376dc2f-0731-49c9-bd20-25a01258fc5e` |
| Pending Sale | `3812deaf-b462-4299-a048-ba68c0e7b8e9` |
| Close Lost | `0a2c8dd0-1592-4fa7-b75d-e30c4528e726` |
| Close Won | `720dd586-4766-4bf4-bf9e-6c87dcb2e758` |

## Phase 1: Meta Ads → marketing-performance.json

Call the Meta Ads MCP for `ad_account_id=1185223312884959`, `level=ad_account`,
`fields=amount_spent,impressions,actions:link_click,lead`,
`time_range={"since":X,"until":Y}`, `time_increment=1`. Detect the range to
sync from the current `marketing-performance.json`'s last date through today
(default), or honor `--meta-days N`.

Parse each daily row (`amount_spent` strips `"A$"`/commas → float;
`impressions`/`actions:link_click`/`lead` → int), then merge into the `daily`
array by date (replace if the date exists, append otherwise, keep sorted).
Recompute `meta.totalDays`/`meta.totalSpend`/`meta.dataWindow`.

## Phase 2: GHL funnel snapshot → funnel-stages.json

For each of the 11 stage IDs above, call GHL MCP operation `search-opportunity`
(`pipelineId: "djiSwm3hJsW7Rv9tyqSl", pipelineStageId: <id>, limit: 1`) via
`execute_operation`. Read `data.meta.total` — that's the authoritative count
for that stage (matches the GHL UI exactly; the nested contact-filter version
of this query is unreliable, this direct opportunities-search endpoint isn't).
Batch all 11 in parallel.

Sort stages by count descending for `position` (0-indexed), compute
`winProbability = round(count / totalOpportunities * 100, 2)`. Overwrite the
file wholesale — it's a snapshot, not a history.

## Phase 3: Registrations → masterclass-registrations.json

Run `python3 sync/fetch_sheets.py registrations`. This pulls the sheet via
`https://docs.google.com/spreadsheets/d/<id>/gviz/tq?tqx=out:csv&sheet=X%20-%20AUTO`
(no auth needed, link-viewable), groups rows by `Webinar Date` (parsed as
`"Tue Sep 1"` + current year, same as the sheet's original Apps Script sync),
and counts `COUNT(DISTINCT Email Address)` per date.

**Merge onto the existing committed file** — read the current
`masterclass-registrations.json`, index by date, overlay the fresh pull's
dates on top (fresh wins for dates it has), keep every date the fresh pull
doesn't have. This is necessary because the sheet's `X - AUTO` tab only
retains recent webinar dates — it rotates/prunes older rows, so a wholesale
overwrite would silently lose history that BigQuery used to durably
accumulate. The committed JSON file is now that durable store.

## Phase 4: Attendance → masterclass-attendance.json

For each date from Phase 3, format the GHL tag as
`accelerator masterclass - attended {day}/{month}` (no leading zeros, e.g.
`15/9` not `15/09`) and call GHL MCP `search-contacts-advanced` with
`filters: [{"field": "tags", "operator": "contains_set", "value": [tag]}], pageLimit: 1`.
Read `data.total`.

**Verify the tag prefix before trusting a zero.** This scheme has changed at
least once before (`masterclass - registered D/M` → `accelerator masterclass -
registered D/M`). If a date that should have attendees comes back 0, pull one
live opportunity for that date's registered stage and check its `contact.tags`
array for the actual current attendance-tag spelling before concluding it's
really zero.

Same merge-onto-existing rule as Phase 3.

## Phase 5: Revenue + attribution → cash-attribution.json

Run `python3 sync/fetch_sheets.py transactions` — pulls `CONSOLIDATED` via CSV
export, parses `Date`/`Name`/`Email`/`Product`/`Amount`/`Closer`/`Mode`, and
reads **`Attribution`** (added to the sheet 2026-09-15 — `PAID`/`ORGANIC`)
directly as the row's source. No GHL lookup, no cache, no closer-assigned
filter — every row with a valid date/amount/email/attribution counts,
per the "PROPER MAPPING/WIRING of DATA SOURCE" spec doc.

Overwrite `cash-attribution.json` wholesale from the fresh pull each sync:
group by date for `dailyBreakdown` (sum `cashFromAds`/`cashFromOrganic`), by
`YYYY-MM` for `monthlySummary`, keep `transactions` as the full parsed list.

## Phase 6: Composite → marketing-data.json

Rebuild from the four files above:

```python
{
  "meta": {...},
  "funnelSnapshot": {"generatedAt": ..., "stages": [{"stage": s["name"], "count": s["count"]} for s in funnel_stages]},
  "masterclassRuns": [...],  # date/label/registered from registrations + attended from attendance
  "adSpendDaily": marketing_performance["daily"],
  "cashAttributionDaily": cash_attribution["dailyBreakdown"],
  "oneOffEvents": [],
}
```

## Phase 7: Deploy — copy data into docs/, commit, push

GitHub Pages serves this repo from `docs/` (branch `main`, path `/docs`), which
is the **built** output of `dashboard/`, not the source. A routine data-only
sync doesn't need a rebuild — just copy the fresh JSON into `docs/data/` too:

```bash
cd /Users/jayvee/Documents/ds-work/fa-masterclass-live-dashboard
cp dashboard/public/data/*.json docs/data/
git add dashboard/public/data/*.json docs/data/*.json
git commit -m "Sync masterclass data through <date>"
git push origin main
```

Only rerun `cd dashboard && npm run build && rm -rf ../docs && cp -r dist ../docs`
(then re-add `.nojekyll`) when frontend **code** changed, not for a plain
data sync.

Skip the push if `--no-push`.

## History

- **2026-09-14, first sync**: `cash-attribution.json` was initially bootstrapped
  from `au-fa-dashboard`'s already-classified BigQuery-era data (GHL
  `attributionSource` lookups, cached in a now-deleted `sync/attribution_cache.json`),
  because the CONSOLIDATED sheet had no attribution of its own yet.
- **2026-09-15**: the sheet gained its own `Attribution` column, and the
  "PROPER MAPPING/WIRING of DATA SOURCE" spec doc confirmed the Cash
  Attribution section should sync straight from it. Phase 5 above was
  rewritten accordingly — the GHL cross-reference and the cache file are
  gone, `cash-attribution.json` is now rebuilt wholesale from the sheet every
  sync, no closer filter. Also fixed on the same date: all period math
  (Weekly/Monthly/Custom) now resolves "today" against Sydney's calendar via
  `sydneyTodayISO()` instead of the viewer's browser timezone, and all
  date-range filtering compares plain date strings instead of Date-object/UTC
  arithmetic (`src/utils/dateRanges.ts`, `src/components/PeriodPicker.tsx`,
  `src/pages/MarketingPage.tsx`). Checked whether Meta had a Jan 1–12, 2026
  gap (the spec doc asks for data from Jan 1) — confirmed via a direct Meta
  MCP pull that the account's first active day is genuinely Jan 13, 2026;
  there's no gap to backfill.
