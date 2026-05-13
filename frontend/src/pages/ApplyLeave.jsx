import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import api from "../services/api"
import { countWorkingLeaveDays } from "../utils/workingDays"

export default function ApplyLeave() {
  const navigate = useNavigate()
  const userId = localStorage.getItem("user_id")
  const [balance, setBalance] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [leaveTypeId, setLeaveTypeId] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [mode, setMode] = useState("full_day")
  const [reason, setReason] = useState("")
  const [contact, setContact] = useState("")

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const b = await api.get(`/api/leave/balance/${userId}`)
        if (!cancelled) {
          setBalance(Array.isArray(b) ? b : [])
          if (Array.isArray(b) && b[0]?.leave_type_id) setLeaveTypeId(b[0].leave_type_id)
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Could not load balances")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const selected = useMemo(
    () => balance.find((x) => x.leave_type_id === leaveTypeId),
    [balance, leaveTypeId]
  )

  const daysRequested = useMemo(
    () => countWorkingLeaveDays(fromDate, toDate, mode),
    [fromDate, toDate, mode]
  )

  const insufficient = selected && daysRequested > (selected.remaining ?? 0)

  async function onSubmit(e) {
    e.preventDefault()
    setError("")
    setSuccess("")
    if (!leaveTypeId) {
      setError("Select a leave type.")
      return
    }
    if (!fromDate || !toDate) {
      setError("Choose from and to dates.")
      return
    }
    if (daysRequested <= 0) {
      setError("Date range has no working days (weekends only).")
      return
    }
    if (insufficient) {
      setError("Requested days exceed remaining balance.")
      return
    }
    setSubmitting(true)
    try {
      await api.post("/api/leave/apply", {
        leave_type_id: leaveTypeId,
        from_date: fromDate,
        to_date: toDate,
        mode,
        reason: reason.trim() || "—",
        contact_during: contact.trim() || undefined,
      })
      setSuccess("Leave application submitted.")
      setTimeout(() => navigate("/dashboard"), 1200)
    } catch (err) {
      setError(err.message || "Submit failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-200">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    )
  }

  if (!balance.length) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
        <Link to="/dashboard" className="text-sm text-sky-400 hover:text-sky-300">
          ← Dashboard
        </Link>
        <p className="mt-6 text-sm text-slate-400">
          No leave balances found. An admin may need to verify your account.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
      <Link to="/dashboard" className="text-sm text-sky-400 hover:text-sky-300">
        ← Dashboard
      </Link>

      <h1 className="mt-4 text-xl font-semibold">Apply for leave</h1>
      <p className="mt-1 text-sm text-slate-400">
        Working days exclude weekends (holidays are applied on the server later).
      </p>

      <form onSubmit={onSubmit} className="mx-auto mt-8 max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300">Leave type</label>
          <select
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none ring-sky-500 focus:ring-2"
          >
            {balance.map((b) => (
              <option key={b.leave_type_id} value={b.leave_type_id}>
                {b.leave_type} — {b.remaining ?? b.total_days - b.used_days} days left
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-300">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm"
          >
            <option value="full_day">Full day</option>
            <option value="first_half">First half</option>
            <option value="second_half">Second half</option>
          </select>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
          Working days counted: <strong className="text-slate-100">{daysRequested}</strong>
          {selected ? (
            <span className="text-slate-500">
              {" "}
              · Balance: {selected.remaining ?? selected.total_days - selected.used_days}
            </span>
          ) : null}
        </div>

        {insufficient ? (
          <p className="text-sm font-medium text-red-400">Insufficient balance for this range.</p>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-slate-300">Reason</label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Contact during leave (optional)</label>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm"
          />
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

        <button
          type="submit"
          disabled={submitting || insufficient || daysRequested <= 0}
          className="min-h-[44px] w-full rounded-lg bg-sky-600 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </div>
  )
}
