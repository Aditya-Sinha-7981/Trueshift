import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import api from "../services/api"
import SelfieCapture from "../components/SelfieCapture"
import GeofenceMap from "../components/GeofenceMap"
import { useGeolocation } from "../hooks/useGeolocation"

export default function CheckIn() {
  const userId = localStorage.getItem("user_id")
  const { location, error: locErr, isLoading: locLoading, request } = useGeolocation()

  const [today, setToday] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [zones, setZones] = useState([])
  const [selfieB64, setSelfieB64] = useState(null)
  const [camError, setCamError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [geofenceErr, setGeofenceErr] = useState(null)
  const locRequested = useRef(false)
  const autoPostRef = useRef(false)

  const loadToday = useCallback(async () => {
    if (!userId) return
    const t = await api.get(`/api/attendance/today/${userId}`)
    setToday(t)
  }, [userId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [z] = await Promise.all([
          api.get("/api/geofence/zones"),
          loadToday().catch(() => null),
        ])
        if (!cancelled) setZones(Array.isArray(z) ? z : [])
      } catch {
        if (!cancelled) setZones([])
      } finally {
        if (!cancelled) setPageLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadToday])

  useEffect(() => {
    if (!selfieB64 || locRequested.current) return
    locRequested.current = true
    request()
  }, [selfieB64, request])

  useEffect(() => {
    if (!selfieB64 || !location || autoPostRef.current) return
    autoPostRef.current = true
    ;(async () => {
      setSubmitting(true)
      setFormError("")
      setGeofenceErr(null)
      try {
        const body = {
          latitude: location.lat,
          longitude: location.lng,
          selfie_base64: selfieB64,
          employee_id: userId,
        }
        await api.post("/api/attendance/checkin", body)
        await loadToday()
        setSelfieB64(null)
        locRequested.current = false
        autoPostRef.current = false
      } catch (e) {
        autoPostRef.current = false
        const d = e.details || {}
        if (d.distance_meters != null && d.nearest_zone) {
          setFormError(d.error || e.message || "Outside all geofence zones")
          setGeofenceErr({
            distance: d.distance_meters,
            nearest: d.nearest_zone,
            lat: location.lat,
            lng: location.lng,
          })
        } else {
          setFormError(e.message || "Check-in failed")
        }
      } finally {
        setSubmitting(false)
      }
    })()
  }, [selfieB64, location, userId, loadToday])

  const nearestZone = zones[0] || {
    name: "Head Office",
    latitude: 22.7196,
    longitude: 75.8577,
    radius_meters: 200,
  }

  const onCheckout = async () => {
    if (!location) {
      request()
      return
    }
    setSubmitting(true)
    setFormError("")
    try {
      await api.post("/api/attendance/checkout", {
        latitude: location.lat,
        longitude: location.lng,
        employee_id: userId,
      })
      await loadToday()
    } catch (e) {
      setFormError(e.message || "Check-out failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-200">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    )
  }

  const hasIn = today?.checkin_time
  const hasOut = today?.checkout_time

  if (hasIn && !hasOut) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
        <header className="mb-6 flex items-center justify-between">
          <Link to="/dashboard" className="text-sm text-sky-400 hover:text-sky-300">
            ← Dashboard
          </Link>
        </header>
        <div className="mx-auto max-w-lg rounded-2xl border border-emerald-900/50 bg-emerald-950/25 p-6">
          <h1 className="text-lg font-semibold text-emerald-100">Checked in today</h1>
          <p className="mt-2 text-sm text-emerald-100/80">
            {today.zone_name || "Office"} ·{" "}
            {today.checkin_time && new Date(today.checkin_time).toLocaleString()}
          </p>
          <p className="mt-4 text-sm text-slate-400">Check out when you leave.</p>
          {!location && !locLoading ? (
            <p className="mt-2 text-xs text-amber-200/90">Turn on location, then tap Check out again.</p>
          ) : null}
          {locLoading ? <p className="mt-2 text-xs text-slate-500">Getting location…</p> : null}
          <button
            type="button"
            disabled={submitting}
            onClick={onCheckout}
            className="mt-6 min-h-[44px] w-full rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-50"
          >
            {submitting ? "Working…" : "Check out"}
          </button>
          {formError ? <p className="mt-3 text-sm text-red-400">{formError}</p> : null}
        </div>
      </div>
    )
  }

  if (hasIn && hasOut) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
        <header className="mb-6">
          <Link to="/dashboard" className="text-sm text-sky-400 hover:text-sky-300">
            ← Dashboard
          </Link>
        </header>
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h1 className="text-lg font-semibold">Day complete</h1>
          <p className="mt-2 text-sm text-slate-400">
            Checked out at {today.checkout_time && new Date(today.checkout_time).toLocaleString()}
          </p>
          {today.hours_worked != null ? (
            <p className="mt-1 text-sm text-slate-300">Hours worked: {today.hours_worked}</p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <Link to="/dashboard" className="text-sm text-sky-400 hover:text-sky-300">
          ← Dashboard
        </Link>
      </header>

      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-xl font-semibold">Check in</h1>
        <p className="text-sm text-slate-400">
          Take a selfie, then we use your location once (mock records it on the server).
        </p>

        {geofenceErr ? (
          <div className="space-y-3">
            <p className="text-sm text-red-300">{formError || "Outside all geofence zones"}</p>
            <GeofenceMap
              userLat={geofenceErr.lat}
              userLng={geofenceErr.lng}
              nearestZone={{
                name: geofenceErr.nearest,
                latitude: nearestZone.latitude,
                longitude: nearestZone.longitude,
                radius_meters: nearestZone.radius_meters,
              }}
              distanceMeters={geofenceErr.distance}
              isInside={false}
            />
            <button
              type="button"
              className="min-h-[44px] rounded-lg border border-slate-600 px-4 text-sm text-slate-200 hover:bg-slate-800"
              onClick={() => {
                setGeofenceErr(null)
                setFormError("")
                setSelfieB64(null)
                locRequested.current = false
                autoPostRef.current = false
              }}
            >
              Try again
            </button>
          </div>
        ) : null}

        {!geofenceErr ? (
          <>
            {!selfieB64 ? (
              <>
                {camError ? (
                  <p className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-200">
                    {camError}
                  </p>
                ) : null}
                <SelfieCapture
                  onCapture={(b64) => {
                    setCamError("")
                    setSelfieB64(b64)
                  }}
                  onError={(msg) => setCamError(msg)}
                />
              </>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
                <p className="font-medium text-slate-100">Selfie saved</p>
                <p className="mt-2 text-slate-400">
                  {locLoading ? "Getting your location…" : locErr ? "" : "Location acquired."}
                </p>
                {locErr ? <p className="mt-2 text-amber-200">{locErr}</p> : null}
                {submitting ? <p className="mt-3 text-sky-300">Submitting check-in…</p> : null}
                {formError ? <p className="mt-3 text-sm text-red-400">{formError}</p> : null}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
