# AttendTrack Pro — Solo Developer Reference
### Day-to-day commands, environment setup, testing checklists, and unblocking yourself.

---

## Your Stack at a Glance

| What | Where | Free Tier |
|---|---|---|
| Frontend (React + Vite) | Vercel | Unlimited deploys, 100GB bandwidth/month |
| Backend (FastAPI) | Railway | $5 free credit/month (enough for low traffic) |
| Database + Auth | Supabase | 500MB DB, 50MB file uploads |
| Selfie Storage | Cloudinary | 25GB storage, 25GB bandwidth/month |
| Email | Resend | 3,000 emails/month |
| AI (insights) | Gemini 2.0 Flash | 1,500 requests/day free |

**Total monthly cost: ₹0 within free tier limits.**
Only thing that will eventually cost money: Railway ($5/month) after free credit runs out.

---

## Local Development — Daily Commands

```bash
# Terminal 1 — Mock server (while building frontend, Steps 1-12)
cd mock_api && uvicorn mock_server:app --reload --port 8001

# Terminal 2 — Real backend (Steps 13+)
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend && npm run dev

# Switch frontend from mock to real backend:
# In frontend/.env, change VITE_API_URL from :8001 to :8000
# Vite hot-reloads. No restart needed.

# Test on your phone (same WiFi):
# Find your laptop IP: ipconfig getifaddr en0 (Mac)
# Open http://192.168.x.x:5173 on your phone

# Test on phone over the internet (different network):
ngrok http 5173
# Paste the ngrok URL into your phone browser
```

---

## Environment Setup (Do This Once)

### Python
```bash
# Install pyenv (Mac)
brew install pyenv
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
source ~/.zshrc

# Install exact Python version
pyenv install 3.11.9
cd backend
pyenv local 3.11.9
python --version  # Must show 3.11.9

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### React + Vite + Tailwind
```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install react-router-dom @supabase/supabase-js date-fns
```

### Environment Files

`backend/.env` — never commit this:
```
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
GEMINI_API_KEY=AIza...
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@yourdomain.com
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
SCHEDULER_TIMEZONE=Asia/Kolkata
```

`frontend/.env`:
```
VITE_API_URL=http://localhost:8001
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=attendtrack_selfies
```

**Supabase key confusion (very common mistake):**
- `service_role` key → `backend/.env` as `SUPABASE_SERVICE_KEY` → bypasses RLS
- `anon` key → `frontend/.env` as `VITE_SUPABASE_ANON_KEY` → respects RLS
- Both start with `eyJ...` — copy carefully from Project Settings → API → Legacy API Keys
- **Never put service_role in the frontend. Never.**

---

## Supabase Setup Checklist

```
[ ] Create project at supabase.com
[ ] Run entire SCHEMA.sql in SQL Editor
[ ] Run verification queries at the bottom — confirm 5 leave types exist
[ ] Confirm trigger on_auth_user_created exists
[ ] Disable RLS for development (uncomment the disable block in SCHEMA.sql)
[ ] Copy Project URL and both keys to .env files
[ ] Test: manually insert a profiles row → confirm it appears
[ ] RLS: ENABLE on Step 18 (production deploy) only
```

**Creating your super admin account:**
```sql
-- After registering on the app, run this in Supabase SQL Editor:
UPDATE profiles
SET role = 'super_admin', is_verified = true
WHERE id = 'paste-your-uuid-here';
```
Find your UUID: Supabase dashboard → Authentication → Users → copy the ID.

---

## Cloudinary Setup Checklist

```
[ ] Create free account at cloudinary.com
[ ] Copy Cloud Name, API Key, API Secret to backend/.env
[ ] Settings → Upload → Add upload preset
      Name: attendtrack_selfies
      Signing mode: Unsigned   ← important, allows frontend direct upload
      Folder: attendtrack/selfies
[ ] Copy Cloud Name and preset name to frontend/.env
[ ] Test: upload one image via dashboard → confirm it appears
```

---

## Feature Testing Checklists

Run through these after building each feature. Do not skip.

### Auth
- [ ] Register with new email → success message shown, no auto-login
- [ ] Try logging in as unverified account → 403 → /pending page
- [ ] Admin verifies the account via Pending tab → account gets email
- [ ] Login as newly verified account → works, lands on dashboard
- [ ] Login as admin → lands on admin dashboard
- [ ] Login as super_admin → lands on admin dashboard, sees extra super-admin-only nav items
- [ ] Refresh page → still logged in
- [ ] Delete auth_token from localStorage → redirected to /login
- [ ] Employee tries to navigate to /admin → redirected to /login

### Check-in (test on real phone)
- [ ] Camera opens and shows live preview
- [ ] Selfie captures and shows preview image
- [ ] "Retake" button works
- [ ] "Use this" triggers location request
- [ ] Inside zone → check-in succeeds, shows confirmation with zone name
- [ ] Outside zone → shows GeofenceMap SVG with distance
- [ ] Trying to check in twice → "Already checked in today" error
- [ ] Check-out button appears after check-in
- [ ] Check-out updates the record correctly
- [ ] Selfie appears in Cloudinary dashboard under attendtrack/selfies/{employee_id}/
- [ ] attendance_logs row has selfie_url, zone_id, zone_name all set

### Employee Verification (admin flow)
- [ ] New registration appears in Pending tab immediately
- [ ] "Verify & Activate" fires API call
- [ ] Card disappears from pending list after verification
- [ ] Employee receives activation email
- [ ] employee_id is assigned (EMP-XXX format)
- [ ] Leave balance rows created for all leave types

### Leave Flow
- [ ] Apply for leave → appears in My Applications as "pending"
- [ ] Admin sees it in Leave Management → Pending tab
- [ ] Admin approves → status changes to "approved" on both sides
- [ ] `leave_balances.used_days` incremented in DB
- [ ] Approval email arrives (check spam)
- [ ] Admin rejects with note → "rejected" status + note visible to employee
- [ ] Rejection email arrives with the note
- [ ] Applying for more days than balance → warning shown, form blocked

### Admin Dashboard
- [ ] Today's summary shows real counts from DB
- [ ] Office breakdown table shows correct per-office counts
- [ ] Recent activity feed updates when employees check in
- [ ] Pending leaves count badge is accurate

### Reports
- [ ] Attendance CSV downloads without error
- [ ] CSV opens in Excel with all columns present
- [ ] No "null" strings in CSV — only blank cells
- [ ] Leave CSV downloads and opens correctly
- [ ] Monthly summary shows real aggregated data

### AI Insight
- [ ] Admin opens employee profile → spinner shows
- [ ] After 2-4 seconds → insight text appears (must reference real data)
- [ ] `insights_cache` table has a row in Supabase
- [ ] Second visit loads instantly (from cache, no Gemini call)
- [ ] "Refresh" button forces new generation

---

## Deployment Checklist

### Railway (Backend)
```
[ ] Push backend/ to GitHub
[ ] railway.app → New Project → Deploy from GitHub → select backend/ as root
[ ] Start command: uvicorn main:app --host 0.0.0.0 --port $PORT
[ ] Add all environment variables from .env (one by one)
[ ] Wait for deploy → test /health endpoint → { "status": "ok" }
[ ] Copy Railway public URL
```

### Vercel (Frontend)
```
[ ] vercel.com → Import from GitHub
[ ] Root directory: frontend/
[ ] Environment variables:
      VITE_API_URL = https://your-railway-url
      VITE_SUPABASE_URL = ...
      VITE_SUPABASE_ANON_KEY = ...
      VITE_CLOUDINARY_CLOUD_NAME = ...
      VITE_CLOUDINARY_UPLOAD_PRESET = attendtrack_selfies
[ ] Deploy → copy Vercel URL
```

### Post-Deploy
```
[ ] Update FRONTEND_URL in Railway env vars → redeploy backend
[ ] Supabase: Auth → URL Configuration → add Vercel URL to allowed redirect URLs
[ ] Enable RLS on all tables (SCHEMA.sql enable block)
[ ] Create super admin in production (UPDATE profiles SET ... in Supabase SQL Editor)
[ ] Full end-to-end test on https:// URLs (not localhost)
[ ] Test check-in on real phone on cellular data (not WiFi)
[ ] Test leave flow end-to-end including emails
[ ] Confirm Cloudinary receives selfies from production
```

---

## When You Are Blocked

```
Blocked < 15 min:
  → Read the full error message carefully. Most blocks are typos,
    missing imports, or wrong field names.
  → FastAPI errors are descriptive. React errors have line numbers. Use them.

Blocked 15–30 min:
  → Stop. Read the relevant section of API_CONTRACT.md or CORE.md again.
  → The contract is the source of truth. If your code disagrees with it,
    your code is wrong.

Blocked 30+ min:
  → Open Claude Code. Paste the exact error message.
    Paste the relevant function. Ask for the specific fix.
    Never say "it doesn't work" — paste the actual error.

Blocked 2+ hours:
  → Mark with a TODO comment and skip it.
  → Build the next thing. A working app with 9 features beats a broken
    app stuck on feature 4.
  → Come back with fresh eyes.
```

---

## Git Workflow

```bash
# Daily work
git add .
git commit -m "feat: add leave approval endpoint"

# Tag stable checkpoints
git tag -a v0.2 -m "Phase 2 done: full employee flow"

# If you break something
git stash                     # save broken state, restore last commit
git diff HEAD~1               # see what changed in last commit
git reset HEAD~1              # un-commit but keep changes (soft reset)

# If something was working 3 commits ago and now isn't
git log --oneline             # find the last good commit hash
git checkout abc1234 -- path/to/specific/file.py   # restore one file
```

Commit prefixes:
- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — config, deps, env
- `style:` — UI/CSS only
- `refactor:` — restructure without behaviour change

---

## Capacity Reference

200 employees, 1 year of data:

| Data | Rows | Size |
|---|---|---|
| attendance_logs | ~62,400 | ~30MB |
| leaves | ~2,400 | ~2MB |
| profiles | 200 | <1MB |
| Everything else | — | ~5MB |
| **Total DB** | | **~38MB** (Supabase free: 500MB ✓) |
| Selfies (30-day rolling, 80KB each) | ~4,000 | ~320MB (Cloudinary free: 25GB ✓) |

You have significant headroom on all services within free tier.
