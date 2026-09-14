# Freedom Academy Marketing Dashboard — Phase 2 (partial live data)

> **Status update**: Masterclass and Marketing pages are now fully live —
> Meta Ads, GHL funnel/attendance, and both Google Sheets are pulled directly
> into `public/data/*.json` on every `/sync-fa-masterclass-live` run (see the
> repo root `README.md`). Granular View's Ad Spend row is live too; its
> Charlie/Dialer/Outbound Bookings rows are still the Phase 1 mock data
> described below (that page is hidden from nav for now). Everything past
> this note describes the original Phase 1/2 build history — kept for
> context on what's mock vs. real and why.

A standalone React/Vite dashboard replacing the Data Studio "Marketing Dashboard" /
"Sales Dashboard" / "Masterclass Webinar" tabs. Phase 1 was UI-first with mock
data only. **Phase 2 has since wired in real data where it was cleanly
reachable** — GoHighLevel Masterclass registered/attended counts and Meta Ads
daily spend — via a one-time live backfill, not yet an automated refresh. Most
figures (cash amounts, funnel stages past registered/attended, the
Charlie/Dialer/Outbound Bookings rows) are still Phase 1 mock. See "Phase 2"
below for exactly what's real, what's mock, and why.

## Running it locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173` (or the next free port). Four routes:

- `/revenue` — Revenue Dashboard
- `/masterclass` — Masterclass Dashboard (per-run funnel + revenue, date selector)
- `/marketing` — Marketing Dashboard
- `/granular-view` — Granular View (Monthly Breakdown + Weekly Breakdown funnel detail tables)

`npm run build` type-checks and produces a production build; `npm run preview`
serves that build locally.

## Where the mock data lives

Everything both pages render comes from **[`src/data/mockDashboardData.ts`](src/data/mockDashboardData.ts)**,
typed by **[`src/types/dashboard.ts`](src/types/dashboard.ts)**. Every number in
that file was read directly off 3 Data Studio screenshots supplied in the build
prompt — none of it has been checked against GoHighLevel, Meta, or the
`CONSOLIDATED` sales sheet. Treat it as placeholder shape/example data only.

## Nav structure — confirmed

Four tabs, evolved twice from the original build prompt. The prompt proposed
Revenue & Masterclass merged into one page with a run-selector (default "All
Time" aggregate view; pick a Masterclass date to see that single run's funnel
+ revenue) plus Marketing as its own page — confirmed with JV before building
rather than assumed. **Granular View** was added after the fact (JV pasted a
screenshot of the actual "FA | Marketing Funnel Dashboard" Google Sheet and
asked for the same weekly-growing table format), then renamed from its
original working name "Weekly Breakdown" once JV asked for a Monthly
Breakdown table to sit above it on the same page. Later, once Phase 2 gave
the Masterclass side of the page real data worth navigating to on its own,
JV asked to **split Revenue and Masterclass into separate tabs** — the
"All Time" toggle is gone; `/revenue` is always the aggregate view and
`/masterclass` is always a specific run (default the fully-populated 15 Apr
2026 mock example, or pick any other date including the 6 live ones).

## Assumptions & placeholders (read before reconciling against real data)

**Design**
- The initial pass guessed a dark-navy/orange palette with no brand source to
  check against. JV pointed out Freedom Academy doesn't actually use that
  orange and asked to match the live
  [`/sales-dashboard`](https://freedomacademy.azdigitalph.com/sales-dashboard/)
  report instead — its real brand colors were pulled directly from that page's
  CSS custom properties (`--plane`, `--surface`, `--accent`, `--neon`,
  `--critical`, etc.) rather than eyeballed, and `--color-fa-*` in
  [`src/index.css`](src/index.css) now mirrors them exactly:
  dark green base (`#0f1710` page / `#172114` card surface / `#1c2a24`
  raised), a pale-mint accent (`#b9dacd`) for active states and positive
  deltas, a lime highlight (`#c6f24e`) for the executive-summary indicator dot
  and hero numbers, and the same red (`#f87171`) for negative deltas — no
  orange anywhere.
- Chart data-mark colors (the donut and bar charts) stay a **separate**
  categorical palette from the `--color-fa-*` UI chrome tokens — decoration and
  data-encoding colors serve different jobs. Re-validated for colorblind-safety
  and contrast against the new `#172114` chart surface using the dataviz
  skill's palette validator (all checks still pass; see
  [`src/utils/chartPalette.ts`](src/utils/chartPalette.ts)).
- Currency formatting assumes **AUD** throughout (`Intl.NumberFormat('en-AU', currency: 'AUD')`).
  Per the build prompt this is unconfirmed — flagged in Section 6 as needing
  verification if any spend is actually in USD.

**Currency**
- All `$` figures assumed AUD (Shane Da Costa AU Meta account, AU-based
  sheet/GHL location). Not yet confirmed — see build prompt Section 6.

**Data fidelity (Section 5.1 — Revenue rollup)**
- `Cash From Ads` ($116,672) is labeled 22.9% and `Cash From Organic`
  ($34,485) is labeled 77.1% in the source screenshot — note the labeled
  percentages don't match the dollar-amount ratio (Ads is the larger dollar
  figure but the smaller percentage). The donut chart's slice sizes are driven
  by the **labeled percentages**, not the raw dollar amounts, to stay visually
  consistent with what the source screenshot actually showed. Worth reconciling
  which number (or which total) is correct before this goes live.
- `Last 30 Days Cash Received` daily bar chart: Mar 15, Mar 21, Mar 28–30 fell
  inside the Mar 08–Apr 04 range shown but weren't legible/listed in the
  screenshot crop. Rather than assume $0, these are flagged
  `notCaptured: true` in the mock data and rendered as empty dashed bars.
  Mar 24 and Mar 27 were partially obscured — approximate round numbers
  ($21,500 / $22,000) are used and flagged `approximate: true` (dashed
  outline in the chart).
- `Monthly Cash Received`: only one bar was visible in the screenshot crop
  ($138.6k). **Assumption**: mapped it to March 2026, since it roughly matches
  the sum of the daily figures above. Jan/Feb/Apr 2026 are padded with $0
  (not invented nonzero history) per the build prompt's explicit instruction.

**Masterclass runs (Section 5.2)**
- Only the **15 Apr 2026** run has real (screenshot-sourced) numbers.
- The date-selector dropdown includes several other mock weekly-Friday dates
  (17 Apr, 10 Apr, 03 Apr, 27 Mar, 20 Mar, 13 Mar, 06 Mar, 27 Feb, 20 Feb 2026)
  purely so the selector UI has something to select — per the build prompt,
  real batch-date logic is unresolved and comes in Phase 2. These other runs
  render with all-zero/empty stats rather than invented plausible numbers.
- **Registration → Attendance funnel**: stage names and order are the real,
  confirmed GoHighLevel Masterclass Pipeline stages (`djiSwm3hJsW7Rv9tyqSl`).
  Per-stage counts were cut off in the screenshot and are left as explicit
  `null` → rendered as a visible "TODO: confirm exact count" placeholder bar,
  not a guessed number.

**Marketing Dashboard (Section 5.3)**
- `Sale`, `Net Profit`, and `ROAS` values were cut off in the source
  screenshot — rendered as "TODO: confirm" text, not invented numbers.
- `Cash Received (From Ads)`, `Cash Received (Organic)`, and `Total Ad Spend`
  are rendered as an explicit **dashed "No data" empty state**, matching the
  source's literal "No data" label — this is the core problem the rebuild
  exists to solve, so it's intentionally the most visually distinct state in
  the whole UI rather than a quiet `$0`.
- The date/period picker (`src/components/PeriodPicker.tsx`) follows the same
  Weekly / Monthly / Custom pattern as the existing
  [`/sales-dashboard`](https://freedomacademy.azdigitalph.com/sales-dashboard/)
  report, per JV's explicit request after seeing the first pass (replaced an
  earlier Day/Week/Month/Quarter/Year switcher): a segmented control, a
  prev/next-arrowed dropdown listing weeks (`W33 · Aug 10 → 16 2026`, ISO week
  numbers, **Monday–Sunday**) or months (`Aug 2026`) for those two modes, and
  plain From/To date inputs for Custom. It still just re-renders the same mock
  KPI shape regardless of the selected period — see `// TODO: wire to a real
  period-aware query once the data layer exists` in
  [`src/pages/MarketingPage.tsx`](src/pages/MarketingPage.tsx). The generated
  week/month list spans Jan 2025–Dec 2026 and defaults to whatever period
  contains today's date; because Phase 1 has no concept yet of "which periods
  actually have data," every period in that range is selectable, unlike the
  reference report (which only lists weeks/months with real rows).

**Granular View (new — added after JV shared the source sheet screenshot)**
- Two stacked tables, Monthly Breakdown above Weekly Breakdown, sharing one
  component (`src/components/BreakdownTable.tsx`) and one row-group legend.
  Both have sticky Metric + YTD columns, then one column per period,
  row-grouped and color-tinted the same way as the sheet (Ad Spend,
  Charlie/AI Dialer Bookings, Dialer Leads, Outbound Bookings, All Other
  Bookings, Overall Bookings, Calls, Sales, Cost Efficiency). See
  [`src/data/mockWeeklyBreakdown.ts`](src/data/mockWeeklyBreakdown.ts).
- **Weekly Breakdown** is transcribed from a screenshot of the "FA |
  Marketing Funnel Dashboard" → "2026 FB Ads Dashboard" tab. Only
  **WK29–WK33 (13 Jul – 16 Aug 2026)** were fully legible in the crop and have
  real numbers. The partially-cut-off WK28 column is omitted entirely rather
  than guessed at (same rule as the Revenue page's daily chart). Weeks before
  WK29 feed the real YTD total but weren't visible, and weeks after WK33 are
  genuinely not yet reported — both render as "—", same as the source sheet
  shows them, so there's no visual distinction between "not captured" and
  "hasn't happened yet."
- **Monthly Breakdown is not a second source of truth** — there is no
  monthly screenshot. It's a naive rollup of the weekly rows (`monthlyRows` in
  `mockWeeklyBreakdown.ts`): each week is bucketed into the month its Monday
  falls in (so WK31, Jul 27 – Aug 2, counts entirely as July), then
  number/currency rows are summed and percent rows are averaged across the
  weeks in that month. That's a real but crude rollup rule — a correct
  weighted average (e.g. percent-of-total rather than average-of-averages)
  needs the real per-week denominators, which only exist in the source sheet.
  Treat Monthly Breakdown as an illustration of the table shape, not a number
  to quote.
- The sheet's hidden/collapsed row groups (rows 5–9 under Ad Spend, rows
  17–20 under Dialer Pickup Rate — indicated by "+" outline controls in
  Sheets) were never visible in the screenshot, so their contents are unknown
  and are **not** reproduced here — only the rows actually visible in the crop
  are included.
- **Independent of the Marketing page's Weekly/Monthly/Custom period
  picker**, per JV's explicit instruction — both tables always show the full
  year, exactly like the source sheet tab.
- **Capped at 50 columns each** per JV's request (`WEEK_COLUMN_CAP` /
  `MONTH_COLUMN_CAP` in `mockWeeklyBreakdown.ts`) — moot for the 12-column
  Monthly table but matters once the Weekly table's underlying year range
  grows.
- Row-group colors are a dark-surface-friendly stand-in (the app's existing
  chart palette at low opacity) for the source sheet's pastel row colors,
  which were designed for a white sheet background and wouldn't read the same
  way here.
- **Bug found and fixed while building this**: `dateRanges.ts`'s week/month
  key generation used `Date.toISOString()`, which converts through UTC — on
  any machine east of UTC (e.g. Philippines, UTC+8), a local Monday midnight
  shifts back to the *previous* day once converted, silently producing the
  wrong ISO key. This only surfaced once the Weekly Breakdown's mock values
  had to match hardcoded date-string keys exactly; the existing Marketing-page
  period picker happened to only ever compare keys generated by the same
  (equally-shifted) function against each other, so the bug was invisible
  until now. Fixed by building the date string from local
  `getFullYear()/getMonth()/getDate()` instead of `toISOString()`.
- **Trend charts**: each table has an Ad Spend vs. Cash Collected area/line
  chart above it (`src/components/TrendLineChart.tsx`), sharing one Y axis
  (both are dollar figures) with a gradient fill, hover crosshair, and a
  combined tooltip showing both series at that period. Both charts only plot
  periods where at least one series has a real value — with the mock data
  that's 2 months / 5 weeks, so a full 12- or 50-column axis would be almost
  entirely empty space rather than a readable trend. Each series draws its own
  gaps independently when data is missing for just that series (e.g. Cash
  Collected has no WK33 figure, so its line stops at WK32 while Ad Spend's
  continues) — gaps are never interpolated or invented. Line colors match
  each metric's row-tint in the table below it (Ad Spend orange, Cash
  Collected violet) for visual continuity between chart and table.

## Component structure

Reusable, data-source-agnostic pieces in [`src/components/`](src/components/):
`StatCard` (default / hero / no-data variants), `DonutChart`, `BarChartPanel`
(vertical time-series or horizontal comparison), `ExecutiveSummary`,
`FunnelStages`, `PeriodPicker`, `RunSelector`, `MiniFunnelBar`,
`BreakdownTable` (generic — takes any column list, used for both Weekly and
Monthly Breakdown), `TrendLineChart` (generic — takes any column list + series
keys, used for both trend charts), `NavShell`. Pages (`src/pages/RevenuePage.tsx`,
`src/pages/MasterclassPage.tsx`, `src/pages/MarketingPage.tsx`, `src/pages/GranularViewPage.tsx`) only
assemble these from the mock data modules (`mockDashboardData.ts`,
`mockWeeklyBreakdown.ts`) — swapping in real data later is a data-source
change (replace the mock module with real queries/hooks returning the same
`src/types/dashboard.ts` / `BreakdownRow` shapes), not a UI rewrite.

## Phase 2 — what's real, what's mock, and why

### The 5 original blockers

1. **Masterclass batch-tag scheme — resolved.** Pulled the location's full
   tag list and dated every Masterclass tag variant found. Chronologically:
   `new masterclass D/M` (Mar–Apr 2026, dead) →
   `fdr masterclass YYYYMMDD participants` (Feb–May 2026, dead) →
   `fdr masterclass - registered D/M` (Apr–May 2026, dead) →
   **`masterclass - registered D/M`** / **`masterclass - attended D/M`**
   (no "fdr" prefix, May 2026–present — a tag exists for 18/8, six days after
   today, so this is still being actively created). This is the scheme the
   live backfill below uses.
2. **Paid vs. organic attribution — resolved, refined.** Sampled 17 real
   contacts across several recent Masterclass batches. **`attributionSource.
   utmMedium` of `"paid"` or `"paid_social"`** is the reliable signal —
   present on every contact that came through a tracked Facebook/Instagram ad
   (`fbclid` present), absent on contacts with `sessionSource: "Direct
   traffic"` or an untagged social referral. `sessionSource` alone is **not**
   enough — organic social clicks also read `"Social media"`. Across the
   sample, ~65% (11/17) were paid — directional, not a census; **not** used to
   fabricate a dollar split anywhere in the app (Cash From Ads/Organic still
   correctly shows "No data").
3. **`CONSOLIDATED` sheet columns — resolved.** Ten columns: `Date`, `Name`,
   `Email`, `Product`, `Amount`, `Closer`, `Mode`, `Cash Category`, `Closer
   Checker`, `Payment Occurence`. Five sibling tabs — `Stripe`, `EFT`,
   `Finance`, `StripeFailed`, `REF` — suggest `CONSOLIDATED` aggregates
   across payment-mode-specific source tabs. **Row-level data was not
   reachable this session** — the browser tool blocked both the `/export`
   and `/gviz` CSV endpoints (navigation denied), and manually scrolling/
   screenshotting hundreds of rows wasn't practical. A real Sheets API
   credential (the way the existing `FA_Revenue_Apps_Script.gs` pipeline does
   it) is the correct fix, not browser scraping.
4. **BigQuery schema — done.** Four new tables live in
   `jv-data-warehouse.freedom_academy_au`: `marketing_masterclass_runs`,
   `marketing_funnel_stages` (created, not yet populated — see below),
   `marketing_ad_spend_daily`, `marketing_cash_attribution` (created, empty —
   needs the Sheets access above). `marketing_*` prefix confirmed
   non-colliding with the existing `agent_list` / `current_data` / `v2_*` /
   `revenue_*` sales-agent tables.
5. **Reconciliation — partially done.** See the backfill below; BigQuery
   totals were spot-checked against the GHL/Meta calls used to produce them
   and matched exactly (920 registered / 201 attended across 6 runs;
   $35,934.16 total ad spend across 31 days).

### What's actually live in the app right now

A **one-time backfill**, not an automated refresh — see
`public/data/marketing-data.json` (`meta.generatedAt`) for when it was
pulled. `src/data/liveData.ts` fetches it at runtime and every page falls
back to the Phase 1 mock data if the fetch fails or the selected period falls
outside the live window.

- **Masterclass Dashboard**: **14 real Masterclass runs** (26 May – 18 Aug
  2026, all on the current reliable tag scheme) appear in the date selector
  labeled "(live)" with real `registered`/`attended`/show-up-rate/
  **Application**/**VIP Upgrade**/**Attend.-to-App %** — e.g. 11 Aug 2026
  shows 227 registered, 44 attended, 15 applications, 34.09% attend-to-app,
  all verified against BigQuery. Application comes from a
  `masterclass - booked application call` tag + that run's registered tag
  (a clean compound filter, cheap to query). Originally only the 6 most
  recent runs were backfilled (16 Jul onward); extended 2026-08-13 after
  discovering the same reliable tag scheme actually reaches back to 26 May
  — 8 more runs, pulled the identical way. One is worth flagging: **24 Jun
  2026 had 6 registrants and 0 attended** — looks like a near-cancelled or
  rescheduled session, not a data error (confirmed the tag counts are
  real). Its $11,000 in "revenue" is actually a duplicate: the same buyer
  (Bruce Notman) is tagged registered for both 24 Jun and 28 Jul, and his
  real purchase on 31 Jul counts toward both runs' totals — the first
  observed instance of the "registered tags persist across
  re-registrations" caveat that was previously only theoretical. Left
  as-is rather than guessing which run deserves credit, but **don't sum
  revenue across all 14 runs expecting a clean total** — this $11,000 is
  double-counted. Nothing exists before 25 Feb 2026 in GHL's tag data at
  all (checked the full location tag list), so there's no way to reach
  back to January 2026; 25 Feb – 21 May 2026 uses three different,
  deprecated tag schemes not yet verified to have the same reliable
  attended-tag pattern — left out rather than assumed safe (see
  `notFilled`).
  VIP Upgrade was originally sourced from the `fdr masterclass - vip upgrade`
  tag, but JV asked for the VIP Upgrade and Cash From VIP scorecards to be
  removed from this page entirely (numbers were too small/legacy-tagged to
  be meaningful) — they no longer render, though the underlying data still
  flows through `marketing-data.json` unused.
  A **per-run** 11-stage funnel breakdown stays TODO — not fabricated,
  genuinely not achievable cheaply this pass: GHL's contact-search API has no
  compound tag+pipeline-stage filter (tested — `opportunities.pipelineStageId`
  as a nested filter field is silently ignored, returning 0 even for a stage
  known to have hundreds of matches), and bulk-fetching every registrant's
  full contact record to tally stages client-side would mean pulling 500+
  heavy payloads per run — impractical for a single conversation's context
  budget. This is exactly the kind of aggregation Apps Script (no
  context-window limit, can paginate freely) is built for — another point in
  favor of the automated-refresh follow-up below rather than solving it via
  more live tool calls.
  **Revenue, Deals Closed, Cash From Ads, and Cash From Organic are now real**,
  though — solved without needing the CONSOLIDATED sheet API access that
  blocked them originally. `jv-data-warehouse.freedom_academy_au.
  revenue_transactions` turned out to already exist and already be synced
  from that same sheet (it's what backs the separate FA Revenue Dashboard —
  698 rows, $795,669.01 total, Nov 2025–Aug 2026). For each run: pulled that
  run's registered-contact emails from GHL, joined by email against
  `revenue_transactions`, filtered per JV's rule to only rows where
  **product is `Accelerator` or `Foundation`** (the products Masterclass
  actually contributes — no `Foundation` rows exist yet, the filter's ready
  for when they do) **and a closer is assigned** (unassigned rows are
  excluded — 218 of 698 transactions / $684,489.01 pass this filter),
  restricted further to transactions dated on/after the run date. That date
  guard matters — without it, a matched buyer's *pre-existing* purchase
  (from before they ever registered for a Masterclass) would get
  misattributed to a run that didn't generate it. Cash From Ads vs Organic
  reuses the same `attributionSource.utmMedium` signal as everything else
  here. **Result under this filter: only 28 Jul 2026 has real matched
  revenue** — $11,000 from 2 deals, both the same registrant (Bruce Notman,
  a $6,000 and a $5,000 purchase 3 days after the run). The other 5 runs are
  genuinely $0: the $97 figures that briefly showed on 4 Aug/11 Aug before
  this filter were "3D HT Closer Challenge" purchases — a real product, just
  not Accelerator/Foundation, so JV's rule correctly excludes them.
  **Caveats**: (1) registered tags persist across re-registrations, so a
  contact registered for two different runs would have matching revenue
  counted toward both — none observed this pull, but structurally possible,
  same class of issue as the VIP Upgrade caveat above; (2) most revenue
  (~$658K of the $684K that passes the product filter) doesn't match any of
  the 6 tracked runs at all. JV asked specifically where three Aug 7–11
  examples were being attributed (alexanderlynne12@gmail.com,
  finc82@hotmail.com, bennyam4646@gmail.com) — checked each by hand in GHL:
  **all three came through a separate, currently-untracked Masterclass
  funnel** ("Crypto Collective X FA Masterclass," tagged
  `crypto fa masterclass - registered`/`attended` rather than the per-date
  `masterclass - registered D/M` scheme the 6 tracked runs use). This
  dashboard doesn't represent that funnel at all right now — a real gap, not
  a join bug, and worth a separate decision on whether to add it; (3)
  revenue is naturally low per run relative to registrant volume since this
  is a front-end webinar feeding a back-end sales process that plays out
  over weeks, not same-day. See `meta.revenueDataNote` in
  `marketing-data.json` for the full writeup.
  The **Registration → Attendance funnel table itself is now real**, though:
  JV asked for a current, always-on view instead of waiting on the per-run
  breakdown, and it turns out GHL has a *separate*, working endpoint for
  this — `/opportunities/search` (operation `search-opportunity`), which
  takes `pipelineId`+`pipelineStageId` as direct query params rather than as
  a nested contact filter, and isn't affected by the bug above. Queried once
  per stage (`limit: 1, status: all`, reading `meta.total`) for all 11
  stages of the Masterclass Pipeline. This is a **live, all-time,
  all-runs-combined snapshot** — e.g. 4,424 currently in Registered, 71 in
  Close Won — stored in `marketing-data.json`'s `funnelSnapshot` key and
  rendered once at the bottom of the Masterclass Dashboard page,
  independent of the date selector (it does not vary per run, by design —
  there's still no way to split it per run, see above).
  **One-off collab events get their own collapsible section** below the
  funnel snapshot, separate from the recurring-run date selector. This
  started from JV asking where three Accelerator sales were being
  attributed (see the Revenue caveat above) — traced them to a "Crypto x FA
  Masterclass" collab that isn't part of the 6 tracked runs at all, and
  JV's manager confirmed one-off co-branded events like this are a
  recurring pattern worth tracking on their own, not folded into the
  weekly-run selector (they have no single "run date" to select — GHL tags
  them generically, e.g. `crypto fa masterclass - registered`/`attended`,
  with no per-date suffix, confirmed against the location's full tag list).
  Same computation as the tracked runs — GHL tag search for
  registered/attended counts, the same BigQuery `revenue_transactions` join
  for revenue/deals/cash split — just keyed to the event's tag instead of a
  run date, and with the date guard applied per-contact (each contact's own
  `dateAdded`) rather than a shared run date, since registrations trickle
  in over an open window rather than landing on one day. First entry:
  Crypto x FA Masterclass — 163 registered, 90 attended (55.21% show-up,
  notably higher than any tracked run), 6 deals closed for $26,033.33, all
  organic (none of its matched buyers show `utmMedium=paid` — this looks
  community/partner-driven rather than Meta-ads-driven, so no Ad
  Spend/ROAS is shown for it, a real absence rather than unfetched data).
  Stored in `marketing-data.json`'s `oneOffEvents` array (see
  `meta.oneOffEventsNote` for the full writeup) and rendered by
  `src/components/OneOffEvents.tsx`, collapsed by default since it's
  supplementary to the page's main story.
  **Also selectable from the date selector itself** — JV wanted it directly
  reachable, not just summarized in the collapsed section. Each one-off
  event gets converted to the same `MasterclassRun` shape as a dated run
  (`oneOffEventToMasterclassRun` in `MasterclassPage.tsx`) and pinned to a
  sentinel date (`9999-12-31-{index}`) so it always sorts to the top of the
  dropdown, labeled `{name} (one-off)` so it's never mistaken for a dated
  run. Selecting it renders the exact same full view as a real run —
  scorecards, executive summary, Marketing Performance (shows $0/N/A
  throughout, since there's no ad spend to report), and the Deals Closed
  detail table below. The collapsed section and the dropdown option show
  the same underlying data — the section is for scanning across every
  one-off event at a glance if there's ever more than one; the dropdown
  entry is for the full deep-dive.
  **Marketing Performance** (Ad Spend, Link Clicks, CTR%, Leads Generated,
  Cost Per Lead) is real and live for all 14 runs, computed client-side in
  `computeWindowedPerformance()` (`src/data/liveData.ts`) — not stored in
  BigQuery, recomputed on every load from `adSpendDaily`. There's no per-run
  ad campaign to attribute spend to: Meta runs one continuous evergreen
  campaign feeding every run, confirmed by inspecting the account's campaign
  list. The standard proxy for a recurring evergreen funnel is a
  **time-windowed attribution**: the days between the previous run and this
  run are summed and attributed to this run's registrant cohort (e.g. 11 Aug
  2026's window is 4–10 Aug, the 7 days before it). This is disclosed in the
  UI as a windowed proxy, not true ad-level attribution, via the section's
  source label and executive-summary bullets. `adSpendDaily` now covers
  26 May – 12 Aug 2026 (78 daily rows across a 79-day span — one gap,
  15 Jun, looks like a zero/paused-delivery day rather than a failed pull).
  **26 May 2026 (the earliest run) gets no windowed figures at all** —
  falls back to the same "no data" state mock runs use — since there's
  genuinely no prior day to window against; 18 Aug 2026 is marked
  **partial** (its window extends to 17 Aug, but the ad-spend data only
  reaches 12 Aug, so only 2 of that window's 7 days have data). **A second
  data gap**: Meta's leads metric returned "Not available" for 11 of the
  78 days (mostly 26 May–3 Jun, plus 9 and 12 Jun) — Ad Spend/Link
  Clicks/CTR are real and unaffected, but Leads Generated/Cost Per Lead
  show as 0/$0 for the three runs whose windows fall entirely inside that
  gap (28 May, 2 Jun, 4 Jun) — an honest reflection of unavailable data,
  not a claim that zero leads were generated. **ROAS is computed**
  (windowed ad spend ÷ this run's registrant revenue, from the join
  described above) wherever ad spend is nonzero — e.g. 28 Jul 2026 is
  1.37. Worth naming explicitly: this divides two numbers with different
  scopes (a time-windowed spend proxy vs. a registrant-cohort revenue
  figure), not a strict apples-to-apples ad-level ROAS — directionally
  useful, not exact.
- **Marketing Dashboard**: Impressions, Link Clicks, Leads, and Total Ad
  Spend go live automatically whenever the selected Weekly/Monthly/Custom
  period overlaps 13 Jul – 12 Aug 2026 (the default "this month" view does,
  today), shown with a "live Meta data (N days)" label. Cash Received (From
  Ads/Organic) correctly keeps its "No data" empty state — that number needs
  the CONSOLIDATED cross-reference, which isn't done yet.
- **Granular View**: only the **Ad Spend** row (weekly and monthly, plus its
  trend chart) was replaced with the real daily Meta pull, summed per week/
  month. Interesting cross-check: the live numbers for WK29–32 came out
  within a few dollars of the original Phase 1 mock (which was itself
  transcribed from a real screenshot) — two independent reads of the same
  real spend agreeing. WK33 is now higher than the old mock because the
  screenshot caught it mid-week; the live pull has all 3 available days.
  Every other row (Charlie/Dialer/Outbound Bookings, Cash Collected, etc.)
  is still Phase 1 mock — needs the separate "FA Marketing Funnel Dashboard"
  sheet (never shared, only a screenshot) and/or the CONSOLIDATED
  cross-reference.

### Still needed for full Phase 2

- **A real Google Sheets API credential** — the single biggest unlock left.
  Resolves the CONSOLIDATED cross-reference (Cash Collected, Cash From Ads/
  Organic dollar splits, per-run cash figures) in one shot.
- **Automated refresh** — everything above was pulled by live tool calls in
  one session, not a script JV can re-run. The existing pattern
  (`FA_Revenue_Apps_Script.gs`, time-driven Apps Script triggers) is the
  right model, but needs a GHL API key and Meta access token stored as
  Script Properties — secrets only JV can provision.
- **Full historical backfill** — this now covers 14 runs on the current
  reliable tag scheme (26 May – 18 Aug 2026). Earlier runs (roughly 25 Feb –
  21 May 2026) use three different, deprecated tag schemes and would need
  separate handling — unverified whether each has a matching "attended" tag
  in the same reliable pattern, left out rather than assumed safe. Nothing
  exists before 25 Feb 2026 at all (checked GHL's full tag list) — there's
  no way to reach January 2026.
- **Charlie/Dialer/Outbound Bookings** in Granular View — needs the "FA
  Marketing Funnel Dashboard" sheet URL.

Reference config confirmed real (safe to hardcode as labels, not as data):
GoHighLevel location `ZwP47P1XZZ8TSazVZMxc`; Masterclass Pipeline
`djiSwm3hJsW7Rv9tyqSl`; Meta Ads account `1185223312884959` (Shane Da Costa AU,
AUD, business "Miyagi 1"); sales-tracking spreadsheet id
`1LKIwjIpzn1jNSaIzzLAWLkkiODJUuKReKkw3QUT9c8A`, tab `CONSOLIDATED`; BigQuery
`jv-data-warehouse.freedom_academy_au.marketing_*`.
