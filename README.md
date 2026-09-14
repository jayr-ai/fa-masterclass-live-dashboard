# Freedom Academy Masterclass Dashboard — Direct Sync (No BigQuery)

Recreation of `au-fa-dashboard/marketing-dashboard` with the BigQuery hop
removed. Same frontend, same data contract, different pipeline:

```
Meta MCP ──┐
GHL MCP  ──┼──►  Claude Code session assembles JSON directly  ──► dashboard/public/data/*.json ──► GitHub Pages
Google Sheet (CSV export) ──┘
```

No BigQuery, no Apps Script. Everything lands as static JSON the frontend
already knows how to read — the only thing that changed is how that JSON
gets produced.

## Layout

- `dashboard/` — React + Vite + Tailwind + Recharts frontend (3 routes:
  Masterclass, Marketing, Granular View — the last hidden from nav, same as
  the original build). Ported unchanged from the source zip except:
  - removed dead cross-repo fetch helpers in `src/data/liveData.ts` that
    pointed at the old `jayr-ai/au-fa-dashboard` repo and were never called
  - reconstructed `src/components/PeriodPicker.tsx`, which was a 0-byte file
    in the source zip (a packaging artifact, not something the new pipeline
    caused) — rebuilt from its usage in `MarketingPage.tsx` and the
    behavior documented in `dashboard/README.md`'s "Period Filters" section,
    reusing the existing `src/utils/dateRanges.ts` week/month helpers
  - updated a couple of user-visible "BigQuery" labels/tooltips that no
    longer describe how the data actually gets here
- `sync/` — `fetch_sheets.py` (the one part of the sync that's a real script:
  pulling the two Google Sheets via CSV export, no auth) and
  `attribution_cache.json` (email → Paid/Organic, avoids re-classifying the
  same email on every sync)
- `.claude/skills/sync-fa-masterclass-live/` — the sync procedure Claude
  follows on `/sync-fa-masterclass-live` (see `SKILL.md` / `IMPLEMENTATION.md`)

## Running locally

```bash
cd dashboard
npm install
npm run dev
```

## Refreshing data

```bash
/sync-fa-masterclass-live
```

See `.claude/skills/sync-fa-masterclass-live/SKILL.md` for what it does and
`IMPLEMENTATION.md` for the exact Meta/GHL/Sheets config (account IDs,
pipeline stage IDs, sheet IDs, tag formats).

## Deploy

Not yet pushed to a GitHub repo / GitHub Pages — ask before doing so, since
that's a "visible to others" action. `npm run build` in `dashboard/` produces
a static `dist/` ready for any static host once a repo exists.
