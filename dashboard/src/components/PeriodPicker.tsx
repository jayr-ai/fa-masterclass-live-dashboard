import {
  generateWeeks,
  generateMonths,
  monthRange,
  formatISO,
  sydneyTodayISO,
  addDaysISO,
  daysBetweenISO,
  type WeekOption,
  type MonthOption,
} from '../utils/dateRanges'

// The picker lists Weekly/Monthly options across this fixed span (matches the
// original build's documented range) — every period in it is selectable
// regardless of whether it actually has data yet.
const RANGE_START = new Date(2025, 0, 1)
const RANGE_END = new Date(2026, 11, 31)

export type PeriodMode = 'weekly' | 'monthly' | 'custom'

export type PeriodValue =
  | { mode: 'weekly'; weekKey: string }
  | { mode: 'monthly'; monthKey: string }
  | { mode: 'custom'; from: string; to: string }

export interface ResolvedPeriod {
  /** YYYY-MM-DD, inclusive — the only fields that should drive data filtering. */
  fromStr: string
  toStr: string
  /** Local Date equivalents of fromStr/toStr, for display/chart use only. */
  from: Date
  to: Date
  label: string
}

const ALL_WEEKS = generateWeeks(RANGE_START, RANGE_END)
const ALL_MONTHS = generateMonths(RANGE_START, RANGE_END)

function endOfDay(d: Date): Date {
  const e = new Date(d)
  e.setHours(23, 59, 59, 999)
  return e
}

function findWeek(weekKey: string): WeekOption {
  return ALL_WEEKS.find((w) => w.key === weekKey) ?? ALL_WEEKS[ALL_WEEKS.length - 1]
}

function findMonth(monthKey: string): MonthOption {
  return ALL_MONTHS.find((m) => m.key === monthKey) ?? ALL_MONTHS[ALL_MONTHS.length - 1]
}

// "Today" is always Sydney's calendar date (AEST/AEDT), never the viewer's
// own browser timezone — ad spend and revenue are recorded against Sydney
// business dates, so defaults and boundaries must match that clock.
function todayWeekKey(): string {
  const today = sydneyTodayISO()
  const containing = ALL_WEEKS.find((w) => formatISO(w.start) <= today && today <= formatISO(w.end))
  return (containing ?? ALL_WEEKS[ALL_WEEKS.length - 1]).key
}

function todayMonthKey(): string {
  const key = sydneyTodayISO().slice(0, 7)
  return ALL_MONTHS.some((m) => m.key === key) ? key : ALL_MONTHS[ALL_MONTHS.length - 1].key
}

export const defaultPeriodValue: PeriodValue = { mode: 'monthly', monthKey: todayMonthKey() }

export function resolvePeriod(period: PeriodValue): ResolvedPeriod {
  if (period.mode === 'weekly') {
    const week = findWeek(period.weekKey)
    return { fromStr: formatISO(week.start), toStr: formatISO(week.end), from: week.start, to: endOfDay(week.end), label: week.label }
  }
  if (period.mode === 'monthly') {
    const month = findMonth(period.monthKey)
    const { start, end } = monthRange(month)
    return { fromStr: formatISO(start), toStr: formatISO(end), from: start, to: end, label: month.label }
  }
  const from = new Date(`${period.from}T00:00:00`)
  const to = endOfDay(new Date(`${period.to}T00:00:00`))
  return { fromStr: period.from, toStr: period.to, from, to, label: period.from === period.to ? period.from : `${period.from} → ${period.to}` }
}

export function resolvePreviousPeriod(period: PeriodValue): ResolvedPeriod {
  if (period.mode === 'weekly') {
    const idx = ALL_WEEKS.findIndex((w) => w.key === period.weekKey)
    const prev = ALL_WEEKS[Math.max(0, idx - 1)]
    return { fromStr: formatISO(prev.start), toStr: formatISO(prev.end), from: prev.start, to: endOfDay(prev.end), label: prev.label }
  }
  if (period.mode === 'monthly') {
    const idx = ALL_MONTHS.findIndex((m) => m.key === period.monthKey)
    const prev = ALL_MONTHS[Math.max(0, idx - 1)]
    const { start, end } = monthRange(prev)
    return { fromStr: formatISO(start), toStr: formatISO(end), from: start, to: end, label: prev.label }
  }
  // Custom: previous period is the same-length span immediately preceding.
  const { from: prevFrom, to: prevTo } = shiftCustomRange(period, -1)
  const from = new Date(`${prevFrom}T00:00:00`)
  const to = endOfDay(new Date(`${prevTo}T00:00:00`))
  return { fromStr: prevFrom, toStr: prevTo, from, to, label: prevFrom === prevTo ? prevFrom : `${prevFrom} → ${prevTo}` }
}

/**
 * Shift a Custom range forward/backward by its own length — pure
 * calendar-string arithmetic (addDaysISO/daysBetweenISO), no Date-object/UTC
 * involved. A single day shifts to the next/previous single day; a 7-day
 * range shifts by 7 days, etc.
 */
export function shiftCustomRange(period: { from: string; to: string }, dir: 1 | -1): { from: string; to: string } {
  const spanDays = daysBetweenISO(period.from, period.to)
  if (dir === -1) {
    const to = addDaysISO(period.from, -1)
    const from = addDaysISO(to, -(spanDays - 1))
    return { from, to }
  }
  const from = addDaysISO(period.to, 1)
  const to = addDaysISO(from, spanDays - 1)
  return { from, to }
}

function shiftWeek(weekKey: string, dir: 1 | -1): string {
  const idx = ALL_WEEKS.findIndex((w) => w.key === weekKey)
  const next = ALL_WEEKS[Math.min(ALL_WEEKS.length - 1, Math.max(0, idx + dir))]
  return next.key
}

function shiftMonth(monthKey: string, dir: 1 | -1): string {
  const idx = ALL_MONTHS.findIndex((m) => m.key === monthKey)
  const next = ALL_MONTHS[Math.min(ALL_MONTHS.length - 1, Math.max(0, idx + dir))]
  return next.key
}

const modeButtonClass = (active: boolean) =>
  `rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
    active
      ? 'border-fa-accent/34 bg-fa-surface-2 text-fa-text'
      : 'border-fa-border text-fa-text-dim hover:text-fa-text'
  }`

const arrowButtonClass = 'rounded-lg border border-fa-border px-3 py-2 text-sm text-fa-text-dim hover:text-fa-text disabled:opacity-40'

export function PeriodPicker({ value, onChange }: { value: PeriodValue; onChange: (v: PeriodValue) => void }) {
  const setMode = (mode: PeriodMode) => {
    if (mode === value.mode) return
    if (mode === 'weekly') onChange({ mode: 'weekly', weekKey: todayWeekKey() })
    else if (mode === 'monthly') onChange({ mode: 'monthly', monthKey: todayMonthKey() })
    else {
      const today = sydneyTodayISO()
      onChange({ mode: 'custom', from: today, to: today })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-2">
        {(['weekly', 'monthly', 'custom'] as const).map((mode) => (
          <button key={mode} className={modeButtonClass(value.mode === mode)} onClick={() => setMode(mode)}>
            {mode === 'weekly' ? 'Weekly' : mode === 'monthly' ? 'Monthly' : 'Custom'}
          </button>
        ))}
      </div>

      {value.mode === 'weekly' && (
        <div className="flex items-center gap-2">
          <button className={arrowButtonClass} onClick={() => onChange({ mode: 'weekly', weekKey: shiftWeek(value.weekKey, -1) })}>
            ‹
          </button>
          <select
            className="rounded-lg border border-fa-border bg-fa-surface px-3 py-2 text-sm text-fa-text"
            value={value.weekKey}
            onChange={(e) => onChange({ mode: 'weekly', weekKey: e.target.value })}
          >
            {[...ALL_WEEKS].reverse().map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
          <button className={arrowButtonClass} onClick={() => onChange({ mode: 'weekly', weekKey: shiftWeek(value.weekKey, 1) })}>
            ›
          </button>
        </div>
      )}

      {value.mode === 'monthly' && (
        <div className="flex items-center gap-2">
          <button className={arrowButtonClass} onClick={() => onChange({ mode: 'monthly', monthKey: shiftMonth(value.monthKey, -1) })}>
            ‹
          </button>
          <select
            className="rounded-lg border border-fa-border bg-fa-surface px-3 py-2 text-sm text-fa-text"
            value={value.monthKey}
            onChange={(e) => onChange({ mode: 'monthly', monthKey: e.target.value })}
          >
            {[...ALL_MONTHS].reverse().map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <button className={arrowButtonClass} onClick={() => onChange({ mode: 'monthly', monthKey: shiftMonth(value.monthKey, 1) })}>
            ›
          </button>
        </div>
      )}

      {value.mode === 'custom' && (
        <div className="flex items-center gap-2">
          <button
            className={arrowButtonClass}
            onClick={() => onChange({ mode: 'custom', ...shiftCustomRange(value, -1) })}
          >
            ‹
          </button>
          <input
            type="date"
            className="rounded-lg border border-fa-border bg-fa-surface px-3 py-2 text-sm text-fa-text"
            value={value.from}
            onChange={(e) => onChange({ mode: 'custom', from: e.target.value, to: value.to })}
          />
          <span className="text-fa-text-dim">→</span>
          <input
            type="date"
            className="rounded-lg border border-fa-border bg-fa-surface px-3 py-2 text-sm text-fa-text"
            value={value.to}
            onChange={(e) => onChange({ mode: 'custom', from: value.from, to: e.target.value })}
          />
          <button
            className={arrowButtonClass}
            onClick={() => onChange({ mode: 'custom', ...shiftCustomRange(value, 1) })}
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
