import { describe, expect, it } from 'vitest'
import { accessKeyCheckDigit } from './accessKey.ts'
import { checkReceipt, receiptSchema, type Receipt } from './receipt.ts'

// Fake receipt (not a real one): CNPJ 11222333000181, NFC-e, Nov 2026.
const keyBody = '2526111122233300018165002000001234112345678'
const accessKey = keyBody + accessKeyCheckDigit(keyBody)

const raw = {
  market: {
    cnpj: '11.222.333/0001-81',
    legal_name: 'MERCADO TESTE LTDA',
    address: 'Rua Teste, 1, Campina Grande',
  },
  access_key: accessKey.replace(/(\d{4})/g, '$1 '),
  issued_at: '2026-11-03T18:13:36-03:00',
  items: [
    {
      line_number: 1,
      code: '2831',
      description: 'MEL DE ABELHA',
      quantity: 1,
      unit: 'und',
      unit_price: 25,
      total_price: 25,
    },
    {
      line_number: 2,
      code: '399',
      description: 'CALDO DE GALINHA',
      quantity: 0.122,
      unit: 'KG',
      unit_price: 30,
      total_price: 3.66,
    },
    {
      line_number: 3,
      code: '399',
      description: 'CALDO DE GALINHA',
      quantity: 0.118,
      unit: 'KG',
      unit_price: 30,
      total_price: 3.54,
    },
  ],
  products_total: 32.2,
  discount_total: 0,
  paid_total: 32.2,
  payments: [{ method: '20-Pagamento Instantâneo (PIX) –', amount: 32.2 }],
}

const parse = (data: unknown): Receipt => receiptSchema.parse(data)
const codes = (issues: { code: string }[]) => issues.map((issue) => issue.code)

describe('receiptSchema', () => {
  it('normaliza CNPJ, chave, unidade e forma de pagamento', () => {
    const receipt = parse(raw)
    expect(receipt.market.cnpj).toBe('11222333000181')
    expect(receipt.access_key).toBe(accessKey)
    expect(receipt.items[0]!.unit).toBe('UND')
    expect(receipt.payments[0]!.method).toBe('20-Pagamento Instantâneo (PIX)')
  })

  it('descarta campos fora do schema, como um CPF devolvido pela IA', () => {
    const receipt = parse({ ...raw, consumer: { cpf: '987.654.321-00' }, cpf: '98765432100' })
    const json = JSON.stringify(receipt)
    expect(json).not.toMatch(/cpf|consumer/i)
    expect(json).not.toMatch(/987\.?654\.?321/)
  })

  it('assume o fuso -03:00 quando a data vem sem fuso', () => {
    expect(parse({ ...raw, issued_at: '2026-11-03T18:13:36' }).issued_at).toBe(
      '2026-11-03T18:13:36-03:00',
    )
  })

  it('recusa cupom sem itens, com valor negativo ou com tipo errado', () => {
    expect(receiptSchema.safeParse({ ...raw, items: [] }).success).toBe(false)
    expect(receiptSchema.safeParse({ ...raw, paid_total: -1 }).success).toBe(false)
    expect(receiptSchema.safeParse({ ...raw, paid_total: '32,20' }).success).toBe(false)
    expect(
      receiptSchema.safeParse({ ...raw, market: { ...raw.market, cnpj: '123' } }).success,
    ).toBe(false)
  })
})

describe('checkReceipt', () => {
  it('não acusa nada num cupom consistente, com itens a granel repetidos', () => {
    expect(checkReceipt(parse(raw))).toEqual({ errors: [], warnings: [] })
  })

  it('recusa chave incompleta ou com dígito verificador errado', () => {
    expect(codes(checkReceipt(parse({ ...raw, access_key: keyBody })).errors)).toEqual([
      'access_key_length',
    ])
    const wrongDigit = keyBody + ((Number(accessKey[43]) + 1) % 10)
    expect(codes(checkReceipt(parse({ ...raw, access_key: wrongDigit })).errors)).toEqual([
      'access_key_check_digit',
    ])
  })

  it('recusa quando o CNPJ lido não é o da chave', () => {
    const receipt = parse({ ...raw, market: { ...raw.market, cnpj: '99888777000166' } })
    expect(codes(checkReceipt(receipt).errors)).toEqual(['cnpj_mismatch'])
  })

  it('recusa nota que não é NFC-e (modelo 55)', () => {
    const body = keyBody.slice(0, 20) + '55' + keyBody.slice(22)
    const receipt = parse({ ...raw, access_key: body + accessKeyCheckDigit(body) })
    expect(codes(checkReceipt(receipt).errors)).toEqual(['not_nfce'])
  })

  it('avisa, sem recusar, quando as contas não fecham', () => {
    const receipt = parse({
      ...raw,
      issued_at: '2026-10-30T10:00:00-03:00',
      items: [{ ...raw.items[0]!, total_price: 26 }, ...raw.items.slice(1)],
      paid_total: 30,
    })
    const result = checkReceipt(receipt)
    expect(result.errors).toEqual([])
    expect(codes(result.warnings)).toEqual([
      'issued_at_mismatch',
      'item_total_mismatch',
      'products_total_mismatch',
      'paid_total_mismatch',
    ])
  })

  it('tolera arredondamento de centavos no total da linha', () => {
    // 0.094 kg × 36.00 = 3.384 -> printed 3.38
    const item = { ...raw.items[1]!, quantity: 0.094, unit_price: 36, total_price: 3.38 }
    const receipt = parse({
      ...raw,
      items: [raw.items[0]!, item],
      products_total: 28.38,
      paid_total: 28.38,
    })
    expect(checkReceipt(receipt).warnings).toEqual([])
  })

  it('considera o desconto no total pago', () => {
    const receipt = parse({ ...raw, discount_total: 2.2, paid_total: 30 })
    expect(checkReceipt(receipt).warnings).toEqual([])
  })
})
