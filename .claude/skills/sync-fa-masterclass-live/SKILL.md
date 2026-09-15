---
name: sync-fa-masterclass-live
description: Sync Freedom Academy Masterclass dashboard data directly from Meta MCP, the GHL REST API (Private Integration Token), and Google Sheets to JSON — no BigQuery, no Apps Script, no agency-scoped MCP
---

# Sync FA Masterclass Live Dashboard

**Project directory**: `/Users/jayvee/Documents/ds-work/fa-masterclass-live-dashboard` — `cd` there first; this skill is registered globally so it can be invoked from any session, but every command below assumes that cwd (see IMPLEMENTATION.md Step 0).

Pulls Meta Ads, the GHL funnel snapshot, and the two Google Sheets straight
into `dashboard/public/data/*.json`. This is the no-BigQuery replacement for
`au-fa-dashboard`'s `/sync-fa-marketing-data`: same data sources, same GHL
pipeline/stage IDs, same Meta ad account — but every step writes the final
JSON directly instead of upserting to a warehouse table first.

**GHL access is a location-scoped Private Integration Token (PIT), not the
GHL MCP connector** — changed 2026-09-15 because the user works with
multiple clients across different agency accounts, and the MCP connector is
bound to one agency at a time. A PIT is per-location instead, so
`sync/fetch_ghl.py`'s approach (direct REST calls to
`services.leadconnectorhq.com`) generalizes to any other client's GHL
location just by swapping the token/pipeline/stage config. The token lives
in `sync/.env` (`FA_GHL_PIT=...`), git-ignored, never hardcoded into any
script and never committed — this repo is **public**.

**All period math (Weekly/Monthly/Custom on the Marketing page) is anchored
to Sydney's calendar date, not the viewer's browser timezone** —
`src/utils/dateRanges.ts`'s `sydneyTodayISO()` — and all data filtering
compares plain `YYYY-MM-DD` strings, never Date-object/UTC arithmetic. Keep
any future date-range code in that same string-comparison style; it's the
one thing that has caused real bugs in this user's other dashboards.

**A truncated sheet read is a real, recurring risk here — root cause
confirmed by the user: someone applying a regular Filter (not a Filter View)
to the Webinar Tracker sheet.** A basic Filter hides rows for every viewer
*and* every reader of the sheet, including `fetch_csv_rows`'s gviz pull — a
Filter View wouldn't cause this, it's per-viewer only. Once saw 182 rows
instead of the real ~4,500 this way. `fetch_csv_rows` now:
1. Retries a few times **spaced ~8s apart** (not back-to-back — a filter
   applied to check something is usually cleared within seconds to a
   couple minutes, so back-to-back retries would just hit the same filtered
   window), exiting early the moment a healthy-looking read shows up.
2. Compares the best result against a persisted baseline
   (`sync/row_count_baseline.json`, gitignored — regenerate anytime, it's
   just a floor, not a source of truth). If still under 70% of the last
   known-good count after retrying, it raises `SuspiciousReadError` instead
   of returning partial data — **do not catch this and proceed anyway**.
   Tell the user a Filter looks active on the sheet and ask them to clear
   it, then re-run. Recommend they use Filter Views (Data > Filter views)
   for any ad-hoc personal filtering going forward — those don't affect
   what this sync (or anyone else) sees.

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
2. **GHL Masterclass Pipeline** (`djiSwm3hJsW7Rv9tyqSl`) — `python3
   sync/fetch_ghl.py funnel-stages` (needs `FA_GHL_PIT` loaded from
   `sync/.env` — `set -a; source sync/.env; set +a` first). 11 direct REST
   calls to `/opportunities/search`, one per stage, `meta.total` is the
   count. No MCP involved. Overwrites `funnel-stages.json` — it's a
   point-in-time snapshot, not a history, so there's nothing to merge.
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
   page — is a *different* thing from the per-run Attended card here; both
   are now off GHL MCP entirely, just via different mechanisms — PIT/REST
   for the snapshot, the sheet's Column N for the per-run card.)
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
