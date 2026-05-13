const tone = {
  green: "border-emerald-800/60 bg-emerald-950/40 text-emerald-100",
  red: "border-red-800/60 bg-red-950/40 text-red-100",
  amber: "border-amber-800/60 bg-amber-950/40 text-amber-100",
  blue: "border-sky-800/60 bg-sky-950/40 text-sky-100",
  grey: "border-slate-700 bg-slate-900 text-slate-200",
}

export default function StatCard({ label, value, subtitle, color = "grey" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone[color] || tone.grey}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  )
}
