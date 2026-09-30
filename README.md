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

- `dashboard/` — React + Vite + Tailwind + Recharts frontend (4 routes:
  Marketing, Masterclass, Application Funnel, Granular View — the last
  hidden from nav, same as the original build). Ported from a source zip;
  `src/components/PeriodPicker.tsx` had to be reconstructed (it was a 0-byte
  file in that zip, a packaging artifact) from its usage in `MarketingPage.tsx`.
- `sync/` — the scripts that produce `dashboard/public/data/*.json`:
  - `fetch_sheets.py` — pulls both Google Sheets (Webinar Tracker + revenue
    CONSOLIDATED) via no-auth CSV export. Guards against a sheet Filter
    (not Filter View) hiding rows from the read — see its module docstring.
  - `fetch_ghl.py` — pulls the GHL Masterclass Pipeline funnel snapshot via
    direct REST calls, using `FA_GHL_PIT` from `sync/.env`.
  - `fetch_application_funnel.py` — pulls the GHL Accelerator Application
    Pipeline's opportunities (paginated, ~1,000+ records) for the
    Application Funnel tab. See "Application Funnel tab" below.
  - `.env` (git-ignored, not in this repo) — holds `FA_GHL_PIT=<token>`.
    Load before running `fetch_ghl.py`/`fetch_application_funnel.py`:
    `set -a; source sync/.env; set +a`.
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

## Application Funnel tab

Added 2026-09-30. Tracks the Accelerator Application Funnel — a **different
funnel** from Masterclass, with no webinar date. Grouped by application
cohort (week/month the GHL opportunity was created) instead. **FA only —
this tab does not exist on Heart Smart's dashboard.**

**Data sources**:
- Meta Ads (`act_1185223312884959`), scoped to **8 explicit campaign IDs**
  (not a name pattern — campaign naming across this account's history is
  too inconsistent to auto-derive a safe rule). Confirmed by the user
  2026-09-30 after reviewing the full candidate list. The pull happens via
  Claude's Meta MCP tool inside a sync session (not scriptable standalone,
  same as Masterclass) — save the raw campaign-level daily insights to a
  temp JSON file, then run
  `python3 sync/build_application_funnel_ad_spend.py <raw-file>` to
  assemble/merge it into `application-funnel-ad-spend.json`. To change which
  campaigns count, edit the `CAMPAIGN_NAMES` dict at the top of that script
  and re-run.
- GHL Accelerator Application Pipeline (`o3UfP72baKpNIhXMW2oV`, location
  `ZwP47P1XZZ8TSazVZMxc`) — `python3 sync/fetch_application_funnel.py build-data`,
  paginated fetch of every opportunity (cursor-based, GHL v2's
  `startAfter`/`startAfterId` convention), writes
  `application-funnel-opportunities.json` directly. This pipeline has **no
  separate "Applied" or "Showed" stage** — every opportunity is created
  directly at "Appointment Set". Per user decision 2026-09-30:
  - Applied = Booked = "Appointment Set" (every opportunity counts as both)
  - Showed = progressed to Pending Payment, Lost, or Won (i.e. did *not* end
    in No Show / Cancelled / Needs To Reschedule)
  - Closed = Won
  Re-run `python3 sync/fetch_application_funnel.py list-stages` if the
  pipeline's stages are ever added/renamed/reordered, and update
  `STAGE_IDS`/the derived stage-name sets accordingly. Then run
  `python3 sync/fetch_application_funnel.py build-transactions` (needs
  `build-data` run first, and `fetch_sheets.py` in the same directory) to
  match CONSOLIDATED sheet rows and write `application-funnel-transactions.json`.
- Google Sheet CONSOLIDATED (same sheet as Masterclass) — matched by
  **email present in the pipeline AND sale date on/after that contact's
  earliest opportunity `createdAt`**. Deliberately **no product-name
  filter**: Accelerator/Accelerator Premium is the same product sold
  through both Masterclass and this funnel, so product name can't
  distinguish them — the GHL pipeline membership is the only reliable
  signal (per user decision 2026-09-30).

**Projection module** (`dashboard/src/lib/applicationFunnel/projection.ts`):
computes Cash/Contracted/Projected ROAS per the spec's Section 7 formulas,
with every assumption a named constant at the top of the file
(`COLLECTION_RATE`, `STALENESS_CUTOFF_DAYS`, `MIN_CLOSES_FOR_CONFIDENCE`,
`DEFAULT_CLOSE_LAG_DAYS`). **Known simplification**: there's no real
Accelerator payment-plan-structure table (installment count/amount per
product) to draw from, so remaining-installment estimation uses a proxy —
each matched customer's total paid so far vs. the highest total-paid seen
historically for the same product, as a stand-in "full plan value". This is
coarser than a real plan table; swap one in (see the module's docstring)
if/when Accelerator's actual installment terms are documented. **No unit
tests** — this project has no test runner installed (`package.json` has
none), and adding one wasn't done silently; verification was done by
inspecting the module's output against real data in the browser instead.
If real tests are wanted later, `vitest` is the natural fit for this Vite
project.

**Target ROAS** for the color thresholds (cohort table, ROAS trio panel):
3.0x, confirmed by the user 2026-09-30.

## Secrets

`sync/.env` (git-ignored) holds `FA_GHL_PIT`, the GHL Private Integration
Token. Never commit it, never hardcode it into a script, never print it in
a place that ends up in a commit or issue — this repo is public.
