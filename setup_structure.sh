#!/bin/bash
# AttendTrack Pro — Project Structure Setup
# Run ONCE from the repo root after cloning.
# Usage: bash setup_structure.sh
# Mac/Linux: runs as-is. Windows: use Git Bash or WSL (not cmd.exe).
# Python version: 3.11.9 (set via pyenv — see instructions at the bottom)

echo "Creating AttendTrack Pro project structure..."

# ── FOLDERS ───────────────────────────────────────────────────────────────────

mkdir -p backend/api
mkdir -p backend/services
mkdir -p backend/models
mkdir -p backend/utils
mkdir -p frontend/src/pages
mkdir -p frontend/src/components
mkdir -p frontend/src/hooks
mkdir -p frontend/src/services
mkdir -p frontend/public
mkdir -p mock_api
mkdir -p docs

# ── BACKEND PACKAGE INIT FILES ────────────────────────────────────────────────

touch backend/__init__.py
touch backend/api/__init__.py
touch backend/services/__init__.py
touch backend/models/__init__.py
touch backend/utils/__init__.py

# ── BACKEND CORE FILES ────────────────────────────────────────────────────────

cat > backend/main.py << 'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import auth, attendance, leave, employees, geofence, holidays, reports, dashboard
from scheduler import start_scheduler
from config import settings

app = FastAPI(title="AttendTrack API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock to specific URLs before production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/auth")
app.include_router(attendance.router,  prefix="/api/attendance")
app.include_router(leave.router,       prefix="/api/leave")
app.include_router(employees.router,   prefix="/api/employees")
app.include_router(geofence.router,    prefix="/api/geofence")
app.include_router(holidays.router,    prefix="/api/holidays")
app.include_router(reports.router,     prefix="/api/reports")
app.include_router(dashboard.router,   prefix="/api/dashboard")

@app.on_event("startup")
async def on_startup():
    start_scheduler()

@app.get("/health")
def health():
    return {"status": "ok"}
EOF

cat > backend/config.py << 'EOF'
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    resend_api_key: str
    from_email: str = "noreply@attendtrack.com"
    cloudinary_cloud_name: str
    cloudinary_api_key: str
    cloudinary_api_secret: str
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    scheduler_timezone: str = "Asia/Kolkata"

    class Config:
        env_file = ".env"

settings = Settings()
EOF

cat > backend/scheduler.py << 'EOF'
# APScheduler setup
# Job 1 — Daily at 18:30 IST: mark absent for employees with no check-in today
# Job 2 — 1st of each month at 02:00 IST: delete selfies older than 30 days from Cloudinary

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")

def start_scheduler():
    # TODO: implement mark_absentees() and cleanup_old_selfies() in services/
    # scheduler.add_job(mark_absentees, CronTrigger(hour=18, minute=30))
    # scheduler.add_job(cleanup_old_selfies, CronTrigger(day=1, hour=2))
    scheduler.start()
EOF

cat > backend/models/schemas.py << 'EOF'
# All Pydantic request/response models go here
# See CORE.md for full endpoint specs — build models to match those shapes exactly
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

# Example — expand as you build each endpoint:
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
EOF

cat > backend/utils/supabase_client.py << 'EOF'
# Supabase singleton — import this everywhere, never create a new client yourself
# Usage: from utils.supabase_client import supabase
from supabase import create_client, Client
from config import settings

supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)
EOF

cat > backend/utils/auth_utils.py << 'EOF'
# JWT verification and role-check FastAPI dependencies
# Usage: current_user = Depends(get_current_user)
#        admin_user   = Depends(require_admin)
#        super_user   = Depends(require_super_admin)
from fastapi import Depends, HTTPException, Header
from utils.supabase_client import supabase

async def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")
    token = authorization.split(" ")[1]
    try:
        user = supabase.auth.get_user(token)
        profile = supabase.table("profiles").select("*").eq("id", user.user.id).single().execute()
        if not profile.data["is_verified"]:
            raise HTTPException(status_code=403, detail="Account pending verification")
        return profile.data
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def require_super_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user
EOF

# ── BACKEND API STUBS ─────────────────────────────────────────────────────────

for f in auth attendance leave employees geofence holidays reports dashboard; do
cat > backend/api/${f}.py << EOF
# ${f}.py — see CORE.md and API_CONTRACT.md for full implementation spec
from fastapi import APIRouter
router = APIRouter()
EOF
done

# ── BACKEND SERVICE STUBS ─────────────────────────────────────────────────────

for f in geofence_service cloudinary_service email_service; do
cat > backend/services/${f}.py << EOF
# ${f}.py — see CORE.md for full implementation spec
EOF
done

# ── BACKEND REQUIREMENTS.TXT ──────────────────────────────────────────────────

cat > backend/requirements.txt << 'EOF'
fastapi==0.111.0
uvicorn[standard]==0.29.0
python-multipart==0.0.9
python-dotenv==1.0.1
supabase==2.4.2
apscheduler==3.10.4
resend==0.7.0
cloudinary==1.40.0
httpx==0.27.0
pydantic==2.7.0
pydantic-settings==2.2.1
python-jose[cryptography]==3.3.0
EOF

# ── BACKEND .ENV.EXAMPLE ──────────────────────────────────────────────────────

cat > backend/.env.example << 'EOF'
# Copy this file to .env and fill in all values before running the server
# Never commit .env — it is gitignored

SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_KEY=eyJ...           # service_role key — NOT anon key

RESEND_API_KEY=re_...
FROM_EMAIL=noreply@yourdomain.com

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

FRONTEND_URL=http://localhost:5173    # Update to Vercel URL before production
BACKEND_URL=http://localhost:8000     # Update to Railway URL before production
SCHEDULER_TIMEZONE=Asia/Kolkata
EOF

# ── BACKEND .ENV (copy from example if not already there) ─────────────────────

if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "  ✓ backend/.env created from .env.example — fill in your API keys"
else
    echo "  ✓ backend/.env already exists, skipping"
fi

# ── PYTHON VERSION PIN ────────────────────────────────────────────────────────

echo "3.11.9" > backend/.python-version

# ── FRONTEND PAGE STUBS ───────────────────────────────────────────────────────

for page in Login Register PendingVerification EmployeeDashboard AdminDashboard CheckIn ApplyLeave LeaveManagement EmployeeManagement EmployeeProfile GeofenceManagement Holidays Reports; do
cat > frontend/src/pages/${page}.jsx << EOF
// ${page}.jsx — see CORE.md for full spec
export default function ${page}() {
  return <div>${page}</div>
}
EOF
done

# ── FRONTEND COMPONENT STUBS ──────────────────────────────────────────────────

for comp in AttendanceCalendar SelfieCapture GeofenceMap LeaveCard HolidayBadge EmployeeCard StatCard; do
cat > frontend/src/components/${comp}.jsx << EOF
// ${comp}.jsx — see CORE.md for full spec
export default function ${comp}() {
  return null
}
EOF
done

# ── FRONTEND HOOKS ────────────────────────────────────────────────────────────

cat > frontend/src/hooks/useAuth.js << 'EOF'
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
EOF

cat > frontend/src/hooks/useGeolocation.js << 'EOF'
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
EOF

cat > frontend/src/hooks/useCamera.js << 'EOF'
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
EOF

# ── FRONTEND SERVICES ─────────────────────────────────────────────────────────

cat > frontend/src/services/api.js << 'EOF'
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
EOF

cat > frontend/src/services/supabaseClient.js << 'EOF'
// Supabase JS client singleton — use for auth session if needed
// import { supabase } from './services/supabaseClient'
import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
EOF

# ── FRONTEND APP.JSX ──────────────────────────────────────────────────────────

cat > frontend/src/App.jsx << 'EOF'
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./hooks/useAuth"

import Login               from "./pages/Login"
import Register            from "./pages/Register"
import PendingVerification from "./pages/PendingVerification"
import EmployeeDashboard   from "./pages/EmployeeDashboard"
import AdminDashboard      from "./pages/AdminDashboard"
import CheckIn             from "./pages/CheckIn"
import ApplyLeave          from "./pages/ApplyLeave"
import LeaveManagement     from "./pages/LeaveManagement"
import EmployeeManagement  from "./pages/EmployeeManagement"
import EmployeeProfile     from "./pages/EmployeeProfile"
import GeofenceManagement  from "./pages/GeofenceManagement"
import Holidays            from "./pages/Holidays"
import Reports             from "./pages/Reports"

function RequireAuth({ children }) {
  const token = localStorage.getItem("auth_token")
  return token ? children : <Navigate to="/login" replace />
}

function RequireAdmin({ children }) {
  const role = localStorage.getItem("user_role")
  if (!localStorage.getItem("auth_token")) return <Navigate to="/login" replace />
  if (!["admin", "super_admin"].includes(role)) return <Navigate to="/dashboard" replace />
  return children
}

function RequireSuperAdmin({ children }) {
  const role = localStorage.getItem("user_role")
  if (!localStorage.getItem("auth_token")) return <Navigate to="/login" replace />
  if (role !== "super_admin") return <Navigate to="/admin" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login"   element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pending" element={<PendingVerification />} />

        {/* Employee */}
        <Route path="/dashboard" element={<RequireAuth><EmployeeDashboard /></RequireAuth>} />
        <Route path="/checkin"   element={<RequireAuth><CheckIn /></RequireAuth>} />
        <Route path="/apply-leave" element={<RequireAuth><ApplyLeave /></RequireAuth>} />

        {/* Admin */}
        <Route path="/admin"                    element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/employees"          element={<RequireAdmin><EmployeeManagement /></RequireAdmin>} />
        <Route path="/admin/employees/:id"      element={<RequireAdmin><EmployeeProfile /></RequireAdmin>} />
        <Route path="/admin/leaves"             element={<RequireAdmin><LeaveManagement /></RequireAdmin>} />
        <Route path="/admin/reports"            element={<RequireAdmin><Reports /></RequireAdmin>} />
        <Route path="/admin/holidays"           element={<RequireAdmin><Holidays /></RequireAdmin>} />

        {/* Super Admin only */}
        <Route path="/admin/geofence"           element={<RequireSuperAdmin><GeofenceManagement /></RequireSuperAdmin>} />

        {/* Default */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
EOF

cat > frontend/src/main.jsx << 'EOF'
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
EOF

cat > frontend/src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

# ── FRONTEND CONFIG FILES ─────────────────────────────────────────────────────

cat > frontend/index.html << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AttendTrack</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

cat > frontend/vite.config.js << 'EOF'
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
})
EOF

cat > frontend/tailwind.config.js << 'EOF'
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
EOF

cat > frontend/postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

cat > frontend/package.json << 'EOF'
{
  "name": "attendtrack-frontend",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "@supabase/supabase-js": "^2.43.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.2.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
EOF

# ── FRONTEND PWA MANIFEST ─────────────────────────────────────────────────────

cat > frontend/public/manifest.json << 'EOF'
{
  "name": "AttendTrack",
  "short_name": "AttendTrack",
  "description": "Attendance management for your team",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4f8ef7",
  "icons": []
}
EOF

# ── FRONTEND .ENV ─────────────────────────────────────────────────────────────

if [ ! -f frontend/.env ]; then
cat > frontend/.env << 'EOF'
# During development against mock server:
VITE_API_URL=http://localhost:8001

# Switch to real backend when ready:
# VITE_API_URL=http://localhost:8000

# Production: set VITE_API_URL to your Railway URL in Vercel dashboard

VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=attendtrack_selfies
EOF
    echo "  ✓ frontend/.env created — fill in Supabase and Cloudinary values"
else
    echo "  ✓ frontend/.env already exists, skipping"
fi

# ── MOCK SERVER ───────────────────────────────────────────────────────────────
# Full mock server code is in CORE.md — paste it here after running this script

cat > mock_api/mock_server.py << 'EOF'
# AttendTrack Mock Server
# Full implementation is in CORE.md under "Mock Server"
# Paste the complete mock_server.py code from CORE.md here.
#
# Run with:
#   cd mock_api && pip install fastapi uvicorn
#   uvicorn mock_server:app --reload --port 8001
#
# frontend/.env must have: VITE_API_URL=http://localhost:8001

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health():
    return {"status": "ok — paste full mock server from CORE.md"}
EOF

# ── .GITIGNORE ────────────────────────────────────────────────────────────────

cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*.pyo
venv/
.venv/
*.egg-info/
dist/
build/

# Env files — NEVER commit these
backend/.env
frontend/.env

# Node
node_modules/
frontend/dist/
frontend/.cache/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Logs
*.log
logs/*.local.md
EOF

# ── README ────────────────────────────────────────────────────────────────────

cat > README.md << 'EOF'
# AttendTrack Pro

Attendance management web app for employees and admins.
Geofence + selfie check-in. Leave management. CSV reports.

## Start Here

1. Read `docs/PROJECT_CONTEXT.md` first
2. Follow `docs/BUILD_WORKFLOW.md` step by step
3. Reference `docs/CORE.md` for all implementation specs
4. Reference `docs/API_CONTRACT.md` for all endpoint shapes

## Quick Start

```bash
# 1. Run the scaffold (already done if you're reading this)
bash setup_structure.sh

# 2. Set up backend
cd backend
pyenv local 3.11.9
python -m venv venv
source venv/bin/activate          # Mac/Linux
# venv\Scripts\activate           # Windows
pip install -r requirements.txt
# Fill in backend/.env (copy from .env.example)

# 3. Set up frontend
cd frontend
npm install
# Fill in frontend/.env

# 4. Start mock server (Terminal 1)
cd mock_api && uvicorn mock_server:app --reload --port 8001

# 5. Start frontend (Terminal 2)
cd frontend && npm run dev
```

## Docs

All documentation is in the `docs/` folder.
EOF

# ── COPY DOCS ─────────────────────────────────────────────────────────────────

echo ""
echo "  ── Reminder: copy your .md files into the docs/ folder ──"
echo "     docs/PROJECT_CONTEXT.md"
echo "     docs/CORE.md"
echo "     docs/API_CONTRACT.md"
echo "     docs/SCHEMA.sql"
echo "     docs/BUILD_WORKFLOW.md"
echo "     docs/SOLO_WORKFLOW.md"
echo "     docs/EXTRAS.md"

# ── DONE ─────────────────────────────────────────────────────────────────────

echo ""
echo "✓ AttendTrack Pro structure created."
echo ""
echo "Next steps:"
echo ""
echo "  1. Copy all .md and .sql files into docs/"
echo "  2. Fill in backend/.env (Supabase, Cloudinary, Resend keys)"
echo "  3. Fill in frontend/.env (Supabase anon key, Cloudinary preset)"
echo "  4. Paste full mock server code from CORE.md into mock_api/mock_server.py"
echo "  5. Run Supabase setup: paste SCHEMA.sql into Supabase SQL Editor"
echo "  6. cd backend && python -m venv venv && source venv/bin/activate"
echo "     Mac/Linux: source venv/bin/activate"
echo "     Windows:   venv\Scripts\activate"
echo "  7. pip install -r requirements.txt"
echo "  8. cd frontend && npm install"
echo "  9. Start building — follow BUILD_WORKFLOW.md step by step"
echo ""
echo "Python version: 3.11.9"
echo "Use pyenv: pyenv install 3.11.9 && cd backend && pyenv local 3.11.9"
echo ""
