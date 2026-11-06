import type { Session } from '@supabase/supabase-js'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/AuthContext.ts'
import HomePage from './HomePage.tsx'

vi.mock('../lib/supabase.ts', () => ({ supabase: { auth: { signOut: vi.fn() } } }))

const session = { user: { email: 'casa@local.test' } } as Session

describe('HomePage', () => {
  it('cumprimenta em português e mostra a conta conectada', () => {
    const html = renderToString(
      <AuthContext.Provider value={{ session }}>
        <HomePage />
      </AuthContext.Provider>,
    )
    expect(html).toContain('Olá')
    expect(html).toContain('casa@local.test')
  })
})
