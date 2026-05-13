# AttendTrack Mock Server
# Full implementation is in CORE.md under "Mock Server"
# Paste the complete mock_server.py code from CORE.md here.
#
# Run with:
#   cd mock_api && pip install fastapi uvicorn
#   uvicorn mock_server:app --reload --port 8001
#
# frontend/.env must have: VITE_API_URL=http://localhost:8001

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health():
    return {"status": "ok — paste full mock server from CORE.md"}
