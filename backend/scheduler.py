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
