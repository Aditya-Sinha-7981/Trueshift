// Exposes: { user, role, isAdmin, isSuperAdmin, isLoading, logout }
// isAdmin: true if role is 'admin' OR 'super_admin'
// isSuperAdmin: true only if role is 'super_admin'
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

export function useAuth() {
  const [user, setUser]     = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem("auth_token")
    const role  = localStorage.getItem("user_role")
    const id    = localStorage.getItem("user_id")
    if (token && role && id) {
      setUser({ id, role })
    }
    setIsLoading(false)
  }, [])

  const logout = () => {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("user_role")
    localStorage.removeItem("user_id")
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
