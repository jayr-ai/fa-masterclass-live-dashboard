import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { StatCard } from '../components/StatCard'
import {
  loadAdSpendData,
  loadOpportunitiesData,
  loadFunnelTransactions,
  type AdSpendDay,
  type Opportunity,
  type FunnelTransaction,
} from '../data/applicationFunnelData'
import { sydneyTodayISO, addDaysISO } from '../utils/dateRanges'
import { formatCurrency, formatNumber, formatPct } from '../utils/format'
import {
  computeExpectedPipelineRevenue,
  computeRoasFigures,
  MIN_CLOSES_FOR_CONFIDENCE,
} from '../lib/applicationFunnel/projection'
import { buildCohorts, type CohortGrain } from '../lib/applicationFunnel/cohorts'
import { CATEGORICAL, GRIDLINE, AXIS_MUTED } from '../utils/chartPalette'

const SHOWED_STAGES = new Set(['Pending Payment', 'Lost', 'Won'])
const CLOSED_STAGES = new Set(['Won'])
const TARGET_ROAS = 3.0

type PresetKey = '7d' | '30d' | 'thisMonth' | 'lastMonth' | '90d' | 'allTime' | 'custom'

function resolvePreset(preset: PresetKey, customFrom: string, customTo: string, earliestDate: string): { from: string; to: string } {
  const today = sydneyTodayISO()
  switch (preset) {
    case '7d':
      return { from: addDaysISO(today, -6), to: today }
    case '30d':
      return { from: addDaysISO(today, -29), to: today }
    case '90d':
      return { from: addDaysISO(today, -89), to: today }
    case 'thisMonth':
      return { from: today.slice(0, 8) + '01', to: today }
    case 'lastMonth': {
      const [y, m] = today.split('-').map(Number)
      const lastMonth = m === 1 ? 12 : m - 1
      const lastMonthYear = m === 1 ? y - 1 : y
      const key = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}`
      const lastDay = new Date(lastMonthYear, lastMonth, 0).getDate()
      return { from: `${key}-01`, to: `${key}-${String(lastDay).padStart(2, '0')}` }
    }
    case 'allTime':
      return { from: earliestDate, to: today }
    case 'custom':
      return { from: customFrom || earliestDate, to: customTo || today }
  }
}

export function ApplicationFunnelPage() {
  const [adSpendDaily, setAdSpendDaily] = useState<AdSpendDay[]>([])
  const [byCampaignDaily, setByCampaignDaily] = useState<{ campaignId: string; campaignName: string; date: string; spend: number; impressions: number; linkClicks: number; leads: number }[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [transactions, setTransactions] = useState<FunnelTransaction[]>([])
  const [lastSynced, setLastSynced] = useState<string | null>(null)

  const [preset, setPreset] = useState<PresetKey>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [viewMode, setViewMode] = useState<'calendar' | 'cohort'>('calendar')
  const [grain, setGrain] = useState<CohortGrain>('week')
  const [attributionFilter, setAttributionFilter] = useState<'all' | 'paid' | 'organic'>('all')

  useEffect(() => {
    loadAdSpendData().then((d) => {
      if (!d) return
      setAdSpendDaily(d.dailyTotal)
      setByCampaignDaily(d.byCampaignDaily)
      setLastSynced((prev) => prev ?? d.meta.generatedAt)
    })
    loadOpportunitiesData().then((d) => {
      if (!d) return
      setOpportunities(d.opportunities)
    })
    loadFunnelTransactions().then((d) => {
      if (!d) return
      setTransactions(d.transactions)
    })
  }, [])

  const today = sydneyTodayISO()
  const earliestOppDate = useMemo(
    () => (opportunities.length > 0 ? opportunities.reduce((min, o) => (o.createdAt < min ? o.createdAt : min), opportunities[0].createdAt).slice(0, 10) : today),
    [opportunities, today]
  )
  const { from: fromStr, to: toStr } = resolvePreset(preset, customFrom, customTo, earliestOppDate)

  const filteredTransactions = useMemo(
    () => transactions.filter((t) => attributionFilter === 'all' || (attributionFilter === 'paid' ? t.source === 'Paid' : t.source === 'Organic')),
    [transactions, attributionFilter]
  )

  // ---- Ad performance (calendar-dated) ----
  const adInRange = adSpendDaily.filter((d) => d.date >= fromStr && d.date <= toStr)
  const spend = adInRange.reduce((s, d) => s + d.spend, 0)
  const impressions = adInRange.reduce((s, d) => s + d.impressions, 0)
  const linkClicks = adInRange.reduce((s, d) => s + d.linkClicks, 0)
  const metaLeads = adInRange.reduce((s, d) => s + d.leads, 0)
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : null
  const costPerLinkClick = linkClicks > 0 ? spend / linkClicks : null
  const linkCtr = impressions > 0 ? (linkClicks / impressions) * 100 : null
  const costPerLead = metaLeads > 0 ? spend / metaLeads : null

  // ---- Funnel + sales (cohort-consistent: scoped by application/opportunity createdAt) ----
  const oppsInRange = opportunities.filter((o) => o.createdAt.slice(0, 10) >= fromStr && o.createdAt.slice(0, 10) <= toStr)
  const applications = oppsInRange.length
  const booked = applications
  const showed = oppsInRange.filter((o) => SHOWED_STAGES.has(o.stageName)).length
  const closed = oppsInRange.filter((o) => CLOSED_STAGES.has(o.stageName)).length
  const costPerApplication = applications > 0 ? spend / applications : null
  const costPerBooked = booked > 0 ? spend / booked : null
  const showRate = booked > 0 ? (showed / booked) * 100 : null
  const closeRateOfShowed = showed > 0 ? (closed / showed) * 100 : null
  const closeRateOfApplications = applications > 0 ? (closed / applications) * 100 : null

  const emailToEarliestApp = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of opportunities) {
      if (!o.email) continue
      const created = o.createdAt.slice(0, 10)
      const existing = map.get(o.email)
      if (!existing || created < existing) map.set(o.email, created)
    }
    return map
  }, [opportunities])

  const matchedTxnsInRange = filteredTransactions.filter((t) => {
    const appDate = emailToEarliestApp.get(t.email)
    return appDate !== undefined && appDate >= fromStr && appDate <= toStr
  })
  const cashCollected = matchedTxnsInRange.reduce((s, t) => s + t.amount, 0)
  const firstPaymentByEmail = new Map<string, string>()
  for (const t of matchedTxnsInRange) {
    const existing = firstPaymentByEmail.get(t.email)
    if (!existing || t.date < existing) firstPaymentByEmail.set(t.email, t.date)
  }
  const newCustomers = new Set(matchedTxnsInRange.map((t) => t.email)).size
  const cpa = newCustomers > 0 ? spend / newCustomers : null
  const avgCashPerCustomer = newCustomers > 0 ? cashCollected / newCustomers : null
  const daysAppToClose: number[] = []
  for (const [email, saleDate] of firstPaymentByEmail) {
    const appDate = emailToEarliestApp.get(email)
    if (!appDate) continue
    const days = Math.round((new Date(saleDate).getTime() - new Date(appDate).getTime()) / 86400000)
    if (days >= 0) daysAppToClose.push(days)
  }
  daysAppToClose.sort((a, b) => a - b)
  const medianDaysAppToClose = daysAppToClose.length > 0 ? daysAppToClose[Math.floor(daysAppToClose.length / 2)] : null

  // ---- Projection / ROAS ----
  const projection = useMemo(
    () => computeExpectedPipelineRevenue({ opportunities: oppsInRange, transactions: matchedTxnsInRange, today }),
    [oppsInRange, matchedTxnsInRange, today]
  )
  const roas = computeRoasFigures(spend, cashCollected, projection)

  // ---- Cohorts ----
  const cohorts = useMemo(
    () => buildCohorts(opportunities, adSpendDaily, filteredTransactions, grain, projection.closeLagDays, today, SHOWED_STAGES, CLOSED_STAGES),
    [opportunities, adSpendDaily, filteredTransactions, grain, projection.closeLagDays, today]
  )

  // ---- Campaign breakdown ----
  const campaignBreakdown = useMemo(() => {
    const byCampaign = new Map<string, { campaignName: string; spend: number; impressions: number; linkClicks: number; leads: number }>()
    for (const row of byCampaignDaily) {
      if (row.date < fromStr || row.date > toStr) continue
      const existing = byCampaign.get(row.campaignId) ?? { campaignName: row.campaignName, spend: 0, impressions: 0, linkClicks: 0, leads: 0 }
      existing.spend += row.spend
      existing.impressions += row.impressions
      existing.linkClicks += row.linkClicks
      existing.leads += row.leads
      byCampaign.set(row.campaignId, existing)
    }
    return Array.from(byCampaign.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.spend - a.spend)
  }, [byCampaignDaily, fromStr, toStr])

  // ---- Trend chart (last 12 cohorts, spend vs cash) ----
  const trendCohorts = useMemo(() => [...cohorts].reverse().slice(-12), [cohorts])

  // ---- Data quality ----
  const totalUniqueMatched = new Set(transactions.map((t) => t.email)).size

  const narrative = spend > 0 || applications > 0
    ? `In the selected range, ${formatCurrency(spend)} in ad spend generated ${formatNumber(applications)} application${applications === 1 ? '' : 's'} (${costPerApplication !== null ? formatCurrency(costPerApplication) : '—'} each) and ${formatNumber(newCustomers)} new customer${newCustomers === 1 ? '' : 's'}. Cash ROAS is ${roas.cashRoas !== null ? roas.cashRoas.toFixed(2) + 'x' : '—'} today; including remaining installments and open pipeline, projected ROAS is ${roas.projectedRoas !== null ? roas.projectedRoas.toFixed(2) + 'x' : '—'}${roas.lowConfidence ? ' (low confidence — limited historical closes)' : ''}.`
    : 'No Application Funnel spend or applications in this range.'

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-fa-text">Application Funnel</h1>
          <p className="mt-1 text-sm text-fa-text-dim">
            Accelerator Application Pipeline — no webinar date, grouped by application cohort
            {lastSynced && <span className="text-fa-text-faint"> · last synced {new Date(lastSynced).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST</span>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-fa-border bg-fa-surface p-3">
        {(['7d', '30d', 'thisMonth', 'lastMonth', '90d', 'allTime', 'custom'] as PresetKey[]).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${preset === p ? 'border-fa-accent/40 bg-fa-surface-2 text-fa-text' : 'border-fa-border text-fa-text-dim hover:text-fa-text'}`}
          >
            {{ '7d': 'Last 7 days', '30d': 'Last 30 days', thisMonth: 'This month', lastMonth: 'Last month', '90d': 'Last 90 days', allTime: 'All time', custom: 'Custom' }[p]}
          </button>
        ))}
        {preset === 'custom' && (
          <span className="flex items-center gap-2 text-xs">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded border border-fa-border bg-fa-surface-2 px-2 py-1 text-fa-text" />
            <span className="text-fa-text-faint">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded border border-fa-border bg-fa-surface-2 px-2 py-1 text-fa-text" />
          </span>
        )}
        <span className="mx-2 h-5 w-px bg-fa-border" />
        {(['calendar', 'cohort'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setViewMode(v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === v ? 'border-fa-accent/40 bg-fa-surface-2 text-fa-text' : 'border-fa-border text-fa-text-dim hover:text-fa-text'}`}
          >
            {v === 'calendar' ? 'Calendar view' : 'Cohort view'}
          </button>
        ))}
        {viewMode === 'cohort' && (
          <>
            {(['week', 'month'] as CohortGrain[]).map((g) => (
              <button
                key={g}
                onClick={() => setGrain(g)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${grain === g ? 'border-fa-accent/40 bg-fa-surface-2 text-fa-text' : 'border-fa-border text-fa-text-dim hover:text-fa-text'}`}
              >
                {g}
              </button>
            ))}
          </>
        )}
        <span className="mx-2 h-5 w-px bg-fa-border" />
        {(['all', 'paid', 'organic'] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAttributionFilter(a)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${attributionFilter === a ? 'border-fa-accent/40 bg-fa-surface-2 text-fa-text' : 'border-fa-border text-fa-text-dim hover:text-fa-text'}`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-fa-border bg-fa-surface p-5 text-sm text-fa-text-dim">{narrative}</div>

      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-fa-text-dim">Hero KPIs</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Spend" value={formatCurrency(spend)} variant="hero" />
          <StatCard label="Cash Collected" value={formatCurrency(cashCollected)} variant="hero" />
          <StatCard label="Cash ROAS" value={roas.cashRoas !== null ? `${roas.cashRoas.toFixed(2)}x` : '—'} variant="hero" sublabel="Actual, cash in bank" />
          <StatCard
            label="Projected ROAS"
            value={roas.projectedRoas !== null ? `${roas.projectedRoas.toFixed(2)}x` : '—'}
            variant="hero"
            sublabel={roas.lowConfidence ? `Low confidence (<${MIN_CLOSES_FOR_CONFIDENCE} historical closes)` : 'Cash + contracted + expected pipeline'}
          />
          <StatCard label="CPA" value={cpa !== null ? formatCurrency(cpa) : '—'} variant="hero" sublabel="Spend ÷ new customers" />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-fa-text-dim">Ad Performance</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Impressions" value={formatNumber(impressions)} />
          <StatCard label="CPM" value={cpm !== null ? formatCurrency(cpm, { exact: true }) : '—'} />
          <StatCard label="Link Clicks" value={formatNumber(linkClicks)} />
          <StatCard label="Cost per Link Click" value={costPerLinkClick !== null ? formatCurrency(costPerLinkClick, { exact: true }) : '—'} />
          <StatCard label="Link CTR" value={linkCtr !== null ? formatPct(linkCtr) : '—'} />
          <StatCard label="Leads (Meta)" value={formatNumber(metaLeads)} />
          <StatCard label="Cost per Lead" value={costPerLead !== null ? formatCurrency(costPerLead, { exact: true }) : '—'} />
          <StatCard label="Applications (GHL)" value={formatNumber(applications)} sublabel="Source of truth for lead volume" />
          <StatCard label="Cost per Application" value={costPerApplication !== null ? formatCurrency(costPerApplication, { exact: true }) : '—'} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-fa-text-dim">Sales</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="New Customers" value={formatNumber(newCustomers)} sublabel="Distinct matched buyers" />
          <StatCard label="Avg Cash per Customer" value={avgCashPerCustomer !== null ? formatCurrency(avgCashPerCustomer) : '—'} />
          <StatCard label="Avg Days Application → Close" value={medianDaysAppToClose !== null ? `${medianDaysAppToClose}d` : '—'} sublabel="Median" />
        </div>
      </div>

      <FunnelBars
        linkClicks={linkClicks}
        applications={applications}
        booked={booked}
        showed={showed}
        closed={closed}
        costPerBooked={costPerBooked}
        showRate={showRate}
        closeRateOfShowed={closeRateOfShowed}
        closeRateOfApplications={closeRateOfApplications}
      />

      <SpendVsRevenueTrend cohorts={trendCohorts} grain={grain} />

      <RoasTrioPanel cash={roas.cashRoas} contracted={roas.contractedRoas} projected={roas.projectedRoas} target={TARGET_ROAS} />

      <CohortTable rows={cohorts} grain={grain} />

      <div className="rounded-xl border border-fa-border bg-fa-surface p-5">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-fa-text-dim">
          Campaign Breakdown
          <span className="ml-2 normal-case text-fa-text-faint">— {fromStr} to {toStr}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-fa-border text-left">
                <th className="px-2.5 py-2 font-medium text-fa-text-dim">Campaign</th>
                <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">Spend</th>
                <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">Impressions</th>
                <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">Link Clicks</th>
                <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">CPC</th>
                <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">CTR</th>
                <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">Meta Leads</th>
                <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">CPL</th>
              </tr>
            </thead>
            <tbody>
              {campaignBreakdown.length > 0 ? (
                campaignBreakdown.map((c) => (
                  <tr key={c.id} className="border-b border-fa-border/50">
                    <td className="px-2.5 py-1.5 text-fa-text">{c.campaignName}</td>
                    <td className="px-2.5 py-1.5 text-right text-fa-text">{formatCurrency(c.spend)}</td>
                    <td className="px-2.5 py-1.5 text-right text-fa-text-dim">{formatNumber(c.impressions)}</td>
                    <td className="px-2.5 py-1.5 text-right text-fa-text-dim">{formatNumber(c.linkClicks)}</td>
                    <td className="px-2.5 py-1.5 text-right text-fa-text-dim">{c.linkClicks > 0 ? formatCurrency(c.spend / c.linkClicks, { exact: true }) : '—'}</td>
                    <td className="px-2.5 py-1.5 text-right text-fa-text-dim">{c.impressions > 0 ? formatPct((c.linkClicks / c.impressions) * 100) : '—'}</td>
                    <td className="px-2.5 py-1.5 text-right text-fa-text-dim">{formatNumber(c.leads)}</td>
                    <td className="px-2.5 py-1.5 text-right text-fa-text-dim">{c.leads > 0 ? formatCurrency(c.spend / c.leads, { exact: true }) : '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-2.5 py-8 text-center text-fa-text-dim">No Application Funnel spend in this range</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-fa-border bg-fa-surface/40 p-5 text-xs text-fa-text-faint">
        <div className="mb-2 font-medium uppercase tracking-wide">Data quality</div>
        <ul className="list-inside list-disc space-y-1">
          <li>Ad spend: 8 explicit campaign IDs, confirmed 2026-09-30 (see README) — not a name-pattern match.</li>
          <li>Applications/funnel counts: {formatNumber(opportunities.length)} opportunities in the Accelerator Application Pipeline (GHL REST, all-time).</li>
          <li>Sales matching: email present in the pipeline AND sale date on/after that contact's earliest application — no product-name filter (Accelerator/Accelerator Premium sells through both this funnel and Masterclass). {formatNumber(totalUniqueMatched)} distinct customers matched all-time.</li>
          <li>Projection: remaining-installment estimate uses a total-paid-vs-historical-ceiling proxy, not a real plan-structure table (none exists yet) — see code comments in <code>lib/applicationFunnel/projection.ts</code>. Close lag: {projection.closeLagDays} days ({projection.historicalCloseCount} historical closes used).</li>
          <li>This pipeline has no separate "Applied" or "Showed" stage — every opportunity starts at "Appointment Set" (Applied = Booked), and Showed is inferred as reaching Pending Payment, Lost, or Won.</li>
        </ul>
      </div>
    </div>
  )
}

function SpendVsRevenueTrend({ cohorts, grain }: { cohorts: ReturnType<typeof buildCohorts>; grain: CohortGrain }) {
  if (cohorts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-fa-border bg-fa-surface/40 p-5 text-sm text-fa-text-faint">
        No cohorts with data to chart yet.
      </div>
    )
  }
  const data = cohorts.map((c) => ({ label: c.label.replace('Week of ', ''), spend: c.spend, cash: c.cashToDate }))

  return (
    <div className="rounded-xl border border-fa-border bg-fa-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-fa-text-dim">Spend vs Revenue Trend</div>
          <div className="mt-0.5 text-[11px] text-fa-text-faint">By {grain} — matched cash collected per cohort</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-fa-text-dim">
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: CATEGORICAL[0] }} />
            Spend
          </div>
          <div className="flex items-center gap-1.5 text-xs text-fa-text-dim">
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: CATEGORICAL[1] }} />
            Cash Collected
          </div>
        </div>
      </div>
      <div className="mt-4" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="af-trend-spend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CATEGORICAL[0]} stopOpacity={0.28} />
                <stop offset="100%" stopColor={CATEGORICAL[0]} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="af-trend-cash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CATEGORICAL[1]} stopOpacity={0.28} />
                <stop offset="100%" stopColor={CATEGORICAL[1]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRIDLINE} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: AXIS_MUTED, fontSize: 11 }} axisLine={{ stroke: GRIDLINE }} tickLine={false} />
            <YAxis tick={{ fill: AXIS_MUTED, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} width={54} />
            <Tooltip
              contentStyle={{ background: '#1c2a24', border: '1px solid rgba(237,237,238,0.1)', borderRadius: 8, fontSize: 12 }}
              formatter={(value, name) => [formatCurrency(Number(value), { exact: true }), name === 'spend' ? 'Spend' : 'Cash Collected']}
            />
            <Area type="monotone" dataKey="spend" stroke={CATEGORICAL[0]} strokeWidth={2} fill="url(#af-trend-spend)" dot={{ r: 3, fill: CATEGORICAL[0], strokeWidth: 0 }} />
            <Area type="monotone" dataKey="cash" stroke={CATEGORICAL[1]} strokeWidth={2} fill="url(#af-trend-cash)" dot={{ r: 3, fill: CATEGORICAL[1], strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function FunnelBars({
  linkClicks,
  applications,
  booked,
  showed,
  closed,
  costPerBooked,
  showRate,
  closeRateOfShowed,
  closeRateOfApplications,
}: {
  linkClicks: number
  applications: number
  booked: number
  showed: number
  closed: number
  costPerBooked: number | null
  showRate: number | null
  closeRateOfShowed: number | null
  closeRateOfApplications: number | null
}) {
  const steps = [
    { label: 'Link Clicks', value: linkClicks },
    { label: 'Applications', value: applications },
    { label: 'Booked', value: booked },
    { label: 'Showed', value: showed },
    { label: 'Closed', value: closed },
  ]
  const maxVal = Math.max(1, ...steps.map((s) => s.value))

  return (
    <div className="rounded-xl border border-fa-border bg-fa-surface p-5">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-fa-text-dim">Funnel</div>
      <div className="mb-4 text-[11px] text-fa-text-faint">
        Applications = Booked in this pipeline (no separate stage). Showed inferred as reaching Pending Payment/Lost/Won.
        {costPerBooked !== null && ` Cost per Booked: ${formatCurrency(costPerBooked, { exact: true })}.`}
      </div>
      <div className="space-y-2.5">
        {steps.map((s, i) => {
          const pct = Math.max(4, (s.value / maxVal) * 100)
          const prevValue = i > 0 ? steps[i - 1].value : null
          const stepPct = prevValue && prevValue > 0 ? (s.value / prevValue) * 100 : null
          return (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-28 shrink-0 truncate text-sm text-fa-text-dim">{s.label}</div>
              <div className="relative h-6 flex-1 overflow-hidden rounded bg-fa-surface-2">
                <div className="h-full rounded bg-gradient-to-r from-fa-accent-dim to-fa-accent" style={{ width: `${pct}%` }} />
              </div>
              <div className="w-16 shrink-0 text-right text-sm font-medium text-fa-text">{formatNumber(s.value)}</div>
              <div className="w-14 shrink-0 text-right text-xs text-fa-text-faint">{stepPct !== null ? formatPct(stepPct) : ''}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex gap-6 text-xs text-fa-text-faint">
        <span>Show Rate: {showRate !== null ? formatPct(showRate) : '—'}</span>
        <span>Close Rate (of Showed): {closeRateOfShowed !== null ? formatPct(closeRateOfShowed) : '—'}</span>
        <span>Close Rate (of Applications): {closeRateOfApplications !== null ? formatPct(closeRateOfApplications) : '—'}</span>
      </div>
    </div>
  )
}

function RoasTrioPanel({ cash, contracted, projected, target }: { cash: number | null; contracted: number | null; projected: number | null; target: number }) {
  const data = [
    { label: 'Cash ROAS', value: cash ?? 0, raw: cash },
    { label: 'Contracted ROAS', value: contracted ?? 0, raw: contracted },
    { label: 'Projected ROAS', value: projected ?? 0, raw: projected },
  ]
  const colorFor = (v: number | null) => {
    if (v === null) return AXIS_MUTED
    if (v >= target) return '#199e70'
    if (v >= target * 0.8) return '#c98500'
    return '#e66767'
  }

  return (
    <div className="rounded-xl border border-fa-border bg-fa-surface p-5">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-fa-text-dim">ROAS Trio</div>
      <div className="mb-4 text-[11px] text-fa-text-faint">Target ROAS: {target.toFixed(1)}x — green at/above target, amber within 20%, red below</div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={GRIDLINE} strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fill: AXIS_MUTED, fontSize: 11 }} tickFormatter={(v) => `${v}x`} />
          <YAxis type="category" dataKey="label" tick={{ fill: AXIS_MUTED, fontSize: 12 }} width={120} />
          <Tooltip formatter={(v) => `${Number(v).toFixed(2)}x`} contentStyle={{ background: '#1c2a24', border: '1px solid rgba(237,237,238,0.1)', borderRadius: 8, fontSize: 12 }} />
          <ReferenceLine x={target} stroke="#999" strokeDasharray="4 4" />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((d, i) => (
              <Cell key={i} fill={colorFor(d.raw)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CohortTable({ rows, grain }: { rows: ReturnType<typeof buildCohorts>; grain: CohortGrain }) {
  return (
    <div className="rounded-xl border border-fa-border bg-fa-surface p-5">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-fa-text-dim">
        Cohort Table
        <span className="ml-2 normal-case text-fa-text-faint">— by application {grain}, all-time history, not affected by the date range above</span>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-fa-border bg-fa-surface-2 text-left">
              <th className="px-2.5 py-2 font-medium text-fa-text-dim">Cohort</th>
              <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">Spend</th>
              <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">Apps</th>
              <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">Cost/App</th>
              <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">Showed</th>
              <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">Closed</th>
              <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">Close %</th>
              <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">Cash to Date</th>
              <th className="px-2.5 py-2 text-right font-medium text-fa-text-dim">Maturity %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={`border-b border-fa-border/50 ${r.maturityPct < 60 ? 'opacity-60' : ''}`}>
                <td className="px-2.5 py-1.5 text-fa-text">{r.label}</td>
                <td className="px-2.5 py-1.5 text-right text-fa-text">{formatCurrency(r.spend)}</td>
                <td className="px-2.5 py-1.5 text-right text-fa-text-dim">{formatNumber(r.applications)}</td>
                <td className="px-2.5 py-1.5 text-right text-fa-text-dim">{r.costPerApplication !== null ? formatCurrency(r.costPerApplication, { exact: true }) : '—'}</td>
                <td className="px-2.5 py-1.5 text-right text-fa-text-dim">{formatNumber(r.showed)}</td>
                <td className="px-2.5 py-1.5 text-right text-fa-text-dim">{formatNumber(r.closed)}</td>
                <td className="px-2.5 py-1.5 text-right text-fa-text-dim">{formatPct(r.closeRatePct)}</td>
                <td className="px-2.5 py-1.5 text-right text-fa-neon">{formatCurrency(r.cashToDate)}</td>
                <td className="px-2.5 py-1.5 text-right text-fa-text-faint">{formatPct(r.maturityPct)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-2.5 py-8 text-center text-fa-text-dim">No cohorts yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
