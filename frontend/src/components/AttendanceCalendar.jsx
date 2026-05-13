import { format, isWeekend, subDays } from "date-fns"

const statusStyles = {
  present: "bg-emerald-600/80 border-emerald-500",
  late: "bg-amber-600/80 border-amber-500",
  absent: "bg-red-600/80 border-red-500",
  on_leave: "bg-sky-600/80 border-sky-500",
  half_day: "bg-amber-500/70 border-amber-400",
  default: "bg-slate-700/80 border-slate-600",
  future: "bg-slate-800/50 border-slate-700 border-dashed",
}

function cellClass(log, day) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (day > today) return statusStyles.future
  if (!log || !log.status) return statusStyles.default
  return statusStyles[log.status] || statusStyles.default
}

export default function AttendanceCalendar({ logs = [], month = new Date() }) {
  const end = new Date(month)
  end.setHours(0, 0, 0, 0)
  const days = []
  for (let i = 29; i >= 0; i--) {
    days.push(subDays(end, i))
  }

  const byDate = {}
  for (const log of logs) {
    if (log?.date) byDate[log.date] = log
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="text-sm font-medium text-slate-200">Last 30 days</h3>
      <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-10">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd")
          const log = byDate[key]
          const weekend = isWeekend(day)
          const title = `${key}${log?.status ? ` — ${log.status}` : weekend ? " — weekend" : ""}`
          return (
            <div
              key={key}
              title={title}
              className={`aspect-square rounded border text-[10px] leading-none ${cellClass(log, day)} ${weekend && !log ? "opacity-60" : ""}`}
            />
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-600" /> Present
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-amber-600" /> Late
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-red-600" /> Absent
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-sky-600" /> Leave
        </span>
      </div>
    </div>
  )
}
