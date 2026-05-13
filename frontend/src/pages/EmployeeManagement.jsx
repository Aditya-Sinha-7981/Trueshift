import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import api from "../services/api"
import EmployeeCard from "../components/EmployeeCard"

export default function EmployeeManagement() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab") === "pending" ? "pending" : "all"

  const [tab, setTab] = useState(tabFromUrl)
  const [employees, setEmployees] = useState([])
  const [pending, setPending] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit] = useState(50)
  const [search, setSearch] = useState("")
  const [department, setDepartment] = useState("")
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    setTab(tabFromUrl)
  }, [tabFromUrl])

  const loadAll = async (p = 1) => {
    const res = await api.get(`/api/employees?page=${p}&limit=${limit}`)
    setEmployees(res.data || [])
    setTotal(res.total ?? 0)
    setPage(res.page ?? p)
  }

  const loadPending = async () => {
    const list = await api.get("/api/employees/pending")
    setPending(Array.isArray(list) ? list : [])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError("")
      try {
        await Promise.all([loadAll(1), loadPending()])
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

  const departments = useMemo(() => {
    const s = new Set()
    employees.forEach((e) => {
      if (e.department) s.add(e.department)
    })
    return Array.from(s).sort()
  }, [employees])

  const filtered = useMemo(() => {
    let rows = employees
    if (department) rows = rows.filter((e) => e.department === department)
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (e) =>
          (e.full_name || "").toLowerCase().includes(q) ||
          (e.employee_id || "").toLowerCase().includes(q)
      )
    }
    return rows
  }, [employees, search, department])

  const verify = async (id) => {
    setError("")
    try {
      await api.post(`/api/employees/${id}/verify`)
      setPending((prev) => prev.filter((p) => p.id !== id))
      setToast("Employee verified and activated.")
      setTimeout(() => setToast(""), 4000)
      await loadAll(page)
    } catch (e) {
      setError(e.message || "Verify failed")
    }
  }

  const loadMore = async () => {
    const next = page + 1
    try {
      const res = await api.get(`/api/employees?page=${next}&limit=${limit}`)
      const more = res.data || []
      setEmployees((prev) => {
        const ids = new Set(prev.map((x) => x.id))
        const merged = [...prev]
        for (const row of more) {
          if (!ids.has(row.id)) merged.push(row)
        }
        return merged
      })
      setPage(res.page ?? next)
    } catch (e) {
      setError(e.message || "Load more failed")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-200">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 pb-24 text-slate-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link to="/admin" className="text-sm text-sky-400 hover:text-sky-300">
          ← Admin
        </Link>
      </div>

      <h1 className="text-xl font-semibold">Employees</h1>

      {toast ? (
        <div className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-100">
          {toast}
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <div className="mt-6 flex gap-2 border-b border-slate-800">
        <button
          type="button"
          className={`min-h-[44px] px-4 pb-3 text-sm font-medium ${
            tab === "all" ? "border-b-2 border-sky-500 text-sky-300" : "text-slate-500"
          }`}
          onClick={() => setTab("all")}
        >
          All employees
        </button>
        <button
          type="button"
          className={`min-h-[44px] px-4 pb-3 text-sm font-medium ${
            tab === "pending" ? "border-b-2 border-sky-500 text-sky-300" : "text-slate-500"
          }`}
          onClick={() => setTab("pending")}
        >
          Pending verification
          <span className="ml-2 rounded-full bg-amber-500/20 px-2 text-xs">{pending.length}</span>
        </button>
      </div>

      {tab === "all" ? (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <input
              type="search"
              placeholder="Search name or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-[44px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm"
            />
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Dept</th>
                  <th className="hidden px-3 py-2 sm:table-cell">Role</th>
                  <th className="hidden px-3 py-2 md:table-cell">Shift</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((emp) => (
                  <EmployeeCard
                    key={emp.id}
                    employee={emp}
                    onRowClick={(e) => navigate(`/admin/employees/${e.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {employees.length < total ? (
            <button
              type="button"
              onClick={loadMore}
              className="min-h-[44px] rounded-lg border border-slate-600 px-4 text-sm text-slate-200 hover:bg-slate-800"
            >
              Load more
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {pending.length === 0 ? (
            <p className="text-sm text-slate-500">No pending accounts.</p>
          ) : (
            pending.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
              >
                <p className="font-medium text-slate-100">{p.full_name}</p>
                <p className="text-sm text-slate-400">{p.email}</p>
                <p className="text-xs text-slate-500">{p.created_at}</p>
                <button
                  type="button"
                  onClick={() => verify(p.id)}
                  className="mt-4 min-h-[44px] rounded-lg bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-500"
                >
                  Verify & Activate
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
