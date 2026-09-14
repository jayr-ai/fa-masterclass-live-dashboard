export interface TrendValue {
  value: number
  trendPct: number | null // null = "N/A"
}

export interface CashByDay {
  date: string // ISO date
  amount: number
  approximate?: boolean // value was partially obscured in source screenshot
  notCaptured?: boolean // day fell inside the screenshot's date range but wasn't legible/listed — omit from totals, render as empty bar
}

export interface ProgramCashSlice {
  program: string
  amount: number
}

export interface DonutSlice {
  label: string
  amount: number
  pct: number
}

export interface ExecutiveSummary {
  bullets: string[]
}

export interface MasterclassStage {
  stage: string
  count: number | null // null = TODO, not yet confirmed
}

export interface Deal {
  date: string // ISO date the transaction landed, not the run date
  name: string
  email: string
  product: string
  amount: number
  closer: string
  mode: string // payment mode e.g. "Stripe", "EFT"
}

export interface MasterclassRun {
  date: string // ISO date, the Masterclass run date
  label: string // display label e.g. "15 Apr 2026"
  registered: number
  showUpRatePct: number
  attended: number
  vipUpgrade: number
  cashFromVip: number
  application: number
  attendToAppPct: number
  allTimeRevenue: number
  dealsClosed: number
  cashFromAds: number
  cashFromOrganic: number
  deals: Deal[] // line-item detail behind dealsClosed/allTimeRevenue — [] where not captured (mock runs)
  executiveSummary: ExecutiveSummary
  marketingPerformance: {
    sourceLabel: string
    adSpend: number
    linkClicks: number
    ctrPct: number
    leadsGenerated: number
    costPerLead: number
    roas: number | null // null = TODO, needs revenue data
  }
}

export interface RevenueRollup {
  periodLabel: string
  totalRevenue: number
  cashReceivedLast30: TrendValue
  salesLast30: TrendValue
  cashFromAds: DonutSlice
  cashFromOrganic: DonutSlice
  won: { value: number; trend: 'N/A' }
  cashProjectedByProgram: ProgramCashSlice[]
  last30DaysCash: CashByDay[]
  monthlyCash: { month: string; amount: number }[]
}

/** null = "No data" — explicit unattributed / not-yet-wired state, not a real $0 */
export interface MaybeMetric {
  value: number | null
  noData?: boolean
}

export interface MarketingBreakdown {
  periodLabel: string
  executiveSummary: ExecutiveSummary
  impressions: number
  reach: number
  linkClicks: number
  clickThroughPct: number
  leadsAdsManager: number
  clickToLeadPct: number
  booking: number
  leadToBookPct: number
  sale: number | null // TODO: confirmed cut off in source
  cashReceivedFromAds: MaybeMetric
  cashReceivedOrganic: MaybeMetric
  totalAdSpend: MaybeMetric
  cpm1000: number
  costPerLinkClick: number
  costPerLead: number
  costPerBooking: number
  costPerSale: number
  netProfit: number | null // TODO: cut off in source
  roas: number | null // TODO: cut off in source
  totalCallsBooked: number
  callsFromAds: number
  callsFromOrganic: number
  noShowCancelled: number
  noShowCancelledPct: number
  vipUpgrade: number
  applicationDeposit: number
}
