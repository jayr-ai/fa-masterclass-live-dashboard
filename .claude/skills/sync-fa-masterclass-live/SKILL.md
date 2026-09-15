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
3. **Registrations** (Google Sheet `1g4h0IHwz0_BZ90nslU7NNKwIsENJw9hzgbk3A52dcQo`,
   tab `X - AUTO`) — pulled via `sync/fetch_sheets.py registrations` (no auth,
   CSV export). **Merge, don't overwrite**: this sheet tab only retains recent
   webinar dates (it rotates), so the fresh pull is merged on top of the
   already-committed `masterclass-registrations.json` — new/updated dates
   overwrite, older dates the sheet no longer has are kept as-is.
4. **Attendance** — GHL MCP `search-contacts-advanced`, tag
   `accelerator masterclass - attended D/M` (confirmed current prefix — the
   scheme has changed before, cross-check a live opportunity's contact tags
   if counts come back suspiciously low), one call per webinar date from
   step 3. Same merge-not-overwrite rule as registrations, into
   `masterclass-attendance.json`.
5. **Revenue / attribution** (Google Sheet `1LKIwjIpzn1jNSaIzzLAWLkkiODJUuKReKkw3QUT9c8A`,
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
6. **Composite** — regenerate `marketing-data.json` from the five files above
   (funnelSnapshot, masterclassRuns, adSpendDaily, cashAttributionDaily,
   oneOffEvents: []) — the frontend fetches this one first and errors if it's
   missing, even though everything in it gets overwritten by the
   per-source fetches afterward.
7. **Commit & push** `dashboard/public/data/*.json` (and `sync/attribution_cache.json`)
   to the repo.

See `IMPLEMENTATION.md` for the exact tool calls, tag formats, and file shapes.
