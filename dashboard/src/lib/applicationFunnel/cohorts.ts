// Groups opportunities/spend/transactions into weekly or monthly application
// cohorts (Section 6B of the spec) — the week/month the opportunity was
// created, not the webinar-date grouping Masterclass uses (this funnel has
// no webinar date at all).

import type { AdSpendDay, Opportunity, FunnelTransaction } from '../../data/applicationFunnelData'
import { computeCohortMaturity } from './projection'

export type CohortGrain = 'week' | 'month'

function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const day = dt.getDay() || 7
  dt.setDate(dt.getDate() - (day - 1))
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function cohortKey(iso: string, grain: CohortGrain): string {
  return grain === 'month' ? iso.slice(0, 7) : mondayOf(iso)
}

export function cohortLabel(key: string, grain: CohortGrain): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  if (grain === 'month') {
    const [y, m] = key.split('-').map(Number)
    return `${MONTHS[m - 1]} ${y}`
  }
  const [y, m, d] = key.split('-').map(Number)
  return `Week of ${MONTHS[m - 1]} ${d}, ${y}`
}

export interface CohortRow {
  key: string
  label: string
  ageDays: number
  spend: number
  applications: number
  booked: number
  showed: number
  closed: number
  costPerApplication: number | null
  closeRatePct: number
  cashToDate: number
  maturityPct: number
}

export function buildCohorts(
  opportunities: Opportunity[],
  adSpendDaily: AdSpendDay[],
  transactions: FunnelTransaction[],
  grain: CohortGrain,
  closeLagDays: number,
  todayIso: string,
  showedStageNames: Set<string>,
  closedStageNames: Set<string>
): CohortRow[] {
  const spendByDate = new Map(adSpendDaily.map((d) => [d.date, d.spend]))
  const opportunitiesByCohort = new Map<string, Opportunity[]>()
  for (const o of opportunities) {
    const key = cohortKey(o.createdAt.slice(0, 10), grain)
    const arr = opportunitiesByCohort.get(key) ?? []
    arr.push(o)
    opportunitiesByCohort.set(key, arr)
  }

  // Which cohort each matched customer's application belongs to
  const cohortByEmail = new Map<string, string>()
  for (const o of opportunities) {
    if (!o.email) continue
    const key = cohortKey(o.createdAt.slice(0, 10), grain)
    const existing = cohortByEmail.get(o.email)
    if (!existing || o.createdAt < (opportunitiesByCohort.get(existing)?.[0]?.createdAt ?? '')) {
      cohortByEmail.set(o.email, key)
    }
  }
  const cashByCohort = new Map<string, number>()
  for (const t of transactions) {
    const key = cohortByEmail.get(t.email)
    if (!key) continue
    cashByCohort.set(key, (cashByCohort.get(key) ?? 0) + t.amount)
  }

  const rows: CohortRow[] = []
  for (const [key, opps] of opportunitiesByCohort) {
    // Spend for the cohort's own week/month window (not per-opportunity — a
    // single account-level daily spend figure applies to the whole cohort).
    let spend = 0
    for (const [date, s] of spendByDate) {
      if (cohortKey(date, grain) === key) spend += s
    }

    const applications = opps.length
    const booked = applications // this pipeline has no separate applied/booked stage
    const showed = opps.filter((o) => showedStageNames.has(o.stageName)).length
    const closed = opps.filter((o) => closedStageNames.has(o.stageName)).length

    const [cy, cm, cd] = grain === 'month' ? [Number(key.slice(0, 4)), Number(key.slice(5, 7)), 1] : key.split('-').map(Number)
    const cohortStart = new Date(cy, cm - 1, cd)
    const [ty, tm, td] = todayIso.split('-').map(Number)
    const ageDays = Math.round((new Date(ty, tm - 1, td).getTime() - cohortStart.getTime()) / 86400000)

    rows.push({
      key,
      label: cohortLabel(key, grain),
      ageDays,
      spend: Math.round(spend * 100) / 100,
      applications,
      booked,
      showed,
      closed,
      costPerApplication: applications > 0 ? spend / applications : null,
      closeRatePct: applications > 0 ? (closed / applications) * 100 : 0,
      cashToDate: Math.round((cashByCohort.get(key) ?? 0) * 100) / 100,
      maturityPct: computeCohortMaturity(ageDays, closeLagDays) * 100,
    })
  }

  return rows.sort((a, b) => (a.key < b.key ? 1 : -1)) // most recent cohort first
}
