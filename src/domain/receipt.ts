// Shape of the data extracted from a receipt image, its validation, and the
// consistency checks run before saving. Shared by the Edge Function and Vitest.
import { z } from 'zod'
import { parseAccessKey } from './accessKey.ts'

const digitsOnly = (value: string) => value.replace(/\D/g, '')
const money = z.number().min(0)

/** São Paulo has had no DST since 2019, so a missing offset means -03:00. */
function withOffset(value: string): string {
  return /([+-]\d{2}:?\d{2}|Z)$/.test(value) ? value : `${value}-03:00`
}

// z.object drops unknown keys, so a CPF the model returns anyway is discarded.
export const receiptSchema = z.object({
  market: z.object({
    cnpj: z.string().transform(digitsOnly).pipe(z.string().length(14)),
    legal_name: z.string().trim().min(1),
    address: z.string().trim().min(1).nullable(),
  }),
  access_key: z.string().transform(digitsOnly),
  issued_at: z
    .string()
    .transform(withOffset)
    .pipe(z.iso.datetime({ offset: true })),
  items: z
    .array(
      z.object({
        line_number: z.number().int().positive(),
        code: z.string().trim().min(1).nullable(),
        description: z.string().trim().min(1),
        quantity: z.number().positive(),
        unit: z.string().trim().min(1).toUpperCase(),
        unit_price: money,
        total_price: money,
      }),
    )
    .min(1),
  products_total: money,
  discount_total: money,
  paid_total: money,
  payments: z.array(
    z.object({
      // Drops trailing dashes the print leaves after the method ("20-Pagamento ... (PIX) –").
      method: z
        .string()
        .transform((value) => value.replace(/[\s–—-]+$/u, '').trim())
        .pipe(z.string().min(1)),
      amount: money,
    }),
  ),
})

export type Receipt = z.output<typeof receiptSchema>

/**
 * The same shape as a JSON Schema for Gemini's structured output. Kept by hand
 * because Gemini accepts only a subset of JSON Schema (no patterns).
 */
export const receiptJsonSchema = {
  type: 'object',
  properties: {
    market: {
      type: 'object',
      properties: {
        cnpj: { type: 'string', description: 'CNPJ do emitente, só os 14 dígitos' },
        legal_name: { type: 'string', description: 'Razão social do emitente' },
        address: { type: ['string', 'null'], description: 'Endereço do emitente' },
      },
      required: ['cnpj', 'legal_name', 'address'],
    },
    access_key: { type: 'string', description: 'Chave de acesso, só os 44 dígitos' },
    issued_at: {
      type: 'string',
      format: 'date-time',
      description: 'Data e hora de emissão, ISO 8601 com fuso -03:00',
    },
    items: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          line_number: { type: 'integer', description: 'Posição da linha no cupom, a partir de 1' },
          code: { type: ['string', 'null'], description: 'Código do item como impresso' },
          description: { type: 'string', description: 'Descrição como impressa' },
          quantity: { type: 'number' },
          unit: { type: 'string', description: 'Unidade como impressa: UND, KG, PCT...' },
          unit_price: { type: 'number', description: 'Valor unitário em reais' },
          total_price: { type: 'number', description: 'Valor total da linha em reais' },
        },
        required: [
          'line_number',
          'code',
          'description',
          'quantity',
          'unit',
          'unit_price',
          'total_price',
        ],
      },
    },
    products_total: { type: 'number', description: 'Total dos produtos em reais' },
    discount_total: { type: 'number', description: 'Descontos em reais, 0 se não houver' },
    paid_total: { type: 'number', description: 'Total da nota (valor a pagar) em reais' },
    payments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          method: { type: 'string', description: 'Forma de pagamento como impressa' },
          amount: { type: 'number' },
        },
        required: ['method', 'amount'],
      },
    },
  },
  required: [
    'market',
    'access_key',
    'issued_at',
    'items',
    'products_total',
    'discount_total',
    'paid_total',
    'payments',
  ],
} as const

export type ReceiptIssue = { code: string; message: string }
export type ReceiptCheck = { errors: ReceiptIssue[]; warnings: ReceiptIssue[] }

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Two values printed with 2 decimals differ beyond rounding. */
const differs = (a: number, b: number, tolerance = 0.01) => Math.abs(a - b) > tolerance + 1e-9

/**
 * Errors block saving (the receipt can't be identified or isn't an NFC-e).
 * Warnings are saved anyway and shown for review (RF07), since likely misreads
 * of the image should not lose the whole receipt.
 */
export function checkReceipt(receipt: Receipt): ReceiptCheck {
  const errors: ReceiptIssue[] = []
  const warnings: ReceiptIssue[] = []

  const key = parseAccessKey(receipt.access_key)
  if (!key.ok) {
    errors.push({
      code: `access_key_${key.reason}`,
      message:
        key.reason === 'length'
          ? 'Não foi possível ler os 44 dígitos da chave de acesso. Envie uma imagem em que ela apareça inteira.'
          : 'A chave de acesso lida não é válida (dígito verificador). Envie uma imagem mais nítida da chave.',
    })
  } else {
    if (key.key.model !== '65') {
      errors.push({
        code: 'not_nfce',
        message: 'Esta nota não é uma NFC-e (cupom fiscal de consumidor).',
      })
    }
    if (key.key.cnpj !== receipt.market.cnpj) {
      errors.push({
        code: 'cnpj_mismatch',
        message:
          'O CNPJ do mercado não confere com o da chave de acesso. Envie uma imagem mais nítida do cabeçalho e da chave.',
      })
    }
    const issued = receipt.issued_at.slice(2, 4) + receipt.issued_at.slice(5, 7)
    if (issued !== key.key.yearMonth) {
      warnings.push({
        code: 'issued_at_mismatch',
        message: 'O mês de emissão lido não confere com o da chave de acesso. Confira a data.',
      })
    }
  }

  for (const item of receipt.items) {
    const expected = item.quantity * item.unit_price
    // Line totals may be rounded or truncated, hence the 1-cent tolerance plus rounding.
    if (differs(item.total_price, expected, 0.01 + item.quantity * 0.005)) {
      warnings.push({
        code: 'item_total_mismatch',
        message: `Linha ${item.line_number} (${item.description}): ${item.quantity} × ${brl(item.unit_price)} não dá ${brl(item.total_price)}.`,
      })
    }
  }

  const itemsSum = receipt.items.reduce((sum, item) => sum + item.total_price, 0)
  if (differs(itemsSum, receipt.products_total)) {
    warnings.push({
      code: 'products_total_mismatch',
      message: `A soma dos itens (${brl(itemsSum)}) difere do total dos produtos (${brl(receipt.products_total)}). Algum item pode ter sido lido errado ou faltado.`,
    })
  }

  if (differs(receipt.products_total - receipt.discount_total, receipt.paid_total)) {
    warnings.push({
      code: 'paid_total_mismatch',
      message: `Total dos produtos menos descontos não dá o total da nota (${brl(receipt.paid_total)}).`,
    })
  }

  return { errors, warnings }
}
