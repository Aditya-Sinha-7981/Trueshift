"""Local mock API for frontend development (Steps 1–12). Run: uvicorn mock_server:app --reload --port 8001"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import Body, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

app = FastAPI(title="AttendTrack Mock API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MOCK_EMP_ID = "mock-emp-001"
MOCK_ADMIN_ID = "mock-admin-001"

TZ = ZoneInfo("Asia/Kolkata")
MOCK_ATTENDANCE_TODAY: dict[str, dict] = {}


def _attendance_key(employee_id: str, day: date | None = None) -> str:
    d = day or date.today()
    return f"{employee_id}|{d.isoformat()}"


def _build_recent_logs_employee_dashboard():
    today = date.today()
    cycle = ["present", "present", "late", "absent", "on_leave", "present"]
    out = []
    for i in range(30):
        d = today - timedelta(days=i)
        st = cycle[i % len(cycle)]
        out.append(
            {
                "id": f"log-dash-{i}",
                "date": d.isoformat(),
                "checkin_time": "09:02" if st in ("present", "late") else None,
                "checkout_time": "18:05" if st in ("present", "late") else None,
                "hours_worked": 8.05 if st in ("present", "late") else None,
                "status": st,
                "zone_name": "Head Office" if st in ("present", "late") else None,
                "selfie_url": None,
            }
        )
    return out


@app.get("/health")
def health():
    return {"status": "ok"}


# --- AUTH -----------------------------------------------------------------
@app.post("/api/auth/register")
async def mock_register(_body: dict = Body(...)):
    return {"message": "Registration submitted. Await admin verification."}


@app.post("/api/auth/login")
async def mock_login(body: dict = Body(...)):
    email = (body.get("email") or "").lower().strip()
    if email == "pending@test.com":
        return JSONResponse(
            status_code=403,
            content={"error": "Account pending verification"},
        )
    if email.startswith("admin"):
        return {
            "access_token": "mock-token",
            "role": "admin",
            "id": MOCK_ADMIN_ID,
            "full_name": "Admin User",
        }
    if email.startswith("super"):
        return {
            "access_token": "mock-token",
            "role": "super_admin",
            "id": MOCK_ADMIN_ID,
            "full_name": "Super Admin",
        }
    return {
        "access_token": "mock-token",
        "role": "employee",
        "id": MOCK_EMP_ID,
        "full_name": "Rahul Mehta",
    }


# --- ATTENDANCE ------------------------------------------------------------
@app.post("/api/attendance/checkin")
async def mock_checkin(body: dict = Body(...)):
    emp = body.get("employee_id") or MOCK_EMP_ID
    try:
        lat = float(body["latitude"]) if body.get("latitude") is not None else None
    except (TypeError, ValueError):
        lat = None
    if lat is not None and lat >= 91.0:
        return JSONResponse(
            status_code=400,
            content={
                "error": "Outside all geofence zones",
                "distance_meters": 450,
                "nearest_zone": "Head Office",
            },
        )
    key = _attendance_key(emp)
    row = MOCK_ATTENDANCE_TODAY.get(key)
    if row and row.get("checkin_time") and not row.get("checkout_time"):
        return JSONResponse(status_code=400, content={"error": "Already checked in today"})
    now = datetime.now(TZ)
    now_iso = now.isoformat()
    MOCK_ATTENDANCE_TODAY[key] = {
        "status": "present",
        "checkin_time": now_iso,
        "checkout_time": None,
        "hours_worked": None,
        "zone_name": "Head Office",
    }
    return {
        "message": "Checked in successfully",
        "status": "present",
        "checkin_time": now_iso,
        "zone_name": "Head Office",
    }


@app.post("/api/attendance/checkout")
async def mock_checkout(body: dict = Body(...)):
    emp = body.get("employee_id") or MOCK_EMP_ID
    key = _attendance_key(emp)
    row = MOCK_ATTENDANCE_TODAY.get(key)
    if not row or not row.get("checkin_time"):
        return JSONResponse(status_code=400, content={"error": "No check-in found for today"})
    if row.get("checkout_time"):
        return JSONResponse(status_code=400, content={"error": "Already checked out"})
    now = datetime.now(TZ)
    checkout_iso = now.isoformat()
    MOCK_ATTENDANCE_TODAY[key] = {
        **row,
        "checkout_time": checkout_iso,
        "hours_worked": 8.2,
    }
    return {
        "message": "Checked out successfully",
        "hours_worked": 8.2,
        "checkout_time": checkout_iso,
    }


@app.get("/api/attendance/today/{employee_id}")
async def mock_today(employee_id: str):
    key = _attendance_key(employee_id)
    if key not in MOCK_ATTENDANCE_TODAY:
        return {
            "status": None,
            "checkin_time": None,
            "checkout_time": None,
            "hours_worked": None,
            "zone_name": None,
        }
    return MOCK_ATTENDANCE_TODAY[key]


@app.get("/api/attendance/{employee_id}")
async def mock_logs(
    _employee_id: str,
    _from_date: str | None = None,
    _to_date: str | None = None,
    page: int = 1,
    limit: int = 30,
):
    return {
        "data": [
            {
                "id": "log-1",
                "date": "2025-05-10",
                "checkin_time": "09:02",
                "checkout_time": "18:05",
                "hours_worked": 8.05,
                "status": "present",
                "zone_name": "Head Office",
            },
            {
                "id": "log-2",
                "date": "2025-05-09",
                "checkin_time": "09:45",
                "checkout_time": "18:10",
                "hours_worked": 8.41,
                "status": "late",
                "zone_name": "Head Office",
            },
            {
                "id": "log-3",
                "date": "2025-05-08",
                "checkin_time": None,
                "checkout_time": None,
                "hours_worked": None,
                "status": "absent",
                "zone_name": None,
            },
        ],
        "total": 3,
        "page": page,
        "limit": limit,
    }


# --- DASHBOARD -------------------------------------------------------------
@app.get("/api/dashboard/employee/{employee_id}")
async def mock_emp_dashboard(employee_id: str):
    today = date.today()
    key = _attendance_key(employee_id)
    today_row = MOCK_ATTENDANCE_TODAY.get(key)
    if not today_row:
        today_payload = {
            "status": None,
            "checkin_time": None,
            "checkout_time": None,
            "hours_worked": None,
            "zone_name": None,
        }
    else:
        ci = today_row.get("checkin_time")
        co = today_row.get("checkout_time")
        today_payload = {
            "status": today_row.get("status"),
            "checkin_time": (ci[11:16] if isinstance(ci, str) and len(ci) >= 16 else ci),
            "checkout_time": (co[11:16] if isinstance(co, str) and len(co) >= 16 else co),
            "hours_worked": today_row.get("hours_worked"),
            "zone_name": today_row.get("zone_name"),
        }

    return {
        "profile": {
            "full_name": "Rahul Mehta",
            "employee_id": "EMP-001",
            "department": "Operations",
            "designation": "Manager",
            "shift_start": "09:00",
            "shift_end": "18:00",
        },
        "today": today_payload,
        "this_month": {
            "present": 18,
            "absent": 2,
            "late": 3,
            "attendance_rate": 90,
        },
        "leave_balance": [
            {
                "type": "Casual Leave",
                "code": "CL",
                "color": "#4f8ef7",
                "total": 12,
                "used": 4,
                "remaining": 8,
            },
            {
                "type": "Sick Leave",
                "code": "SL",
                "color": "#10b981",
                "total": 8,
                "used": 2,
                "remaining": 6,
            },
        ],
        "recent_logs": _build_recent_logs_employee_dashboard(),
        "upcoming_leaves": [
            {
                "type": "Casual Leave",
                "from_date": (today + timedelta(days=5)).isoformat(),
                "to_date": (today + timedelta(days=6)).isoformat(),
                "days_requested": 2,
            },
        ],
    }


@app.get("/api/dashboard/admin")
async def mock_admin_dashboard():
    return {
        "today_summary": {
            "total_employees": 200,
            "present": 162,
            "absent": 18,
            "late": 12,
            "on_leave": 5,
            "not_checked_in": 3,
        },
        "by_office": [
            {"zone_name": "Head Office", "present": 95, "total": 110},
            {"zone_name": "Branch - Indore", "present": 67, "total": 90},
        ],
        "department_breakdown": [
            {"department": "Operations", "present": 45, "total": 52, "rate": 87},
            {"department": "Sales", "present": 38, "total": 45, "rate": 84},
        ],
        "recent_activity": [
            {
                "employee_name": "Rahul Mehta",
                "action": "Checked In",
                "time": "09:02",
                "zone": "Head Office",
            },
            {
                "employee_name": "Priya Sharma",
                "action": "Checked In",
                "time": "09:08",
                "zone": "Branch - Indore",
            },
        ],
        "pending_leaves_count": 7,
    }


# --- EMPLOYEES -------------------------------------------------------------
@app.get("/api/employees")
async def mock_employees(
    _department: str | None = None,
    _status: str | None = None,
    page: int = 1,
    limit: int = 50,
):
    return {
        "data": [
            {
                "id": "emp-1",
                "full_name": "Rahul Mehta",
                "employee_id": "EMP-001",
                "department": "Operations",
                "designation": "Manager",
                "shift_start": "09:00",
                "shift_end": "18:00",
                "is_active": True,
                "is_verified": True,
            },
            {
                "id": "emp-2",
                "full_name": "Priya Sharma",
                "employee_id": "EMP-002",
                "department": "Sales",
                "designation": "Executive",
                "shift_start": "10:00",
                "shift_end": "19:00",
                "is_active": True,
                "is_verified": True,
            },
        ],
        "total": 2,
        "page": page,
        "limit": limit,
    }


@app.get("/api/employees/pending")
async def mock_pending():
    return [
        {
            "id": "emp-99",
            "full_name": "New Employee",
            "email": "new@company.com",
            "created_at": "2025-05-10T08:00:00Z",
        },
    ]


@app.post("/api/employees/{employee_id}/verify")
async def mock_verify(_employee_id: str):
    return {"message": "Employee verified and activated", "employee_id": "EMP-042"}


@app.put("/api/employees/{employee_id}")
async def mock_update_employee(_employee_id: str, _body: dict = Body(...)):
    return {"message": "Profile updated"}


@app.post("/api/employees/{employee_id}/promote")
async def mock_promote(_employee_id: str, body: dict = Body(...)):
    return {"message": f"Role updated to {body.get('role')}"}


# --- LEAVE ----------------------------------------------------------------
@app.post("/api/leave/apply")
async def mock_apply(_body: dict = Body(...)):
    return {
        "message": "Leave application submitted",
        "leave_id": "leave-new-001",
        "days_requested": 2,
    }


@app.get("/api/leave/my/{employee_id}")
async def mock_my_leaves(_employee_id: str):
    return [
        {
            "id": "leave-1",
            "type": "Casual Leave",
            "from_date": "2025-05-12",
            "to_date": "2025-05-13",
            "days_requested": 2,
            "reason": "Personal",
            "status": "pending",
            "rejection_note": None,
            "applied_at": "2025-05-09",
        },
        {
            "id": "leave-2",
            "type": "Sick Leave",
            "from_date": "2025-04-15",
            "to_date": "2025-04-15",
            "days_requested": 1,
            "reason": "Fever",
            "status": "approved",
            "rejection_note": None,
            "applied_at": "2025-04-14",
        },
    ]


@app.get("/api/leave/all")
async def mock_all_leaves(
    status: str | None = None,
    _department: str | None = None,
    page: int = 1,
    limit: int = 20,
):
    leaves = [
        {
            "id": "leave-1",
            "employee_name": "Rahul Mehta",
            "employee_id": "EMP-001",
            "department": "Operations",
            "type": "Casual Leave",
            "from_date": "2025-05-12",
            "to_date": "2025-05-13",
            "days_requested": 2,
            "reason": "Personal",
            "status": "pending",
        },
        {
            "id": "leave-2",
            "employee_name": "Priya Sharma",
            "employee_id": "EMP-002",
            "department": "Sales",
            "type": "Sick Leave",
            "from_date": "2025-05-08",
            "to_date": "2025-05-08",
            "days_requested": 1,
            "reason": "Fever",
            "status": "approved",
        },
        {
            "id": "leave-3",
            "employee_name": "Alex Kumar",
            "employee_id": "EMP-003",
            "department": "Operations",
            "type": "Earned Leave",
            "from_date": "2025-04-01",
            "to_date": "2025-04-03",
            "days_requested": 3,
            "reason": "Personal work",
            "status": "rejected",
        },
    ]
    if status:
        leaves = [l for l in leaves if l["status"] == status]
    total = len(leaves)
    start = (page - 1) * limit
    page_rows = leaves[start : start + limit]
    return {"data": page_rows, "total": total, "page": page, "limit": limit}


@app.get("/api/leave/balance/{employee_id}")
async def mock_balance(_employee_id: str):
    return [
        {
            "leave_type_id": "00000000-0000-4000-8000-000000000001",
            "leave_type": "Casual Leave",
            "code": "CL",
            "color": "#4f8ef7",
            "total_days": 12,
            "used_days": 4,
            "remaining": 8,
        },
        {
            "leave_type_id": "00000000-0000-4000-8000-000000000002",
            "leave_type": "Sick Leave",
            "code": "SL",
            "color": "#10b981",
            "total_days": 8,
            "used_days": 2,
            "remaining": 6,
        },
        {
            "leave_type_id": "00000000-0000-4000-8000-000000000003",
            "leave_type": "Earned Leave",
            "code": "EL",
            "color": "#f59e0b",
            "total_days": 15,
            "used_days": 6,
            "remaining": 9,
        },
    ]


@app.put("/api/leave/{leave_id}/approve")
async def mock_approve(_leave_id: str):
    return {"message": "Leave approved"}


@app.put("/api/leave/{leave_id}/reject")
async def mock_reject(_leave_id: str, _body: dict = Body(...)):
    return {"message": "Leave rejected"}


# --- HOLIDAYS --------------------------------------------------------------
@app.get("/api/holidays")
async def mock_holidays():
    return [
        {"id": "h1", "name": "Republic Day", "date": "2025-01-26", "type": "national"},
        {"id": "h2", "name": "Holi", "date": "2025-03-14", "type": "festival"},
        {"id": "h3", "name": "Independence Day", "date": "2025-08-15", "type": "national"},
        {"id": "h4", "name": "Diwali", "date": "2025-10-20", "type": "festival"},
    ]


@app.post("/api/holidays")
async def mock_add_holiday(_body: dict = Body(...)):
    return {"message": "Holiday added", "id": "new-holiday-uuid"}


@app.delete("/api/holidays/{holiday_id}")
async def mock_delete_holiday(_holiday_id: str):
    return {"message": "Holiday removed"}


# --- GEOFENCE --------------------------------------------------------------
@app.get("/api/geofence/zones")
async def mock_zones():
    return [
        {
            "id": "zone-1",
            "name": "Head Office",
            "latitude": 22.7196,
            "longitude": 75.8577,
            "radius_meters": 200,
            "is_active": True,
        },
        {
            "id": "zone-2",
            "name": "Branch - Indore",
            "latitude": 22.7340,
            "longitude": 75.8726,
            "radius_meters": 150,
            "is_active": True,
        },
    ]


@app.post("/api/geofence/zones")
async def mock_add_zone(_body: dict = Body(...)):
    return {"message": "Zone added", "id": "new-zone-uuid"}


@app.put("/api/geofence/zones/{zone_id}")
async def mock_update_zone(_zone_id: str, _body: dict = Body(...)):
    return {"message": "Zone updated"}


@app.delete("/api/geofence/zones/{zone_id}")
async def mock_delete_zone(_zone_id: str):
    return {"message": "Zone deactivated"}


# --- REPORTS ---------------------------------------------------------------
@app.get("/api/reports/attendance/csv")
async def mock_attendance_csv():
    csv = (
        "employee_id,full_name,department,date,checkin_time,checkout_time,hours_worked,status,zone_name\n"
        "EMP-001,Rahul Mehta,Operations,2025-05-10,09:02,18:05,8.05,present,Head Office\n"
        "EMP-002,Priya Sharma,Sales,2025-05-10,09:15,18:10,8.55,present,Branch - Indore\n"
    )
    return PlainTextResponse(
        csv,
        headers={"Content-Disposition": 'attachment; filename="attendance.csv"'},
    )


@app.get("/api/reports/leave/csv")
async def mock_leave_csv():
    csv = (
        "employee_id,full_name,department,leave_type,from_date,to_date,days_requested,status\n"
        "EMP-001,Rahul Mehta,Operations,Casual Leave,2025-05-12,2025-05-13,2,approved\n"
    )
    return PlainTextResponse(
        csv,
        headers={"Content-Disposition": 'attachment; filename="leaves.csv"'},
    )


@app.get("/api/reports/summary")
async def mock_summary(_month: str = "2025-05"):
    return {
        "total_employees": 200,
        "avg_attendance_rate": 87,
        "total_late": 34,
        "total_absent": 28,
        "department_breakdown": [
            {"department": "Operations", "rate": 89},
            {"department": "Sales", "rate": 84},
        ],
        "top_absentees": [{"full_name": "Some Employee", "absent_days": 5}],
    }
