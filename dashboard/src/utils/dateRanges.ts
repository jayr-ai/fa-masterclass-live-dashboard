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

export function monthRange(m: MonthOption): { start: Date; end: Date } {
  const start = new Date(`${m.year}-${String(m.month + 1).padStart(2, '0')}-01T00:00:00Z`)
  const endDate = new Date(m.year, m.month + 1, 0)
  const end = new Date(`${m.year}-${String(m.month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}T23:59:59Z`)
  return { start, end }
}

export function formatISO(d: Date): string {
  return toISODate(d)
}
