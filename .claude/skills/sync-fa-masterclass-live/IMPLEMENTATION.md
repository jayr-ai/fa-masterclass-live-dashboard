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

## Phase 3: Registrations, Attendance, Application (Webinar Tracker sheet)

All three are one pass over the same sheet
(`https://docs.google.com/spreadsheets/d/<id>/gviz/tq?tqx=out:csv&sheet=X%20-%20AUTO`,
no auth, link-viewable — see `_webinar_metrics_by_date()` in `fetch_sheets.py`),
grouped by `Webinar Date` (Column F, parsed as `"Tue Sep 1"` + current year),
each counted as **unique emails** (Column C) per date:

- **Registered** → `masterclass-registrations.json`: every row for that date.
- **Attended** (Column N, "Attended Webinar") → `masterclass-attendance.json`:
  rows where that column is non-empty (any checkmark glyph counts — don't
  match on the exact character). Replaced the old GHL-tag mechanism
  (`accelerator masterclass - attended D/M`) on 2026-09-15 per the spec doc —
  confirmed the two methods disagree (Sep 1: sheet says 31, GHL tags said 36),
  sheet is now the source of truth.
- **Application** (Column I "Call Booked Event" contains "application"
  case-insensitive, AND Column M "Booking Status" == `BOOKED`) →
  `masterclass-applications.json` (new file, shape `{meta, applications:
  [{date, applications}]}` — the frontend already expected this file and
  silently defaulted to 0 everywhere when it was missing).

Run via `python3 sync/fetch_sheets.py registrations` / `attendance` /
`applications`.

**Merge onto the existing committed files** for all three — read the current
JSON, index by date, overlay the fresh pull's dates on top (fresh wins),
keep any date the fresh pull doesn't have. This used to be justified as
"the sheet prunes old batches" — that was **wrong**, disproven by checking:
the sheet holds full history back to the earliest tracked run (30+ dates,
Apr 2026 onward). The real reason to keep merging is the gviz truncation
risk noted at the top of SKILL.md — a bad short read should never be allowed
to wipe out good committed history.

## Phase 4: Revenue + attribution → cash-attribution.json

Run `python3 sync/fetch_sheets.py transactions` — pulls `CONSOLIDATED` via CSV
export, parses `Date`/`Name`/`Email`/`Product`/`Amount`/`Closer`/`Mode`, and
reads **`Attribution`** (added to the sheet 2026-09-15 — `PAID`/`ORGANIC`)
directly as the row's source. No GHL lookup, no cache, no closer-assigned
filter — every row with a valid date/amount/email/attribution counts,
per the "PROPER MAPPING/WIRING of DATA SOURCE" spec doc.

Overwrite `cash-attribution.json` wholesale from the fresh pull each sync:
group by date for `dailyBreakdown` (sum `cashFromAds`/`cashFromOrganic`), by
`YYYY-MM` for `monthlySummary`, keep `transactions` as the full parsed list.

## Phase 5: Composite → marketing-data.json

Rebuild from the files above (`masterclass-applications.json` is fetched
separately by the page and does NOT feed into this composite):

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

## Phase 6: Deploy — copy data into docs/, commit, push

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
- **2026-09-15, MASTERCLASS tab spec doc**: verified the Ad Spend windowing
  logic against the doc's worked example (08 Sep 2026 → window 02–08 Sep,
  $9,402.68) — the dollar figure was already correct, but found and fixed a
  real bug: the Executive Summary sentence displayed the *revenue* window's
  dates ("8 Sep–14 Sep") as if they were the ad-spend window's dates, even
  though the numbers in that sentence were correctly computed from the real
  02–08 Sep ad-spend window. Root cause: `computeWindowedPerformance()` in
  `liveData.ts` returned the revenue window's start/end under
  `windowStart`/`windowEnd`, which `MasterclassPage.tsx`'s executive-summary
  text then displayed as the ad-spend window. Fixed by returning the actual
  ad-spend window's own dates there instead (also explains the previously-odd
  "15 Sep–30 Dec" label on the most recent run — the revenue window has no
  next run to bound it, so it defaulted to a sentinel far-future date).
  Also per the spec doc: Attended switched from GHL tags to the sheet's own
  Column N (see Phase 3), Application is a new card/file (Column I+M), and
  "Revenue (This Run's Registrants)" was renamed to "Revenue Collected For
  This Run". The GHL funnel snapshot section ("Registration → Attendance,
  live snapshot") is explicitly deferred per the doc — left untouched.
