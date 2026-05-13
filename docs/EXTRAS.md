# AttendTrack Pro — Nice to Have
### Only touch these after all 18 steps in BUILD_WORKFLOW.md are done and the app is live.
### Ordered by actual impact for a real 200-person company.

---

## Tier 1 — High Impact, Low Effort

### 1. WhatsApp Notifications (via Twilio or 2Factor)
**Why it matters:** In India, employees are far more likely to open a WhatsApp message than an email. Leave approvals, reminders, and daily summaries via WhatsApp will get dramatically better engagement.

**What to build:**
- Leave approval/rejection notification via WhatsApp (replace or supplement the Resend email)
- Morning reminder at 8:45 AM if employee hasn't checked in (optional, configurable per employee)

**How:** Twilio WhatsApp API (free sandbox for testing, $0.005/message in production) or 2Factor.in (cheaper for India).

**Effort:** ~4-6 hours. Add to `email_service.py` as a parallel notification channel.

---

### 2. Bulk Employee Import via CSV
**Why it matters:** Your father may need to onboard 200 employees at once rather than waiting for each to self-register and get verified one by one.

**What to build:**
- Super Admin uploads a CSV: `full_name, email, department, designation, shift_start, shift_end`
- Backend creates Supabase Auth accounts with a temp password and triggers profile creation
- All imported employees get `is_verified=true` automatically (admin vouches for them)
- Employees receive an email with their temp password and a prompt to change it

**How:** `POST /api/employees/bulk-import` accepts a CSV file. Use Python's `csv` module + Supabase Admin API.

**Effort:** ~5-8 hours. Worth doing if onboarding more than 20 employees at once.

---

### 3. Late Arrival / Absence Alerts for Admin
**Why it matters:** Right now the admin has to open the dashboard to see who's missing. A daily 10:00 AM alert listing employees who haven't checked in is far more actionable.

**What to build:**
- APScheduler job at 10:00 AM IST: find employees with shift_start before 10:00 who have not checked in
- Send admin a summary email (or WhatsApp): "3 employees not yet checked in: Rahul Mehta, ..."

**How:** Add one job to `scheduler.py`. Uses existing `email_service.py`.

**Effort:** ~2-3 hours.

---

### 4. Monthly Attendance Summary Email to Admin
**Why it matters:** At the end of every month, the admin (your father) should automatically get a PDF or email summary without having to log in and download a report.

**What to build:**
- APScheduler job on 1st of each month: generate summary for previous month
- Send to admin: attendance rate, top 5 absentees, department breakdown
- Optional: attach the attendance CSV

**How:** Extend `scheduler.py`. Reuse the `/api/reports/summary` logic.

**Effort:** ~3-4 hours.

---

## Tier 2 — Medium Impact, Medium Effort

### 5. PWA Install Prompt
**Why it matters:** Employees on Android can add the app to their home screen and it behaves like a native app. Makes daily check-in much smoother.

**What to build:**
- `public/manifest.json` is already in the file structure
- Fill it in with name, icons, theme_color, display: "standalone"
- Add a service worker (Vite PWA plugin handles this automatically)
- Show a banner "Add to Home Screen" on first visit

**How:** `npm install vite-plugin-pwa` — configures everything automatically.

**Effort:** ~2-3 hours.

---

### 6. Department-Level Admin (Delegated Admin)
**Why it matters:** In a 200-person company, one admin approving all leaves becomes a bottleneck. Department heads may need their own limited admin view.

**What to build:**
- Add `managed_department TEXT` field to profiles
- A "Department Admin" can only see and approve leaves for their own department
- Super Admin assigns department to a Department Admin

**How:** Add `managed_department` to profiles table. Add middleware check in `/api/leave/all` and `/api/leave/{id}/approve` to filter by department.

**Effort:** ~6-8 hours. Involves schema change, migrate carefully.

---

### 7. Employee Self-Service: Edit Own Profile
**Why it matters:** Employees should be able to update their own phone number without going to admin.

**What to build:**
- Employee can edit: phone number only
- All other fields (department, shift, designation) remain admin-only

**How:** Add a `PUT /api/profile/me` endpoint that only allows phone field updates.

**Effort:** ~1-2 hours. Easy add.

---

## Tier 3 — Drop Unless Specifically Requested

The following were in the original hackathon EXTRAS.md but are **not relevant** for a professional company attendance tool:

- ❌ Streak gamification and leaderboards (this is for employees, not a game)
- ❌ Shift swap requests (adds complexity, low ROI for most companies)
- ❌ QR code check-in (geofence + selfie is already better and more tamper-proof)
- ❌ Slack/Discord integration (company probably uses WhatsApp)

---

## How to Add an Extra

1. Build it on a feature branch: `git checkout -b feat/whatsapp-notifications`
2. Add the new endpoint to `API_CONTRACT.md` before writing code
3. Add the mock response to `mock_server.py` first
4. Build backend, then frontend
5. Test end-to-end
6. Merge to dev: `git checkout dev && git merge feat/whatsapp-notifications`
7. Commit: `git commit -m "feat: WhatsApp leave notifications via Twilio"`
