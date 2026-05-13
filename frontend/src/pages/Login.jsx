import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import api from "../services/api"

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (localStorage.getItem("auth_token")) {
      navigate("/", { replace: true })
    }
  }, [navigate])

  async function onSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const data = await api.post("/api/auth/login", { email, password })
      if (!data) return
      localStorage.setItem("auth_token", data.access_token)
      localStorage.setItem("user_role", data.role)
      localStorage.setItem("user_id", data.id)
      if (data.full_name) localStorage.setItem("user_full_name", data.full_name)
      if (["admin", "super_admin"].includes(data.role)) {
        navigate("/admin", { replace: true })
      } else {
        navigate("/dashboard", { replace: true })
      }
    } catch (err) {
      setError(err.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-slate-400">Use your work email and password.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none ring-sky-500 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none ring-sky-500 focus:ring-2"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-red-950/50 border border-red-900/60 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 py-3 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px]"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          No account?{" "}
          <Link to="/register" className="font-medium text-sky-400 hover:text-sky-300">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
