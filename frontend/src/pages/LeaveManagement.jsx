import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import api from "../services/api"

const TABS = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "", label: "All" },
]

export default function LeaveManagement() {
  const [tab, setTab] = useState("pending")
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [rejectId, setRejectId] = useState(null)
  const [rejectNote, setRejectNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [badges, setBadges] = useState({ pending: 0, approved: 0, rejected: 0, all: 0 })

  const refreshBadges = useCallback(async () => {
    try {
      const [p, a, r, all] = await Promise.all([
        api.get("/api/leave/all?status=pending&page=1&limit=1"),
        api.get("/api/leave/all?status=approved&page=1&limit=1"),
        api.get("/api/leave/all?status=rejected&page=1&limit=1"),
        api.get("/api/leave/all?page=1&limit=1"),
      ])
      setBadges({
        pending: p.total ?? 0,
        approved: a.total ?? 0,
        rejected: r.total ?? 0,
        all: all.total ?? 0,
      })
    } catch {
      /* best-effort */
    }
  }, [])

  useEffect(() => {
    refreshBadges()
  }, [refreshBadges])

  const fetchPage = useCallback(
    async (statusKey, p = 1, append = false) => {
      const qs =
        statusKey && statusKey !== "all"
          ? `?status=${encodeURIComponent(statusKey)}&page=${p}&limit=${limit}`
          : `?page=${p}&limit=${limit}`
      const res = await api.get(`/api/leave/all${qs}`)
      const data = res.data || []
      setTotal(res.total ?? data.length)
      setPage(res.page ?? p)
      if (append) {
        setRows((prev) => {
          const ids = new Set(prev.map((x) => x.id))
          const merged = [...prev]
          for (const row of data) {
            if (!ids.has(row.id)) merged.push(row)
          }
          return merged
        })
      } else {
        setRows(data)
      }
    },
    [limit]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError("")
      try {
        await fetchPage(tab, 1, false)
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load leaves")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, fetchPage])

  const approve = async (id) => {
    const prev = rows.find((r) => r.id === id)
    setRows((list) =>
      list.map((r) => (r.id === id ? { ...r, status: "approved" } : r))
    )
    try {
      await api.put(`/api/leave/${id}/approve`)
      await refreshBadges()
    } catch (e) {
      if (prev) setRows((list) => list.map((r) => (r.id === id ? prev : r)))
      setError(e.message || "Approve failed")
    }
  }

  const submitReject = async () => {
    if (!rejectId || !rejectNote.trim()) return
    const id = rejectId
    const prev = rows.find((r) => r.id === id)
    setSubmitting(true)
    setRows((list) =>
      list.map((r) => (r.id === id ? { ...r, status: "rejected" } : r))
    )
    setRejectId(null)
    setRejectNote("")
    try {
      await api.put(`/api/leave/${id}/reject`, { rejection_note: rejectNote.trim() })
      await refreshBadges()
    } catch (e) {
      if (prev) setRows((list) => list.map((r) => (r.id === id ? prev : r)))
      setError(e.message || "Reject failed")
    } finally {
      setSubmitting(false)
    }
  }

  const loadMore = async () => {
    try {
      await fetchPage(tab, page + 1, true)
    } catch (e) {
      setError(e.message || "Load more failed")
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-200">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 pb-32 text-slate-100">
      <Link to="/admin" className="text-sm text-sky-400 hover:text-sky-300">
        ← Admin
      </Link>
      <h1 className="mt-4 text-xl font-semibold">Leave management</h1>
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id || "all"}
            type="button"
            className={`min-h-[40px] rounded-lg px-3 text-sm ${
              tab === t.id ? "bg-slate-800 text-sky-300" : "text-slate-500 hover:bg-slate-900"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "pending" ? (
              <span className="ml-1 text-xs text-slate-500">({badges.pending})</span>
            ) : null}
            {t.id === "approved" ? (
              <span className="ml-1 text-xs text-slate-500">({badges.approved})</span>
            ) : null}
            {t.id === "rejected" ? (
              <span className="ml-1 text-xs text-slate-500">({badges.rejected})</span>
            ) : null}
            {t.id === "" ? (
              <span className="ml-1 text-xs text-slate-500">({badges.all})</span>
            ) : null}
          </button>
        ))}
      </div>

      <ul className="mt-6 space-y-4">
        {rows.map((leave) => (
          <li
            key={leave.id}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-100">{leave.employee_name}</p>
                <p className="text-xs text-slate-500">
                  {leave.employee_id} · {leave.department}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {leave.type} · {leave.from_date} → {leave.to_date} ({leave.days_requested}d)
                </p>
                <p className="mt-1 text-sm text-slate-500">{leave.reason}</p>
              </div>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs capitalize text-slate-300">
                {leave.status}
              </span>
            </div>
            {leave.status === "pending" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => approve(leave.id)}
                  className="min-h-[40px] rounded-lg bg-emerald-700 px-4 text-sm text-white hover:bg-emerald-600"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setRejectId(leave.id)}
                  className="min-h-[40px] rounded-lg border border-red-900/50 px-4 text-sm text-red-300 hover:bg-red-950/40"
                >
                  Reject
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {rows.length < total ? (
        <button
          type="button"
          onClick={loadMore}
          className="mt-6 min-h-[44px] rounded-lg border border-slate-600 px-4 text-sm text-slate-200"
        >
          Load more
        </button>
      ) : null}

      {rejectId ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-medium text-slate-100">Reject leave</h3>
            <textarea
              className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              rows={4}
              placeholder="Rejection note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-slate-800"
                onClick={() => {
                  setRejectId(null)
                  setRejectNote("")
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !rejectNote.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={submitReject}
              >
                Submit rejection
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
