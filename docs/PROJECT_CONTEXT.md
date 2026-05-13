# AttendTrack Pro — Project Context
### Read this first. Read it every time you sit down to build something new.

---

## What You Are Building

A **three-sided attendance management web app** for employees, admins, and a super admin.

**The problem:** Organisations lose hours and money to inaccurate attendance, manual sign-in sheets, and proxy attendance.

**Your solution:**
- Employees check in and out using **selfie + geofence** on their personal phones — you cannot fake your location or get someone else to check in for you.
- Admins see **real-time dashboards**, approve/reject leave, manage holidays, and download reports.

---

## Core Features

| # | Feature | What it means |
|---|---|---|
| 1 | **Geofence check-in** | Employee must be within a defined radius of the office to check in. Location verified server-side using Haversine formula. |
| 2 | **Selfie verification** | A photo is captured at check-in, compressed to ~80KB on device, uploaded to Cloudinary. Admins can audit it. No proxy attendance. |
| 3 | **Full leave lifecycle** | Employee applies → Admin approves/rejects → Employee notified by email → Leave reflected in calendar and reports. |

---

## Three User Roles

| Role | `role` value | What they can do |
|---|---|---|
| **Employee** | `employee` | Check in/out with selfie + geofence, apply for leave, view own attendance history and leave balance, view holiday calendar |
| **Basic Admin** | `admin` | Approve/reject leaves, view all attendance dashboards, view employee profiles + AI insights, manage employees (edit profiles, set shifts, deactivate), download reports |
| **Super Admin** | `super_admin` | Everything Basic Admin can do, plus: promote/demote admins, configure geofence zones, manage holiday calendar, configure leave types |

### Registration Flow (Important)
- Anyone can register via the app
- New accounts are set to `is_verified: false` and **cannot log in** until verified
- Basic Admin or Super Admin sees pending accounts in the admin panel and verifies them
- Super Admin is the only one who can grant `admin` or `super_admin` role to a verified account
- This prevents random outsiders from accessing company data

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + Vite | Fast builds, great ecosystem, deploys in seconds |
| Styling | Tailwind CSS | No custom CSS sprawl. Every component stays maintainable. |
| Frontend Deploy | Vercel | Free tier, instant deploys from `git push` |
| Backend | FastAPI (Python 3.11.9) | Async, fast, Pydantic validation, great for scheduled jobs |
| Backend Deploy | Railway | Free tier, persistent process (APScheduler stays alive) |
| Database + Auth | Supabase (Postgres) | Free tier, Auth built in, Row Level Security |
| Selfie Storage | Cloudinary | 25GB free, auto-expiry tags for 30-day retention, direct upload from frontend |
| Scheduler | APScheduler (inside FastAPI) | For daily attendance summary emails |
| Email | Resend API | Transactional emails: leave notifications. Free tier = 3000/month. |
| Geofence | Browser Geolocation API + Haversine formula | No Google Maps billing. Distance check done server-side in Python. |

### Why Cloudinary over Supabase Storage
200 employees × 26 working days × 12 months = ~62,400 check-ins/year.
At 80KB/selfie = ~5GB/year. Supabase Storage free tier is 1GB — it would overflow.
Cloudinary free tier is 25GB. You also get auto-delete via expiry tags, so you only keep the last 30 days of selfies (~4,000 images = ~320MB at any time).

---

## Multiple Office Support

Each physical office location is a **geofence zone**. Super Admin creates and manages zones.
An employee checking in is validated against **all active zones** — they just need to be inside any one of them.
The matching zone name is stored with the attendance record so reports show which office they checked in from.

---

## Shift Timings

Shift timings (`shift_start`, `shift_end`) are stored per employee in the `profiles` table.
Both Basic Admin and Super Admin can edit any employee's shift via the employee management panel.
Late status is calculated at check-in: if `checkin_time > shift_start + 15 minutes`, status = `late`.

---

## Repository Structure

```
attendtrack/
│
├── backend/
│   ├── main.py                     # FastAPI app entry point, mounts all routers
│   ├── config.py                   # Reads .env, exposes a single `settings` object
│   ├── scheduler.py                # APScheduler setup — daily summary job
│   ├── requirements.txt            # Pinned. Use these exact versions.
│   ├── .env                        # NEVER commit. Copy from .env.example
│   ├── .env.example                # Commit this. No real keys.
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py                 # POST /api/auth/register, /api/auth/login
│   │   ├── attendance.py           # Check-in, check-out, get logs
│   │   ├── leave.py                # Apply, approve, reject, list leaves
│   │   ├── employees.py            # Admin CRUD for employee records + verification
│   │   ├── geofence.py             # CRUD for geofence zones (super admin only)
│   │   ├── holidays.py             # CRUD for company holiday calendar (super admin only)
│   │   ├── reports.py              # CSV and summary endpoints
│   │   └── dashboard.py            # Aggregated data + AI insight endpoints
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── email_service.py        # All Resend calls live here
│   │   ├── gemini_service.py       # All Gemini calls live here
│   │   ├── geofence_service.py     # Haversine distance check
│   │   ├── cloudinary_service.py   # Cloudinary upload + signed URL + delete
│   │   └── insight_service.py      # Builds the prompt for Gemini from DB data
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py              # All Pydantic request/response models
│   │
│   └── utils/
│       ├── __init__.py
│       ├── auth_utils.py           # JWT decode, get_current_user, require_admin, require_super_admin
│       └── supabase_client.py      # Supabase client singleton
│
├── frontend/
│   ├── public/
│   │   └── manifest.json           # PWA manifest (makes it installable on phone)
│   ├── src/
│   │   ├── App.jsx                 # Router, auth guard
│   │   ├── main.jsx
│   │   ├── index.css               # Tailwind directives only
│   │   │
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── PendingVerification.jsx    # "Your account is pending approval" screen
│   │   │   ├── EmployeeDashboard.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── CheckIn.jsx                # Selfie + geofence check-in flow
│   │   │   ├── ApplyLeave.jsx             # Leave application form
│   │   │   ├── LeaveManagement.jsx        # Admin: approve/reject leave list
│   │   │   ├── Holidays.jsx               # Super admin: holiday calendar management
│   │   │   ├── EmployeeProfile.jsx        # Admin: per-employee profile + history
│   │   │   ├── EmployeeManagement.jsx     # Admin: list + verify + edit employees
│   │   │   ├── GeofenceManagement.jsx     # Super admin: zone CRUD
│   │   │   └── Reports.jsx                # Admin: download reports
│   │   │
│   │   ├── components/
│   │   │   ├── AttendanceCalendar.jsx     # 30-day grid: green/amber/red/blue/grey
│   │   │   ├── SelfieCapture.jsx          # Camera component for check-in
│   │   │   ├── GeofenceMap.jsx            # SVG geofence ring (no Google Maps)
│   │   │   ├── LeaveCard.jsx              # Single leave application row
│   │   │   ├── HolidayBadge.jsx           # Coloured holiday type chip
│   │   │   ├── EmployeeCard.jsx           # One employee row in admin table
│   │   │   └── StatCard.jsx               # Reusable KPI stat card
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.js                 # Supabase session, role, logout
│   │   │   ├── useGeolocation.js          # getCurrentPosition wrapper
│   │   │   └── useCamera.js               # getUserMedia wrapper, capture + compress to base64
│   │   │
│   │   └── services/
│   │       ├── api.js                     # All fetch calls, attaches Bearer token automatically
│   │       └── supabaseClient.js          # Supabase JS client singleton
│   │
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── mock_api/
│   └── mock_server.py               # Run locally when building frontend. No real backend needed.
│
└── README.md
```

---

## Environment Variables

### Backend `backend/.env` (never commit)
```
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_KEY=eyJ...           # service_role key — NOT anon key
RESEND_API_KEY=re_...
FROM_EMAIL=noready@yourdomain.com
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=https://attendtrack.vercel.app
BACKEND_URL=https://attendtrack.railway.app
SCHEDULER_TIMEZONE=Asia/Kolkata
```

### Frontend `frontend/.env`
```
VITE_API_URL=http://localhost:8001          # mock server during dev
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...              # anon key — NOT service key
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=attendtrack_selfies   # unsigned upload preset
```

On Vercel, set `VITE_API_URL` to your Railway backend URL.

---

## Known Risks

| Risk | Mitigation |
|---|---|
| Camera permission denied on phone | Catch `getUserMedia` errors, show clear browser settings instructions |
| Geolocation denied or inaccurate | Show "Location unavailable" with instructions. Never silently fail. |
| Selfie upload to Cloudinary fails | Show error state. Do not save attendance record without a selfie. |
| Railway restarts lose APScheduler jobs | Re-schedule all jobs on `startup` event in `main.py` |
| 200 employees registering → messy data | Admin verification step before account is active prevents junk accounts |
| Multiple offices: employee at wrong office | Geofence check returns which zone matched, stored in attendance record |
| CORS errors in development | `allow_origins=["*"]` during dev. Lock to specific URLs before production. |
