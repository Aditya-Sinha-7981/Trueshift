# JWT verification and role-check FastAPI dependencies
# Usage: current_user = Depends(get_current_user)
#        admin_user   = Depends(require_admin)
#        super_user   = Depends(require_super_admin)
from fastapi import Depends, HTTPException, Header
from utils.supabase_client import supabase

async def get_current_user(authorization: str = Header(...)):
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
