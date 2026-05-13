# AttendTrack Pro — Build Workflow
### Your step-by-step git workflow. Each step = one commit. Test before you commit. Never skip ahead.

---

## Ground Rules

- **One step at a time.** Do not start Step N+1 until Step N is verified working.
- **Commit at every step.** The commit message is listed with each step.
- **Test on mobile early.** By Step 4, open the app on your actual phone. Do not wait for the end.
- **When blocked:** Read the error carefully → check relevant .md file → ask Claude Code with the exact error message pasted in.
- **Mock first, real later.** Steps 1-3 use the mock server. You swap to the real backend at Step 8.

---

## Before You Start — One-Time Setup

```bash
# 1. Create GitHub repo (do this on github.com first)
git clone https://github.com/yourusername/attendtrack.git
cd attendtrack

# 2. Create folder structure
mkdir -p backend/api backend/services backend/models backend/utils
mkdir -p frontend/src/pages frontend/src/components frontend/src/hooks frontend/src/services
mkdir -p frontend/public mock_api

# 3. Initial commit
git add .
git commit -m "chore: initial repo structure"
git push origin main

# 4. Create a dev branch (work here, merge to main at deployment)
git checkout -b dev
```

---

## Phase 1 — Foundation (Steps 1–3)
### Goal: Mock server running, React app loads, can navigate between pages.

---

### Step 1 — Supabase + Mock Server

**What you're doing:** Set up the database and get the mock server running so the frontend has something to talk to.

**Supabase setup:**
1. Create project at supabase.com (free tier)
2. Go to SQL Editor → paste and run the entire `SCHEMA.sql` file
3. Run verification queries at the bottom of SCHEMA.sql — confirm 5 leave types exist
4. Go to Project Settings → API → copy:
   - Project URL → `SUPABASE_URL`
   - `anon` key → `VITE_SUPABASE_ANON_KEY` (frontend)
   - `service_role` key → `SUPABASE_SERVICE_KEY` (backend only, never frontend)
5. **Disable RLS for now** — run the disable block commented out in SCHEMA.sql

**Mock server:**
```bash
cd mock_api
pip install fastapi uvicorn
# Paste mock_server.py content from CORE.md
uvicorn mock_server:app --reload --port 8001
# Visit http://localhost:8001/health → should return {"status": "ok"} ... wait, add this route
# Actually test: http://localhost:8001/api/auth/login (POST via curl or Postman)
```

**Verify:**
- [ ] Mock server runs at :8001 without errors
- [ ] POST to `/api/auth/login` with `{"email":"emp@test.com","password":"x"}` returns a mock token
- [ ] Supabase SQL Editor shows 5 rows in `leave_types`
- [ ] Supabase trigger `on_auth_user_created` exists

```bash
git add .
git commit -m "chore: supabase schema + mock server"
```

---

### Step 2 — React App Scaffold

**What you're doing:** Get the React app running with routing, auth guard, and all page files created (even if they're just empty shells).

```bash
cd ..
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install react-router-dom @supabase/supabase-js date-fns
```

**Configure Tailwind** — in `tailwind.config.js`:
```js
content: ["./index.html", "./src/**/*.{js,jsx}"]
```

**Add to `src/index.css`:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Create `.env` file in frontend/:**
```
VITE_API_URL=http://localhost:8001
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=attendtrack_selfies
```

**Create all page files as stubs** — each file just returns a `<div>PageName</div>` for now:
- `src/pages/Login.jsx`
- `src/pages/Register.jsx`
- `src/pages/PendingVerification.jsx`
- `src/pages/EmployeeDashboard.jsx`
- `src/pages/AdminDashboard.jsx`
- `src/pages/CheckIn.jsx`
- `src/pages/ApplyLeave.jsx`
- `src/pages/LeaveManagement.jsx`
- `src/pages/EmployeeManagement.jsx`
- `src/pages/EmployeeProfile.jsx`
- `src/pages/GeofenceManagement.jsx`
- `src/pages/Holidays.jsx`
- `src/pages/Reports.jsx`

**Build `src/services/api.js`** — copy the spec from CORE.md. This is critical infrastructure.

**Build `src/hooks/useAuth.js`** — reads localStorage, exposes `user`, `role`, `isAdmin`, `isSuperAdmin`, `logout`.

**Build `src/App.jsx`** with react-router-dom routes and a simple auth guard:
- `/` → redirect to `/dashboard` or `/admin` based on role
- `/login` → Login.jsx (public)
- `/register` → Register.jsx (public)
- `/pending` → PendingVerification.jsx (public)
- `/dashboard` → EmployeeDashboard.jsx (requires auth, role=employee)
- `/checkin` → CheckIn.jsx (requires auth)
- `/apply-leave` → ApplyLeave.jsx (requires auth, role=employee)
- `/admin` → AdminDashboard.jsx (requires auth, isAdmin)
- `/admin/employees` → EmployeeManagement.jsx (requires auth, isAdmin)
- `/admin/employees/:id` → EmployeeProfile.jsx (requires auth, isAdmin)
- `/admin/leaves` → LeaveManagement.jsx (requires auth, isAdmin)
- `/admin/geofence` → GeofenceManagement.jsx (requires auth, isSuperAdmin)
- `/admin/holidays` → Holidays.jsx (requires auth, isSuperAdmin)
- `/admin/reports` → Reports.jsx (requires auth, isAdmin)

**Verify:**
- [ ] `npm run dev` starts at :5173 with no errors
- [ ] `/login` loads without crashing
- [ ] Navigating to `/dashboard` without a token redirects to `/login`
- [ ] No TypeErrors in console

```bash
git add .
git commit -m "feat: react scaffold, routing, auth guard, page stubs"
```

---

### Step 3 — Login + Register Pages

**What you're doing:** Build real Login and Register pages that talk to the mock server.

**Login.jsx:**
- Form: email + password
- On submit: `api.post('/auth/login', { email, password })`
- On success: save `access_token`, `role`, `id` to localStorage → redirect based on role
- On 403 "pending": navigate to `/pending`
- Show loading state on button while request is in flight

**Register.jsx:**
- Form: full name, email, password
- On submit: `api.post('/auth/register', { full_name, email, password })`
- On success: show success message (not auto-login)

**PendingVerification.jsx:**
- Static screen: "Your account is pending admin verification. You will receive an email once activated."

**Verify:**
- [ ] Login with `emp@test.com` → lands on EmployeeDashboard stub
- [ ] Login with `admin@test.com` → lands on AdminDashboard stub
- [ ] Login with `super@test.com` → lands on AdminDashboard stub (super admin goes to same dashboard)
- [ ] Register form submits → shows success message
- [ ] Refreshing page while logged in → stays logged in (token in localStorage)
- [ ] Deleting `auth_token` from localStorage → redirected to `/login`

```bash
git add .
git commit -m "feat: login and register pages, auth flow"
```

---

## Phase 2 — Employee Flow (Steps 4–6)
### Goal: An employee can check in, check out, and see their dashboard.

---

### Step 4 — Check-In Flow

**What you're doing:** Build the most important feature. Get selfie + geolocation working.

**Build `hooks/useCamera.js`** — see spec in CORE.md. Key details:
- `facingMode: 'user'` (front camera)
- Compress to `quality: 0.6` in `toDataURL`
- Always stop tracks on unmount

**Build `hooks/useGeolocation.js`** — see spec in CORE.md. Return specific error messages for each failure case.

**Build `components/SelfieCapture.jsx`** — camera preview → capture → preview → "Use this" / "Retake"

**Build `components/GeofenceMap.jsx`** — pure SVG, shows user position vs zone. Green if inside, red if outside. Show distance in metres.

**Build `pages/CheckIn.jsx`:**
1. If already checked in → show today's status + Check Out button
2. If not → Step 1: open SelfieCapture → Step 2: auto-request geolocation → Step 3: POST to `/api/attendance/checkin`
3. On success → green card with time and office name
4. On geofence error → show GeofenceMap with distance

**Test on real phone:**
Open `http://your-laptop-ip:5173/checkin` on your phone (must be same WiFi).
Camera and GPS only work properly on a real device.

**Verify:**
- [ ] Camera opens on phone
- [ ] Selfie captures and shows preview
- [ ] "Use this" triggers location request
- [ ] Successful check-in shows confirmation (mock always returns success)
- [ ] Mock geofence error response shows the SVG map
- [ ] Camera tracks are stopped when leaving the page (check browser console)

```bash
git add .
git commit -m "feat: check-in flow, selfie capture, geofence map"
```

---

### Step 5 — Employee Dashboard

**What you're doing:** Build the main screen an employee sees every day.

**Build `components/StatCard.jsx`** — reusable KPI card
**Build `components/AttendanceCalendar.jsx`** — 30-day grid, colour-coded by status
**Build `components/LeaveCard.jsx`** — single leave row with status badge

**Build `pages/EmployeeDashboard.jsx`:**
- Loads `GET /api/dashboard/employee/{user_id}`
- Shows today's status card with check-in/out button
- This month stats (4 StatCards)
- 30-day AttendanceCalendar
- Leave balance progress bars per type
- Last 3 leave applications

**Verify:**
- [ ] Dashboard loads mock data without errors
- [ ] AttendanceCalendar renders 30 squares
- [ ] Today's status card shows correct mock status
- [ ] Check In button navigates to /checkin
- [ ] Leave balance bars show correct proportions
- [ ] Page is usable on a phone screen (no horizontal scroll)

```bash
git add .
git commit -m "feat: employee dashboard, attendance calendar, stat cards"
```

---

### Step 6 — Apply Leave

**What you're doing:** Employee leave application form.

**Build `pages/ApplyLeave.jsx`:**
- Loads leave balance from `GET /api/leave/balance/{user_id}` for dropdown + balance preview
- Form: leave type, from/to date, mode, reason, contact
- Live days calculation (client-side, exclude weekends)
- Balance warning if insufficient
- On submit: `POST /api/leave/apply`
- Success → navigate back to dashboard

**Verify:**
- [ ] Leave type dropdown populates from balance endpoint
- [ ] Selecting dates shows correct days_requested count
- [ ] Selecting more days than balance shows warning in red
- [ ] Submitting shows success message
- [ ] After success, navigates back to dashboard

```bash
git add .
git commit -m "feat: apply leave form with balance validation"
```

---

## Phase 3 — Admin Flow (Steps 7–9)
### Goal: Admin can manage employees, approve leaves, and see the dashboard.

---

### Step 7 — Admin Dashboard

**What you're doing:** The main screen admins see.

**Build `pages/AdminDashboard.jsx`:**
- Loads `GET /api/dashboard/admin`
- Today's summary (5 StatCards: present, absent, late, on_leave, not_checked_in)
- Office breakdown table (which office has how many people)
- Department breakdown table
- Recent activity feed (last 10 check-ins)
- Pending verifications badge → links to /admin/employees?tab=pending
- Pending leaves badge → links to /admin/leaves

**Verify:**
- [ ] Dashboard loads mock data without errors
- [ ] Office breakdown shows multiple offices
- [ ] All 5 summary KPI cards render
- [ ] Recent activity feed shows employee names + office
- [ ] Pending leave badge shows count
- [ ] All links navigate correctly

```bash
git add .
git commit -m "feat: admin dashboard with office breakdown and activity feed"
```

---

### Step 8 — Employee Management + Verification

**What you're doing:** The admin's tool for managing the 200 employees.

**Build `pages/EmployeeManagement.jsx`:**

Tab 1 — All Employees:
- Paginated table (50 per page)
- Search by name or employee ID
- Filter by department
- Columns: name, employee ID, department, designation, shift, status
- Click row → navigate to EmployeeProfile

Tab 2 — Pending Verification:
- Cards for each unverified account
- "Verify & Activate" button → `POST /api/employees/{id}/verify`
- On success: remove card from list + show success toast

**Build `components/EmployeeCard.jsx`** — one row in the employees table

**Verify:**
- [ ] Table renders 2 mock employees
- [ ] Pending tab shows 1 mock pending account
- [ ] "Verify & Activate" button fires the API call and removes the card
- [ ] Search input filters the visible list client-side
- [ ] Clicking a row navigates to the profile page

```bash
git add .
git commit -m "feat: employee management, pending verification flow"
```

---

### Step 9 — Leave Management

**What you're doing:** Admin approve/reject leave flow.

**Build `pages/LeaveManagement.jsx`:**
- Filter tabs: Pending | Approved | Rejected | All
- Loads `GET /api/leave/all?status={tab}`
- For each leave: employee name, type, dates, days, reason, status badge
- Approve button → `PUT /api/leave/{id}/approve` → optimistic UI (update card immediately)
- Reject button → modal to type rejection note → `PUT /api/leave/{id}/reject`
- 20 per page with load more

**Verify:**
- [ ] Pending tab shows 1 mock pending leave
- [ ] Approved tab shows 1 mock approved leave
- [ ] Approve button updates the card status immediately (optimistic)
- [ ] Reject modal accepts a note and submits
- [ ] After approve/reject, tab badge counts update

```bash
git add .
git commit -m "feat: leave management, approve/reject flow"
```

---

## Phase 4 — Profile + AI + Super Admin (Steps 10–12)

---

### Step 10 — Employee Profile + AI Insight

**What you're doing:** The deep-dive view admins use per employee.

**Build `components/InsightCard.jsx`:**
- On mount: `GET /api/dashboard/insight/{employeeId}`
- Loading state: spinner + "Analysing attendance patterns..."
- Loaded: insight text + generated time + small "AI" badge
- Error: "Could not generate insight."
- Refresh button to regenerate

**Build `pages/EmployeeProfile.jsx`:**
- Profile header with all employee details
- Edit button → inline form for shift times, department, designation
- InsightCard component
- AttendanceCalendar (30-day)
- This month stats
- Leave history
- Last 5 selfies (show as small thumbnails if selfie_url is set)

**Verify:**
- [ ] Profile page loads with mock data
- [ ] InsightCard shows spinner for 2 seconds (mock has asyncio.sleep), then text
- [ ] Edit form updates values
- [ ] Attendance calendar renders correctly
- [ ] Selfie thumbnails section shows "No selfies yet" placeholder (mock data has no selfie_url)

```bash
git add .
git commit -m "feat: employee profile page, AI insight card"
```

---

### Step 11 — Super Admin Pages

**What you're doing:** Geofence management, holidays, role promotion.

**Build `pages/GeofenceManagement.jsx`:**
- List all zones
- Add zone: form with name, latitude, longitude (text inputs), radius slider
- Edit zone: same fields + active/inactive toggle
- Delete = soft delete (set inactive)

**Build `pages/Holidays.jsx`:**
- Monthly grid view with highlighted holidays
- List below with type badges
- Add/remove controls (Super Admin only)

**Add role promotion to EmployeeProfile:**
- "Change Role" button (only visible to super admin)
- Dropdown: employee / admin / super_admin
- `POST /api/employees/{id}/promote`

**Build `pages/Reports.jsx`:**
- Attendance CSV download section
- Leave CSV download section
- Monthly summary section

**Verify:**
- [ ] Geofence page lists 2 mock zones
- [ ] Add zone form posts to mock endpoint
- [ ] Holidays calendar highlights mock dates
- [ ] Reports download buttons trigger CSV download (mock returns CSV)
- [ ] Role promotion button is hidden when logged in as `admin` (not super_admin)
- [ ] Role promotion button is visible when logged in as `super_admin`

```bash
git add .
git commit -m "feat: geofence management, holidays, reports, role promotion"
```

---

### Step 12 — UI Polish

**What you're doing:** Make it look and feel production-ready on a phone.

Checklist:
- [ ] Every page has a loading skeleton or spinner while data loads
- [ ] Every error state has a visible message (no blank pages)
- [ ] Mobile navigation works (hamburger menu or bottom nav)
- [ ] No horizontal scroll on any page at 375px width
- [ ] Tap targets are large enough on phone (minimum 44px height)
- [ ] All forms show validation errors inline
- [ ] Success toasts disappear after 3 seconds
- [ ] Back navigation works everywhere
- [ ] All empty states have helpful messages ("No leaves applied yet" etc.)

```bash
git add .
git commit -m "style: mobile UI polish, loading states, empty states"
```

---

## Phase 5 — Real Backend (Steps 13–17)
### Goal: Replace mock server with real FastAPI backend.

---

### Step 13 — Backend Scaffold + Auth

```bash
cd backend
pyenv local 3.11.9
python -m venv venv
source venv/bin/activate   # Mac
# venv\Scripts\activate    # Windows
pip install -r requirements.txt
cp .env.example .env
# Fill in all values in .env
```

**Build in this order:**
1. `utils/supabase_client.py`
2. `utils/auth_utils.py`
3. `config.py`
4. `models/schemas.py` (all Pydantic models)
5. `main.py`
6. `api/auth.py` — register + login endpoints

**Test auth with real Supabase:**
```bash
uvicorn main:app --reload --port 8000
# POST http://localhost:8000/api/auth/register
# POST http://localhost:8000/api/auth/login
```

**Create first super admin account:**
```bash
# Register via API, then manually set role in Supabase SQL Editor:
UPDATE profiles SET role = 'super_admin', is_verified = true WHERE id = 'your-uuid-here';
```

**Switch frontend to real backend:**
```
# In frontend/.env:
VITE_API_URL=http://localhost:8000
```

**Verify:**
- [ ] Register creates a row in Supabase `profiles` table with `is_verified=false`
- [ ] Login as unverified account → 403 "pending verification" → frontend goes to /pending
- [ ] Login as verified super admin → gets token, lands on admin dashboard
- [ ] Supabase dashboard shows the profile row

```bash
git add .
git commit -m "feat: backend scaffold, auth endpoints, real Supabase auth"
```

---

### Step 14 — Geofence + Attendance Backend

**Build in this order:**
1. `services/geofence_service.py`
2. `services/cloudinary_service.py`
3. `api/geofence.py`
4. `api/attendance.py` (checkin + checkout + logs)

**Set up Cloudinary:**
1. Create free account at cloudinary.com
2. Create an upload preset named `attendtrack_selfies` (Settings → Upload → Add preset → set to unsigned)
3. Add Cloudinary credentials to `backend/.env`
4. Add `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` to `frontend/.env`

**Create at least one geofence zone** via Supabase SQL Editor or your frontend (once that's wired up):
```sql
INSERT INTO geofence_zones (name, latitude, longitude, radius_meters, is_active)
VALUES ('Head Office', 22.7196, 75.8577, 200, true);
```
Use your actual office coordinates.

**Test check-in on real phone** (laptop + phone on same WiFi, or use ngrok):
```bash
# ngrok for testing on phone over internet:
ngrok http 8000
# Set VITE_API_URL=https://your-ngrok-url in frontend/.env
```

**Verify:**
- [ ] Check-in with coordinates inside zone → attendance_logs row created in Supabase
- [ ] Check-in outside zone → 400 error with distance
- [ ] Selfie appears in Cloudinary dashboard under `attendtrack/selfies/`
- [ ] `selfie_url` is stored in the attendance_logs row
- [ ] Check-out updates the row with `checkout_time` and `hours_worked`
- [ ] Trying to check in twice → 400 "Already checked in today"

```bash
git add .
git commit -m "feat: real geofence + attendance endpoints, Cloudinary selfie upload"
```

---

### Step 15 — Leave + Employee Backend

**Build in this order:**
1. `api/leave.py`
2. `api/employees.py`
3. `services/email_service.py`
4. Wire email calls into leave approve/reject endpoints

**Test employee verification flow:**
1. Register a new account via frontend
2. Go to admin panel → Pending Verification tab
3. Click "Verify & Activate"
4. Try logging in as that account → should now work
5. Verify the account gets a verification email

**Verify:**
- [ ] Apply for leave creates a row in `leaves` table with status='pending'
- [ ] Admin approves → status changes to 'approved', `leave_balances.used_days` incremented
- [ ] Employee receives approval email (check spam)
- [ ] Rejection sends email with rejection note
- [ ] Verifying a new employee sends activation email
- [ ] `seed_leave_balances` is called when verifying → leave balance rows created

```bash
git add .
git commit -m "feat: leave endpoints, employee management, email notifications"
```

---

### Step 16 — Dashboard + AI Insight Backend

**Build in this order:**
1. `api/dashboard.py` — employee + admin endpoints
2. `services/gemini_service.py`
3. `services/insight_service.py`
4. Add `/api/dashboard/insight/{employee_id}` to dashboard.py
5. `api/reports.py` — CSV downloads

**Test AI insight:**
- Employee needs at least a few days of attendance data in DB for insight to be meaningful
- Admin opens employee profile → InsightCard should load (2-4 seconds) with real data
- Check `insights_cache` table in Supabase — should have a row after first load

**Verify:**
- [ ] Admin dashboard shows real counts from DB
- [ ] AI insight generates and caches correctly
- [ ] Second visit to insight loads instantly (from cache)
- [ ] Attendance CSV downloads and opens correctly in Excel
- [ ] Leave CSV downloads correctly
- [ ] Monthly summary endpoint returns real aggregated data

```bash
git add .
git commit -m "feat: dashboard aggregations, AI insight, CSV reports"
```

---

### Step 17 — APScheduler

**Build `scheduler.py`:**

Job 1 — Daily absent marking (runs at 18:30 IST):
- For every active, verified employee with no attendance_logs row for today and no approved leave covering today → insert a row with status='absent'

Job 2 — Monthly selfie cleanup (runs on 1st of each month at 02:00 IST):
- Find all attendance_logs rows older than 30 days where selfie_public_id is not null
- Call `cloudinary_service.delete_selfie(public_id)` for each
- Set `selfie_url=null` and `selfie_public_id=null` on those rows

**Wire into main.py startup:**
```python
@app.on_event("startup")
async def on_startup():
    start_scheduler()
```

**Verify:**
- [ ] Scheduler starts without error on app boot (check logs)
- [ ] Manually trigger the absent-marking job and check DB for absent rows
- [ ] Cloudinary cleanup runs without errors (check logs)

```bash
git add .
git commit -m "feat: APScheduler, daily absent marking, monthly selfie cleanup"
```

---

## Phase 6 — Deploy (Step 18)

### Step 18 — Production Deploy

**Railway (Backend):**
1. Push backend folder to GitHub
2. railway.app → New Project → Deploy from GitHub
3. Root directory: `backend/`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add ALL environment variables from `.env` in Railway dashboard
6. Wait for deploy → test `https://your-app.railway.app/health` → `{"status":"ok"}`

**Vercel (Frontend):**
1. vercel.com → Import from GitHub
2. Root directory: `frontend/`
3. Add environment variables:
   - `VITE_API_URL` = your Railway URL
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`
4. Deploy → copy your Vercel URL

**Post-deploy checklist:**
```
[ ] Update backend .env: FRONTEND_URL = your Vercel URL → redeploy Railway
[ ] In Supabase: Auth → URL Configuration → add Vercel URL to allowed redirect URLs
[ ] Enable RLS: run the ENABLE RLS block from SCHEMA.sql
[ ] Full end-to-end test on deployed URLs (not localhost)
[ ] Test check-in on a real phone on real cellular data (not WiFi)
[ ] Test admin verification flow end-to-end
[ ] Test leave application + approval + email flow end-to-end
[ ] Confirm selfies appear in Cloudinary dashboard
[ ] Confirm AI insight generates on employee profile
```

**Create your super admin account on production:**
```sql
-- After registering on production site, run in Supabase SQL Editor:
UPDATE profiles SET role = 'super_admin', is_verified = true WHERE id = 'your-uuid';
```

**Tag the release:**
```bash
git tag -a v1.0 -m "AttendTrack Pro v1.0 - Production deploy"
git push origin v1.0
```

```bash
git add .
git commit -m "chore: production deployment config"
git checkout main
git merge dev
git push origin main
```

---

## Stable Checkpoints to Tag

```bash
git tag -a v0.1 -m "Phase 1 done: mock server + React scaffold + auth"
git tag -a v0.2 -m "Phase 2 done: full employee flow on mock"
git tag -a v0.3 -m "Phase 3 done: full admin flow on mock"
git tag -a v0.4 -m "Phase 4 done: AI insight + super admin + UI polish"
git tag -a v0.5 -m "Phase 5 done: real backend, all endpoints live"
git tag -a v1.0 -m "Production deployed"
```

---

## Commit Message Conventions

```
feat:   — new feature (new page, new endpoint, new component)
fix:    — bug fix
chore:  — config, deps, env setup, scaffolding
style:  — UI/CSS changes only, no logic
refactor: — restructuring code without changing behaviour
test:   — adding/running tests
```

Examples:
- `feat: check-in flow with selfie capture`
- `fix: geofence distance calculation off by factor of 1000`
- `chore: add Cloudinary credentials to .env.example`
- `style: mobile nav, responsive dashboard grid`

---

## If You Break Something

```bash
# See what changed in last commit
git diff HEAD~1

# Undo last commit (keeps your changes, just un-commits)
git reset HEAD~1

# Nuclear option: go back to last stable tag
git stash
git checkout v0.3
```

---

## Quick Reference — Which File to Edit for What

| What you want to change | File to edit |
|---|---|
| Add a new API endpoint | `backend/api/{relevant_router}.py` + `mock_api/mock_server.py` + `API_CONTRACT.md` |
| Change what dashboard shows | `backend/api/dashboard.py` |
| Change AI prompt | `backend/services/gemini_service.py` |
| Change email template | `backend/services/email_service.py` |
| Change geofence radius logic | `backend/services/geofence_service.py` |
| Change selfie folder structure in Cloudinary | `backend/services/cloudinary_service.py` |
| Add a new page | `frontend/src/pages/NewPage.jsx` + route in `App.jsx` |
| Add a new API call | `frontend/src/services/api.js` (it's just a wrapper, calls are inline in pages) |
| Change who can see a page | `frontend/src/App.jsx` auth guard for that route |
| Change table schema | `SCHEMA.sql` → re-run in Supabase SQL Editor (careful with existing data) |
