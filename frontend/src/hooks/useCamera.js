import { useState, useRef, useCallback } from "react"

export function useCamera() {
  const [capturedImage, setCapturedImage] = useState(null)
  const streamRef = useRef(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(
    async (videoEl) => {
      if (!videoEl) return
      stop()
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
        })
        streamRef.current = stream
        videoEl.srcObject = stream
        await videoEl.play()
      } catch (e) {
        const name = e?.name || ""
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          throw new Error(
            "Camera access denied. Allow camera in browser settings (Safari / Chrome → Site settings)."
          )
        }
        if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          throw new Error("No camera found on this device.")
        }
        throw new Error(e?.message || "Could not start camera.")
      }
    },
    [stop]
  )

  const capture = useCallback((videoEl) => {
    if (!videoEl || videoEl.videoWidth === 0) return null
    const canvas = document.createElement("canvas")
    canvas.width = videoEl.videoWidth
    canvas.height = videoEl.videoHeight
    canvas.getContext("2d").drawImage(videoEl, 0, 0)
    const base64 = canvas.toDataURL("image/jpeg", 0.6)
    setCapturedImage(base64)
    return base64
  }, [])

  const retake = useCallback(() => {
    setCapturedImage(null)
  }, [])

  return { capturedImage, startCamera, capture, retake, stop }
}
