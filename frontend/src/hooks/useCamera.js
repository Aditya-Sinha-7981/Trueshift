// Exposes: { capturedImage, startCamera(), capture(), retake(), stop() }
import { useState, useRef } from "react"

export function useCamera() {
  const [capturedImage, setCapturedImage] = useState(null)
  const streamRef = useRef(null)

  const startCamera = async (videoEl) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 640, height: 480 },
    })
    streamRef.current = stream
    if (videoEl) videoEl.srcObject = stream
  }

  const capture = (videoEl) => {
    const canvas = document.createElement("canvas")
    canvas.width  = videoEl.videoWidth
    canvas.height = videoEl.videoHeight
    canvas.getContext("2d").drawImage(videoEl, 0, 0)
    const base64 = canvas.toDataURL("image/jpeg", 0.6)
    setCapturedImage(base64)
    return base64
  }

  const retake = () => setCapturedImage(null)

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  return { capturedImage, startCamera, capture, retake, stop }
}
