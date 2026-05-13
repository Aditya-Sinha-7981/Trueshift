// Exposes: { location: { lat, lng }, error, isLoading, request() }
import { useState } from "react"

export function useGeolocation() {
  const [location, setLocation]   = useState(null)
  const [error, setError]         = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const request = () => {
    setIsLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setIsLoading(false)
      },
      (err) => {
        const messages = {
          1: "Please allow location access in your browser settings.",
          2: "Location unavailable. Move to an open area and try again.",
          3: "Location request timed out. Try again.",
        }
        setError(messages[err.code] || "Location error.")
        setIsLoading(false)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  return { location, error, isLoading, request }
}
