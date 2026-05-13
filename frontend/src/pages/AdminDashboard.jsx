import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import api from "../services/api"
import StatCard from "../components/StatCard"

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [dash, pending] = await Promise.all([
          api.get("/api/dashboard/admin"),
          api.get("/api/employees/pending"),
        ])
        if (cancelled) return
        setData(dash)
        setPendingCount(Array.isArray(pending) ? pending.length : 0)
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-200">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-red-300">
        <p>{error || "No data"}</p>
      </div>
    )
  }

  const s = data.today_summary || {}
  const pendingLeaves = data.pending_leaves_count ?? 0

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 pb-24 text-slate-100">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Admin dashboard</h1>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link to="/admin/employees" className="rounded-lg px-3 py-2 text-sky-400 hover:bg-slate-800">
            Employees
          </Link>
          <Link to="/admin/leaves" className="rounded-lg px-3 py-2 text-sky-400 hover:bg-slate-800">
            Leaves
          </Link>
          <Link to="/admin/reports" className="rounded-lg px-3 py-2 text-sky-400 hover:bg-slate-800">
            Reports
          </Link>
        </nav>
      </header>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          to="/admin/employees?tab=pending"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 text-sm font-medium text-amber-100 hover:bg-amber-950/50"
        >
          Pending verifications
          <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs">{pendingCount}</span>
        </Link>
        <Link
          to="/admin/leaves"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-sky-900/50 bg-sky-950/30 px-4 text-sm font-medium text-sky-100 hover:bg-sky-950/50"
        >
          Pending leaves
          <span className="ml-2 rounded-full bg-sky-500/20 px-2 py-0.5 text-xs">{pendingLeaves}</span>
        </Link>
      </div>

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Present" value={s.present ?? "—"} color="green" />
        <StatCard label="Absent" value={s.absent ?? "—"} color="red" />
        <StatCard label="Late" value={s.late ?? "—"} color="amber" />
        <StatCard label="On leave" value={s.on_leave ?? "—"} color="blue" />
        <StatCard label="Not checked in" value={s.not_checked_in ?? "—"} color="grey" />
      </section>

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-sm font-medium text-slate-300">By office</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="pb-2">Office</th>
                <th className="pb-2">Present</th>
                <th className="pb-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {(data.by_office || []).map((row) => (
                <tr key={row.zone_name} className="border-t border-slate-800">
                  <td className="py-2">{row.zone_name}</td>
                  <td className="py-2 tabular-nums">{row.present}</td>
                  <td className="py-2 tabular-nums">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-sm font-medium text-slate-300">By department</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="pb-2">Department</th>
                <th className="pb-2">Present</th>
                <th className="pb-2">Rate</th>
              </tr>
            </thead>
            <tbody>
              {(data.department_breakdown || []).map((row) => (
                <tr key={row.department} className="border-t border-slate-800">
                  <td className="py-2">{row.department}</td>
                  <td className="py-2 tabular-nums">
                    {row.present}/{row.total}
                  </td>
                  <td className="py-2 tabular-nums">{row.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-medium text-slate-300">Recent activity</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {(data.recent_activity || []).map((a, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2 border-b border-slate-800/80 pb-2 last:border-0">
              <span>
                <strong className="text-slate-100">{a.employee_name}</strong> · {a.action}
              </span>
              <span className="text-slate-500">
                {a.time} · {a.zone}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
