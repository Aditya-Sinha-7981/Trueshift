// Central API wrapper — all fetch calls go through here, never inline in components
// Reads base URL from VITE_API_URL in .env
// Attaches Authorization: Bearer token automatically on every call
// On 401: clears localStorage + redirects to /login
// On 403 "pending verification": redirects to /pending

const BASE_URL = import.meta.env.VITE_API_URL

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
})

const handleResponse = async (res) => {
  if (res.status === 401) {
    localStorage.clear()
    window.location.href = "/login"
    return
  }
  if (res.status === 403) {
    const data = await res.json()
    if (data?.error?.includes("pending verification")) {
      window.location.href = "/pending"
      return
    }
    throw new Error(data?.error || "Forbidden")
  }
  return res.json()
}

const api = {
  get:    (path)        => fetch(`${BASE_URL}${path}`, { headers: getHeaders() }).then(handleResponse),
  post:   (path, body)  => fetch(`${BASE_URL}${path}`, { method: "POST",   headers: getHeaders(), body: JSON.stringify(body) }).then(handleResponse),
  put:    (path, body)  => fetch(`${BASE_URL}${path}`, { method: "PUT",    headers: getHeaders(), body: JSON.stringify(body) }).then(handleResponse),
  delete: (path)        => fetch(`${BASE_URL}${path}`, { method: "DELETE", headers: getHeaders() }).then(handleResponse),
}

export default api
