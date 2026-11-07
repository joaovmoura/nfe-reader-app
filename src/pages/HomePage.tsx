import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext.ts'
import { supabase } from '../lib/supabase.ts'

export default function HomePage() {
  const { session } = useAuth()

  return (
    <main className="page">
      <h1>Olá!</h1>
      <p>Envie o cupom fiscal e acompanhe os preços do mercado.</p>
      <p>
        <Link className="button" to="/enviar">
          Enviar cupom
        </Link>
      </p>
      <p className="muted">Conectado como {session?.user.email}</p>
      <button type="button" onClick={() => supabase.auth.signOut()}>
        Sair
      </button>
    </main>
  )
}
