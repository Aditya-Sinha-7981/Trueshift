# All Pydantic request/response models go here
# See CORE.md for full endpoint specs — build models to match those shapes exactly
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

# Example — expand as you build each endpoint:
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
