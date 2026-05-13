import { describe, expect, it } from "vitest"
import { countWorkingLeaveDays } from "./workingDays"

describe("countWorkingLeaveDays", () => {
  it("counts Mon–Fri only for full_day", () => {
    // Mon 2025-05-12 to Fri 2025-05-16 → 5 working days
    expect(countWorkingLeaveDays("2025-05-12", "2025-05-16", "full_day")).toBe(5)
  })

  it("excludes weekends in range", () => {
    // Fri 2025-05-09 to Mon 2025-05-12 → Fri + Mon = 2 (skips Sat Sun)
    expect(countWorkingLeaveDays("2025-05-09", "2025-05-12", "full_day")).toBe(2)
  })

  it("returns 0 when range is invalid", () => {
    expect(countWorkingLeaveDays("2025-05-12", "2025-05-10", "full_day")).toBe(0)
    expect(countWorkingLeaveDays("", "2025-05-12", "full_day")).toBe(0)
  })

  it("halves working days for half-day modes", () => {
    expect(countWorkingLeaveDays("2025-05-12", "2025-05-16", "first_half")).toBe(2.5)
    expect(countWorkingLeaveDays("2025-05-12", "2025-05-16", "second_half")).toBe(2.5)
  })

  it("returns 0 for weekend-only range", () => {
    // Sat–Sun only
    expect(countWorkingLeaveDays("2025-05-10", "2025-05-11", "full_day")).toBe(0)
  })
})
