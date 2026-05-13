# AttendTrack Pro — CORE BUILD
### Everything here must work before you touch anything else. No shortcuts.

---

## Core Features

- **Geofence check-in:** Employee must be within a defined radius of an office to check in. Location verified server-side.
- **Selfie verification:** Photo taken at check-in, compressed to ~80KB, uploaded to Cloudinary. Admins can audit it.
- **Full leave lifecycle:** Apply → pending → admin approves/rejects → email sent → status updates on both sides → reflected in reports.

> **Rule:** If any of these are broken, fix it before adding anything new.

---

## Admin Role Permissions Reference

| Action | Employee | Basic Admin | Super Admin |
|---|---|---|---|
| Check in/out | ✓ | ✓ | ✓ |
| Apply for leave | ✓ | ✓ | ✓ |
| View own attendance | ✓ | ✓ | ✓ |
| View all attendance | ✗ | ✓ | ✓ |
| Approve/reject leave | ✗ | ✓ | ✓ |
| View employee profiles + attendance history | ✗ | ✓ | ✓ |
| Edit employee profile / set shifts | ✗ | ✓ | ✓ |
| Verify new employee accounts | ✗ | ✓ | ✓ |
| Download reports (CSV) | ✗ | ✓ | ✓ |
| Promote user to admin role | ✗ | ✗ | ✓ |
| Manage geofence zones | ✗ | ✗ | ✓ |
| Manage holiday calendar | ✗ | ✗ | ✓ |
| Configure leave types | ✗ | ✗ | ✓ |

---

## Backend — File by File

### `backend/main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import auth, attendance, leave, employees, geofence, holidays, reports, dashboard
from scheduler import start_scheduler
from config import settings

app = FastAPI(title="AttendTrack API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Lock to specific URLs before production
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
```

### `backend/config.py`
```python
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
```

### `backend/utils/supabase_client.py`
```python
from supabase import create_client, Client
from config import settings

supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)
```
Import this singleton everywhere. Never create a new client.

### `backend/utils/auth_utils.py`
```python
from fastapi import Depends, HTTPException, Header
from utils.supabase_client import supabase

async def get_current_user(authorization: str = Header(...)):
    """
    Verifies the Bearer JWT from Supabase Auth.
    Returns the full profile dict (including role, is_verified).
    Raises 401 if invalid or 403 if account is not verified.
    """
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
```

### `backend/services/geofence_service.py`
```python
import math
from utils.supabase_client import supabase

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Returns distance in metres between two GPS coordinates."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def check_within_any_zone(lat: float, lng: float) -> dict | None:
    """
    Returns the matching zone dict if coordinates are inside any active zone.
    Returns None if outside all zones.
    """
    zones = supabase.table("geofence_zones").select("*").eq("is_active", True).execute().data
    for zone in zones:
        dist = haversine_distance(lat, lng, zone["latitude"], zone["longitude"])
        if dist <= zone["radius_meters"]:
            return zone
    return None
```

### `backend/services/cloudinary_service.py`
```python
import cloudinary
import cloudinary.uploader
import base64
from config import settings
from datetime import datetime, timedelta

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
)

def upload_selfie(image_base64: str, employee_id: str, date_str: str) -> dict:
    """
    Uploads a base64 selfie to Cloudinary.
    Organises as: attendtrack/selfies/{employee_id}/{date_str}
    Sets expiry tag for auto-delete after 30 days.
    Returns: { url, public_id }
    """
    image_data = image_base64.split(",")[-1]  # strip data:image/jpeg;base64, prefix
    public_id = f"attendtrack/selfies/{employee_id}/{date_str}"

    result = cloudinary.uploader.upload(
        f"data:image/jpeg;base64,{image_data}",
        public_id=public_id,
        overwrite=True,
        resource_type="image",
        transformation=[
            {"quality": "auto:low", "fetch_format": "jpg"}  # compress on Cloudinary side
        ],
        tags=[f"employee_{employee_id}", "selfie", "auto_delete_30d"]
    )
    return {
        "url": result["secure_url"],
        "public_id": result["public_id"]
    }

def delete_selfie(public_id: str) -> bool:
    """Deletes a selfie by its Cloudinary public_id. Used by the 30-day cleanup job."""
    try:
        cloudinary.uploader.destroy(public_id)
        return True
    except Exception:
        return False
```

### `backend/services/email_service.py`
```python
import resend
from config import settings

resend.api_key = settings.resend_api_key

def send_leave_status_email(
    to_email: str,
    employee_name: str,
    leave_type: str,
    from_date: str,
    to_date: str,
    status: str,
    rejection_note: str = None
):
    emoji = "✅" if status == "approved" else "❌"
    rejection_block = f'<p style="color:#ef4444;margin-top:12px"><strong>Reason:</strong> {rejection_note}</p>' if rejection_note else ''
    body = f"""
    <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="margin:0 0 16px">{emoji} Leave {status.title()}</h2>
      <p>Dear {employee_name},</p>
      <p>Your <strong>{leave_type}</strong> leave application from
         <strong>{from_date}</strong> to <strong>{to_date}</strong>
         has been <strong>{status}</strong>.</p>
      {rejection_block}
      <p>Log in to AttendTrack to view your updated leave balance.</p>
      <a href="{settings.frontend_url}"
         style="display:inline-block;margin-top:12px;background:#4f8ef7;color:white;
                padding:10px 20px;border-radius:8px;text-decoration:none">
        View Dashboard
      </a>
    </div>
    """
    resend.Emails.send({
        "from": settings.from_email,
        "to": to_email,
        "subject": f"Leave {status.title()} — AttendTrack",
        "html": body
    })

def send_verification_email(to_email: str, employee_name: str):
    """Sent when admin verifies and activates a new account."""
    body = f"""
    <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
      <h2>✅ Account Activated</h2>
      <p>Dear {employee_name},</p>
      <p>Your AttendTrack account has been verified and activated. You can now log in and start using the app.</p>
      <a href="{settings.frontend_url}"
         style="display:inline-block;margin-top:12px;background:#4f8ef7;color:white;
                padding:10px 20px;border-radius:8px;text-decoration:none">
        Log In Now
      </a>
    </div>
    """
    resend.Emails.send({
        "from": settings.from_email,
        "to": to_email,
        "subject": "Your AttendTrack account is ready",
        "html": body
    })
```

---

## Backend — API Endpoints (Implementation Guides)

### `api/auth.py`
```python
# POST /api/auth/register
# Body: { email, password, full_name }
# → calls supabase.auth.sign_up() with metadata { full_name }
# → trigger auto-creates profiles row (role='employee', is_verified=False)
# → returns: { message: "Registration successful. Await admin verification." }
# NOTE: No auto-login. Account must be verified by admin before login works.

# POST /api/auth/login
# Body: { email, password }
# → calls supabase.auth.sign_in_with_password()
# → fetches profile from profiles table
# → if is_verified=False: return 403 { error: "Account pending verification" }
# → if is_active=False: return 403 { error: "Account deactivated" }
# → returns: { access_token, role, id, full_name }
# Frontend stores access_token in localStorage as 'auth_token'
```

### `api/attendance.py`
```python
# POST /api/attendance/checkin
# [Protected — verified employees only]
# Body: { latitude, longitude, selfie_base64 }
# Steps:
#   1. Call check_within_any_zone(lat, lng) → get zone or raise 400 "Outside all geofence zones"
#   2. Check if attendance_logs row exists for today → raise 400 "Already checked in" if so
#   3. Determine status: compare checkin_time vs profile.shift_start + profile.late_threshold_minutes
#      → if late: status = 'late', else status = 'present'
#   4. Upload selfie to Cloudinary → get { url, public_id }
#   5. Insert row into attendance_logs with zone_id, zone_name, selfie_url, selfie_public_id, status
#   6. Return { message, status, checkin_time, zone_name }

# POST /api/attendance/checkout
# [Protected]
# Body: { latitude, longitude }
# Steps:
#   1. Find today's attendance_logs row for this employee
#   2. Raise 400 if no check-in found or already checked out
#   3. Calculate hours_worked = (now - checkin_time).total_seconds() / 3600
#   4. Update row: checkout_time, checkout_lat, checkout_lng, hours_worked
#   5. Return { message, hours_worked, checkout_time }

# GET /api/attendance/{employee_id}?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=30
# [Protected — admin or self only]
# Returns paginated attendance_logs rows in date range, ordered by date DESC

# GET /api/attendance/today/{employee_id}
# [Protected — admin or self]
# Returns the attendance_logs row for today, or null
```

### `api/employees.py`
```python
# GET /api/employees?department=&status=active&page=1&limit=50
# [Protected — admin only]
# Returns paginated employee list. status filter: 'active', 'inactive', 'pending' (unverified)

# GET /api/employees/pending
# [Protected — admin only]
# Returns all profiles where is_verified=False, ordered by created_at DESC
# This is the "awaiting verification" list in admin panel

# POST /api/employees/{employee_id}/verify
# [Protected — admin only]
# Steps:
#   1. Set profiles.is_verified=True, profiles.is_active=True
#   2. Assign employee_id string (e.g. EMP-042) if not already set
#   3. Call seed_leave_balances(employee_id) via supabase.rpc()
#   4. Send verification email via email_service
#   5. Return { message: "Employee verified and activated" }

# PUT /api/employees/{employee_id}
# [Protected — admin only]
# Editable fields: full_name, department, designation, phone,
#                  shift_start, shift_end, late_threshold_minutes, is_active
# Role changes: only super_admin can change role field
# Returns updated profile

# POST /api/employees/{employee_id}/promote
# [Protected — super_admin only]
# Body: { role: "admin" | "super_admin" | "employee" }
# → Updates profiles.role
# → Returns { message }
```

### `api/leave.py`
```python
# POST /api/leave/apply
# [Protected — verified employees only]
# Body: { leave_type_id, from_date, to_date, mode, reason, contact_during }
# Steps:
#   1. Calculate days_requested: count working days in range (exclude weekends + holidays table)
#   2. Check leave_balances — raise 400 if used_days + days_requested > total_days
#   3. Check for date conflicts with existing approved leaves
#   4. Insert into leaves with status='pending'
#   5. Return { message, leave_id, days_requested }

# GET /api/leave/my/{employee_id}
# [Protected — self only]
# Returns all leave rows for this employee, ordered by applied_at DESC

# GET /api/leave/all?status=pending&department=&page=1&limit=50
# [Protected — admin only]
# Paginated list with optional filters

# PUT /api/leave/{leave_id}/approve
# [Protected — admin only]
# Steps:
#   1. Update leaves: status='approved', approved_by=current_user.id, approved_at=now()
#   2. Update leave_balances: used_days += days_requested
#   3. For each date in leave range: upsert attendance_logs with status='on_leave'
#   4. Send approval email
#   5. Return { message }

# PUT /api/leave/{leave_id}/reject
# [Protected — admin only]
# Body: { rejection_note }
# Steps:
#   1. Update leaves: status='rejected', rejection_note
#   2. Send rejection email
#   3. Return { message }

# GET /api/leave/balance/{employee_id}
# [Protected — self or admin]
# Returns leave_balances joined with leave_types for this employee + current year
```

### `api/geofence.py`
```python
# GET /api/geofence/zones
# [Protected — any verified user]
# Returns all active zones (needed by check-in to show the map)

# POST /api/geofence/zones
# [Protected — super_admin only]
# Body: { name, latitude, longitude, radius_meters }

# PUT /api/geofence/zones/{zone_id}
# [Protected — super_admin only]
# Editable: name, latitude, longitude, radius_meters, is_active

# DELETE /api/geofence/zones/{zone_id}
# [Protected — super_admin only]
# Soft delete: set is_active=False, do not hard delete (historical records reference zone_id)
```

### `api/holidays.py`
```python
# GET /api/holidays?year=2025
# [Protected — any verified user]

# POST /api/holidays
# [Protected — super_admin only]
# Body: { name, date, type, description }

# DELETE /api/holidays/{holiday_id}
# [Protected — super_admin only]
```

### `api/dashboard.py`
```python
# GET /api/dashboard/employee/{employee_id}
# [Protected — self or admin]
# Returns:
# {
#   profile: { full_name, employee_id, department, designation, shift_start, shift_end },
#   today: { status, checkin_time, checkout_time, hours_worked, zone_name },
#   this_month: { present, absent, late, attendance_rate },
#   leave_balance: [ { type, code, color, total, used, remaining } ],
#   recent_logs: [ last 30 days of attendance_logs ],
#   upcoming_leaves: [ approved leaves in the next 30 days ]
# }

# GET /api/dashboard/admin
# [Protected — admin only]
# Returns:
# {
#   today_summary: { total_employees, present, absent, late, on_leave, not_checked_in },
#   by_office: [ { zone_name, present, total } ],
#   department_breakdown: [ { department, present, total, rate } ],
#   recent_activity: [ last 10 check-in events with employee name + zone ]
#   pending_leaves_count: N
# }
```

### `api/reports.py`
```python
# GET /api/reports/attendance/csv?from=YYYY-MM-DD&to=YYYY-MM-DD&department=
# [Protected — admin only]
# Returns StreamingResponse CSV
# Columns: employee_id, full_name, department, date, checkin_time, checkout_time,
#          hours_worked, status, zone_name

# GET /api/reports/leave/csv?year=2025
# [Protected — admin only]
# Columns: employee_id, full_name, department, leave_type, from_date, to_date,
#          days_requested, status, approved_by, applied_at

# GET /api/reports/summary?month=2025-05
# [Protected — admin only]
# Returns JSON: { total_employees, avg_attendance_rate, total_late, total_absent,
#                 department_breakdown, top_absentees }
```

### `scheduler.py`
```python
# APScheduler job: runs daily at 18:30 IST
# For each employee with no attendance record today (and no approved leave):
#   → Insert attendance_logs row with status='absent'
# This ensures every working day has a record, making reports accurate.

# APScheduler job: runs on 1st of each month
# For all selfies older than 30 days:
#   → Call cloudinary_service.delete_selfie(public_id) for each old record
#   → Clear selfie_url and selfie_public_id from attendance_logs row
# This keeps storage lean.
```

---

## Frontend — All Pages

### `pages/Login.jsx`
- Form: email + password
- Calls `POST /api/auth/login`
- On success: stores `access_token` as `auth_token`, `role` as `user_role`, `id` as `user_id` in localStorage
- Redirects to `/dashboard` (employee) or `/admin` (admin/super_admin)
- On 403 with "pending verification": redirects to `/pending` page

### `pages/Register.jsx`
- Form: full name, email, password only (no role selector — everyone registers as employee)
- Calls `POST /api/auth/register`
- On success: shows message "Registration submitted. You will receive an email when your account is activated."
- Does NOT auto-login

### `pages/PendingVerification.jsx`
- Static screen shown after registration or on 403 login attempt
- Message: "Your account is pending admin verification. You will receive an email once activated."
- No actions. Just a clear status screen.

### `pages/CheckIn.jsx`
- Step 1: Open camera via `useCamera` hook → live preview → capture selfie
- Step 2: Request location via `useGeolocation` hook
- Step 3: POST both to `/api/attendance/checkin`
- On success: green confirmation card showing check-in time and office name
- On geofence error: show `GeofenceMap` component with user's distance from nearest zone
- On already checked in: show today's status + check-out button

### `pages/EmployeeDashboard.jsx`
```
Loads: GET /api/dashboard/employee/{user_id}
Shows:
  - Today's status card (checked in / checked out / not yet / on leave)
  - Check-in / check-out button → navigates to /checkin
  - This month stats: present, absent, late, rate %
  - 30-day AttendanceCalendar
  - Leave balance per type (progress bars)
  - Recent leave applications (last 3) with status badges
  - Upcoming holidays (next 5)
```

### `pages/AdminDashboard.jsx`
```
Loads: GET /api/dashboard/admin
Shows:
  - Today's summary: present / absent / late / on leave / not checked in (StatCards)
  - Office breakdown table (which office has how many people in)
  - Department breakdown (with attendance rate bars)
  - Recent activity feed (last 10 check-ins with name + office)
  - Pending verifications badge → links to EmployeeManagement pending tab
  - Pending leaves badge → links to LeaveManagement
```

### `pages/EmployeeManagement.jsx` (Admin only)
```
Tabs: All Employees | Pending Verification
Loads: GET /api/employees (paginated, 50 per page)
       GET /api/employees/pending (for Pending tab)

All Employees tab:
  - Search by name or employee ID
  - Filter by department, status
  - Table: name, employee ID, department, designation, shift, status
  - Click row → EmployeeProfile page
  - Edit button → inline edit drawer (shift, department, designation)

Pending Verification tab:
  - Cards for each unverified account
  - Shows: name, email, registered date
  - Button: "Verify & Activate" → POST /api/employees/{id}/verify
  - On success: moves card out of list, shows success toast
```

### `pages/EmployeeProfile.jsx` (Admin only)
```
Loads: GET /api/dashboard/employee/{employee_id}
Shows:
  - Profile header: name, ID, dept, designation, shift, join date
  - Edit profile button (admin + super admin) — inline form
  - Promote role button (super admin only) → dropdown: employee / admin / super_admin
  - AttendanceCalendar (30-day)
  - This month stats
  - Leave history
  - Last 5 selfies (Cloudinary URLs — only show if selfie_url is set)
```

### `pages/LeaveManagement.jsx` (Admin only)
```
Filter tabs: Pending | Approved | Rejected | All
Loads: GET /api/leave/all?status={tab}&page=1
For each LeaveCard: employee name, type, dates, days, reason, status badge
Approve → PUT /api/leave/{id}/approve (optimistic UI update)
Reject → modal to type rejection note → PUT /api/leave/{id}/reject
Pagination: show 20 per page, load more button
```

### `pages/ApplyLeave.jsx` (Employee only)
```
Form: leave type (from GET /api/leave/balance), from_date, to_date, mode, reason, contact
Live preview: days_requested (calculated client-side, excluding weekends)
Balance warning: if days_requested > remaining, show warning in red
Submit: POST /api/leave/apply → success message → navigate back to dashboard
```

### `pages/GeofenceManagement.jsx` (Super Admin only)
```
Lists all zones (active + inactive)
Add zone: form with name, lat/lng (text input — no maps API needed), radius slider
Edit zone: name, lat/lng, radius, toggle active/inactive
Delete: soft delete (set inactive)
Shows approximate address via reverse geocoding if browser supports it
```

### `pages/Holidays.jsx` (Super Admin manages, all roles view)
```
Monthly calendar grid with holiday dates highlighted
Holiday list sorted by date
Admin: Add holiday button → modal (name, date, type, description)
Admin: Remove holiday (X)
Both: see next 5 upcoming holidays at top
```

### `pages/Reports.jsx` (Admin only)
```
Section 1 — Attendance CSV
  Date range picker, department filter, Download button

Section 2 — Leave CSV
  Year picker, Download button

Section 3 — Monthly Summary
  Month picker, renders summary JSON as formatted cards
```

---

## Frontend — Components

### `components/SelfieCapture.jsx`
```javascript
// Props: onCapture(base64String), onError(message)
// 1. navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
// 2. Show <video> with live preview
// 3. On "Capture": draw to <canvas> → toDataURL('image/jpeg', 0.6)
//    Note: quality 0.6 typically gives ~60-80KB for a face photo. Adjust if needed.
// 4. Show preview with "Use this" / "Retake"
// 5. On "Use this": call onCapture(base64)
// 6. On permission denied: show clear instructions (Settings → Safari/Chrome → Camera)
// Cleanup: stop all camera tracks on unmount
```

### `components/GeofenceMap.jsx`
```javascript
// Props: userLat, userLng, nearestZone { lat, lng, radius, name }, distanceMeters, isInside
// Pure SVG — no Google Maps, no API key
// Renders: circle for geofence zone, dot for user position, line showing distance
// Green if inside, red if outside
// Shows: distance in metres, zone name, clear message
```

### `components/AttendanceCalendar.jsx`
```javascript
// Props: logs (attendance_logs array), month (Date)
// 30-day grid
// Green: 'present' | Amber: 'late' or 'half_day' | Red: 'absent' | Blue: 'on_leave' | Grey: future
// Tooltip on tap/hover: date, status, hours_worked, zone_name
```

### `components/StatCard.jsx`
```javascript
// Props: label, value, subtitle, color ('green'|'red'|'amber'|'blue'|'grey')
// Simple KPI card used in both dashboards
```

---

## Frontend — Hooks

### `hooks/useAuth.js`
```javascript
// Exposes: { user, role, isSuperAdmin, isAdmin, isLoading, logout }
// Reads: auth_token, user_role, user_id from localStorage
// On mount: decode JWT exp claim → if expired, call logout()
// isAdmin: true if role is 'admin' OR 'super_admin'
// isSuperAdmin: true only if role is 'super_admin'
// logout(): clears localStorage → navigate('/login')
```

### `hooks/useGeolocation.js`
```javascript
// Exposes: { location: { lat, lng }, error, isLoading, request() }
// request(): navigator.geolocation.getCurrentPosition with timeout: 10000
// Specific error messages for each failure case:
//   PERMISSION_DENIED → "Please allow location access in your browser settings"
//   POSITION_UNAVAILABLE → "Location unavailable. Move to an open area and try again."
//   TIMEOUT → "Location request timed out. Try again."
```

### `hooks/useCamera.js`
```javascript
// Exposes: { stream, capturedImage, startCamera(), capture(), retake(), stop() }
// startCamera(): getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
// capture(): canvas drawImage → toDataURL('image/jpeg', 0.6)
// retake(): clear capturedImage, restart preview
// stop(): tracks.forEach(t => t.stop())
// Always stop() on component unmount
```

### `services/api.js`
```javascript
// Central fetch wrapper
// Reads base URL from import.meta.env.VITE_API_URL
// Attaches Authorization: Bearer {token} automatically
// On 401: clear localStorage + redirect to /login
// On 403 with "pending verification": redirect to /pending
// Methods: api.get(path), api.post(path, body), api.put(path, body), api.delete(path)
```

---

## Dependencies

### Backend `requirements.txt`
```
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
```

### Frontend key deps
```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "@supabase/supabase-js": "^2.43.0",
    "date-fns": "^3.6.0"
  }
}
```

---

## Mock Server — Use While Building Frontend

```bash
cd mock_api
pip install fastapi uvicorn
uvicorn mock_server:app --reload --port 8001
```

Set `VITE_API_URL=http://localhost:8001` in `frontend/.env`.
When the real backend is ready, change that one env var. Nothing else changes.

### `mock_api/mock_server.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MOCK_EMP_ID   = "mock-emp-001"
MOCK_ADMIN_ID = "mock-admin-001"

# AUTH
@app.post("/api/auth/register")
async def mock_register(body: dict):
    return {"message": "Registration submitted. Await admin verification."}

@app.post("/api/auth/login")
async def mock_login(body: dict):
    if body.get("email", "").startswith("admin"):
        return {"access_token": "mock-token", "role": "admin", "id": MOCK_ADMIN_ID, "full_name": "Admin User"}
    if body.get("email", "").startswith("super"):
        return {"access_token": "mock-token", "role": "super_admin", "id": MOCK_ADMIN_ID, "full_name": "Super Admin"}
    return {"access_token": "mock-token", "role": "employee", "id": MOCK_EMP_ID, "full_name": "Rahul Mehta"}

# ATTENDANCE
@app.post("/api/attendance/checkin")
async def mock_checkin(body: dict):
    return {"message": "Checked in successfully", "status": "present", "checkin_time": "09:02", "zone_name": "Head Office"}

@app.post("/api/attendance/checkout")
async def mock_checkout(body: dict):
    return {"message": "Checked out", "hours_worked": 8.2, "checkout_time": "18:05"}

@app.get("/api/attendance/today/{employee_id}")
async def mock_today(employee_id: str):
    return {"status": "present", "checkin_time": "2025-05-10T09:02:00+05:30", "checkout_time": None, "hours_worked": None, "zone_name": "Head Office"}

@app.get("/api/attendance/{employee_id}")
async def mock_logs(employee_id: str, from_date: str = None, to_date: str = None, page: int = 1, limit: int = 30):
    return {
        "data": [
            {"id": "log-1", "date": "2025-05-10", "checkin_time": "09:02", "checkout_time": "18:05", "hours_worked": 8.05, "status": "present", "zone_name": "Head Office"},
            {"id": "log-2", "date": "2025-05-09", "checkin_time": "09:45", "checkout_time": "18:10", "hours_worked": 8.41, "status": "late", "zone_name": "Head Office"},
            {"id": "log-3", "date": "2025-05-08", "checkin_time": None, "checkout_time": None, "hours_worked": None, "status": "absent", "zone_name": None},
        ],
        "total": 3, "page": page, "limit": limit
    }

# DASHBOARD
@app.get("/api/dashboard/employee/{employee_id}")
async def mock_emp_dashboard(employee_id: str):
    return {
        "profile": {"full_name": "Rahul Mehta", "employee_id": "EMP-001", "department": "Operations", "shift_start": "09:00", "shift_end": "18:00"},
        "today": {"status": "present", "checkin_time": "09:02", "checkout_time": None, "hours_worked": None, "zone_name": "Head Office"},
        "this_month": {"present": 18, "absent": 2, "late": 3, "attendance_rate": 90},
        "leave_balance": [
            {"type": "Casual Leave", "code": "CL", "color": "#4f8ef7", "total": 12, "used": 4, "remaining": 8},
            {"type": "Sick Leave", "code": "SL", "color": "#10b981", "total": 8, "used": 2, "remaining": 6},
        ],
        "recent_logs": [],
        "upcoming_leaves": []
    }

@app.get("/api/dashboard/admin")
async def mock_admin_dashboard():
    return {
        "today_summary": {"total_employees": 200, "present": 162, "absent": 18, "late": 12, "on_leave": 5, "not_checked_in": 3},
        "by_office": [
            {"zone_name": "Head Office", "present": 95, "total": 110},
            {"zone_name": "Branch - Indore", "present": 67, "total": 90},
        ],
        "department_breakdown": [
            {"department": "Operations", "present": 45, "total": 52, "rate": 87},
            {"department": "Sales", "present": 38, "total": 45, "rate": 84},
        ],
        "recent_activity": [
            {"employee_name": "Rahul Mehta", "action": "Checked In", "time": "09:02", "zone": "Head Office"},
            {"employee_name": "Priya Sharma", "action": "Checked In", "time": "09:08", "zone": "Branch - Indore"},
        ],
        "pending_leaves_count": 7
    }

# EMPLOYEES
@app.get("/api/employees")
async def mock_employees(department: str = None, status: str = None, page: int = 1, limit: int = 50):
    return {
        "data": [
            {"id": "emp-1", "full_name": "Rahul Mehta", "employee_id": "EMP-001", "department": "Operations", "designation": "Manager", "is_active": True, "is_verified": True},
            {"id": "emp-2", "full_name": "Priya Sharma", "employee_id": "EMP-002", "department": "Sales", "designation": "Executive", "is_active": True, "is_verified": True},
        ],
        "total": 2, "page": page, "limit": limit
    }

@app.get("/api/employees/pending")
async def mock_pending():
    return [
        {"id": "emp-99", "full_name": "New Employee", "email": "new@company.com", "created_at": "2025-05-10T08:00:00Z"},
    ]

@app.post("/api/employees/{employee_id}/verify")
async def mock_verify(employee_id: str):
    return {"message": "Employee verified and activated"}

@app.put("/api/employees/{employee_id}")
async def mock_update_employee(employee_id: str, body: dict):
    return {"message": "Profile updated"}

@app.post("/api/employees/{employee_id}/promote")
async def mock_promote(employee_id: str, body: dict):
    return {"message": f"Role updated to {body.get('role')}"}

# LEAVE
@app.post("/api/leave/apply")
async def mock_apply(body: dict):
    return {"message": "Leave application submitted", "leave_id": "leave-new-001", "days_requested": 2}

@app.get("/api/leave/my/{employee_id}")
async def mock_my_leaves(employee_id: str):
    return [
        {"id": "leave-1", "type": "Casual Leave", "from_date": "2025-05-12", "to_date": "2025-05-13", "days_requested": 2, "reason": "Personal", "status": "pending", "applied_at": "2025-05-09"},
        {"id": "leave-2", "type": "Sick Leave", "from_date": "2025-04-15", "to_date": "2025-04-15", "days_requested": 1, "reason": "Fever", "status": "approved", "applied_at": "2025-04-14"},
    ]

@app.get("/api/leave/all")
async def mock_all_leaves(status: str = None, department: str = None, page: int = 1, limit: int = 20):
    leaves = [
        {"id": "leave-1", "employee_name": "Rahul Mehta", "department": "Operations", "type": "Casual Leave", "from_date": "2025-05-12", "to_date": "2025-05-13", "days_requested": 2, "reason": "Personal", "status": "pending"},
        {"id": "leave-2", "employee_name": "Priya Sharma", "department": "Sales", "type": "Sick Leave", "from_date": "2025-05-08", "to_date": "2025-05-08", "days_requested": 1, "reason": "Fever", "status": "approved"},
    ]
    if status:
        leaves = [l for l in leaves if l["status"] == status]
    return {"data": leaves, "total": len(leaves), "page": page, "limit": limit}

@app.get("/api/leave/balance/{employee_id}")
async def mock_balance(employee_id: str):
    return [
        {"leave_type": "Casual Leave", "code": "CL", "color": "#4f8ef7", "total_days": 12, "used_days": 4, "remaining": 8},
        {"leave_type": "Sick Leave", "code": "SL", "color": "#10b981", "total_days": 8, "used_days": 2, "remaining": 6},
        {"leave_type": "Earned Leave", "code": "EL", "color": "#f59e0b", "total_days": 15, "used_days": 6, "remaining": 9},
    ]

@app.put("/api/leave/{leave_id}/approve")
async def mock_approve(leave_id: str):
    return {"message": "Leave approved"}

@app.put("/api/leave/{leave_id}/reject")
async def mock_reject(leave_id: str, body: dict):
    return {"message": "Leave rejected"}

# HOLIDAYS
@app.get("/api/holidays")
async def mock_holidays():
    return [
        {"id": "h1", "name": "Republic Day", "date": "2025-01-26", "type": "national"},
        {"id": "h2", "name": "Holi", "date": "2025-03-14", "type": "festival"},
        {"id": "h3", "name": "Independence Day", "date": "2025-08-15", "type": "national"},
        {"id": "h4", "name": "Diwali", "date": "2025-10-20", "type": "festival"},
    ]

@app.post("/api/holidays")
async def mock_add_holiday(body: dict):
    return {"message": "Holiday added", "id": "new-holiday-uuid"}

@app.delete("/api/holidays/{holiday_id}")
async def mock_delete_holiday(holiday_id: str):
    return {"message": "Holiday removed"}

# GEOFENCE
@app.get("/api/geofence/zones")
async def mock_zones():
    return [
        {"id": "zone-1", "name": "Head Office", "latitude": 22.7196, "longitude": 75.8577, "radius_meters": 200, "is_active": True},
        {"id": "zone-2", "name": "Branch - Indore", "latitude": 22.7340, "longitude": 75.8726, "radius_meters": 150, "is_active": True},
    ]

@app.post("/api/geofence/zones")
async def mock_add_zone(body: dict):
    return {"message": "Zone added", "id": "new-zone-uuid"}

@app.put("/api/geofence/zones/{zone_id}")
async def mock_update_zone(zone_id: str, body: dict):
    return {"message": "Zone updated"}

@app.delete("/api/geofence/zones/{zone_id}")
async def mock_delete_zone(zone_id: str):
    return {"message": "Zone deactivated"}

# REPORTS
@app.get("/api/reports/attendance/csv")
async def mock_attendance_csv():
    from fastapi.responses import PlainTextResponse
    csv = "employee_id,full_name,department,date,checkin_time,checkout_time,hours_worked,status,zone_name\n"
    csv += "EMP-001,Rahul Mehta,Operations,2025-05-10,09:02,18:05,8.05,present,Head Office\n"
    csv += "EMP-002,Priya Sharma,Sales,2025-05-10,09:15,18:10,8.55,present,Branch - Indore\n"
    return PlainTextResponse(csv, headers={"Content-Disposition": "attachment; filename=attendance.csv"})

@app.get("/api/reports/leave/csv")
async def mock_leave_csv():
    from fastapi.responses import PlainTextResponse
    csv = "employee_id,full_name,department,leave_type,from_date,to_date,days_requested,status\n"
    csv += "EMP-001,Rahul Mehta,Operations,Casual Leave,2025-05-12,2025-05-13,2,approved\n"
    return PlainTextResponse(csv, headers={"Content-Disposition": "attachment; filename=leaves.csv"})

@app.get("/api/reports/summary")
async def mock_summary(month: str = "2025-05"):
    return {
        "total_employees": 200, "avg_attendance_rate": 87,
        "total_late": 34, "total_absent": 28,
        "department_breakdown": [
            {"department": "Operations", "rate": 89},
            {"department": "Sales", "rate": 84},
        ],
        "top_absentees": [
            {"full_name": "Some Employee", "absent_days": 5}
        ]
    }
```

---

## Quick Reference — All Endpoints

```
POST   /api/auth/register
POST   /api/auth/login

POST   /api/attendance/checkin
POST   /api/attendance/checkout
GET    /api/attendance/today/{employee_id}
GET    /api/attendance/{employee_id}?from=&to=&page=&limit=

GET    /api/dashboard/employee/{employee_id}
GET    /api/dashboard/admin

POST   /api/leave/apply
GET    /api/leave/my/{employee_id}
GET    /api/leave/all?status=&department=&page=&limit=
PUT    /api/leave/{leave_id}/approve
PUT    /api/leave/{leave_id}/reject
GET    /api/leave/balance/{employee_id}

GET    /api/holidays?year=
POST   /api/holidays
DELETE /api/holidays/{holiday_id}

GET    /api/geofence/zones
POST   /api/geofence/zones
PUT    /api/geofence/zones/{zone_id}
DELETE /api/geofence/zones/{zone_id}

GET    /api/employees?department=&status=&page=&limit=
GET    /api/employees/pending
POST   /api/employees/{employee_id}/verify
PUT    /api/employees/{employee_id}
POST   /api/employees/{employee_id}/promote

GET    /api/reports/attendance/csv?from=&to=&department=
GET    /api/reports/leave/csv?year=
GET    /api/reports/summary?month=
```
