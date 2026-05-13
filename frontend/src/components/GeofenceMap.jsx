export default function GeofenceMap({
  userLat,
  userLng,
  nearestZone,
  distanceMeters,
  isInside,
}) {
  const name = nearestZone?.name || "Office"
  const cx = 110
  const cy = 110
  const r = 70
  const ux = isInside ? cx - 18 : cx + r + 35
  const uy = isInside ? cy + 12 : cy - 28
  const stroke = isInside ? "#22c55e" : "#ef4444"

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
      <svg viewBox="0 0 220 220" className="mx-auto h-auto w-full max-w-sm" aria-label="Geofence map">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth="2" opacity="0.85" />
        <line x1={cx} y1={cy} x2={ux} y2={uy} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx={cx} cy={cy} r="4" fill="#64748b" />
        <circle cx={ux} cy={uy} r="8" fill={stroke} />
        <text x="110" y="205" textAnchor="middle" className="fill-slate-400 text-[10px]">
          {name}
        </text>
      </svg>
      <p className={`mt-3 text-center text-sm font-medium ${isInside ? "text-emerald-400" : "text-red-400"}`}>
        {isInside ? "Inside zone" : "Outside zone"} — about {Math.round(distanceMeters ?? 0)} m from centre
      </p>
      <p className="mt-1 text-center text-xs text-slate-500">
        Your position: {userLat?.toFixed(5)}, {userLng?.toFixed(5)}
      </p>
    </div>
  )
}
