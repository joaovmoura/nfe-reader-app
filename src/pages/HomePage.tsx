import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext.ts'
import { supabase } from '../lib/supabase.ts'

export default function HomePage() {
  const { session } = useAuth()

  return (
    <main className="page">
      <h1>Olá!</h1>
      <p>Envie o cupom fiscal e acompanhe os preços do mercado.</p>
      <nav className="menu">
        <Link className="button" to="/enviar">
          Enviar cupom
        </Link>
        <Link className="button secondary" to="/compras">
          Compras
        </Link>
        <Link className="button secondary" to="/mercados">
          Mercados
        </Link>
      </nav>
      <p className="muted">Conectado como {session?.user.email}</p>
      <button type="button" className="secondary" onClick={() => supabase.auth.signOut()}>
        Sair
      </button>
    </main>
  )
}
