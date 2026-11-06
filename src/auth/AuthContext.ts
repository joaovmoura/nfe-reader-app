import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

// undefined = still checking the stored session; null = logged out.
export type AuthState = { session: Session | null | undefined }

export const AuthContext = createContext<AuthState>({ session: undefined })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
