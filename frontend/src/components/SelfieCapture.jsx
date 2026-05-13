import { useRef, useEffect } from "react"
import { useCamera } from "../hooks/useCamera"

export default function SelfieCapture({ onCapture, onError }) {
  const videoRef = useRef(null)
  const { capturedImage, startCamera, capture, retake, stop } = useCamera()

  useEffect(() => {
    if (capturedImage) {
      stop()
      return undefined
    }
    const video = videoRef.current
    if (!video) return undefined
    let cancelled = false
    startCamera(video).catch((e) => {
      if (!cancelled) onError(e.message || "Camera error")
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [capturedImage, startCamera, stop, onError])

  const onCaptureClick = () => {
    const v = videoRef.current
    if (!v) return
    capture(v)
  }

  return (
    <div className="space-y-4">
      {!capturedImage ? (
        <>
          <div className="relative aspect-[4/3] w-full max-w-md overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-700">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          </div>
          <button
            type="button"
            onClick={onCaptureClick}
            className="min-h-[44px] rounded-lg bg-sky-600 px-5 text-sm font-medium text-white hover:bg-sky-500"
          >
            Capture
          </button>
        </>
      ) : (
        <>
          <div className="relative aspect-[4/3] w-full max-w-md overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-700">
            <img src={capturedImage} alt="Captured" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => retake()}
              className="min-h-[44px] rounded-lg border border-slate-600 px-5 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={() => onCapture(capturedImage)}
              className="min-h-[44px] rounded-lg bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Use this
            </button>
          </div>
        </>
      )}
    </div>
  )
}
