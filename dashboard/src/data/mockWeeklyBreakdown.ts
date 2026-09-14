/**
 * Mock data for the Granular View page — transcribed from a screenshot of
 * the "FA | Marketing Funnel Dashboard" Google Sheet (tab "2026 FB Ads
 * Dashboard"). Only WK29–WK33 (13 Jul – 16 Aug 2026) were fully legible in
 * the crop; the partially-cut-off WK28 column is intentionally omitted
 * rather than guessed. All other weeks are genuinely blank (not yet
 * reported / future), matching how the source sheet displays them.
 *
 * Independent of the Marketing page's period picker — this table always
 * shows the full weekly/monthly history, exactly like the source sheet.
 *
 * monthlyRows is NOT a second source of truth — it's a naive rollup of
 * weeklyRows (sum for number/currency, average for percent, bucketing each
 * week into the month its Monday falls in) purely so the Monthly Breakdown
 * table has something to render in Phase 1. There is no real monthly source
 * data yet; see README.
 */
import { generateWeeks, generateMonths } from '../utils/dateRanges'

export type CellValue = number | 'N/A' | null

export interface BreakdownRow {
  key: string
  label: string
  group: string
  indent?: boolean
  format: 'currency' | 'number' | 'percent'
  ytd: number | null
  values: Record<string, CellValue> // keyed by week's Monday ISO date
}

export const WEEK_COLUMN_CAP = 50

// The sheet is a per-calendar-year tab ("2026 FB Ads Dashboard") — mirror that
// with a full year of weeks, capped at WEEK_COLUMN_CAP per the build request.
export const weeklyColumns = generateWeeks(new Date(2026, 0, 1), new Date(2026, 11, 31)).slice(
  0,
  WEEK_COLUMN_CAP,
)

export const weeklyRowGroups: Record<string, { label: string }> = {
  adSpend: { label: 'Ad Spend' },
  charlie: { label: 'Charlie (AI Dialer) Bookings' },
  dialer: { label: 'Dialer Leads' },
  outbound: { label: 'Outbound Bookings' },
  otherBookings: { label: 'All Other Bookings' },
  overall: { label: 'Overall Bookings' },
  calls: { label: 'Calls' },
  sales: { label: 'Sales' },
  efficiency: { label: 'Cost Efficiency' },
}

export const weeklyRows: BreakdownRow[] = [
  {
    key: 'adSpend',
    label: 'Ad Spend',
    group: 'adSpend',
    format: 'currency',
    ytd: 244509.31,
    values: {
      '2026-07-13': 9374.01,
      '2026-07-20': 9428.61,
      '2026-07-27': 6456.31,
      '2026-08-03': 7652.93,
      '2026-08-10': 2012.05,
    },
  },
  {
    key: 'charlieBookings',
    label: '# Charlie Bookings',
    group: 'charlie',
    format: 'number',
    ytd: 141,
    values: { '2026-07-13': 0, '2026-07-20': 0, '2026-07-27': 1, '2026-08-03': 0, '2026-08-10': null },
  },
  {
    key: 'charlieConversationRate',
    label: 'Conversation Rate',
    group: 'charlie',
    format: 'percent',
    ytd: 44.44,
    values: { '2026-07-13': null, '2026-07-20': null, '2026-07-27': 15.38, '2026-08-03': 33.33, '2026-08-10': null },
  },
  {
    key: 'charlieBookingsPerConversation',
    label: '% Bookings/Conversations',
    group: 'charlie',
    format: 'percent',
    ytd: 18.78,
    values: { '2026-07-13': null, '2026-07-20': null, '2026-07-27': 50.0, '2026-08-03': 0.0, '2026-08-10': null },
  },
  {
    key: 'charlieBookingsPerLead',
    label: '% Bookings/Leads',
    group: 'charlie',
    format: 'percent',
    ytd: 6.0,
    values: { '2026-07-13': null, '2026-07-20': null, '2026-07-27': 7.69, '2026-08-03': 0.0, '2026-08-10': null },
  },
  {
    key: 'dialerLeads',
    label: '# Dialer Leads',
    group: 'dialer',
    format: 'number',
    ytd: 2964,
    values: { '2026-07-13': 170, '2026-07-20': 218, '2026-07-27': 259, '2026-08-03': 245, '2026-08-10': null },
  },
  {
    key: 'dialerCostPerLead',
    label: '$ per Dialer lead',
    group: 'dialer',
    format: 'currency',
    ytd: 82.49,
    values: { '2026-07-13': 55.14, '2026-07-20': 43.25, '2026-07-27': 24.93, '2026-08-03': 31.24, '2026-08-10': null },
  },
  {
    key: 'dialerPickupRate',
    label: 'Dialer Pickup Rate',
    group: 'dialer',
    format: 'percent',
    ytd: 11.94,
    values: { '2026-07-13': 14.52, '2026-07-20': 7.11, '2026-07-27': 11.65, '2026-08-03': 17.91, '2026-08-10': null },
  },
  {
    key: 'outboundBookings',
    label: '# Outbound Bookings',
    group: 'outbound',
    format: 'number',
    ytd: 742,
    values: { '2026-07-13': 31, '2026-07-20': 15, '2026-07-27': 19, '2026-08-03': 11, '2026-08-10': 1 },
  },
  {
    key: 't3Bookings',
    label: 'T3 Bookings',
    group: 'outbound',
    indent: true,
    format: 'number',
    ytd: null,
    values: { '2026-07-13': 11, '2026-07-20': 1, '2026-07-27': null, '2026-08-03': 4, '2026-08-10': null },
  },
  {
    key: 'sgBookings',
    label: 'SG Bookings',
    group: 'outbound',
    indent: true,
    format: 'number',
    ytd: null,
    values: { '2026-07-13': 20, '2026-07-20': 14, '2026-07-27': 19, '2026-08-03': 8, '2026-08-10': null },
  },
  {
    key: 'outboundBookingsPerLead',
    label: '% Bookings/Leads',
    group: 'outbound',
    format: 'percent',
    ytd: 25.03,
    values: { '2026-07-13': 18.24, '2026-07-20': 6.88, '2026-07-27': 7.34, '2026-08-03': 4.49, '2026-08-10': null },
  },
  {
    key: 'allOtherBookings',
    label: 'All Other Bookings',
    group: 'otherBookings',
    format: 'number',
    ytd: 497,
    values: { '2026-07-13': 21, '2026-07-20': 19, '2026-07-27': 14, '2026-08-03': 34, '2026-08-10': 12 },
  },
  {
    key: 'applicationFunnel',
    label: 'Application Funnel',
    group: 'otherBookings',
    indent: true,
    format: 'number',
    ytd: null,
    values: { '2026-07-13': 14, '2026-07-20': 11, '2026-07-27': 4, '2026-08-03': 2, '2026-08-10': null },
  },
  {
    key: 'masterclassBookings',
    label: 'Masterclass',
    group: 'otherBookings',
    indent: true,
    format: 'number',
    ytd: null,
    values: { '2026-07-13': 5, '2026-07-20': 7, '2026-07-27': 10, '2026-08-03': 31, '2026-08-10': null },
  },
  {
    key: 'threeDcFunnel',
    label: '3DC Funnel',
    group: 'otherBookings',
    indent: true,
    format: 'number',
    ytd: null,
    values: { '2026-07-13': 2, '2026-07-20': 1, '2026-07-27': null, '2026-08-03': null, '2026-08-10': null },
  },
  {
    key: 'onlineBookings',
    label: 'Online',
    group: 'otherBookings',
    indent: true,
    format: 'number',
    ytd: null,
    values: {},
  },
  {
    key: 'vipBookings',
    label: 'VIP',
    group: 'otherBookings',
    indent: true,
    format: 'number',
    ytd: null,
    values: {},
  },
  {
    key: 'overallBookings',
    label: '# Overall Bookings',
    group: 'overall',
    format: 'number',
    ytd: 1380,
    values: { '2026-07-13': 52, '2026-07-20': 34, '2026-07-27': 34, '2026-08-03': 45, '2026-08-10': 13 },
  },
  {
    key: 'costPerBooking',
    label: '$ Booking',
    group: 'overall',
    format: 'currency',
    ytd: 177.18,
    values: {
      '2026-07-13': 180.27,
      '2026-07-20': 277.31,
      '2026-07-27': 189.89,
      '2026-08-03': 170.07,
      '2026-08-10': 154.77,
    },
  },
  {
    key: 'calls',
    label: '# Calls',
    group: 'calls',
    format: 'number',
    ytd: 583,
    values: { '2026-07-13': 12, '2026-07-20': 17, '2026-07-27': 16, '2026-08-03': 29, '2026-08-10': null },
  },
  {
    key: 'callsPerBooking',
    label: '% Calls/Bookings',
    group: 'calls',
    format: 'percent',
    ytd: 42.25,
    values: { '2026-07-13': 23.08, '2026-07-20': 50.0, '2026-07-27': 47.06, '2026-08-03': 64.44, '2026-08-10': 0.0 },
  },
  {
    key: 'costPerCall',
    label: '$ Call',
    group: 'calls',
    format: 'currency',
    ytd: 419.4,
    values: { '2026-07-13': 781.17, '2026-07-20': 554.62, '2026-07-27': 403.52, '2026-08-03': 263.89, '2026-08-10': null },
  },
  {
    key: 'sales',
    label: '# Sales',
    group: 'sales',
    format: 'number',
    ytd: 90,
    values: { '2026-07-13': 2, '2026-07-20': 0, '2026-07-27': 3, '2026-08-03': 4, '2026-08-10': 2 },
  },
  {
    key: 'salesPct',
    label: '% Sales',
    group: 'sales',
    format: 'percent',
    ytd: 16.09,
    values: { '2026-07-13': 16.67, '2026-07-20': 0.0, '2026-07-27': 18.75, '2026-08-03': 13.79, '2026-08-10': null },
  },
  {
    key: 'costPerSale',
    label: '$ Cost Per Sale',
    group: 'efficiency',
    format: 'currency',
    ytd: 2716.77,
    values: {
      '2026-07-13': 4687.01,
      '2026-07-20': 'N/A',
      '2026-07-27': 2152.1,
      '2026-08-03': 1913.23,
      '2026-08-10': 1006.03,
    },
  },
  {
    key: 'salesEffPct',
    label: 'SALES % EFF',
    group: 'efficiency',
    format: 'percent',
    ytd: 6.52,
    values: { '2026-07-13': 3.85, '2026-07-20': 0.0, '2026-07-27': 8.82, '2026-08-03': 8.89, '2026-08-10': null },
  },
  {
    key: 'cashCollected',
    label: 'Cash Collected',
    group: 'efficiency',
    format: 'currency',
    ytd: 729182.68,
    values: {
      '2026-07-13': 24120.0,
      '2026-07-20': 1640.0,
      '2026-07-27': 30166.68,
      '2026-08-03': 26197.0,
      '2026-08-10': null,
    },
  },
  {
    key: 'roas',
    label: 'ROAS',
    group: 'efficiency',
    format: 'currency',
    ytd: 2.98,
    values: { '2026-07-13': 2.57, '2026-07-20': 0.17, '2026-07-27': 4.67, '2026-08-03': 3.42, '2026-08-10': 0.0 },
  },
]

// ---------------------------------------------------------------------------
// Monthly Breakdown — naive rollup of weeklyRows (see file header)
// ---------------------------------------------------------------------------

export const MONTH_COLUMN_CAP = 50

export const monthlyColumns = generateMonths(new Date(2026, 0, 1), new Date(2026, 11, 31)).slice(
  0,
  MONTH_COLUMN_CAP,
)

function monthKeyOfWeek(weekStartISO: string): string {
  return weekStartISO.slice(0, 7) // 'YYYY-MM' — buckets a week by the month its Monday falls in
}

export const monthlyRows: BreakdownRow[] = weeklyRows.map((row) => {
  const values: Record<string, CellValue> = {}
  for (const month of monthlyColumns) {
    const weeksInMonth = weeklyColumns.filter((w) => monthKeyOfWeek(w.key) === month.key)
    const numeric = weeksInMonth
      .map((w) => row.values[w.key])
      .filter((v): v is number => typeof v === 'number')
    if (numeric.length === 0) {
      values[month.key] = null
      continue
    }
    values[month.key] =
      row.format === 'percent'
        ? numeric.reduce((a, b) => a + b, 0) / numeric.length
        : numeric.reduce((a, b) => a + b, 0)
  }
  return { ...row, values }
})
