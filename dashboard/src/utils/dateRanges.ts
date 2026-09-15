const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface WeekOption {
  key: string // ISO date of the Monday, e.g. '2026-07-27'
  isoWeek: number
  isoYear: number
  start: Date
  end: Date
  label: string // "W31 · Jul 27 → Aug 2 2026"
}

export interface MonthOption {
  key: string // 'YYYY-MM'
  year: number
  month: number // 0-11
  label: string // "Aug 2026"
}

// Local calendar date, not UTC — d.toISOString() shifts a local midnight Date
// across the day boundary in any timezone ahead of UTC, silently corrupting keys.
function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ISO 8601: week 1 is the week containing the year's first Thursday; weeks start Monday.
function isoWeekNumber(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { week, year: d.getUTCFullYear() }
}

function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - (day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

/** Weeks always run Monday–Sunday. */
export function generateWeeks(from: Date, to: Date): WeekOption[] {
  const weeks: WeekOption[] = []
  let cursor = mondayOf(from)
  const end = mondayOf(to)
  while (cursor <= end) {
    const weekEnd = new Date(cursor)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const { week, year } = isoWeekNumber(cursor)
    const sameMonth = cursor.getMonth() === weekEnd.getMonth()
    const startLabel = `${MONTH_ABBR[cursor.getMonth()]} ${cursor.getDate()}`
    const endLabel = sameMonth
      ? `${weekEnd.getDate()}`
      : `${MONTH_ABBR[weekEnd.getMonth()]} ${weekEnd.getDate()}`
    weeks.push({
      key: toISODate(cursor),
      isoWeek: week,
      isoYear: year,
      start: new Date(cursor),
      end: weekEnd,
      label: `W${week} · ${startLabel} → ${endLabel} ${weekEnd.getFullYear()}`,
    })
    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

export function generateMonths(from: Date, to: Date): MonthOption[] {
  const months: MonthOption[] = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cursor <= end) {
    months.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      year: cursor.getFullYear(),
      month: cursor.getMonth(),
      label: `${MONTH_ABBR[cursor.getMonth()]} ${cursor.getFullYear()}`,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

// Local constructor throughout (no 'Z'/UTC anchor) — mirrors mondayOf's
// approach. A UTC-anchored Date here would silently shift a day for any
// viewer west of UTC once read back through local getters (the same bug
// class documented in terraslate-ceo-dashboard and the FA/Heart Smart
// revenue dashboards' weekly-filter fixes).
export function monthRange(m: MonthOption): { start: Date; end: Date } {
  const start = new Date(m.year, m.month, 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(m.year, m.month + 1, 0)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export function formatISO(d: Date): string {
  return toISODate(d)
}

/**
 * Today's calendar date in Sydney (AEST/AEDT), as YYYY-MM-DD — independent
 * of the viewer's own browser timezone. Ad spend and revenue are recorded
 * against Sydney business dates, so "today"/"this week"/"this month" must
 * be resolved against Sydney's clock, not wherever the dashboard is opened
 * from. Uses Intl so daylight saving transitions are handled by the
 * platform's tz database rather than a hardcoded UTC+10/+11 offset.
 */
export function sydneyTodayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Add `days` (may be negative) to a YYYY-MM-DD string, pure calendar arithmetic. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return formatISO(dt)
}

/** Inclusive day count between two YYYY-MM-DD strings (to - from + 1). */
export function daysBetweenISO(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  const from = new Date(fy, fm - 1, fd)
  const to = new Date(ty, tm - 1, td)
  return Math.round((to.getTime() - from.getTime()) / 86400000) + 1
}
