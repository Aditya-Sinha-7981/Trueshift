import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import StatCard from "./StatCard"

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Present" value={42} color="green" />)
    expect(screen.getByText("Present")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
  })
})
