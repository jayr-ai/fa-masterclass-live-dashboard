# Freedom Academy Masterclass Dashboard — Direct Sync (No BigQuery, No Agency-Locked MCP)

Recreation of `au-fa-dashboard/marketing-dashboard` with the BigQuery hop
removed. Same frontend, same data contract, different pipeline:

```
Meta MCP ──────────────────────────┐
GHL REST API (Private Integration Token) ─┼──►  Claude Code session assembles JSON directly  ──► dashboard/public/data/*.json ──► docs/ ──► GitHub Pages
Google Sheets (CSV export) ────────┘
```

No BigQuery, no Apps Script, no GHL MCP (that connector is scoped to one
agency account at a time — not viable once the user is running this for
multiple clients across different agencies, so GHL access is a
location-scoped Private Integration Token via direct REST calls instead).
Everything lands as static JSON the frontend already knows how to read —
the only thing that changed is how that JSON gets produced.

**Live**: https://jayr-ai.github.io/fa-masterclass-live-dashboard/
**Repo**: `jayr-ai/fa-masterclass-live-dashboard` (public — GitHub Pages
requires it on this account's plan)

## Layout

- `dashboard/` — React + Vite + Tailwind + Recharts frontend (3 routes:
  Masterclass, Marketing, Granular View — the last hidden from nav, same as
  the original build). Ported from a source zip; `src/components/PeriodPicker.tsx`
  had to be reconstructed (it was a 0-byte file in that zip, a packaging
  artifact) from its usage in `MarketingPage.tsx`.
- `sync/` — the scripts that produce `dashboard/public/data/*.json`:
  - `fetch_sheets.py` — pulls both Google Sheets (Webinar Tracker + revenue
    CONSOLIDATED) via no-auth CSV export. Guards against a sheet Filter
    (not Filter View) hiding rows from the read — see its module docstring.
  - `fetch_ghl.py` — pulls the GHL Masterclass Pipeline funnel snapshot via
    direct REST calls, using `FA_GHL_PIT` from `sync/.env`.
  - `.env` (git-ignored, not in this repo) — holds `FA_GHL_PIT=<token>`.
    Load before running `fetch_ghl.py`: `set -a; source sync/.env; set +a`.
- `docs/` — the **built** output GitHub Pages actually serves (branch
  `main`, path `/docs`). Not source — `dashboard/` is. A data-only sync
  copies fresh JSON into `docs/data/`; a full rebuild
  (`cd dashboard && npm run build && rm -rf ../docs && cp -r dist ../docs`,
  then re-add `.nojekyll`) is only needed when frontend code changes.
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
pipeline stage IDs, sheet IDs, column mappings) and the non-obvious API
gotchas (GHL wants snake_case params direct-REST but not via MCP; Cloudflare
blocks Python's default user-agent).

## Secrets

`sync/.env` (git-ignored) holds `FA_GHL_PIT`, the GHL Private Integration
Token. Never commit it, never hardcode it into a script, never print it in
a place that ends up in a commit or issue — this repo is public.
