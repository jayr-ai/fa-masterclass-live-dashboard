# Implementation Guide

Step-by-step for what Claude executes on `/sync-fa-masterclass-live`. Meta
calls are Claude tool calls made from inside the session — they can't be
scripted standalone. GHL and Google Sheets are both real, standalone
scripts now (`sync/fetch_ghl.py`, `sync/fetch_sheets.py`) since neither
needs a session-bound MCP connection — GHL uses a Private Integration Token
(env var), Sheets need no auth at all (link-viewable, gviz CSV export).

**Step 0, always, regardless of where this skill was invoked from**: this
skill is registered globally (`~/.claude/skills/`), so the shell's current
directory when `/sync-fa-masterclass-live` runs is not guaranteed to be the
project. Every `sync/fetch_*.py` command below is written as a relative
path — before running any of them:
```bash
cd /Users/jayvee/Documents/ds-work/fa-masterclass-live-dashboard
```

## Config (confirmed real, safe to hardcode)

- Meta ad account: `1185223312884959` (Shane Da Costa AU / Freedom Academy, AUD)
- GHL location: `ZwP47P1XZZ8TSazVZMxc`
- GHL Masterclass Pipeline: `djiSwm3hJsW7Rv9tyqSl`
- Registrations sheet: `1g4h0IHwz0_BZ90nslU7NNKwIsENJw9hzgbk3A52dcQo`, tab `X - AUTO`
- Revenue sheet: `1LKIwjIpzn1jNSaIzzLAWLkkiODJUuKReKkw3QUT9c8A`, tab `CONSOLIDATED`

**GHL PIT** (`FA_GHL_PIT`) lives in `sync/.env`, git-ignored — this repo is
public. Load it before calling `fetch_ghl.py`: `set -a; source sync/.env;
set +a`. Never print, log, or write the raw token value into any file that
gets committed, any code file, or any commit message.

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

**`amount_spent`'s shape is not stable** — confirmed 2026-09-23: most calls
return a formatted string (`"A$1,609.23 AUD"`), but the same field came
back on one call as `{"value": "1609.23", "unit": "AUD"}` instead, with no
change in how the tool was invoked. Parse defensively: if it's a dict, read
`.value`; if it's a string, strip non-numeric characters (`A$`, `AUD`,
commas) before casting to float. Don't assume the string format going
forward.

## Phase 2: GHL funnel snapshot → funnel-stages.json

Run `set -a; source sync/.env; set +a && python3 sync/fetch_ghl.py
funnel-stages`. Internally this hits `GET
https://services.leadconnectorhq.com/opportunities/search` once per stage
ID above, with `Authorization: Bearer $FA_GHL_PIT` + `Version: 2021-07-28`
headers. Read `meta.total` from each response — authoritative, matches the
GHL UI exactly (the nested contact-filter version of this query is
unreliable; this direct opportunities-search endpoint isn't).

**Two non-obvious things this API needs, found by testing rather than
guessing — don't "simplify" them back out:**
1. Query params must be **snake_case** (`location_id`, `pipeline_id`,
   `pipeline_stage_id`) — camelCase 422s with `"property pipelineId should
   not exist"`. This is the opposite convention from most other GHL v2
   endpoints (the GHL MCP tool used camelCase fine — that tool translates
   for you; direct REST calls don't get that translation).
2. `location_id` is **required** even though a PIT is already scoped to one
   location — omitting it 422s with `"location_id can't be undefined"`.
3. Cloudflare in front of the API blocks Python's default `urllib`
   user-agent outright (403, `browser_signature_banned`) even though the
   identical request via `curl` succeeds. `fetch_ghl.py` sets `User-Agent:
   curl/8.7.1` to work around this.

Sort stages by count descending for `position` (0-indexed), compute
`winProbability = round(count / totalOpportunities * 100, 2)`. Overwrite the
file wholesale — it's a snapshot, not a history.

**Reusing this for another client**: swap `LOCATION_ID`, `PIPELINE_ID`, and
`STAGE_IDS` in `fetch_ghl.py` (or parameterize if there end up being more
than a couple of clients) and point `FA_GHL_PIT` at that client's own PIT.
Nothing else about the auth mechanism changes.

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
Apr 2026 onward). The real reason to keep merging is defense-in-depth
against the Filter risk (see SKILL.md) — `fetch_csv_rows` should already
catch and refuse an actively-filtered read via `SuspiciousReadError`, but
merge-not-overwrite is a second layer: even a filtered pull that somehow
slips past the row-count check (e.g. baseline stale/deleted) would only
overwrite the dates it happened to see, never silently erase dates outside
its filtered view.

If `fetch_csv_rows` raises `SuspiciousReadError`: **stop, don't catch it and
merge anyway.** Tell the user the sheet looks like it has an active Filter
right now (name the exact numbers from the error) and ask them to clear it —
Data > Remove filter, or check for a highlighted filter icon in the toolbar
— then re-run `/sync-fa-masterclass-live`. Recommend Filter Views for future
ad-hoc filtering (Data > Filter views > Create new) — those are per-viewer
and don't affect this sync or anyone else looking at the sheet.

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

## Phase 6: Deploy — TWO separate targets, both required

There are **two independent deployments** of this dashboard, in two
different repos, and a sync is not done until both are updated. Confirmed
2026-09-17 after a user reported a stale revenue figure: this project's own
GitHub Pages (`jayr-ai.github.io/fa-masterclass-live-dashboard`) had the
fresh sync, but the actual production URL the user checks
(`datahub.freedomacademy.com.au/marketing-dashboard/`) was still serving
data from **two days earlier** — a separate repo (`au-fa-dashboard`) that
this skill's docs never mentioned deploying to. The same gap meant the
Email-column privacy fix (removed from "Deals Closed — Detail") had also
never reached production, even though it was pushed to this repo days
earlier.

**Target A — this repo's own `docs/`** (`jayr-ai.github.io/fa-masterclass-live-dashboard`):
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

**Target B — the real production domain**, `datahub.freedomacademy.com.au/marketing-dashboard/`,
served from the **separate** `au-fa-dashboard` repo's `marketing-dashboard/`
folder (a full built copy — `index.html` + `assets/` + `data/`, not a
symlink or submodule):
```bash
cd /Users/jayvee/Documents/ds-work/au-fa-dashboard
git fetch origin && git pull --ff-only origin main   # this repo hosts other clients' dashboards too — always sync first
cp /Users/jayvee/Documents/ds-work/fa-masterclass-live-dashboard/dashboard/public/data/*.json marketing-dashboard/data/
git add marketing-dashboard/data
git commit -m "Sync marketing-dashboard data through <date>"
git push origin main
```
If frontend **code** changed since the last time Target B was updated (check
by comparing the JS bundle filename in `marketing-dashboard/assets/` against
`dashboard/dist/assets/` — different hash means different code), also copy
the full build, not just data:
```bash
rm -rf marketing-dashboard/assets
cp -r /Users/jayvee/Documents/ds-work/fa-masterclass-live-dashboard/dashboard/dist/* marketing-dashboard/
git add marketing-dashboard
```
`au-fa-dashboard` is a **shared repo** other automations push to (revenue
dashboard, sales dashboard, etc.) — always `git fetch`/`pull --ff-only`
before editing, and scope `git add` to `marketing-dashboard/` only.

Skip both pushes if `--no-push`. Verify Target B actually updated by
fetching its live `data/cash-attribution.json` (or whichever file changed)
and checking `meta.generatedAt` matches this run — don't assume the push
succeeded just because the command didn't error.

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
- **2026-09-15, same day, root cause of the gviz truncation confirmed**: the
  user identified that they/a teammate occasionally apply a regular Filter
  (not a Filter View) to the Webinar Tracker sheet, which hides rows from
  every reader including this sync — that's what the earlier 182-row read
  actually was, not a random network blip. Replaced the naive "retry 3x
  immediately, take the largest" mitigation with spaced retries (~8s apart,
  early-exiting once healthy) plus a persisted row-count baseline
  (`sync/row_count_baseline.json`, gitignored) that raises
  `SuspiciousReadError` if a read is still under 70% of the last known-good
  count — surfaces the problem loudly instead of silently merging an
  undercounted pull into committed history.
- **2026-09-15, same day, GHL funnel snapshot moved off MCP entirely**: the
  user works with multiple clients across different agency accounts, and
  the GHL MCP connector is bound to one agency at a time — not viable
  long-term. Added `sync/fetch_ghl.py`: direct REST calls to
  `services.leadconnectorhq.com` using a location-scoped Private
  Integration Token (`sync/.env`, git-ignored). Verified `meta.total`
  matched what GHL MCP was reporting moments earlier for the same stages
  (grew slightly between the two checks, consistent with live activity, not
  a discrepancy). Found two real API gotchas by testing rather than
  guessing — snake_case query params, and Cloudflare blocking the default
  Python user-agent — both documented in Phase 2. This was previously
  explicitly deferred by the spec doc; the user asked to do it now.
- **2026-09-17, discovered production was two dashboards behind**: user
  reported September revenue stuck at $48,407 despite a sync having just
  run. Traced to Phase 6 only ever having deployed to this repo's own
  `docs/` — the actual production URL,
  `datahub.freedomacademy.com.au/marketing-dashboard/`, is served from a
  completely separate repo (`au-fa-dashboard/marketing-dashboard/`) that had
  silently gone unsynced. Also found the Email-column privacy fix (removed
  from the "Deals Closed — Detail" table a day earlier) had never reached
  that production copy either, for the same reason. Rewrote Phase 6 as two
  explicit, both-required deploy targets.
