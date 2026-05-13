import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import api from "../services/api"
import StatCard from "../components/StatCard"
import AttendanceCalendar from "../components/AttendanceCalendar"
import LeaveCard from "../components/LeaveCard"
import { format, isBefore, isValid, parseISO, startOfDay } from "date-fns"

export default function EmployeeDashboard() {
  const userId = localStorage.getItem("user_id")
  const [data, setData] = useState(null)
  const [leaves, setLeaves] = useState([])
  const [holidays, setHolidays] = useState([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const [dash, myLeaves, hol] = await Promise.all([
          api.get(`/api/dashboard/employee/${userId}`),
          api.get(`/api/leave/my/${userId}`),
          api.get("/api/holidays").catch(() => []),
        ])
        if (cancelled) return
        setData(dash)
        setLeaves(Array.isArray(myLeaves) ? myLeaves : [])
        const list = Array.isArray(hol) ? hol : []
        const start = startOfDay(new Date())
        const upcoming = list
          .filter((h) => {
            const d = parseISO(h.date)
            return isValid(d) && !isBefore(d, start)
          })
          .sort((a, b) => parseISO(a.date) - parseISO(b.date))
          .slice(0, 5)
        setHolidays(upcoming)
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load dashboard")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-200">
        <p className="text-sm text-slate-400">Loading dashboard…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-red-300">
        <p>{error || "No data"}</p>
        <Link to="/login" className="mt-4 inline-block text-sky-400">
          Back
        </Link>
      </div>
    )
  }

  const { profile, today, this_month, leave_balance, recent_logs } = data
  const t = today || {}
  const recentLeaves = leaves.slice(0, 3)

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 pb-24 text-slate-100">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Hello, {profile?.full_name || "there"}</h1>
          <p className="text-sm text-slate-400">
            {profile?.employee_id} · {profile?.department}
            {profile?.designation ? ` · ${profile.designation}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/checkin"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-500"
          >
            {t.checkin_time && !t.checkout_time ? "Check out" : "Check in"}
          </Link>
          <Link
            to="/apply-leave"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-600 px-4 text-sm text-slate-200 hover:bg-slate-800"
          >
            Apply leave
          </Link>
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-medium text-slate-400">Today</h2>
        <p className="mt-2 text-lg capitalize text-slate-100">{t.status || "Not checked in yet"}</p>
        {t.zone_name ? <p className="text-sm text-slate-400">{t.zone_name}</p> : null}
        {t.checkin_time ? <p className="mt-1 text-sm text-slate-300">In: {t.checkin_time}</p> : null}
        {t.checkout_time ? <p className="text-sm text-slate-300">Out: {t.checkout_time}</p> : null}
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Present" value={this_month?.present ?? "—"} color="green" />
        <StatCard label="Absent" value={this_month?.absent ?? "—"} color="red" />
        <StatCard label="Late" value={this_month?.late ?? "—"} color="amber" />
        <StatCard
          label="Attendance rate"
          value={this_month?.attendance_rate != null ? `${this_month.attendance_rate}%` : "—"}
          subtitle="This month"
          color="blue"
        />
      </section>

      <section className="mb-8">
        <AttendanceCalendar logs={recent_logs || []} month={new Date()} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-slate-300">Leave balance</h2>
        <div className="space-y-4">
          {(leave_balance || []).map((row) => {
            const total = row.total ?? 0
            const used = row.used ?? 0
            const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
            return (
              <div key={row.code}>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>
                    {row.type} ({row.code})
                  </span>
                  <span>
                    {used} / {total} used · {row.remaining ?? total - used} left
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: row.color || "#4f8ef7" }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-slate-300">Recent applications</h2>
        <div className="space-y-2">
          {recentLeaves.length ? (
            recentLeaves.map((l) => <LeaveCard key={l.id} leave={l} />)
          ) : (
            <p className="text-sm text-slate-500">No leave applications yet.</p>
          )}
        </div>
      </section>

      {data.upcoming_leaves?.length ? (
        <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-medium text-slate-300">Upcoming approved leave</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-400">
            {data.upcoming_leaves.map((u, i) => (
              <li key={i}>
                {u.type} · {u.from_date} → {u.to_date} ({u.days_requested}d)
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {holidays.length ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-medium text-slate-300">Upcoming holidays</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-400">
            {holidays.map((h) => (
              <li key={h.id}>
                {format(parseISO(h.date), "yyyy-MM-dd")} — {h.name} ({h.type})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
