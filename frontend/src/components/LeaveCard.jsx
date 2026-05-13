const badges = {
  pending: "bg-amber-950 text-amber-200 ring-amber-800/60",
  approved: "bg-emerald-950 text-emerald-200 ring-emerald-800/60",
  rejected: "bg-red-950 text-red-200 ring-red-800/60",
  cancelled: "bg-slate-800 text-slate-300 ring-slate-600",
}

export default function LeaveCard({ leave }) {
  if (!leave) return null
  const st = (leave.status || "").toLowerCase()
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-slate-100">{leave.type}</p>
        <p className="text-xs text-slate-400">
          {leave.from_date} → {leave.to_date} · {leave.days_requested} day(s)
        </p>
        {leave.reason ? <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{leave.reason}</p> : null}
      </div>
      <span
        className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ${badges[st] || badges.pending}`}
      >
        {leave.status}
      </span>
    </div>
  )
}
