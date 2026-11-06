import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthContext.ts'

// Wraps the internal routes: without a session, send the user to the login.
export function RequireAuth() {
  const { session } = useAuth()
  const location = useLocation()

  if (session === undefined) return <p className="loading">Carregando…</p>
  if (session === null) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
