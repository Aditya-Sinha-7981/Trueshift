import { eachDayOfInterval, isWeekend, parseISO } from "date-fns"

/**
 * Count working days (Mon–Fri) in [fromStr, toStr]. Half-day modes scale working days by 0.5.
 * @param {string} fromStr ISO date yyyy-MM-dd
 * @param {string} toStr ISO date yyyy-MM-dd
 * @param {'full_day'|'first_half'|'second_half'} mode
 */
export function countWorkingLeaveDays(fromStr, toStr, mode) {
  if (!fromStr || !toStr) return 0
  const start = parseISO(fromStr)
  const end = parseISO(toStr)
  if (Number.isNaN(+start) || Number.isNaN(+end) || end < start) return 0
  const days = eachDayOfInterval({ start, end })
  const workDays = days.filter((d) => !isWeekend(d)).length
  if (mode === "full_day") return workDays
  if (workDays === 0) return 0
  return workDays * 0.5
}
