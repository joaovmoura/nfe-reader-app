import type { Session } from '@supabase/supabase-js'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext } from './AuthContext.ts'
import { RequireAuth } from './RequireAuth.tsx'

function render(session: Session | null | undefined) {
  return renderToString(
    <AuthContext.Provider value={{ session }}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<p>tela de login</p>} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<p>área interna</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RequireAuth', () => {
  it('mostra carregando enquanto a sessão salva é lida', () => {
    expect(render(undefined)).toContain('Carregando')
  })

  it('não mostra a área interna sem sessão', () => {
    expect(render(null)).not.toContain('área interna')
  })

  it('mostra a área interna com sessão', () => {
    expect(render({} as Session)).toContain('área interna')
  })
})
