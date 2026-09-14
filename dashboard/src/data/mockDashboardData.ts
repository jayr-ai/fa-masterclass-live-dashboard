/**
 * Mock data for Phase 1 (UI-first pass). Every number here was read directly off
 * 3 Data Studio screenshots — none of it has been verified against GoHighLevel,
 * Meta, or the sales sheet. Treat as placeholder shape/example data only.
 *
 * `null` values and fields marked TODO were cut off / obscured in the source
 * screenshots and are intentionally left unfilled rather than guessed — see
 * README "Assumptions & placeholders".
 */
import type {
  RevenueRollup,
  MasterclassRun,
  MarketingBreakdown,
} from '../types/dashboard'

// ---------------------------------------------------------------------------
// 5.1 Revenue & Masterclass Dashboard — "All Time" / rollup state
// ---------------------------------------------------------------------------

export const revenueRollup: RevenueRollup = {
  periodLabel: '1 Jan 2026 – 7 Apr 2026',
  totalRevenue: 151254,
  cashReceivedLast30: { value: 138302, trendPct: 967.8 },
  salesLast30: { value: 102, trendPct: 200.0 },
  cashFromAds: { label: 'Cash From Ads', amount: 116672, pct: 22.9 },
  cashFromOrganic: { label: 'Cash From Organic', amount: 34485, pct: 77.1 },
  won: { value: 13, trend: 'N/A' },
  cashProjectedByProgram: [
    { program: 'Accelerator', amount: 148000 },
    { program: 'FDR Masterclass VIP Upgrade', amount: -2754 },
    { program: 'FDR Application Deposit', amount: -500 },
    { program: 'FDR Application', amount: 0 },
  ],
  // Days not listed below fell inside the Mar08–Apr04 screenshot range but
  // weren't legible in the crop (Mar15, Mar21, Mar28–30) — marked
  // notCaptured rather than assumed $0.
  last30DaysCash: [
    { date: '2026-03-08', amount: 47 },
    { date: '2026-03-09', amount: 0 },
    { date: '2026-03-10', amount: 22097 },
    { date: '2026-03-11', amount: 0 },
    { date: '2026-03-12', amount: 12194 },
    { date: '2026-03-13', amount: 47 },
    { date: '2026-03-14', amount: 0 },
    { date: '2026-03-15', amount: 0, notCaptured: true },
    { date: '2026-03-16', amount: 22000 },
    { date: '2026-03-17', amount: 97 },
    { date: '2026-03-18', amount: 388 },
    { date: '2026-03-19', amount: 94 },
    { date: '2026-03-20', amount: 11000 },
    { date: '2026-03-21', amount: 0, notCaptured: true },
    { date: '2026-03-22', amount: 0 },
    { date: '2026-03-23', amount: 0 },
    { date: '2026-03-24', amount: 21500, approximate: true },
    { date: '2026-03-25', amount: 0 },
    { date: '2026-03-26', amount: 11097 },
    { date: '2026-03-27', amount: 22000, approximate: true },
    { date: '2026-03-28', amount: 0, notCaptured: true },
    { date: '2026-03-29', amount: 0, notCaptured: true },
    { date: '2026-03-30', amount: 0, notCaptured: true },
    { date: '2026-03-31', amount: 11000 },
    { date: '2026-04-01', amount: 0 },
    { date: '2026-04-02', amount: 0 },
    { date: '2026-04-03', amount: 0 },
    { date: '2026-04-04', amount: 97 },
  ],
  // Only one month was visible in the screenshot crop ($138.6k). Assumption:
  // that bar is March 2026 (its sum roughly matches the daily data above).
  // Adjacent months padded with $0 per Section 5.1 instructions — not invented history.
  monthlyCash: [
    { month: '2026-01', amount: 0 },
    { month: '2026-02', amount: 0 },
    { month: '2026-03', amount: 138600 },
    { month: '2026-04', amount: 0 },
  ],
}

// ---------------------------------------------------------------------------
// 5.2 Revenue & Masterclass Dashboard — single Masterclass run selected
// ---------------------------------------------------------------------------

export const masterclassFunnelTemplate = [
  'Registered',
  'VIP Upgrade',
  'Replay Optin',
  'Appointment Booked',
  'No-Showed',
  'Bad Fit',
  'Call Cancelled / Not Interested',
  'Call Cancelled / Need To Reschedule',
  'Pending Sale',
  'Close Lost',
  'Close Won',
] as const

/** The one run with real (screenshot-sourced) numbers. */
const apr15Run: MasterclassRun = {
  date: '2026-04-15',
  label: '15 Apr 2026',
  registered: 2050,
  showUpRatePct: 18.45,
  attended: 370,
  vipUpgrade: 35,
  cashFromVip: 2516,
  application: 128,
  attendToAppPct: 34.6,
  allTimeRevenue: 174016,
  dealsClosed: 16,
  cashFromAds: 139531,
  cashFromOrganic: 34485,
  deals: [], // Phase 1 screenshot only captured the aggregate, not line items
  executiveSummary: {
    bullets: [
      'In the selected period, your campaigns generated 517 leads from Ads with 4,891 link clicks (10.57% click-to-lead rate).',
      'Total ad spend was $8,392.03, resulting in a Cost Per Lead of $16.23 and a Cost Per Click of $1.72.',
      'Click-through rate was 2.43%, and ROAS is 0.01.',
    ],
  },
  marketingPerformance: {
    sourceLabel: 'Data Source: Facebook Ads Manager report',
    adSpend: 8392,
    linkClicks: 4891,
    ctrPct: 2.43,
    leadsGenerated: 517,
    costPerLead: 16.23,
    roas: 0.01,
  },
}

/** Mock weekly-Friday dates for the selector — batch-date logic is unresolved, see README/Section 6. */
const otherRunDates = [
  { date: '2026-04-17', label: '17 Apr 2026' },
  { date: '2026-04-10', label: '10 Apr 2026' },
  { date: '2026-04-03', label: '03 Apr 2026' },
  { date: '2026-03-27', label: '27 Mar 2026' },
  { date: '2026-03-20', label: '20 Mar 2026' },
  { date: '2026-03-13', label: '13 Mar 2026' },
  { date: '2026-03-06', label: '06 Mar 2026' },
  { date: '2026-02-27', label: '27 Feb 2026' },
  { date: '2026-02-20', label: '20 Feb 2026' },
]

const emptyRun = (date: string, label: string): MasterclassRun => ({
  date,
  label,
  registered: 0,
  showUpRatePct: 0,
  attended: 0,
  vipUpgrade: 0,
  cashFromVip: 0,
  application: 0,
  attendToAppPct: 0,
  allTimeRevenue: 0,
  dealsClosed: 0,
  cashFromAds: 0,
  cashFromOrganic: 0,
  deals: [],
  executiveSummary: { bullets: [] },
  marketingPerformance: {
    sourceLabel: 'Data Source: Facebook Ads Manager report',
    adSpend: 0,
    linkClicks: 0,
    ctrPct: 0,
    leadsGenerated: 0,
    costPerLead: 0,
    roas: 0,
  },
})

export const masterclassRuns: MasterclassRun[] = [
  apr15Run,
  ...otherRunDates.map((d) => emptyRun(d.date, d.label)),
].sort((a, b) => (a.date < b.date ? 1 : -1))

export const defaultMasterclassRunDate = apr15Run.date

// ---------------------------------------------------------------------------
// 5.3 Marketing Dashboard
// ---------------------------------------------------------------------------

export const marketingBreakdown: MarketingBreakdown = {
  periodLabel: '1 Jan 2026 – 16 Apr 2026',
  executiveSummary: {
    bullets: [
      'In the selected period, your campaigns generated 617 leads from 14,629 link clicks (4.22% click-to-lead rate).',
      'Total ad spend was $40,522.08, resulting in a Cost Per Lead of $65.68 and a Cost Per Booking of $413.49.',
      'Click-through rate was 1.94%, and ROAS is 3.44.',
    ],
  },
  impressions: 753297,
  reach: 609723,
  linkClicks: 14629,
  clickThroughPct: 1.94,
  leadsAdsManager: 1924,
  clickToLeadPct: 4.22,
  booking: 389,
  leadToBookPct: 18.98,
  sale: null, // TODO: confirm — value cut off in source screenshot
  // "No data" in source — explicit unattributed state, not a real number, until Phase 2 wires attribution
  cashReceivedFromAds: { value: 139531, noData: true },
  cashReceivedOrganic: { value: 34485, noData: true },
  totalAdSpend: { value: 40522, noData: true },
  cpm1000: 53.79,
  costPerLinkClick: 2.77,
  costPerLead: 65.68,
  costPerBooking: 413.49,
  costPerSale: 1039.03,
  netProfit: null, // TODO: confirm — label visible, value cut off in source
  roas: null, // TODO: confirm — label visible, value cut off in source
  totalCallsBooked: 389,
  callsFromAds: 98,
  callsFromOrganic: 291,
  noShowCancelled: 0,
  noShowCancelledPct: 0.0,
  vipUpgrade: 35,
  applicationDeposit: 128,
}
