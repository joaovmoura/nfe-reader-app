import { describe, expect, it } from 'vitest'
import { lineTotal, parseDecimal } from './format.ts'

describe('parseDecimal', () => {
  it('aceita vírgula ou ponto como separador decimal', () => {
    expect(parseDecimal('0,214')).toBe(0.214)
    expect(parseDecimal('25.90')).toBe(25.9)
    expect(parseDecimal(' 1.234,56 ')).toBe(1234.56)
    expect(parseDecimal('3')).toBe(3)
  })

  it('recusa texto que não é número', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('-2')).toBeNull()
    expect(parseDecimal('1,2,3')).toBeNull()
  })
})

describe('lineTotal', () => {
  it('arredonda para centavos', () => {
    expect(lineTotal(0.094, 36)).toBe(3.38)
    expect(lineTotal(0.122, 30)).toBe(3.66)
  })
})
