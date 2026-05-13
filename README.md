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
