import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"

function isJwtExpired(token) {
  if (!token || token.split(".").length !== 3) return false
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = b64 + "===".slice((b64.length + 3) % 4)
    const payload = JSON.parse(atob(padded))
    if (typeof payload.exp !== "number") return false
    return Date.now() >= payload.exp * 1000
  } catch {
    return false
  }
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  const clearSession = useCallback(() => {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("user_role")
    localStorage.removeItem("user_id")
    localStorage.removeItem("user_full_name")
    setUser(null)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem("auth_token")
    const role = localStorage.getItem("user_role")
    const id = localStorage.getItem("user_id")

    if (token && isJwtExpired(token)) {
      clearSession()
      setIsLoading(false)
      return
    }

    if (token && role && id) {
      setUser({ id, role })
    }
    setIsLoading(false)
  }, [clearSession])

  const logout = () => {
    clearSession()
    navigate("/login")
  }

  return {
    user,
    role: user?.role ?? null,
    isAdmin: ["admin", "super_admin"].includes(user?.role),
    isSuperAdmin: user?.role === "super_admin",
    isLoading,
    logout,
  }
}
