import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.ts'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (veja .env.example).')
}

// Single client for the whole app. It stores the session in localStorage and
// refreshes the token on its own, so the login survives closing the PWA.
export const supabase = createClient<Database>(url, key)
