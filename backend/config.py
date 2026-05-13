from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    resend_api_key: str
    from_email: str = "noreply@attendtrack.com"
    cloudinary_cloud_name: str
    cloudinary_api_key: str
    cloudinary_api_secret: str
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    scheduler_timezone: str = "Asia/Kolkata"

    class Config:
        env_file = ".env"

settings = Settings()
