import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import api from "../services/api"
import AttendanceCalendar from "../components/AttendanceCalendar"

export default function EmployeeProfile() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const dash = await api.get(`/api/dashboard/employee/${id}`)
        if (!cancelled) setData(dash)
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load profile")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-200">
        <p className="text-sm text-slate-400">Loading profile…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-red-300">
        <p>{error || "Not found"}</p>
        <Link to="/admin/employees" className="mt-4 inline-block text-sky-400">
          ← Employees
        </Link>
      </div>
    )
  }

  const p = data.profile || {}

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 pb-24 text-slate-100">
      <Link to="/admin/employees" className="text-sm text-sky-400 hover:text-sky-300">
        ← Employees
      </Link>

      <header className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h1 className="text-xl font-semibold">{p.full_name}</h1>
        <p className="mt-1 font-mono text-sm text-slate-400">{p.employee_id}</p>
        <p className="mt-2 text-sm text-slate-400">
          {p.department} · {p.designation}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Shift {p.shift_start}–{p.shift_end}
        </p>
      </header>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-slate-300">Attendance (30 days)</h2>
        <AttendanceCalendar logs={data.recent_logs || []} />
      </section>

      <p className="mt-8 text-xs text-slate-600">
        AI insight and full edit history ship in Step 10 per build workflow.
      </p>
    </div>
  )
}
