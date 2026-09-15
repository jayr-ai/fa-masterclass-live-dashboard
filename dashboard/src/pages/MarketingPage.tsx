import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { StatCard } from '../components/StatCard'
import { PeriodPicker, resolvePeriod, resolvePreviousPeriod, defaultPeriodValue, type PeriodValue } from '../components/PeriodPicker'
import { loadLiveData, loadCashAttributionData, sumAdSpendInRange, type LiveAdSpendDay, type LiveTransaction } from '../data/liveData'
import { formatCurrency, formatNumber, formatPct } from '../utils/format'

type SourceFilter = 'all' | 'paid' | 'organic'

export function MarketingPage() {
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriodValue)
  const resolved = resolvePeriod(period)
  const [adSpendDaily, setAdSpendDaily] = useState<LiveAdSpendDay[]>([])
  const [transactions, setTransactions] = useState<LiveTransaction[]>([])
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [salesPageNum, setSalesPageNum] = useState(1)
  const ITEMS_PER_PAGE = 40

  useEffect(() => {
    loadLiveData().then((data) => {
      if (!data) return
      setAdSpendDaily(data.adSpendDaily || [])
    })
  }, [])

  useEffect(() => {
    loadCashAttributionData().then((data) => {
      if (!data) return
      // Use transactions from BigQuery (real data source)
      setTransactions(data.transactions)
    })
  }, [])

  const previousPeriod = resolvePreviousPeriod(period)
  const live = sumAdSpendInRange(adSpendDaily, resolved.from, resolved.to)
  const previous = sumAdSpendInRange(adSpendDaily, previousPeriod.from, previousPeriod.to)

  const totalAdSpend = live ? live.spend : null
  const impressions = live ? live.impressions : 0
  const linkClicks = live ? live.linkClicks : 0
  const leadsAdsManager = live ? live.leads : 0
  const clickToLeadPct = live && live.linkClicks > 0 ? (live.leads / live.linkClicks) * 100 : 0
  const ctrPct = live && live.impressions > 0 ? (live.linkClicks / live.impressions) * 100 : 0
  const cpm = live && live.impressions > 0 ? (live.spend / live.impressions) * 1000 : 0
  const cpl = live && live.leads > 0 ? live.spend / live.leads : 0

  // Calculate period-over-period trends
  const impressionsTrend = previous && previous.impressions > 0
    ? ((impressions - previous.impressions) / previous.impressions) * 100
    : null
  const clicksTrend = previous && previous.linkClicks > 0
    ? ((linkClicks - previous.linkClicks) / previous.linkClicks) * 100
    : null
  const ctrTrend = previous && previous.impressions > 0
    ? (ctrPct - ((previous.linkClicks / previous.impressions) * 100))
    : null
  const leadsTrend = previous && previous.leads > 0
    ? ((leadsAdsManager - previous.leads) / previous.leads) * 100
    : null
  const clickToLeadTrend = previous && previous.linkClicks > 0
    ? (clickToLeadPct - ((previous.leads / previous.linkClicks) * 100))
    : null
  const cpmPrevious = previous && previous.impressions > 0 ? (previous.spend / previous.impressions) * 1000 : 0
  const cpmTrend = cpmPrevious > 0 ? ((cpm - cpmPrevious) / cpmPrevious) * 100 : null
  const cplPrevious = previous && previous.leads > 0 ? previous.spend / previous.leads : 0
  const cplTrend = cplPrevious > 0 ? ((cpl - cplPrevious) / cplPrevious) * 100 : null

  // Individual transactions from the CONSOLIDATED sheet in the selected
  // period, filtered by source. Plain YYYY-MM-DD string comparison — no
  // Date-object/timezone conversion, since both the period bounds and the
  // transaction dates are already Sydney-calendar-date strings.
  const transactionsInPeriod = transactions.filter((transaction) => {
    const inPeriod = transaction.date >= resolved.fromStr && transaction.date <= resolved.toStr
    if (!inPeriod) return false
    if (sourceFilter === 'all') return true
    const txSource = transaction.source === 'Paid' ? 'paid' : 'organic'
    return txSource === sourceFilter
  })

  const totalTransactionsAmount = transactionsInPeriod.reduce((sum, tx) => sum + tx.amount, 0)

  // Calculate cash attribution from transactions (source of truth for v2)
  const cashFromAdsV2 = transactionsInPeriod
    .filter(tx => tx.source === 'Paid')
    .reduce((sum, tx) => sum + tx.amount, 0)
  const cashFromOrganicV2 = transactionsInPeriod
    .filter(tx => tx.source === 'Organic')
    .reduce((sum, tx) => sum + tx.amount, 0)

  // Calculate previous period cash for trends — same period mode (weekly/
  // monthly/custom) as the selected one, not always "previous month".
  const transactionsInPreviousPeriod = transactions.filter((transaction) => {
    return transaction.date >= previousPeriod.fromStr && transaction.date <= previousPeriod.toStr
  })
  const previousCashFromAds = transactionsInPreviousPeriod
    .filter(tx => tx.source === 'Paid')
    .reduce((sum, tx) => sum + tx.amount, 0)
  const previousCashFromOrganic = transactionsInPreviousPeriod
    .filter(tx => tx.source === 'Organic')
    .reduce((sum, tx) => sum + tx.amount, 0)
  const previousTotalCash = previousCashFromAds + previousCashFromOrganic
  const previousTotalAdSpend = previous?.spend ?? 0
  const previousROAS = previousTotalAdSpend > 0 ? previousTotalCash / previousTotalAdSpend : 0

  // Cash Attribution trends
  const totalCashTrend = previousTotalCash > 0
    ? (((cashFromAdsV2 + cashFromOrganicV2) - previousTotalCash) / previousTotalCash) * 100
    : null
  const cashFromAdsTrend = previousCashFromAds > 0
    ? ((cashFromAdsV2 - previousCashFromAds) / previousCashFromAds) * 100
    : null
  const cashFromOrganicTrend = previousCashFromOrganic > 0
    ? ((cashFromOrganicV2 - previousCashFromOrganic) / previousCashFromOrganic) * 100
    : null
  const totalAdSpendTrend = previousTotalAdSpend > 0 && totalAdSpend !== null
    ? ((totalAdSpend - previousTotalAdSpend) / previousTotalAdSpend) * 100
    : null
  const roasTrend = previousROAS > 0 && totalAdSpend !== null && totalAdSpend > 0
    ? ((((cashFromAdsV2 + cashFromOrganicV2) / totalAdSpend) - previousROAS) / previousROAS) * 100
    : null

  console.log('Cash trends:', { totalCashTrend, cashFromAdsTrend, cashFromOrganicTrend, totalAdSpendTrend, roasTrend, previousTotalCash, previousCashFromAds, previousCashFromOrganic })

  // Build daily breakdown v2 from transactions
  const dailyBreakdownV2 = Array.from(
    transactionsInPeriod.reduce((map, tx) => {
      if (!map.has(tx.date)) {
        map.set(tx.date, { date: tx.date, paid: 0, organic: 0 })
      }
      const day = map.get(tx.date)!
      if (tx.source === 'Paid') {
        day.paid += tx.amount
      } else {
        day.organic += tx.amount
      }
      return map
    }, new Map<string, any>())
  )
    .map(([_, day]) => day)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-fa-text">Marketing Dashboard</h1>
          <p className="mt-1 text-sm text-fa-text-dim">
            Showing <span className="text-fa-text">{resolved.label}</span>
            {live && (
              <span className="ml-2 text-xs text-fa-neon">
                · live Meta data ({live.dayCount} day{live.dayCount === 1 ? '' : 's'})
              </span>
            )}
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-fa-text-dim">Ad Performance</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-7">
          <StatCard label="Impressions" value={formatNumber(impressions)} trendPct={impressionsTrend} sublabel={live ? 'live' : undefined} />
          <StatCard label="Link Clicks" value={formatNumber(linkClicks)} trendPct={clicksTrend} sublabel={live ? 'live' : undefined} />
          <StatCard label="Click Through %" value={formatPct(ctrPct)} trendPct={ctrTrend} sublabel={live ? 'live' : undefined} />
          <StatCard label="Leads Generated" value={formatNumber(leadsAdsManager)} trendPct={leadsTrend} sublabel={live ? 'live Meta data' : undefined} />
          <StatCard label="Click To Lead %" value={formatPct(clickToLeadPct)} trendPct={clickToLeadTrend} sublabel={live ? 'live' : undefined} />
          <StatCard label="CPM" value={formatCurrency(cpm, { exact: true })} trendPct={cpmTrend} trendDirection="lower-is-better" sublabel={live ? 'per 1000' : undefined} />
          <StatCard label="CPL" value={formatCurrency(cpl, { exact: true })} trendPct={cplTrend} trendDirection="lower-is-better" sublabel={live ? 'per lead' : undefined} />
        </div>
      </section>


      <section>
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-fa-text-dim">
          Cash Attribution <span className="text-fa-neon">(Calculated From Transactions)</span>
          <span className="ml-2 normal-case text-fa-text-faint">
            — Consolidated Stripe, EFT, Finance
          </span>
        </h2>

        {/* KPI Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard
            label="Total Cash (Ads+Organic)"
            value={formatCurrency(Math.round(cashFromAdsV2 + cashFromOrganicV2))}
            trendPct={totalCashTrend}
            sublabel="From Transactions"
          />
          <StatCard
            label="Cash Received (Ads)"
            value={formatCurrency(Math.round(cashFromAdsV2))}
            trendPct={cashFromAdsTrend}
            sublabel="From Transactions"
          />
          <StatCard
            label="Cash Received (Organic)"
            value={formatCurrency(Math.round(cashFromOrganicV2))}
            trendPct={cashFromOrganicTrend}
            sublabel="From Transactions"
          />
          {totalAdSpend !== null ? (
            <StatCard label="Total Ad Spend" value={formatCurrency(totalAdSpend, { exact: true })} trendPct={totalAdSpendTrend} trendDirection="lower-is-better" sublabel="live Meta data" />
          ) : (
            <StatCard label="Total Ad Spend" value="" variant="noData" />
          )}
          <StatCard
            label="ROAS"
            value={(totalAdSpend && totalAdSpend > 0 ? ((cashFromAdsV2 + cashFromOrganicV2) / totalAdSpend).toFixed(2) : '0.00')}
            trendPct={roasTrend}
            sublabel={totalAdSpend ? 'Return on Ad Spend' : undefined}
          />
        </div>

        {/* Charts Row */}
        {dailyBreakdownV2.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Donut Chart - Revenue Mix */}
            <div className="rounded-lg border border-fa-border bg-fa-surface p-6">
              <h3 className="mb-4 text-sm font-semibold text-fa-text">Revenue Source Mix</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Ads', value: Math.round(Math.max(0, cashFromAdsV2)) },
                      { name: 'Organic', value: Math.round(Math.max(0, cashFromOrganicV2)) }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#20d020" />
                    <Cell fill="#666666" />
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 flex justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: '#20d020' }}></div>
                  <span className="text-fa-text">Ads: {formatCurrency(Math.round(cashFromAdsV2))}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-gray-600"></div>
                  <span className="text-fa-text">Organic: {formatCurrency(Math.round(cashFromOrganicV2))}</span>
                </div>
              </div>
            </div>

            {/* Bar Chart - Daily Cash Breakdown */}
            <div className="rounded-lg border border-fa-border bg-fa-surface p-6 lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold text-fa-text">Daily Cash Received</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyBreakdownV2.slice(-30)} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" tick={{ fill: '#999', fontSize: 12 }} tickFormatter={(date) => new Date(date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} />
                  <YAxis tick={{ fill: '#999', fontSize: 12 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} labelFormatter={(date) => date ? new Date(date as string).toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' }) : ''} contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', color: '#fff' }} />
                  <Legend wrapperStyle={{ color: '#ccc' }} />
                  <ReferenceLine y={dailyBreakdownV2.reduce((sum, d) => sum + d.paid + d.organic, 0) / dailyBreakdownV2.length} stroke="#666" strokeDasharray="5 5" name="Daily Avg" label={{ value: 'Daily Avg', position: 'right', fill: '#999', fontSize: 12 }} />
                  <Bar dataKey="paid" stackId="a" fill="#20d020" name="Ads" />
                  <Bar dataKey="organic" stackId="a" fill="#666666" name="Organic" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-fa-text-dim">
            Sales Breakdown by Channel
            <span className="ml-2 normal-case text-fa-text-faint">
              — Individual deals with source attribution (Paid vs Organic)
            </span>
          </h2>
          <div className="flex gap-2">
            {(['all', 'paid', 'organic'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setSourceFilter(filter)
                  setSalesPageNum(1)
                }}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  sourceFilter === filter
                    ? 'border-fa-accent/34 bg-fa-surface-2 text-fa-text'
                    : 'border-fa-border text-fa-text-dim hover:text-fa-text'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'paid' ? 'Paid' : 'Organic'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-fa-border bg-fa-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fa-border bg-fa-surface-2">
                <th className="px-4 py-3 text-left font-medium text-fa-text-dim">Date</th>
                <th className="px-4 py-3 text-left font-medium text-fa-text-dim">Name</th>
                <th className="px-4 py-3 text-left font-medium text-fa-text-dim">Email</th>
                <th className="px-4 py-3 text-left font-medium text-fa-text-dim">Product</th>
                <th className="px-4 py-3 text-right font-medium text-fa-text-dim">Amount</th>
                <th className="px-4 py-3 text-center font-medium text-fa-text-dim">Source</th>
              </tr>
            </thead>
            <tbody>
              {transactionsInPeriod.length > 0 ? (
                transactionsInPeriod.slice((salesPageNum - 1) * ITEMS_PER_PAGE, salesPageNum * ITEMS_PER_PAGE).map((tx, idx) => (
                  <tr key={`${tx.date}-${tx.email}-${idx}`} className="border-b border-fa-border/50 hover:bg-fa-surface-2/50">
                    <td className="px-4 py-3 text-fa-text">{tx.date}</td>
                    <td className="px-4 py-3 text-fa-text">{tx.name}</td>
                    <td className="px-4 py-3 text-fa-text-dim text-xs">{tx.email}</td>
                    <td className="px-4 py-3 text-fa-text">{tx.product}</td>
                    <td className="px-4 py-3 text-right font-semibold text-fa-neon">{formatCurrency(tx.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                          tx.source === 'Paid'
                            ? 'bg-fa-accent/30 text-fa-accent'
                            : 'bg-fa-neon/30 text-fa-neon'
                        }`}
                      >
                        {tx.source}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-fa-text-dim">
                    No sales data for this period and filter
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-fa-border bg-fa-surface-2 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-right text-fa-text">
                  {sourceFilter === 'all' ? 'Total' : `Total (${sourceFilter === 'paid' ? 'Paid' : 'Organic'})`}
                </td>
                <td className="px-4 py-3 text-right text-fa-neon">{formatCurrency(totalTransactionsAmount)}</td>
                <td className="px-4 py-3 text-center text-fa-text">
                  {transactionsInPeriod.length} {transactionsInPeriod.length === 1 ? 'transaction' : 'transactions'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {transactionsInPeriod.length > ITEMS_PER_PAGE && (
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => setSalesPageNum(Math.max(1, salesPageNum - 1))}
              disabled={salesPageNum === 1}
              className="rounded-lg border border-fa-border px-3 py-2 text-sm text-fa-text-dim disabled:opacity-50"
            >
              ← Previous
            </button>
            <span className="text-sm text-fa-text-dim">
              Page {salesPageNum} of {Math.ceil(transactionsInPeriod.length / ITEMS_PER_PAGE)}
            </span>
            <button
              onClick={() => setSalesPageNum(Math.min(Math.ceil(transactionsInPeriod.length / ITEMS_PER_PAGE), salesPageNum + 1))}
              disabled={salesPageNum === Math.ceil(transactionsInPeriod.length / ITEMS_PER_PAGE)}
              className="rounded-lg border border-fa-border px-3 py-2 text-sm text-fa-text-dim disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        )}
      </section>


      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-fa-text-dim">
          Daily Cash Breakdown <span className="text-fa-neon">(From Transactions)</span>
          <span className="ml-2 normal-case text-fa-text-faint">
            — Calculated from individual transactions by date
          </span>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-fa-border bg-fa-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fa-border bg-fa-surface-2">
                <th className="px-4 py-3 text-left font-medium text-fa-text-dim">Date</th>
                <th className="px-4 py-3 text-right font-medium text-fa-text-dim">Paid v2</th>
                <th className="px-4 py-3 text-right font-medium text-fa-text-dim">Organic v2</th>
                <th className="px-4 py-3 text-right font-medium text-fa-text-dim">Total v2</th>
              </tr>
            </thead>
            <tbody>
              {dailyBreakdownV2.length > 0 ? (
                dailyBreakdownV2.map((day) => (
                  <tr key={day.date} className="border-b border-fa-border/50 hover:bg-fa-surface-2/50">
                    <td className="px-4 py-3 text-fa-text">{day.date}</td>
                    <td className="px-4 py-3 text-right text-fa-accent">{formatCurrency(day.paid)}</td>
                    <td className="px-4 py-3 text-right text-fa-neon">{formatCurrency(day.organic)}</td>
                    <td className="px-4 py-3 text-right font-medium text-fa-text">{formatCurrency(day.paid + day.organic)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-fa-text-dim">
                    No transactions for this period
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-fa-border bg-fa-surface-2 font-semibold">
                <td className="px-4 py-3 text-fa-text">Period Total v2</td>
                <td className="px-4 py-3 text-right text-fa-accent">{formatCurrency(Math.round(cashFromAdsV2))}</td>
                <td className="px-4 py-3 text-right text-fa-neon">{formatCurrency(Math.round(cashFromOrganicV2))}</td>
                <td className="px-4 py-3 text-right text-fa-accent">{formatCurrency(Math.round(cashFromAdsV2 + cashFromOrganicV2))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  )
}
