import { useAuth } from '../auth/AuthContext.ts'
import { supabase } from '../lib/supabase.ts'

export default function HomePage() {
  const { session } = useAuth()

  return (
    <main className="page">
      <h1>Olá!</h1>
      <p>Em breve: envie o cupom fiscal e acompanhe os preços do mercado.</p>
      <p className="muted">Conectado como {session?.user.email}</p>
      <button type="button" onClick={() => supabase.auth.signOut()}>
        Sair
      </button>
    </main>
  )
}
