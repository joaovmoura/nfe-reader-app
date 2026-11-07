import { describe, expect, it } from 'vitest'
import { accessKeyCheckDigit, normalizeAccessKey, parseAccessKey } from './accessKey.ts'

// Fake key (not a real receipt): PB, 2026-11, CNPJ 11222333000181, NFC-e, serie 2, nNF 1234.
const first43 = '2526111122233300018165002000001234112345678'
const validKey = first43 + accessKeyCheckDigit(first43)

describe('normalizeAccessKey', () => {
  it('remove pontos, traços, barras e espaços', () => {
    expect(normalizeAccessKey('25-2611-11.222.333/0001-81 65')).toBe('2526111122233300018165')
  })
})

describe('accessKeyCheckDigit', () => {
  it('vale 0 quando o resto da divisão por 11 é 0 ou 1', () => {
    // 43 zeros: sum 0 -> rest 0 -> 0
    expect(accessKeyCheckDigit('0'.repeat(43))).toBe(0)
  })

  it('calcula o dígito com pesos 2 a 9 da direita para a esquerda', () => {
    // '1' at the last position: sum 2 -> rest 2 -> 11 - 2 = 9
    expect(accessKeyCheckDigit('0'.repeat(42) + '1')).toBe(9)
  })
})

describe('parseAccessKey', () => {
  it('extrai os campos de uma chave válida, mesmo formatada', () => {
    const formatted = validKey.replace(/(\d{4})/g, '$1 ')
    const result = parseAccessKey(formatted)
    expect(result).toEqual({
      ok: true,
      key: {
        digits: validKey,
        uf: '25',
        yearMonth: '2611',
        cnpj: '11222333000181',
        model: '65',
        series: 2,
        number: 1234,
      },
    })
  })

  it('recusa chave com menos ou mais de 44 dígitos', () => {
    expect(parseAccessKey(validKey.slice(0, 43))).toEqual({ ok: false, reason: 'length' })
    expect(parseAccessKey(validKey + '0')).toEqual({ ok: false, reason: 'length' })
    expect(parseAccessKey('')).toEqual({ ok: false, reason: 'length' })
  })

  it('recusa chave com dígito verificador errado', () => {
    const wrong = first43 + ((Number(validKey[43]) + 1) % 10)
    expect(parseAccessKey(wrong)).toEqual({ ok: false, reason: 'check_digit' })
  })
})
