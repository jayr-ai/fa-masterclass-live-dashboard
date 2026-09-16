import { useEffect, useMemo, useRef, useState } from 'react'
import { StatCard } from '../components/StatCard'
import { ExecutiveSummary } from '../components/ExecutiveSummary'
import { FunnelStages } from '../components/FunnelStages'
import { RunSelector } from '../components/RunSelector'
import { MiniStat } from '../components/MiniStat'
import { OneOffEvents, type OneOffEvent } from '../components/OneOffEvents'
import { BarChartPanel } from '../components/BarChartPanel'
import {
  masterclassFunnelTemplate,
} from '../data/mockDashboardData'
import {
  loadLiveData,
  computeWindowedPerformance,
  loadMasterclassWebinarDates,
  getMasterclassWindowRevenue,
  type LiveMasterclassRun,
  type WindowedMarketingPerformance,
  type LiveAdSpendDay,
} from '../data/liveData'
import { formatCurrency, formatDateShort } from '../utils/format'
import { calculateMasterclassWindow, formatWindowRange } from '../utils/masterclassDateWindows'
import type { MasterclassRun, MasterclassStage } from '../types/dashboard'

const loadingFunnelSnapshot: MasterclassStage[] = (masterclassFunnelTemplate || []).map((stage) => ({ stage, count: null }))

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`
}

// Real GHL-derived runs get everything the mock `emptyRun` shape needs to
// render. registered/attended/show-up-rate/application/VIP-upgrade/attend-to-
// app% are real (see README for the VIP Upgrade tag caveat). Marketing
// Performance is a time-windowed proxy (see computeWindowedPerformance) since
// there's no per-run ad campaign to attribute to — real, but an
// approximation, not ad-level attribution. Revenue/Deals Closed/Cash From
// Ads/Organic are real too: each run's registered-contact emails, joined
// against BigQuery's revenue_transactions, restricted to transactions on or
// after the run date (see README for the "why" and the double-count caveat).
// The 11-stage per-run funnel breakdown is the one piece still blocked —
// GHL opportunity-stage counting has no compound tag+stage filter — a live
// all-runs-combined snapshot renders separately below instead.
function liveRunToMasterclassRun(r: LiveMasterclassRun, perf: WindowedMarketingPerformance | undefined, applicationCount: number = 0, adSpend: number = 0, windowData?: { revenue: number; cashFromAds: number; cashFromOrganic: number; dealsClosed: number }): MasterclassRun {
  // Use windowed data if available, otherwise fall back to all-time
  const displayRevenue = windowData?.revenue ?? (r.cashFromAds + r.cashFromOrganic)
  const displayCashFromAds = windowData?.cashFromAds ?? r.cashFromAds
  const displayCashFromOrganic = windowData?.cashFromOrganic ?? r.cashFromOrganic
  const displayDealsClosed = windowData?.dealsClosed ?? (r.deals?.length ?? 0)

  const bullets: string[] = []
  if (perf) {
    const windowLabel = perf.isPartialWindow
      ? `${formatShort(perf.windowStart)}–${formatShort(perf.windowEnd)}, partial — only ${perf.windowDays} of that range's days have ad data so far`
      : `${formatShort(perf.windowStart)}–${formatShort(perf.windowEnd)}`
    bullets.push(
      `In the ${perf.windowDays}-day registration window before this run (${windowLabel}), your campaigns generated ${perf.leadsGenerated.toLocaleString('en-AU')} leads from Ads with ${perf.linkClicks.toLocaleString('en-AU')} link clicks (${perf.clickToLeadPct.toFixed(2)}% click-to-lead rate).`,
    )
    bullets.push(
      `Total ad spend was ${formatCurrency(perf.adSpend, { exact: true })}, resulting in a Cost Per Lead of ${formatCurrency(perf.costPerLead, { exact: true })} and a Cost Per Click of ${formatCurrency(perf.costPerClick, { exact: true })}.`,
    )
    bullets.push(`Click-through rate was ${perf.ctrPct.toFixed(2)}%.`)
  }

  bullets.push(
    displayDealsClosed > 0
      ? `This run's registrants closed ${displayDealsClosed} deal${displayDealsClosed === 1 ? '' : 's'} within the window, for ${formatCurrency(displayRevenue, { exact: true })} (${formatCurrency(displayCashFromAds, { exact: true })} from ads, ${formatCurrency(displayCashFromOrganic, { exact: true })} organic).`
      : "No deals closed within this window — for this funnel, closing often takes weeks as the back-end sales process plays out, so this can still move.",
  )

  const displayRoas = adSpend > 0 ? displayRevenue / adSpend : null
  const attendToAppPct = r.attended > 0 ? Math.round((applicationCount / r.attended) * 100 * 100) / 100 : 0

  return {
    date: r.date,
    label: r.label + ' (live)',
    registered: r.registered,
    showUpRatePct: r.showUpRatePct ?? 0,
    attended: r.attended,
    vipUpgrade: 0,
    cashFromVip: 0,
    application: applicationCount,
    attendToAppPct,
    allTimeRevenue: displayRevenue,
    dealsClosed: displayDealsClosed,
    cashFromAds: displayCashFromAds,
    cashFromOrganic: displayCashFromOrganic,
    deals: r.deals ?? [],
    executiveSummary: { bullets },
    marketingPerformance: {
      sourceLabel: 'Ad Spend from Meta MCP (windowed per run)',
      adSpend: adSpend,
      linkClicks: perf?.linkClicks || 0,
      ctrPct: perf?.ctrPct || 0,
      leadsGenerated: perf?.leadsGenerated || 0,
      costPerLead: perf?.costPerLead || 0,
      roas: displayRoas,
    },
  }
}

// One-off events (see OneOffEvents.tsx) have no single "run date" — pinned
// to a sentinel date so they always sort to the top of the selector,
// labeled "(one-off)" so they're never mistaken for a dated recurring run.
function oneOffEventToMasterclassRun(event: OneOffEvent, index: number): MasterclassRun {
  const bullets: string[] = [
    `${event.registered.toLocaleString('en-AU')} registered, ${event.attended.toLocaleString('en-AU')} attended (${event.showUpRatePct === null ? 'N/A' : `${event.showUpRatePct.toFixed(2)}%`} show-up rate).`,
    event.dealsClosed > 0
      ? `Closed ${event.dealsClosed} deal${event.dealsClosed === 1 ? '' : 's'} so far, for ${formatCurrency(event.revenue, { exact: true })} (${formatCurrency(event.cashFromAds, { exact: true })} from ads, ${formatCurrency(event.cashFromOrganic, { exact: true })} organic).`
      : "No deals have closed among this event's registrants yet.",
  ]

  return {
    date: `9999-12-31-${index}`,
    label: `${event.name} (one-off)`,
    registered: event.registered,
    showUpRatePct: event.showUpRatePct ?? 0,
    attended: event.attended,
    vipUpgrade: 0,
    cashFromVip: 0,
    application: event.application,
    attendToAppPct: event.attendToAppPct ?? 0,
    allTimeRevenue: event.revenue,
    dealsClosed: event.dealsClosed,
    cashFromAds: event.cashFromAds,
    cashFromOrganic: event.cashFromOrganic,
    deals: event.deals,
    executiveSummary: { bullets },
    marketingPerformance: {
      sourceLabel: event.sourceLabel,
      adSpend: 0,
      linkClicks: 0,
      ctrPct: 0,
      leadsGenerated: 0,
      costPerLead: 0,
      roas: null,
    },
  }
}

export function MasterclassPage() {
  const [selected, setSelected] = useState<string>('')
  const [liveRuns, setLiveRuns] = useState<MasterclassRun[]>([])
  const [funnelSnapshot, setFunnelSnapshot] = useState<MasterclassStage[]>(loadingFunnelSnapshot)
  const [oneOffEvents, setOneOffEvents] = useState<OneOffEvent[]>([])
  const [revenueByRun, setRevenueByRun] = useState<{ label: string; amount: number }[]>([])
  const [allMasterclassDates, setAllMasterclassDates] = useState<string[]>([])
  const [selectedWindow, setSelectedWindow] = useState<{ start: string; end: string } | null>(null)
  const [windowRevenue, setWindowRevenue] = useState<{ cashFromAds: number; cashFromOrganic: number; dealsClosed: number; transactions?: any[] } | null>(null)
  const hasUserPicked = useRef(false)

  useEffect(() => {
    // Load dynamic webinar dates from Google Sheet (Column F)
    // These dates drive the selector and should auto-update when new dates are added to the Sheet
    loadMasterclassWebinarDates().then(async (webinarDates) => {
      if (webinarDates.length === 0) {
        console.log('No webinar dates found in Google Sheet')
        return
      }

      console.log(`📅 Webinar dates loaded from Sheet: ${webinarDates.map(d => d.label).join(', ')}`)

      // Load registration, attendance, and application data from JSON files
      let registrationMap: Record<string, number> = {}
      let attendanceMap: Record<string, number> = {}
      let applicationMap: Record<string, number> = {}
      let adSpendDaily: LiveAdSpendDay[] = []

      try {
        const regRes = await fetch(`${import.meta.env.BASE_URL}data/masterclass-registrations.json?t=${Date.now()}`)
        if (regRes.ok) {
          const regData = await regRes.json() as any
          regData.masterclassRegistrations?.forEach((r: any) => {
            registrationMap[r.date] = r.registered || 0
          })
        }
      } catch (e) {
        console.warn('Could not load registration data:', e)
      }

      try {
        const attRes = await fetch(`${import.meta.env.BASE_URL}data/masterclass-attendance.json?t=${Date.now()}`)
        if (attRes.ok) {
          const attData = await attRes.json() as any
          attData.masterclassAttendance?.forEach((a: any) => {
            attendanceMap[a.date] = a.attended || 0
          })
        }
      } catch (e) {
        console.warn('Could not load attendance data:', e)
      }

      try {
        const appRes = await fetch(`${import.meta.env.BASE_URL}data/masterclass-applications.json?t=${Date.now()}`)
        if (appRes.ok) {
          const appData = await appRes.json() as any
          appData.applications?.forEach((a: any) => {
            applicationMap[a.date] = a.applications || 0
          })
        }
      } catch (e) {
        console.warn('Could not load application data:', e)
      }

      // Load ad spend daily from marketing-performance.json (BigQuery sync)
      try {
        const perfRes = await fetch(`${import.meta.env.BASE_URL}data/marketing-performance.json?t=${Date.now()}`)
        if (perfRes.ok) {
          const perfData = await perfRes.json() as any
          adSpendDaily = perfData.daily || []
          console.log(`💰 Loaded ${adSpendDaily.length} days of ad spend for windowed calculation`)
        }
      } catch (e) {
        console.warn('Could not load ad spend daily data:', e)
      }

      // Line-item deal detail for the selected run comes from windowRevenue.transactions
      // (getMasterclassWindowRevenue, see RunView) — computed live from cash-attribution.json,
      // not a separate committed file.

      // Load live data for windowed performance and cash attribution
      const liveData = await loadLiveData()
      const perfByRun = liveData ? computeWindowedPerformance(liveData.masterclassRuns, liveData.adSpendDaily) : {}

      // Load masterclass window revenue data for all runs
      let windowDataByDate: Record<string, { revenue: number; cashFromAds: number; cashFromOrganic: number; dealsClosed: number }> = {}

      // Sort dates for window calculation
      const sortedDates = webinarDates.map(wd => wd.date).sort((a, b) => (a < b ? -1 : 1))

      // Fetch windowed revenue for each masterclass date
      for (const date of sortedDates) {
        try {
          const window = calculateMasterclassWindow(date, sortedDates)
          const windowRevenue = await getMasterclassWindowRevenue(date, window.windowStart, window.windowEnd, [])
          if (windowRevenue) {
            windowDataByDate[date] = {
              revenue: windowRevenue.cashFromAds + windowRevenue.cashFromOrganic,
              cashFromAds: windowRevenue.cashFromAds,
              cashFromOrganic: windowRevenue.cashFromOrganic,
              dealsClosed: windowRevenue.dealsClosed,
            }
          }
        } catch (e) {
          console.warn(`Could not fetch window revenue for ${date}:`, e)
        }
      }
      console.log(`📊 Loaded windowed revenue for ${Object.keys(windowDataByDate).length} masterclass dates`)

      // Build revenue trend chart from windowed data
      const chartData = webinarDates
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((wd) => ({
          label: formatDateShort(wd.date),
          amount: windowDataByDate[wd.date]?.revenue || 0,
        }))
      setRevenueByRun(chartData)
      console.log(`📈 Revenue trend chart: ${chartData.length} runs, total $${chartData.reduce((sum, c) => sum + c.amount, 0).toLocaleString('en-AU')}`)

      // Store all dates for window calculations
      const allDates = webinarDates.map(wd => wd.date)
      setAllMasterclassDates(allDates)

      // Build runs with performance data
      const runsWithRevenue = webinarDates.map((wd) => {
        const registered = registrationMap[wd.date] || 0
        const attended = attendanceMap[wd.date] || 0
        const showUpRatePct = registered > 0 ? Math.round((attended / registered) * 100 * 100) / 100 : 0
        const perf = perfByRun[wd.date]

        return {
          date: wd.date,
          label: wd.label,
          registered,
          attended,
          showUpRatePct,
          windowedAdSpend: perf?.adSpend || 0,
          cashFromAds: liveData?.masterclassRuns?.find(r => r.date === wd.date)?.cashFromAds || 0,
          cashFromOrganic: liveData?.masterclassRuns?.find(r => r.date === wd.date)?.cashFromOrganic || 0,
          deals: [], // detail is rendered live in RunView via windowRevenue.transactions instead
        }
      })

      // Convert to MasterclassRun format with windowed data
      const mapped = runsWithRevenue.map((r) => liveRunToMasterclassRun(r, perfByRun[r.date], applicationMap[r.date] || 0, r.windowedAdSpend || 0, windowDataByDate[r.date]))

      setLiveRuns(mapped)

      // Default to the latest webinar date. Populates selectedWindow/windowRevenue
      // the same way handleSelect does (uses the local `allDates` from above, not
      // the allMasterclassDates state — that state update from setAllMasterclassDates
      // above hasn't landed yet at this point in the same effect run).
      if (!hasUserPicked.current && mapped.length > 0) {
        const sorted = [...mapped].sort((a, b) => (a.date > b.date ? -1 : 1)) // Sort newest first
        const latest = sorted[0]
        setSelected(latest.date)
        console.log(`📅 Auto-selecting most recent date: ${latest.date}`)
        const sortedForWindow = [...allDates].sort((a, b) => (a < b ? -1 : 1))
        const window = calculateMasterclassWindow(latest.date, sortedForWindow)
        setSelectedWindow({ start: window.windowStart, end: window.windowEnd })
        getMasterclassWindowRevenue(latest.date, window.windowStart, window.windowEnd, []).then((freshRevenue) => {
          setWindowRevenue(freshRevenue)
        })
      }
    })

    // Load other data (funnel snapshot, one-off events)
    loadLiveData().then((data) => {
      if (!data) return
      if (data.funnelSnapshot?.stages) {
        setFunnelSnapshot(data.funnelSnapshot.stages)
      }
      setOneOffEvents(data.oneOffEvents || [])
    })
  }, [])

  // Shared by both the initial auto-select and manual dropdown selection, so
  // first-load behavior matches interacted behavior. getMasterclassWindowRevenue
  // filters cash-attribution.json purely by date range — it never needed
  // registrant emails (the old gate here always evaluated false, since the
  // registrant-emails file it depended on was never populated; the "Deals
  // Closed — Detail" table below was silently empty on every date as a result).
  const selectWindowFor = async (date: string, datesForWindow: string[]) => {
    const sortedDates = [...datesForWindow].sort((a, b) => (a < b ? -1 : 1))
    const window = calculateMasterclassWindow(date, sortedDates)
    setSelectedWindow({ start: window.windowStart, end: window.windowEnd })

    const freshRevenue = await getMasterclassWindowRevenue(date, window.windowStart, window.windowEnd, [])
    if (freshRevenue) {
      console.log(`💰 Window revenue: $${freshRevenue.cashFromAds.toLocaleString('en-AU')} (ads) + $${freshRevenue.cashFromOrganic.toLocaleString('en-AU')} (organic) = ${freshRevenue.dealsClosed} deals`)
    }
    setWindowRevenue(freshRevenue)
  }

  const handleSelect = async (date: string) => {
    hasUserPicked.current = true
    setSelected(date)
    await selectWindowFor(date, allMasterclassDates)
  }

  const masterclassRuns = useMemo(
    () =>
      [...liveRuns, ...(oneOffEvents || []).map(oneOffEventToMasterclassRun)].sort((a, b) =>
        a.date < b.date ? 1 : -1,
      ),
    [liveRuns, oneOffEvents],
  )

  const selectedRun = useMemo(
    () => masterclassRuns.find((r) => r.date === selected) ?? masterclassRuns[0] ?? null,
    [selected, masterclassRuns],
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-fa-text">Masterclass Dashboard</h1>
          <p className="mt-1 text-sm text-fa-text-dim">
            {selectedRun ? `Masterclass run: ${selectedRun.label}` : 'No runs available'}
          </p>
        </div>
        <RunSelector runs={masterclassRuns} selected={selected} onChange={handleSelect} />
      </div>

      {selectedRun && <RunView run={selectedRun} selectedWindow={selectedWindow} windowRevenue={windowRevenue} />}

      <FunnelStages stages={funnelSnapshot} />

      <BarChartPanel
        title="Revenue Per Masterclass Run — all tracked runs, not affected by the date selector above"
        data={revenueByRun}
        height={240}
        colorIndex={2}
      />

      <OneOffEvents events={oneOffEvents} />
    </div>
  )
}

function RunView({ run, selectedWindow, windowRevenue }: { run: MasterclassRun; selectedWindow: { start: string; end: string } | null; windowRevenue: { cashFromAds: number; cashFromOrganic: number; dealsClosed: number } | null }) {
  const windowLabel = selectedWindow ? formatWindowRange(selectedWindow.start, selectedWindow.end) : 'N/A'

  // Use windowed revenue values when available, otherwise use run defaults
  const displayRevenue = windowRevenue ? (windowRevenue.cashFromAds + windowRevenue.cashFromOrganic) : run.allTimeRevenue
  const displayCashFromAds = windowRevenue ? windowRevenue.cashFromAds : run.cashFromAds
  const displayCashFromOrganic = windowRevenue ? windowRevenue.cashFromOrganic : run.cashFromOrganic
  const displayDealsClosed = windowRevenue ? windowRevenue.dealsClosed : run.dealsClosed
  const displayROAS = displayRevenue > 0 && run.marketingPerformance.adSpend > 0 ? displayRevenue / run.marketingPerformance.adSpend : null

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-fa-accent">
          This Run's Masterclass Data
          {selectedWindow && (
            <span className="ml-2 normal-case text-fa-text-faint">
              — Revenue window: {windowLabel} ({selectedWindow.start} to {selectedWindow.end})
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          <StatCard label="Ad Spend" value={formatCurrency(run.marketingPerformance.adSpend)} />
          <StatCard label="Registered" value={run.registered.toLocaleString('en-AU')} />
          <StatCard label="Show Up Rate %" value={`${run.showUpRatePct}%`} />
          <StatCard label="Attended" value={run.attended.toLocaleString('en-AU')} />
          <StatCard label="Application" value={run.application.toLocaleString('en-AU')} />
          <StatCard label="Attend. to App %" value={`${run.attendToAppPct}%`} />
          <StatCard label="Deals Closed" value={displayDealsClosed.toLocaleString('en-AU')} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Revenue Collected For This Run" value={formatCurrency(Math.round(displayRevenue))} variant="hero" />
          <StatCard label="Cash From Ads" value={formatCurrency(Math.round(displayCashFromAds))} />
          <StatCard label="Cash From Organic" value={formatCurrency(Math.round(displayCashFromOrganic))} />
          <StatCard label="ROAS" value={displayROAS === null ? 'N/A' : displayROAS.toFixed(2)} />
        </div>
      </div>

      {/* Deals Closed – Detail table: show all transactions in the revenue window */}
      {(windowRevenue as any)?.transactions && (windowRevenue as any).transactions.length > 0 && (
        <div className="rounded-xl border border-fa-border bg-fa-surface p-5">
          <div className="mb-4 text-xs font-medium uppercase tracking-wide text-fa-text-dim">
            Deals Closed — Detail
            <span className="ml-2 normal-case text-fa-text-faint">— matched via window revenue ({(windowRevenue as any).transactions.length} transactions)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fa-border text-left">
                  <th className="px-3 py-2 font-medium text-fa-text-dim">Date</th>
                  <th className="px-3 py-2 font-medium text-fa-text-dim">Name</th>
                  <th className="px-3 py-2 font-medium text-fa-text-dim">Product</th>
                  <th className="px-3 py-2 font-medium text-fa-text-dim">Amount</th>
                  <th className="px-3 py-2 font-medium text-fa-text-dim">Type</th>
                  <th className="px-3 py-2 font-medium text-fa-text-dim">Closer</th>
                </tr>
              </thead>
              <tbody>
                {(windowRevenue as any).transactions.map((txn: any, idx: number) => (
                  <tr key={idx} className="border-b border-fa-border hover:bg-fa-surface-hover">
                    <td className="px-3 py-2 text-fa-text-secondary text-sm">{txn.date}</td>
                    <td className="px-3 py-2 text-fa-text-secondary text-sm">{txn.name || '—'}</td>
                    <td className="px-3 py-2 text-fa-text-secondary text-sm">{txn.product || '—'}</td>
                    <td className="px-3 py-2 text-fa-text-secondary text-sm">${txn.amount.toLocaleString('en-AU')}</td>
                    <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${txn.source === 'Paid' ? 'bg-green-900/30 text-green-300' : 'bg-blue-900/30 text-blue-300'}`}>{txn.source}</span></td>
                    <td className="px-3 py-2 text-fa-text-secondary text-sm">{txn.closer || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ExecutiveSummary bullets={run.executiveSummary.bullets} />

      <div className="rounded-xl border border-fa-border bg-fa-surface p-5">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-fa-text-dim">
          Marketing Performance
          <span className="ml-2 normal-case text-fa-text-faint">— {run.marketingPerformance.sourceLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <MiniStat label="Ad Spend" value={formatCurrency(run.marketingPerformance.adSpend)} />
          <MiniStat label="Link Clicks" value={run.marketingPerformance.linkClicks.toLocaleString('en-AU')} />
          <MiniStat label="CTR %" value={`${run.marketingPerformance.ctrPct.toFixed(2)}%`} />
          <MiniStat label="Leads Generated" value={run.marketingPerformance.leadsGenerated.toLocaleString('en-AU')} />
          <MiniStat label="Cost Per Lead" value={formatCurrency(run.marketingPerformance.costPerLead)} />
          <MiniStat
            label="ROAS"
            value={run.marketingPerformance.roas === null ? 'N/A' : run.marketingPerformance.roas.toFixed(2)}
          />
        </div>
      </div>
    </div>
  )
}
