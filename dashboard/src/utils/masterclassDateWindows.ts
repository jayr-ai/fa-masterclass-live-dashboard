/**
 * Masterclass Window Calculation
 *
 * For a selected masterclass date, calculate the revenue attribution window:
 * - Window Start: Masterclass date (inclusive)
 * - Window End: Day before next masterclass date (inclusive)
 *
 * This ensures each masterclass gets credit only for revenue generated
 * between its run and the next run (or today if it's the latest run).
 */

export interface MasterclassWindow {
  masterclassDate: string
  nextMasterclassDate: string | null
  windowStart: string
  windowEnd: string
  windowDays: number
  isLatestRun: boolean
}

/**
 * Calculate the revenue attribution window for a masterclass run
 *
 * @param currentDate - The masterclass date (YYYY-MM-DD)
 * @param allMasterclassDates - All masterclass dates sorted newest first
 * @returns Window object with start/end dates and metadata
 */
export function calculateMasterclassWindow(
  currentDate: string,
  allMasterclassDates: string[]
): MasterclassWindow {
  // Find the index of current date
  const currentIndex = allMasterclassDates.findIndex(d => d === currentDate)

  if (currentIndex === -1) {
    // Date not found - create single-day window as fallback
    return {
      masterclassDate: currentDate,
      nextMasterclassDate: null,
      windowStart: currentDate,
      windowEnd: currentDate,
      windowDays: 1,
      isLatestRun: false,
    }
  }

  // Get next masterclass date (older date, since sorted newest first)
  const nextDate = currentIndex + 1 < allMasterclassDates.length
    ? allMasterclassDates[currentIndex + 1]
    : null

  // Calculate window end: day before next masterclass (or today if no next)
  let windowEnd: string
  if (nextDate) {
    const nextDateObj = new Date(nextDate + 'T00:00:00')
    nextDateObj.setDate(nextDateObj.getDate() - 1)
    windowEnd = toLocalISODate(nextDateObj)
  } else {
    // Latest run - use today as window end
    windowEnd = toLocalISODate(new Date())
  }

  // Calculate number of days
  const startObj = new Date(currentDate + 'T00:00:00')
  const endObj = new Date(windowEnd + 'T00:00:00')
  const diffTime = Math.abs(endObj.getTime() - startObj.getTime())
  const windowDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1 to include both start and end

  return {
    masterclassDate: currentDate,
    nextMasterclassDate: nextDate,
    windowStart: currentDate,
    windowEnd,
    windowDays,
    isLatestRun: !nextDate,
  }
}

/**
 * Format a date range for display
 * @param windowStart - Start date (YYYY-MM-DD)
 * @param windowEnd - End date (YYYY-MM-DD)
 * @returns Formatted string like "Aug 18-24"
 */
export function formatWindowRange(windowStart: string, windowEnd: string): string {
  const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const startDate = new Date(windowStart + 'T00:00:00')
  const endDate = new Date(windowEnd + 'T00:00:00')

  const startMonth = MONTH_ABBR[startDate.getMonth()]
  const endMonth = MONTH_ABBR[endDate.getMonth()]
  const startDay = startDate.getDate()
  const endDay = endDate.getDate()

  if (startMonth === endMonth) {
    // Same month: "Aug 18-24"
    return `${startMonth} ${startDay}-${endDay}`
  } else {
    // Different months: "Jul 25-Aug 05"
    return `${startMonth} ${startDay}-${endMonth} ${endDay}`
  }
}

/**
 * Convert local date to ISO string (avoids timezone shift issues)
 * @param d - Date object
 * @returns ISO date string (YYYY-MM-DD)
 */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
