import { useEffect, useMemo, useState } from 'react'
import { BreakdownTable, GROUP_TINTS, type BreakdownColumn } from '../components/BreakdownTable'
import { TrendLineChart, type TrendSeries } from '../components/TrendLineChart'
import { CATEGORICAL } from '../utils/chartPalette'
import { loadLiveData, sumAdSpendInRange, type LiveAdSpendDay } from '../data/liveData'
import type { BreakdownRow, CellValue } from '../data/mockWeeklyBreakdown'
import {
  weeklyColumns,
  weeklyRows,
  monthlyColumns,
  monthlyRows,
  weeklyRowGroups,
  WEEK_COLUMN_CAP,
  MONTH_COLUMN_CAP,
} from '../data/mockWeeklyBreakdown'

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const TREND_SERIES: TrendSeries[] = [
  { key: 'adSpend', label: 'Ad Spend', color: CATEGORICAL[0] },
  { key: 'cashCollected', label: 'Cash Collected', color: CATEGORICAL[6] },
]

const monthColumns: BreakdownColumn[] = monthlyColumns.map((m) => ({
  key: m.key,
  headerTop: MONTH_ABBR[m.month],
  headerBottom: String(m.year),
}))

const weekColumns: BreakdownColumn[] = weeklyColumns.map((w) => ({
  key: w.key,
  headerTop: `W${w.isoWeek}`,
  headerBottom: w.start.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }),
}))

/** Overrides just the 'adSpend' row's values with real weekly sums where live daily data covers that week. */
function withLiveAdSpend(rows: BreakdownRow[], days: LiveAdSpendDay[]): BreakdownRow[] {
  if (days.length === 0) return rows
  return rows.map((row) => {
    if (row.key !== 'adSpend') return row
    const values: Record<string, CellValue> = { ...row.values }
    for (const w of weeklyColumns) {
      const sum = sumAdSpendInRange(days, w.start, w.end)
      if (sum) values[w.key] = sum.spend
    }
    return { ...row, values }
  })
}

/** Same override, rolled up to months (sum of the weeks whose Monday falls in that month). */
function withLiveAdSpendMonthly(rows: BreakdownRow[], days: LiveAdSpendDay[]): BreakdownRow[] {
  if (days.length === 0) return rows
  return rows.map((row) => {
    if (row.key !== 'adSpend') return row
    const values: Record<string, CellValue> = { ...row.values }
    for (const m of monthlyColumns) {
      const monthWeeks = weeklyColumns.filter((w) => w.key.slice(0, 7) === m.key)
      const sums = monthWeeks
        .map((w) => sumAdSpendInRange(days, w.start, w.end))
        .filter((s): s is NonNullable<typeof s> => s !== null)
      if (sums.length > 0) values[m.key] = sums.reduce((a, s) => a + s.spend, 0)
    }
    return { ...row, values }
  })
}

function GroupLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {Object.entries(weeklyRowGroups).map(([key, g]) => (
        <div key={key} className="flex items-center gap-1.5 text-xs text-fa-text-faint">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: GROUP_TINTS[key]?.replace('0.10', '0.6') ?? 'transparent' }} />
          {g.label}
        </div>
      ))}
    </div>
  )
}

export function GranularViewPage() {
  const [adSpendDaily, setAdSpendDaily] = useState<LiveAdSpendDay[]>([])

  useEffect(() => {
    loadLiveData().then((data) => {
      if (data) setAdSpendDaily(data.adSpendDaily || [])
    })
  }, [])

  const liveWeeklyRows = useMemo(() => withLiveAdSpend(weeklyRows, adSpendDaily), [adSpendDaily])
  const liveMonthlyRows = useMemo(() => withLiveAdSpendMonthly(monthlyRows, adSpendDaily), [adSpendDaily])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-fa-text">Granular View</h1>
        <p className="mt-1 text-sm text-fa-text-dim">
          Full-year funnel detail — mirrors the "2026 FB Ads Dashboard" sheet tab. Independent of the date picker on
          the Marketing page.
          {adSpendDaily.length > 0 && (
            <span className="ml-2 text-fa-neon">Ad Spend row is live Meta data for 13 Jul – 12 Aug 2026.</span>
          )}
        </p>
      </div>

      <GroupLegend />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-fa-text">Monthly Breakdown</h2>
          <p className="text-xs text-fa-text-faint">
            Derived by rolling up the weekly rows below (sum for counts/currency, average for rates) — a Phase 1
            illustration, not a real monthly source, except Ad Spend which sums the live daily pull. Capped at{' '}
            {MONTH_COLUMN_CAP} month columns ({monthColumns.length} shown).
          </p>
        </div>
        <TrendLineChart
          title="Ad Spend vs. Cash Collected — Monthly Trend"
          subtitle="Months with reported data only · Ad Spend is live"
          columns={monthColumns}
          rows={liveMonthlyRows}
          series={TREND_SERIES}
        />
        <BreakdownTable rows={liveMonthlyRows} columns={monthColumns} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-fa-text">Weekly Breakdown</h2>
          <p className="text-xs text-fa-text-faint">
            WK29–WK33 (13 Jul – 16 Aug 2026) are transcribed from the source sheet screenshot; earlier weeks feed the
            YTD column but weren't legible in that crop, and later weeks are genuinely not yet reported — both render
            as "—". Ad Spend for that same window has since been replaced with a live Meta pull. Capped at{' '}
            {WEEK_COLUMN_CAP} week columns ({weekColumns.length} shown).
          </p>
        </div>
        <TrendLineChart
          title="Ad Spend vs. Cash Collected — Weekly Trend"
          subtitle="Weeks with reported data only · Ad Spend is live"
          columns={weekColumns}
          rows={liveWeeklyRows}
          series={TREND_SERIES}
        />
        <BreakdownTable rows={liveWeeklyRows} columns={weekColumns} />
      </section>

      <p className="text-xs text-fa-text-faint">See the README for the full list of assumptions behind this page.</p>
    </div>
  )
}
