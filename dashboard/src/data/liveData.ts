/**
 * Loader for the one-time live backfill (public/data/marketing-data.json) —
 * see the README "Phase 2" section for exactly what was pulled from GHL/Meta,
 * what's still mock, and why. Not an automated refresh: this snapshot is only
 * as current as the last manual backfill.
 */
// Local calendar date, not UTC — Date.toISOString() shifts a local midnight
// Date across the day boundary in any timezone ahead of UTC. Same class of
// bug as dateRanges.ts's toISODate; fixed the same way.
function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface LiveDeal {
  date: string
  name: string
  email: string
  product: string
  amount: number
  closer: string
  mode: string
  source?: 'paid' | 'organic'
}

export interface LiveMasterclassRun {
  date: string
  label: string
  registered: number
  attended: number
  showUpRatePct: number | null
  cashFromAds: number
  cashFromOrganic: number
  deals: LiveDeal[]
}

export interface LiveAdSpendDay {
  date: string
  spend: number
  impressions: number
  linkClicks: number
  leads: number
}

export interface LiveCashAttributionDay {
  date: string
  cashFromAds: number
  cashFromOrganic: number
}

export interface LiveMonthlyCashSummary {
  month: string
  transactionCount: number
  totalCash: number
  cashFromAds: number
  cashFromOrganic: number
}

export interface LiveTransaction {
  date: string
  name: string
  email: string
  product: string
  amount: number
  source: 'Paid' | 'Organic'
  closer?: string | null
}

export interface LiveCashAttributionData {
  meta: {
    generatedAt: string
    source: string
    dataWindow: string
  }
  monthlySummary: LiveMonthlyCashSummary[]
  dailyBreakdown: LiveCashAttributionDay[]
  transactions: LiveTransaction[]
}

export interface MasterclassRegistrationData {
  meta: {
    generatedAt: string
    source: string
    dataWindow: string
    totalRegistrations: number
  }
  masterclassRegistrations: Array<{
    date: string
    label: string
    registered: number
  }>
}

export interface MasterclassAttendanceData {
  meta: {
    generatedAt: string
    source: string
    dataWindow: string
    totalAttendees: number
  }
  masterclassAttendance: Array<{
    date: string
    attended: number
  }>
}

export interface MasterclassApplicationData {
  meta: {
    generatedAt: string
    source: string
    totalApplications: number
  }
  applications: Array<{
    date: string
    applications: number
  }>
}

export interface MasterclassAllTimeMetrics {
  adSpend: number
  registered: number
  attended: number
  showUpRatePct: number
  applications: number
}

export interface LiveFunnelStage {
  stage: string
  count: number
}

export interface LiveFunnelSnapshot {
  generatedAt: string
  stages: LiveFunnelStage[]
}

export interface LiveOneOffEvent {
  name: string
  registered: number
  attended: number
  showUpRatePct: number | null
  application: number
  attendToAppPct: number | null
  dealsClosed: number
  revenue: number
  cashFromAds: number
  cashFromOrganic: number
  deals: LiveDeal[]
  sourceLabel: string
}

export interface LiveMarketingData {
  meta: {
    generatedAt: string
    source: string
    dataWindow: string
    cacheStatus: string
    syncedAt?: string
  }
  funnelSnapshot: LiveFunnelSnapshot
  masterclassRuns: LiveMasterclassRun[]
  adSpendDaily: LiveAdSpendDay[]
  cashAttributionDaily: LiveCashAttributionDay[]
  oneOffEvents: LiveOneOffEvent[]
}

let cache: Promise<LiveMarketingData | null> | null = null
let cashAttributionCache: Promise<LiveCashAttributionData | null> | null = null

export function loadCashAttributionData(): Promise<LiveCashAttributionData | null> {
  if (!cashAttributionCache) {
    cashAttributionCache = (async () => {
      try {
        // Load cash attribution data from BigQuery sync (monthly, daily, transactions)
        const response = await fetch(`${import.meta.env.BASE_URL}data/cash-attribution.json?t=${Date.now()}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json() as LiveCashAttributionData
        console.log(`💰 Loaded cash attribution data: ${data.monthlySummary.length} months, ${data.dailyBreakdown.length} days, ${data.transactions.length} transactions`)
        return data
      } catch (error) {
        console.error('Error loading cash attribution data:', error)
        return null
      }
    })()
  }
  return cashAttributionCache
}

export function loadLiveData(): Promise<LiveMarketingData | null> {
  if (!cache) {
    cache = (async () => {
      try {
        // Load the main marketing data (for funnel, cash attribution, masterclass runs, etc.)
        const marketingRes = await fetch(`${import.meta.env.BASE_URL}data/marketing-data.json?t=${Date.now()}`)
        if (!marketingRes.ok) throw new Error(`HTTP ${marketingRes.status}`)
        const rawMarketingData = await marketingRes.json()

        // Handle JSON structure where `daily` is at top level instead of `adSpendDaily`
        let marketingData: LiveMarketingData
        if (rawMarketingData.daily && Array.isArray(rawMarketingData.daily) && !rawMarketingData.adSpendDaily) {
          // JSON has `daily` at top level - map it to `adSpendDaily`
          marketingData = {
            ...rawMarketingData,
            adSpendDaily: rawMarketingData.daily,
          }
          console.log(`✅ Mapped marketing-data.json.daily (${rawMarketingData.daily.length} days) to adSpendDaily`)
        } else {
          marketingData = rawMarketingData as LiveMarketingData
        }

        // Ensure all required fields exist as fallback arrays/objects
        if (!marketingData.masterclassRuns) marketingData.masterclassRuns = []
        if (!marketingData.oneOffEvents) marketingData.oneOffEvents = []
        if (!marketingData.adSpendDaily) marketingData.adSpendDaily = []
        if (!marketingData.cashAttributionDaily) marketingData.cashAttributionDaily = []
        if (!marketingData.funnelSnapshot) marketingData.funnelSnapshot = { generatedAt: new Date().toISOString(), stages: [] }

        // Load the live marketing performance data from BigQuery sync (daily ad spend + KPIs)
        try {
          const performanceRes = await fetch(`${import.meta.env.BASE_URL}data/marketing-performance.json?t=${Date.now()}`)
          if (performanceRes.ok) {
            const rawPerformanceData = await performanceRes.json()
            // Use the daily array from marketing-performance.json (more current, auto-synced from BigQuery)
            if (rawPerformanceData.daily && Array.isArray(rawPerformanceData.daily)) {
              marketingData.adSpendDaily = rawPerformanceData.daily
              console.log(`📊 Loaded ${rawPerformanceData.daily.length} days of ad spend from marketing-performance.json (BigQuery sync)`)
            }
            // Update meta with sync timestamp from BigQuery
            if (rawPerformanceData.meta?.syncedAt) {
              marketingData.meta.syncedAt = rawPerformanceData.meta.syncedAt
            }
          }
        } catch (perfError) {
          console.warn('Could not load marketing-performance.json, using marketing-data.json fallback:', perfError)
        }

        // Load GHL Masterclass Pipeline funnel stage snapshot from BigQuery sync
        try {
          const funnelRes = await fetch(`${import.meta.env.BASE_URL}data/funnel-stages.json?t=${Date.now()}`)
          if (funnelRes.ok) {
            const funnelData = await funnelRes.json()
            // Transform stages array into LiveFunnelStage format
            if (funnelData.stages && Array.isArray(funnelData.stages)) {
              marketingData.funnelSnapshot = {
                generatedAt: funnelData.meta?.generatedAt || new Date().toISOString(),
                stages: funnelData.stages.map((stage: any) => ({
                  stage: stage.name,
                  count: stage.count
                }))
              }
              console.log(`🔗 Loaded ${funnelData.stages.length} GHL funnel stages from BigQuery sync`)
            }
          }
        } catch (funnelError) {
          console.warn('Could not load funnel-stages.json, using marketing-data.json fallback:', funnelError)
        }

        // Load masterclass registrations to build runs array for windowed performance calculation
        try {
          const regRes = await fetch(`${import.meta.env.BASE_URL}data/masterclass-registrations.json?t=${Date.now()}`)
          if (regRes.ok) {
            const regData = await regRes.json()
            if (regData.masterclassRegistrations && Array.isArray(regData.masterclassRegistrations)) {
              marketingData.masterclassRuns = regData.masterclassRegistrations.map((r: any) => ({
                date: r.date,
                label: r.label || r.date,
                registered: r.registered || 0,
                attended: 0,
                showUpRatePct: null,
                cashFromAds: 0,
                cashFromOrganic: 0,
                deals: [],
              }))
            }
          }
        } catch (regError) {
          console.warn('Could not load masterclass registrations for performance calculation:', regError)
        }

        return marketingData
      } catch (error) {
        console.error('Error loading live data:', error)
        return null
      }
    })()
  }
  return cache
}

export async function loadMasterclassAllTimeMetrics(): Promise<MasterclassAllTimeMetrics | null> {
  try {
    // Load registrations
    const regRes = await fetch(`${import.meta.env.BASE_URL}data/masterclass-registrations.json?t=${Date.now()}`)
    const registrationData = regRes.ok ? await regRes.json() as MasterclassRegistrationData : null
    const totalRegistered = registrationData?.meta?.totalRegistrations || 0

    // Load attendance
    const attRes = await fetch(`${import.meta.env.BASE_URL}data/masterclass-attendance.json?t=${Date.now()}`)
    const attendanceData = attRes.ok ? await attRes.json() as MasterclassAttendanceData : null
    const totalAttended = attendanceData?.meta?.totalAttendees || 0

    // Load applications
    const appRes = await fetch(`${import.meta.env.BASE_URL}data/masterclass-applications.json?t=${Date.now()}`)
    const applicationData = appRes.ok ? await appRes.json() as MasterclassApplicationData : null
    const totalApplications = applicationData?.meta?.totalApplications || 0

    // Load ad spend (from performance data)
    const perfRes = await fetch(`${import.meta.env.BASE_URL}data/marketing-performance.json?t=${Date.now()}`)
    const performanceData = perfRes.ok ? await perfRes.json() : null
    const totalAdSpend = performanceData?.daily ? performanceData.daily.reduce((sum: number, day: any) => sum + (day.spend || 0), 0) : 0

    // Calculate show-up rate
    const showUpRatePct = totalRegistered > 0 ? Math.round((totalAttended / totalRegistered) * 100 * 100) / 100 : 0

    console.log(`📚 Loaded masterclass all-time metrics: ${totalRegistered} registered, ${totalAttended} attended (${showUpRatePct}%), ${totalAdSpend.toFixed(2)} spend, ${totalApplications} applications`)

    return {
      adSpend: totalAdSpend,
      registered: totalRegistered,
      attended: totalAttended,
      showUpRatePct,
      applications: totalApplications
    }
  } catch (error) {
    console.error('Error loading masterclass all-time metrics:', error)
    return null
  }
}

export async function loadMasterclassWebinarDates(): Promise<Array<{ date: string; label: string }>> {
  try {
    const regRes = await fetch(`${import.meta.env.BASE_URL}data/masterclass-registrations.json?t=${Date.now()}`)
    if (!regRes.ok) {
      console.warn('Could not load masterclass registrations for webinar dates')
      return []
    }

    const registrationData = await regRes.json() as MasterclassRegistrationData
    const webinarDates = registrationData.masterclassRegistrations
      .map(r => ({ date: r.date, label: r.label }))
      .sort((a, b) => (a.date < b.date ? 1 : -1)) // Newest first

    console.log(`📅 Loaded ${webinarDates.length} webinar dates from Google Sheet (Column F)`)
    return webinarDates
  } catch (error) {
    console.error('Error loading masterclass webinar dates:', error)
    return []
  }
}

/** Sums live daily ad spend rows whose date falls within [from, to] (inclusive). */
export function sumAdSpendInRange(
  days: LiveAdSpendDay[],
  from: Date,
  to: Date,
): { spend: number; impressions: number; linkClicks: number; leads: number; dayCount: number } | null {
  // Use ISO date string comparison to avoid timezone issues
  const fromStr = toLocalISODate(from)
  const toStr = toLocalISODate(to)
  const matched = days.filter((d) => {
    return d.date >= fromStr && d.date <= toStr
  })
  if (matched.length === 0) return null
  return {
    spend: matched.reduce((a, d) => a + d.spend, 0),
    impressions: matched.reduce((a, d) => a + d.impressions, 0),
    linkClicks: matched.reduce((a, d) => a + d.linkClicks, 0),
    leads: matched.reduce((a, d) => a + d.leads, 0),
    dayCount: matched.length,
  }
}

/** Sums live daily cash-attribution rows whose date falls within [from, to] (inclusive). */
export function sumCashAttributionInRange(
  days: LiveCashAttributionDay[],
  from: Date,
  to: Date,
): { cashFromAds: number; cashFromOrganic: number; dayCount: number } | null {
  const fromMs = from.getTime()
  const toMs = to.getTime()
  const matched = days.filter((d) => {
    const t = new Date(d.date + 'T00:00:00').getTime()
    return t >= fromMs && t <= toMs
  })
  if (matched.length === 0) return null
  return {
    cashFromAds: matched.reduce((a, d) => a + d.cashFromAds, 0),
    cashFromOrganic: matched.reduce((a, d) => a + d.cashFromOrganic, 0),
    dayCount: matched.length,
  }
}

export interface WindowedMarketingPerformance {
  adSpend: number
  linkClicks: number
  impressions: number
  ctrPct: number
  leadsGenerated: number
  costPerLead: number
  costPerClick: number
  clickToLeadPct: number
  windowDays: number
  windowStart: string
  windowEnd: string
  isPartialWindow: boolean
}

/**
 * There's no per-run ad campaign to attribute spend to — Meta runs one
 * continuous evergreen campaign that always points at "the next Masterclass,"
 * not a dedicated campaign per date (confirmed by inspecting the account's
 * campaign list). The standard way to cost a recurring evergreen funnel is a
 * time-windowed proxy: attribute the days between the previous run and this
 * run to this run's registrant cohort. Computed client-side from the same
 * daily series already used elsewhere, so it stays correct automatically if
 * that series is ever refreshed — no separate pipeline step needed.
 */
export function computeWindowedPerformance(
  runs: LiveMasterclassRun[],
  days: LiveAdSpendDay[],
): Record<string, WindowedMarketingPerformance> {
  if (days.length === 0 || runs.length === 0) return {}
  // Sort oldest first (chronological order: earliest to latest)
  const sortedRuns = [...runs].sort((a, b) => {
    const dateA = new Date(a.date).getTime()
    const dateB = new Date(b.date).getTime()
    return dateA - dateB
  })
  console.log(`🔍 Sorted ${sortedRuns.length} runs (oldest-first): ${sortedRuns.map(r => r.date).slice(-5).join(', ')} (last 5)`)
  const result: Record<string, WindowedMarketingPerformance> = {}

  sortedRuns.forEach((run, i) => {
    const prevRunDate = i > 0 ? sortedRuns[i - 1].date : null
    const earliestDay = days.reduce((min, d) => (d.date < min ? d.date : min), days[0].date)

    // AD SPEND WINDOW: from previous run (or earliest day) to current run date
    let adSpendWindowStartStr = prevRunDate && prevRunDate > earliestDay ? prevRunDate : earliestDay
    if (prevRunDate && prevRunDate > earliestDay) {
      const nextDay = new Date(prevRunDate + 'T00:00:00')
      nextDay.setDate(nextDay.getDate() + 1)
      adSpendWindowStartStr = toLocalISODate(nextDay)
    }
    const adSpendWindowStart = new Date(adSpendWindowStartStr + 'T00:00:00')
    const adSpendWindowEnd = new Date(run.date + 'T00:00:00')

    const sum = sumAdSpendInRange(days, adSpendWindowStart, adSpendWindowEnd)
    if (!sum) return

    const expectedDays = Math.round((adSpendWindowEnd.getTime() - adSpendWindowStart.getTime()) / 86400000) + 1

    result[run.date] = {
      adSpend: sum.spend,
      linkClicks: sum.linkClicks,
      impressions: sum.impressions,
      ctrPct: sum.impressions > 0 ? (sum.linkClicks / sum.impressions) * 100 : 0,
      leadsGenerated: sum.leads,
      costPerLead: sum.leads > 0 ? sum.spend / sum.leads : 0,
      costPerClick: sum.linkClicks > 0 ? sum.spend / sum.linkClicks : 0,
      clickToLeadPct: sum.linkClicks > 0 ? (sum.leads / sum.linkClicks) * 100 : 0,
      windowDays: sum.dayCount,
      // The actual ad-spend window these figures were summed from (previous
      // run + 1 day, through this run's date) — NOT the revenue-attribution
      // window (that's a separate, later window: this run through the day
      // before the next one). These two were previously conflated: this
      // function returned the revenue window's dates under windowStart/End
      // while the Executive Summary text displayed them as if they described
      // the ad-spend figures above, which is a different range entirely.
      windowStart: adSpendWindowStartStr,
      windowEnd: toLocalISODate(adSpendWindowEnd),
      isPartialWindow: sum.dayCount < expectedDays,
    }
  })

  return result
}

/**
 * Fetch windowed revenue for a masterclass run from BigQuery
 *
 * Queries revenue_transactions_enriched for:
 * - Transactions within the date window (windowStart to windowEnd, inclusive)
 * - From registrant emails for this masterclass
 * - Summed by attribution source (PAID vs ORGANIC)
 *
 * @param masterclassDate - The masterclass date (YYYY-MM-DD)
 * @param windowStart - Revenue window start date (YYYY-MM-DD, inclusive)
 * @param windowEnd - Revenue window end date (YYYY-MM-DD, inclusive)
 * @param registrantEmails - Array of registrant email addresses
 * @returns Object with cashFromAds, cashFromOrganic, dealsClosed
 */
export async function getMasterclassWindowRevenue(
  masterclassDate: string,
  windowStart: string,
  windowEnd: string,
  _registrantEmails: string[]
): Promise<{
  cashFromAds: number
  cashFromOrganic: number
  dealsClosed: number
  transactions: LiveTransaction[]
} | null> {
  try {
    // Fetch live transaction data that includes cash attribution
    const response = await fetch(`${import.meta.env.BASE_URL}data/cash-attribution.json?t=${Date.now()}`)
    if (!response.ok) {
      console.warn('Could not load cash attribution data for window calculation')
      return null
    }

    const data = await response.json() as LiveCashAttributionData
    const transactions = data.transactions || []

    // Filter transactions by date range only (ALL transactions within the window, regardless of registrant)
    const windowTransactions = transactions.filter(txn => {
      const dateMatch = txn.date >= windowStart && txn.date <= windowEnd
      return dateMatch
    })

    // Sum by source
    const cashFromAds = windowTransactions
      .filter(txn => txn.source === 'Paid')
      .reduce((sum, txn) => sum + txn.amount, 0)

    const cashFromOrganic = windowTransactions
      .filter(txn => txn.source === 'Organic')
      .reduce((sum, txn) => sum + txn.amount, 0)

    // Deals Closed: count UNIQUE emails in the revenue window (one deal per unique customer)
    const uniqueEmails = new Set(windowTransactions.map(txn => txn.email.toLowerCase().trim()))
    const dealsClosed = uniqueEmails.size

    console.log(
      `📊 Window revenue for ${masterclassDate} (${windowStart} to ${windowEnd}): $${(cashFromAds + cashFromOrganic).toFixed(2)} from ${windowTransactions.length} deals (${cashFromAds.toFixed(2)} ads, ${cashFromOrganic.toFixed(2)} organic)`
    )

    return {
      cashFromAds,
      cashFromOrganic,
      dealsClosed,
      transactions: windowTransactions,
    }
  } catch (error) {
    console.error('Error fetching masterclass window revenue:', error)
    return null
  }
}
