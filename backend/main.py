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
