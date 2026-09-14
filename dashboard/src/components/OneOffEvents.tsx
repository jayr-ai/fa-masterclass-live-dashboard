import { MiniStat } from './MiniStat'
import { formatCurrency } from '../utils/format'
import type { Deal } from '../types/dashboard'

export interface OneOffEvent {
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
  deals: Deal[]
  sourceLabel: string
}

// A quick-glance index of every one-off event (co-branded/collab runs, not
// on the recurring weekly schedule). Each one is ALSO selectable from the
// date selector above (see oneOffEventToMasterclassRun in MasterclassPage)
// for the full run-view treatment — this section is a supplementary summary
// for scanning across all of them at once, so it stays collapsed by default.
export function OneOffEvents({ events }: { events: OneOffEvent[] }) {
  if (events.length === 0) return null

  return (
    <details className="group rounded-xl border border-fa-border bg-fa-surface p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium uppercase tracking-wide text-fa-text-dim">
        <span>One-Off Events ({events.length})</span>
        <span className="text-base text-fa-text-faint transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-4 space-y-4">
        {events.map((event) => (
          <div key={event.name} className="rounded-lg border border-fa-border/60 p-4">
            <div className="mb-1 text-sm font-semibold text-fa-text">{event.name}</div>
            <div className="mb-3 text-[11px] text-fa-text-faint">{event.sourceLabel}</div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
              <MiniStat label="Registered" value={event.registered.toLocaleString('en-AU')} />
              <MiniStat label="Attended" value={event.attended.toLocaleString('en-AU')} />
              <MiniStat
                label="Show Up Rate %"
                value={event.showUpRatePct === null ? 'N/A' : `${event.showUpRatePct.toFixed(2)}%`}
              />
              <MiniStat label="Deals Closed" value={event.dealsClosed.toLocaleString('en-AU')} />
              <MiniStat label="Revenue" value={formatCurrency(event.revenue, { exact: true })} />
              <MiniStat label="Cash From Ads" value={formatCurrency(event.cashFromAds, { exact: true })} />
              <MiniStat label="Cash From Organic" value={formatCurrency(event.cashFromOrganic, { exact: true })} />
            </div>
          </div>
        ))}
      </div>
    </details>
  )
}
