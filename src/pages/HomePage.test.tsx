import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import HomePage from './HomePage.tsx'

describe('HomePage', () => {
  it('cumprimenta em português', () => {
    expect(renderToString(<HomePage />)).toContain('Olá')
  })
})
