// Pure projection module for the Application Funnel tab (FA only). No React,
// no fetch — takes already-loaded opportunities/transactions and computes the
// three ROAS figures from spec Section 7. Every assumption is a named,
// documented constant below so they can be tuned without touching the logic.
//
// Simplifications from the original spec, made explicitly rather than
// silently: no config table of Accelerator plan structures exists yet, so
// remaining-installment estimation always uses the spec's own documented
// fallback (infer plan length from historical max Payment Occurence isn't
// available from the matched-transaction data alone — Payment Occurence
// itself isn't currently synced into application-funnel-transactions.json,
// only date/amount/product/source — so this module estimates remaining
// balance from each customer's own payment history: total paid so far vs.
// the largest total-paid-per-customer seen historically for the same
// product, as a proxy for "the typical full plan value"). This is coarser
// than a real plan-structure table; swap in a real one if/when Accelerator's
// actual installment terms are provided.

import type { Opportunity, FunnelTransaction } from '../../data/applicationFunnelData'

// ---- Named assumptions -----------------------------------------------

/** Applied to remaining (unpaid) balance to account for plan defaults/refunds. */
export const COLLECTION_RATE = 0.9

/** An open opportunity with no stage movement this long is treated as effectively lost. */
export const STALENESS_CUTOFF_DAYS = 90

/** Below this many historical closes, Projected ROAS gets a "Low confidence" badge. */
export const MIN_CLOSES_FOR_CONFIDENCE = 20

/** Fallback close-lag (days from application to first sale) when there isn't enough
 * mature-cohort data to compute the real 80th-percentile lag. */
export const DEFAULT_CLOSE_LAG_DAYS = 45

/** A cohort is "immature" — its Cash ROAS shouldn't be read as a verdict — below this. */
export const MATURITY_WARNING_THRESHOLD = 0.6

// ---- Types --------------------------------------------------------------

export interface CustomerRevenue {
  email: string
  totalPaid: number
  product: string
  transactionCount: number
}

export interface ProjectionInputs {
  opportunities: Opportunity[]
  transactions: FunnelTransaction[]
  /** ISO date (YYYY-MM-DD) "today" is resolved against — pass sydneyTodayISO(). */
  today: string
}

export interface ProjectionResult {
  remainingScheduledRevenue: number
  expectedPipelineRevenue: number
  closeLagDays: number
  historicalCloseCount: number
  lowConfidence: boolean
  closeRateByStage: Record<string, number>
}

// ---- Helpers --------------------------------------------------------------

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const da = new Date(ay, am - 1, ad).getTime()
  const db = new Date(by, bm - 1, bd).getTime()
  return Math.round((db - da) / 86400000)
}

function customersByEmail(transactions: FunnelTransaction[]): Map<string, CustomerRevenue> {
  const map = new Map<string, CustomerRevenue>()
  for (const t of transactions) {
    const existing = map.get(t.email)
    if (existing) {
      existing.totalPaid += t.amount
      existing.transactionCount += 1
    } else {
      map.set(t.email, { email: t.email, totalPaid: t.amount, product: t.product, transactionCount: 1 })
    }
  }
  return map
}

/**
 * Remaining scheduled installments, summed across all matched customers.
 * Proxy method (see module docstring): for each customer with 2+ payments
 * (a payment-plan signal), the "full plan value" is estimated as the max
 * totalPaid seen historically among customers of the same product — a
 * customer who has paid less than that ceiling has a remainder equal to
 * the gap, times COLLECTION_RATE.
 */
export function estimateRemainingScheduledRevenue(transactions: FunnelTransaction[]): number {
  const customers = customersByEmail(transactions)
  const maxPaidByProduct = new Map<string, number>()
  for (const c of customers.values()) {
    const current = maxPaidByProduct.get(c.product) ?? 0
    if (c.totalPaid > current) maxPaidByProduct.set(c.product, c.totalPaid)
  }

  let remaining = 0
  for (const c of customers.values()) {
    if (c.transactionCount < 2) continue // single payment — treat as paid in full, no plan signal
    const ceiling = maxPaidByProduct.get(c.product) ?? c.totalPaid
    const gap = Math.max(0, ceiling - c.totalPaid)
    remaining += gap * COLLECTION_RATE
  }
  return Math.round(remaining * 100) / 100
}

/**
 * 80th-percentile days from application (opportunity createdAt) to first
 * matched sale, computed only from customers who have actually closed.
 * Falls back to DEFAULT_CLOSE_LAG_DAYS if there's too little data.
 */
export function computeCloseLagDays(opportunities: Opportunity[], transactions: FunnelTransaction[]): { lagDays: number; sampleSize: number } {
  const firstSaleByEmail = new Map<string, string>()
  for (const t of transactions) {
    const existing = firstSaleByEmail.get(t.email)
    if (!existing || t.date < existing) firstSaleByEmail.set(t.email, t.date)
  }
  const earliestAppByEmail = new Map<string, string>()
  for (const o of opportunities) {
    if (!o.email) continue
    const created = o.createdAt.slice(0, 10)
    const existing = earliestAppByEmail.get(o.email)
    if (!existing || created < existing) earliestAppByEmail.set(o.email, created)
  }

  const lags: number[] = []
  for (const [email, saleDate] of firstSaleByEmail) {
    const appDate = earliestAppByEmail.get(email)
    if (!appDate) continue
    const lag = daysBetween(appDate, saleDate)
    if (lag >= 0) lags.push(lag)
  }

  if (lags.length < 5) return { lagDays: DEFAULT_CLOSE_LAG_DAYS, sampleSize: lags.length }
  lags.sort((a, b) => a - b)
  const idx = Math.min(lags.length - 1, Math.floor(lags.length * 0.8))
  return { lagDays: lags[idx], sampleSize: lags.length }
}

/**
 * Historical close rate per current stage, computed only from "mature"
 * opportunities — those older than closeLagDays, so they've had time to
 * either close or not. Applied to today's open opportunities at each stage
 * to estimate expected pipeline revenue.
 */
export function computeExpectedPipelineRevenue(input: ProjectionInputs): ProjectionResult {
  const { opportunities, transactions, today } = input
  const { lagDays, sampleSize } = computeCloseLagDays(opportunities, transactions)

  const matchedEmails = new Set(transactions.map((t) => t.email))
  const avgFirst90DayCash =
    transactions.length > 0
      ? Array.from(customersByEmail(transactions).values()).reduce((sum, c) => sum + c.totalPaid, 0) /
        customersByEmail(transactions).size
      : 0

  const mature = opportunities.filter((o) => daysBetween(o.createdAt.slice(0, 10), today) >= lagDays)
  const byStageMature: Record<string, { total: number; closed: number }> = {}
  for (const o of mature) {
    const bucket = byStageMature[o.stageName] ?? { total: 0, closed: 0 }
    bucket.total += 1
    if (matchedEmails.has(o.email)) bucket.closed += 1
    byStageMature[o.stageName] = bucket
  }
  const closeRateByStage: Record<string, number> = {}
  let totalHistoricalCloses = 0
  for (const [stage, { total, closed }] of Object.entries(byStageMature)) {
    closeRateByStage[stage] = total > 0 ? closed / total : 0
    totalHistoricalCloses += closed
  }

  const staleCutoffDate = ((): string => {
    const [y, m, d] = today.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() - STALENESS_CUTOFF_DAYS)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  })()

  const openOpps = opportunities.filter(
    (o) => o.status === 'open' && o.lastStageChangeAt.slice(0, 10) >= staleCutoffDate
  )

  let expectedRevenue = 0
  for (const o of openOpps) {
    const rate = closeRateByStage[o.stageName] ?? 0
    expectedRevenue += rate * avgFirst90DayCash
  }

  return {
    remainingScheduledRevenue: estimateRemainingScheduledRevenue(transactions),
    expectedPipelineRevenue: Math.round(expectedRevenue * 100) / 100,
    closeLagDays: lagDays,
    historicalCloseCount: totalHistoricalCloses,
    lowConfidence: totalHistoricalCloses < MIN_CLOSES_FOR_CONFIDENCE || sampleSize < 5,
    closeRateByStage,
  }
}

export interface RoasFigures {
  cashRoas: number | null
  contractedRoas: number | null
  projectedRoas: number | null
  lowConfidence: boolean
}

export function computeRoasFigures(spend: number, cashCollected: number, projection: ProjectionResult): RoasFigures {
  if (spend <= 0) {
    return { cashRoas: null, contractedRoas: null, projectedRoas: null, lowConfidence: projection.lowConfidence }
  }
  return {
    cashRoas: cashCollected / spend,
    contractedRoas: (cashCollected + projection.remainingScheduledRevenue) / spend,
    projectedRoas: (cashCollected + projection.remainingScheduledRevenue + projection.expectedPipelineRevenue) / spend,
    lowConfidence: projection.lowConfidence,
  }
}

/** Cohort Maturity % — share of a cohort's age-appropriate revenue window
 * that has elapsed, using the same close-lag as the pipeline projection.
 * A cohort younger than closeLagDays is still "filling in" its own revenue. */
export function computeCohortMaturity(cohortAgeDays: number, closeLagDays: number): number {
  if (closeLagDays <= 0) return 1
  return Math.min(1, cohortAgeDays / closeLagDays)
}
