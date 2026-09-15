---
name: sync-fa-masterclass-live
description: Sync Freedom Academy Masterclass dashboard data directly from Meta MCP, GHL MCP, and Google Sheets to JSON — no BigQuery, no Apps Script
---

# Sync FA Masterclass Live Dashboard

Pulls Meta Ads, GHL pipeline/attendance, and the two Google Sheets straight into
`dashboard/public/data/*.json`. This is the no-BigQuery replacement for
`au-fa-dashboard`'s `/sync-fa-marketing-data`: same data sources, same GHL
pipeline/stage IDs, same Meta ad account — but every step writes the final
JSON directly instead of upserting to a warehouse table first.

**All period math (Weekly/Monthly/Custom on the Marketing page) is anchored
to Sydney's calendar date, not the viewer's browser timezone** —
`src/utils/dateRanges.ts`'s `sydneyTodayISO()` — and all data filtering
compares plain `YYYY-MM-DD` strings, never Date-object/UTC arithmetic. Keep
any future date-range code in that same string-comparison style; it's the
one thing that has caused real bugs in this user's other dashboards.

**The gviz CSV endpoint (`fetch_csv_rows` in `sync/fetch_sheets.py`) has been
observed to occasionally return a truncated read** — once saw 182 rows for
the Webinar Tracker instead of its real ~4,500, gone on the very next
request with no change on either end. `fetch_csv_rows` now fetches up to 3
times and keeps the largest result as a mitigation. If a sync ever produces
suspiciously low registered/attended/application counts across many dates
at once, re-run it before trusting the numbers — it's more likely a bad read
than a real drop.

## Usage

```bash
/sync-fa-masterclass-live
```

Options:

```bash
/sync-fa-masterclass-live --meta-days 7      # Only refresh the last 7 days of Meta data
/sync-fa-masterclass-live --ghl-only         # Skip Meta, refresh only GHL (funnel + attendance)
/sync-fa-masterclass-live --no-push          # Update local JSON, skip git commit/push
```

## What it does

1. **Meta Ads** (`act_1185223312884959`) — pull daily spend/impressions/link
   clicks/leads via Meta MCP (`time_increment=1`), merge into
   `marketing-performance.json`'s `daily` array by date (upsert, no dupes).
2. **GHL Masterclass Pipeline** (`djiSwm3hJsW7Rv9tyqSl`) — 11 `search-opportunity`
   calls, one per stage ID (see IMPLEMENTATION.md), `meta.total` is the count.
   Overwrites `funnel-stages.json` — it's a point-in-time snapshot, not a
   history, so there's nothing to merge.
3. **Registrations, Attendance, Application** — all three come from the same
   one pass over the Webinar Tracker sheet (`1g4h0IHwz0_BZ90nslU7NNKwIsENJw9hzgbk3A52dcQo`,
   tab `X - AUTO`), grouped by Webinar Date (Column F), each counted as
   **unique emails** (Column C) per date:
   - **Registered**: every row for that date.
   - **Attended** (Column N, "Attended Webinar"): rows with a non-empty
     checkmark. *Not* GHL-tag-based any more — that was the pre-2026-09-15
     mechanism, replaced per the "PROPER MAPPING/WIRING" MASTERCLASS spec doc.
   - **Application** (`masterclass-applications.json`, new file): Column I
     ("Call Booked Event") contains "application" (case-insensitive) AND
     Column M ("Booking Status") is `BOOKED`.
   Run via `sync/fetch_sheets.py registrations` / `attendance` / `applications`.
   **Merge onto the existing committed files, don't overwrite** — this is a
   safety net against the occasional truncated read (see the gviz note
   above), not because the sheet prunes old dates (checked: it doesn't, it
   holds full history back to the earliest tracked run).
   (The GHL Masterclass Pipeline snapshot in step 2 above — labeled
   "Registration → Attendance, live snapshot, all runs combined" on the
   page — is a *different* thing from the per-run Attended card here, and is
   explicitly **deferred** per the spec doc: leave it on GHL MCP, don't touch
   it, even though it looks conceptually similar.)
4. **Revenue / attribution** (Google Sheet `1LKIwjIpzn1jNSaIzzLAWLkkiODJUuKReKkw3QUT9c8A`,
   tab `CONSOLIDATED`) — pull via `sync/fetch_sheets.py transactions`. The
   sheet gained its own **`Attribution` column** (`PAID`/`ORGANIC`) on
   2026-09-15 — read it directly, no GHL cross-reference or cache needed any
   more (the old `sync/attribution_cache.json` approach is gone). Every row
   with a valid date/amount/email/attribution is included — no closer-assigned
   filter, per the "PROPER MAPPING/WIRING" spec doc: the Cash Attribution
   cards are a straight sync of the sheet, not a filtered subset. Overwrite
   `cash-attribution.json`'s `transactions`/`dailyBreakdown`/`monthlySummary`
   wholesale from the fresh pull each time (the sheet itself is the durable
   store here, unlike the registrations tab — no merge-on-top needed).
5. **Composite** — regenerate `marketing-data.json` from the files above
   (funnelSnapshot, masterclassRuns, adSpendDaily, cashAttributionDaily,
   oneOffEvents: []) — the frontend fetches this one first and errors if it's
   missing, even though everything in it gets overwritten by the
   per-source fetches afterward. `masterclass-applications.json` is fetched
   separately by the page, not folded into this composite.
6. **Commit & push** `dashboard/public/data/*.json` and `docs/data/*.json`
   (see IMPLEMENTATION.md Phase 7 — GitHub Pages serves `docs/`, not
   `dashboard/public/`) to the repo.

See `IMPLEMENTATION.md` for the exact tool calls, tag formats, and file shapes.
