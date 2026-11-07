// Display helpers: money and dates always in pt-BR and São Paulo time.

export const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })

export const quantity = (value: number) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

/** Reads "1.234,56", "1234,56" or "1234.56"; null when it isn't a number. */
export function parseDecimal(input: string): number | null {
  let text = input.trim().replace(/\s/g, '')
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  return Number(text)
}

/** Line total as the receipt prints it: quantity × unit price, in cents. */
export const lineTotal = (quantity: number, unitPrice: number) =>
  Math.round(quantity * unitPrice * 100) / 100
