# AttendTrack Pro — API Contract
### The source of truth for all frontend-backend communication. Never change a shape here without updating the mock server the same day.

---

## Base URLs

```
Development (mock):    http://localhost:8001      ← Use while building frontend
Development (real):    http://localhost:8000      ← Switch when backend is ready
Production backend:    https://your-app.railway.app
Production frontend:   https://your-app.vercel.app
```

All frontend API calls read from `import.meta.env.VITE_API_URL`.
**Never hardcode a URL in the frontend.**

---

## Authentication

All protected endpoints require a Bearer token in the `Authorization` header.

```
Authorization: Bearer <supabase_jwt_token>
```

The token comes from Supabase Auth on login and is stored in `localStorage` as `auth_token`.
`services/api.js` attaches this header automatically.

**[PUBLIC]** — No header required
**[VERIFIED]** — Any verified, active account
**[ADMIN]** — role must be `admin` or `super_admin`, returns 403 otherwise
**[SUPER_ADMIN]** — role must be `super_admin` only, returns 403 otherwise

---

## Auth Endpoints

### Register `[PUBLIC]`
```
POST /api/auth/register
Body:  { email: string, password: string, full_name: string }

Response 200:
{ "message": "Registration submitted. Await admin verification." }

Response 400:
{ "error": "Email already registered" }
```
Note: No role field. Everyone registers as `employee`. Role can only be changed by Super Admin after verification.

---

### Login `[PUBLIC]`
```
POST /api/auth/login
Body:  { email: string, password: string }

Response 200:
{
  "access_token": string,    ← Store as localStorage 'auth_token'
  "role":         "employee" | "admin" | "super_admin",
  "id":           string,    ← Store as localStorage 'user_id'
  "full_name":    string
}

Response 401: { "error": "Invalid credentials" }
Response 403: { "error": "Account pending verification" }   ← Redirect to /pending
Response 403: { "error": "Account deactivated" }
```

---

## Attendance Endpoints

### Check In `[VERIFIED]`
```
POST /api/attendance/checkin
Body:
{
  "latitude":      number,
  "longitude":     number,
  "selfie_base64": string    ← data:image/jpeg;base64,{data}
}

Response 200:
{
  "message":      "Checked in successfully",
  "status":       "present" | "late",
  "checkin_time": "2025-05-10T09:02:00+05:30",
  "zone_name":    "Head Office"
}

Response 400: { "error": "Outside all geofence zones", "distance_meters": 450, "nearest_zone": "Head Office" }
Response 400: { "error": "Already checked in today" }
```

### Check Out `[VERIFIED]`
```
POST /api/attendance/checkout
Body: { "latitude": number, "longitude": number }

Response 200:
{
  "message":       "Checked out successfully",
  "hours_worked":  8.2,
  "checkout_time": "2025-05-10T18:05:00+05:30"
}

Response 400: { "error": "No check-in found for today" }
Response 400: { "error": "Already checked out" }
```

### Today's Status `[VERIFIED]`
```
GET /api/attendance/today/{employee_id}

Response 200:
{
  "status":        "present" | "late" | "absent" | "on_leave" | null,
  "checkin_time":  "2025-05-10T09:02:00+05:30" | null,
  "checkout_time": "2025-05-10T18:05:00+05:30" | null,
  "hours_worked":  8.2 | null,
  "zone_name":     "Head Office" | null
}
```

### Attendance Logs `[VERIFIED — admin or self]`
```
GET /api/attendance/{employee_id}?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=30

Response 200:
{
  "data": [
    {
      "id":            "uuid",
      "date":          "2025-05-10",
      "checkin_time":  "2025-05-10T09:02:00+05:30",
      "checkout_time": "2025-05-10T18:05:00+05:30",
      "hours_worked":  8.05,
      "status":        "present",
      "zone_name":     "Head Office",
      "selfie_url":    "https://res.cloudinary.com/..." | null
    }
  ],
  "total": 26,
  "page": 1,
  "limit": 30
}
```

---

## Dashboard Endpoints

### Employee Dashboard `[VERIFIED — self or admin]`
```
GET /api/dashboard/employee/{employee_id}

Response 200:
{
  "profile": {
    "full_name":    "Rahul Mehta",
    "employee_id":  "EMP-001",
    "department":   "Operations",
    "designation":  "Manager",
    "shift_start":  "09:00",
    "shift_end":    "18:00"
  },
  "today": {
    "status":       "present" | "late" | "absent" | "on_leave" | null,
    "checkin_time": "09:02" | null,
    "checkout_time": null,
    "hours_worked": null,
    "zone_name":    "Head Office" | null
  },
  "this_month": {
    "present":         18,
    "absent":           2,
    "late":             3,
    "attendance_rate": 90
  },
  "leave_balance": [
    {
      "type":      "Casual Leave",
      "code":      "CL",
      "color":     "#4f8ef7",
      "total":     12,
      "used":       4,
      "remaining":  8
    }
  ],
  "recent_logs": [ /* last 30 days of attendance_logs */ ],
  "upcoming_leaves": [ /* approved leaves in next 30 days */ ]
}
```

### Admin Dashboard `[ADMIN]`
```
GET /api/dashboard/admin

Response 200:
{
  "today_summary": {
    "total_employees":  200,
    "present":          162,
    "absent":            18,
    "late":              12,
    "on_leave":           5,
    "not_checked_in":     3
  },
  "by_office": [
    { "zone_name": "Head Office",      "present": 95, "total": 110 },
    { "zone_name": "Branch - Indore",  "present": 67, "total": 90 }
  ],
  "department_breakdown": [
    { "department": "Operations", "present": 45, "total": 52, "rate": 87 }
  ],
  "recent_activity": [
    { "employee_name": "Rahul Mehta", "action": "Checked In", "time": "09:02", "zone": "Head Office" }
  ],
  "pending_leaves_count": 7
}
```

---

## Leave Endpoints

### Apply for Leave `[VERIFIED — employee]`
```
POST /api/leave/apply
Body:
{
  "leave_type_id":  "uuid",
  "from_date":      "2025-05-12",
  "to_date":        "2025-05-13",
  "mode":           "full_day" | "first_half" | "second_half",
  "reason":         "Family event",
  "contact_during": "9876543210"   ← optional
}

Response 200:
{ "message": "Leave application submitted", "leave_id": "uuid", "days_requested": 2 }

Response 400: { "error": "Insufficient leave balance. Available: 3, Requested: 5" }
Response 400: { "error": "Conflicting approved leave exists for this date range" }
```

### My Leave Applications `[VERIFIED — self]`
```
GET /api/leave/my/{employee_id}

Response 200: [
  {
    "id":             "uuid",
    "type":           "Casual Leave",
    "from_date":      "2025-05-12",
    "to_date":        "2025-05-13",
    "days_requested": 2,
    "reason":         "Family event",
    "status":         "pending" | "approved" | "rejected" | "cancelled",
    "rejection_note": null,
    "applied_at":     "2025-05-09"
  }
]
```

### All Leave Applications `[ADMIN]`
```
GET /api/leave/all?status=pending&department=Operations&page=1&limit=20

Response 200:
{
  "data": [
    {
      "id":             "uuid",
      "employee_name":  "Rahul Mehta",
      "employee_id":    "EMP-001",
      "department":     "Operations",
      "type":           "Casual Leave",
      "from_date":      "2025-05-12",
      "to_date":        "2025-05-13",
      "days_requested": 2,
      "reason":         "Family event",
      "status":         "pending"
    }
  ],
  "total": 7,
  "page": 1,
  "limit": 20
}
```

### Approve Leave `[ADMIN]`
```
PUT /api/leave/{leave_id}/approve

Response 200: { "message": "Leave approved" }
Response 404: { "error": "Leave not found" }
Response 400: { "error": "Leave already processed" }
```

### Reject Leave `[ADMIN]`
```
PUT /api/leave/{leave_id}/reject
Body: { "rejection_note": "Insufficient notice period" }

Response 200: { "message": "Leave rejected" }
```

### Leave Balance `[VERIFIED — self or admin]`
```
GET /api/leave/balance/{employee_id}

Response 200: [
  {
    "leave_type":   "Casual Leave",
    "code":         "CL",
    "color":        "#4f8ef7",
    "total_days":   12,
    "used_days":     4,
    "remaining":     8
  }
]
```

---

## Employee Endpoints

### List Employees `[ADMIN]`
```
GET /api/employees?department=Operations&status=active&page=1&limit=50

Response 200:
{
  "data": [
    {
      "id":           "uuid",
      "full_name":    "Rahul Mehta",
      "employee_id":  "EMP-001",
      "department":   "Operations",
      "designation":  "Manager",
      "phone":        "9876543210",
      "shift_start":  "09:00",
      "shift_end":    "18:00",
      "is_active":    true,
      "is_verified":  true,
      "joined_date":  "2024-01-15"
    }
  ],
  "total": 200,
  "page": 1,
  "limit": 50
}
```

### Pending Verification List `[ADMIN]`
```
GET /api/employees/pending

Response 200: [
  {
    "id":         "uuid",
    "full_name":  "New Employee",
    "email":      "new@company.com",
    "created_at": "2025-05-10T08:00:00Z"
  }
]
```

### Verify Employee `[ADMIN]`
```
POST /api/employees/{employee_id}/verify

Response 200: { "message": "Employee verified and activated", "employee_id": "EMP-042" }
```

### Update Employee `[ADMIN]`
```
PUT /api/employees/{employee_id}
Body (all optional, include only fields you want to change):
{
  "full_name":               "string",
  "department":              "string",
  "designation":             "string",
  "phone":                   "string",
  "shift_start":             "09:00",
  "shift_end":               "18:00",
  "late_threshold_minutes":  15,
  "is_active":               true
}

Response 200: { "message": "Profile updated", "profile": { /* updated profile */ } }
```

### Promote / Change Role `[SUPER_ADMIN]`
```
POST /api/employees/{employee_id}/promote
Body: { "role": "admin" | "super_admin" | "employee" }

Response 200: { "message": "Role updated to admin" }
Response 403: { "error": "Super admin access required" }
```

---

## Geofence Endpoints

### List Zones `[VERIFIED]`
```
GET /api/geofence/zones

Response 200: [
  {
    "id":             "uuid",
    "name":           "Head Office",
    "latitude":       22.7196,
    "longitude":      75.8577,
    "radius_meters":  200,
    "is_active":      true
  }
]
```

### Add Zone `[SUPER_ADMIN]`
```
POST /api/geofence/zones
Body: { "name": "Branch - Mumbai", "latitude": 19.0760, "longitude": 72.8777, "radius_meters": 150 }

Response 200: { "message": "Zone added", "id": "uuid" }
```

### Update Zone `[SUPER_ADMIN]`
```
PUT /api/geofence/zones/{zone_id}
Body (all optional): { "name": string, "latitude": number, "longitude": number, "radius_meters": number, "is_active": boolean }

Response 200: { "message": "Zone updated" }
```

### Deactivate Zone `[SUPER_ADMIN]`
```
DELETE /api/geofence/zones/{zone_id}

Response 200: { "message": "Zone deactivated" }
Note: Soft delete only. Historical records still reference this zone_id.
```

---

## Holiday Endpoints

### List Holidays `[VERIFIED]`
```
GET /api/holidays?year=2025

Response 200: [
  {
    "id":          "uuid",
    "name":        "Diwali",
    "date":        "2025-10-20",
    "type":        "festival",
    "description": "Festival of lights"
  }
]
```

### Add Holiday `[SUPER_ADMIN]`
```
POST /api/holidays
Body: { "name": "Diwali", "date": "2025-10-20", "type": "festival", "description": "optional" }

Response 200: { "message": "Holiday added", "id": "uuid" }
Response 400: { "error": "A holiday already exists on this date" }
```

### Remove Holiday `[SUPER_ADMIN]`
```
DELETE /api/holidays/{holiday_id}

Response 200: { "message": "Holiday removed" }
```

---

## Reports Endpoints

### Attendance CSV `[ADMIN]`
```
GET /api/reports/attendance/csv?from=2025-05-01&to=2025-05-31&department=Operations

Response: CSV file download
Content-Disposition: attachment; filename="attendance_May2025.csv"

Columns:
employee_id, full_name, department, date, checkin_time, checkout_time, hours_worked, status, zone_name
```

### Leave CSV `[ADMIN]`
```
GET /api/reports/leave/csv?year=2025

Response: CSV file download
Columns:
employee_id, full_name, department, leave_type, from_date, to_date, days_requested, status, approved_by, applied_at
```

### Monthly Summary `[ADMIN]`
```
GET /api/reports/summary?month=2025-05

Response 200:
{
  "total_employees":    200,
  "avg_attendance_rate": 87,
  "total_late":          34,
  "total_absent":        28,
  "department_breakdown": [
    { "department": "Operations", "rate": 89, "total_late": 12, "total_absent": 8 }
  ],
  "top_absentees": [
    { "full_name": "Employee Name", "employee_id": "EMP-012", "absent_days": 5 }
  ]
}
```

---

## Error Format

All error responses follow this shape:
```json
{ "error": "Human-readable error message" }
```

HTTP status codes used:
- `400` — Bad request (validation error, business logic error)
- `401` — Unauthenticated (missing or invalid token)
- `403` — Forbidden (wrong role, or account not verified/active)
- `404` — Resource not found
- `500` — Server error (always log these)
