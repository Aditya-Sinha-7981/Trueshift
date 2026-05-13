// Supabase JS client singleton — use for auth session if needed
// import { supabase } from './services/supabaseClient'
import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
