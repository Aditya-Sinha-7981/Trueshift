# Supabase singleton — import this everywhere, never create a new client yourself
# Usage: from utils.supabase_client import supabase
from supabase import create_client, Client
from config import settings

supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)
