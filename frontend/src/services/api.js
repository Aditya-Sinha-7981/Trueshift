const BASE_URL = import.meta.env.VITE_API_URL

const getHeaders = () => {
  const headers = { "Content-Type": "application/json" }
  const token = localStorage.getItem("auth_token")
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}))

  if (res.status === 401) {
    if (localStorage.getItem("auth_token")) {
      localStorage.removeItem("auth_token")
      localStorage.removeItem("user_role")
      localStorage.removeItem("user_id")
      localStorage.removeItem("user_full_name")
      window.location.href = "/login"
      return undefined
    }
    throw new Error(data?.error || "Invalid credentials")
  }

  if (res.status === 403) {
    const msg = (data?.error || "").toLowerCase()
    if (msg.includes("pending verification")) {
      window.location.href = "/pending"
      return undefined
    }
    throw new Error(data?.error || "Forbidden")
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }

  return data
}

const api = {
  get: (path) =>
    fetch(`${BASE_URL}${path}`, { headers: getHeaders() }).then(handleResponse),
  post: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),
  put: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),
  delete: (path) =>
    fetch(`${BASE_URL}${path}`, { method: "DELETE", headers: getHeaders() }).then(handleResponse),
}

export default api
