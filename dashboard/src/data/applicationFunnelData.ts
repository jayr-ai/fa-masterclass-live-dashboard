// Data loaders for the Application Funnel tab (FA only). Same fetch-a-static-JSON
// pattern as liveData.ts — no live backend, no BigQuery. Files are produced by
// sync/fetch_application_funnel.py + a Claude-session Meta MCP pull, same as
// the Masterclass/Marketing sync.

export interface AdSpendCampaignDay {
  campaignId: string
  campaignName: string
  date: string
  spend: number
  impressions: number
  linkClicks: number
  leads: number
}

export interface AdSpendDay {
  date: string
  spend: number
  impressions: number
  linkClicks: number
  leads: number
}

export interface AdSpendData {
  meta: {
    generatedAt: string
    dataWindow: string
    totalDays: number
    totalSpend: number
    campaignIds: string[]
  }
  byCampaignDaily: AdSpendCampaignDay[]
  dailyTotal: AdSpendDay[]
}

export interface Opportunity {
  id: string
  contactId: string
  name: string
  email: string
  stageId: string
  stageName: string
  status: string
  monetaryValue: number
  createdAt: string // ISO datetime
  lastStageChangeAt: string
  utmCampaign: string | null
  utmMedium: string | null
  fbclid: string | null
}

export interface FunnelSnapshot {
  generatedAt: string
  totalOpportunities: number
  applied: number
  booked: number
  showed: number
  closed: number
  lostAfterShow: number
  noShowOrReschedule: number
  byCurrentStage: Record<string, number>
}

export interface OpportunitiesData {
  meta: { generatedAt: string; totalOpportunities: number }
  funnelSnapshot: FunnelSnapshot
  opportunities: Opportunity[]
}

export interface FunnelTransaction {
  date: string
  name: string
  email: string
  product: string
  amount: number
  closer: string
  mode: string
  source: 'Paid' | 'Organic'
  applicationDate: string
}

export interface TransactionsData {
  meta: {
    generatedAt: string
    totalMatchedTransactions: number
    totalMatchedRevenue: number
    distinctMatchedCustomers: number
  }
  transactions: FunnelTransaction[]
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    // Cache-buster matches liveData.ts's pattern — without it, a browser or
    // CDN can serve a stale JSON response after a fresh sync.
    const res = await fetch(`${import.meta.env.BASE_URL}data/${path}?t=${Date.now()}`)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

let adSpendCache: Promise<AdSpendData | null> | null = null
export function loadAdSpendData(): Promise<AdSpendData | null> {
  if (!adSpendCache) adSpendCache = fetchJson<AdSpendData>('application-funnel-ad-spend.json')
  return adSpendCache
}

let opportunitiesCache: Promise<OpportunitiesData | null> | null = null
export function loadOpportunitiesData(): Promise<OpportunitiesData | null> {
  if (!opportunitiesCache) opportunitiesCache = fetchJson<OpportunitiesData>('application-funnel-opportunities.json')
  return opportunitiesCache
}

let transactionsCache: Promise<TransactionsData | null> | null = null
export function loadFunnelTransactions(): Promise<TransactionsData | null> {
  if (!transactionsCache) transactionsCache = fetchJson<TransactionsData>('application-funnel-transactions.json')
  return transactionsCache
}
