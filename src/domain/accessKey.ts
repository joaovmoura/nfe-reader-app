// Parsing of the NF-e/NFC-e access key (chave de acesso), 44 digits:
// cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) cDV(1)

export type AccessKey = {
  digits: string
  uf: string
  yearMonth: string // AAMM
  cnpj: string
  model: string
  series: number
  number: number
}

export type AccessKeyResult =
  { ok: true; key: AccessKey } | { ok: false; reason: 'length' | 'check_digit' }

/** Keeps only the digits: receipts print the key with dots, dashes and spaces. */
export function normalizeAccessKey(input: string): string {
  return input.replace(/\D/g, '')
}

/** Modulo 11 check digit over the first 43 digits, weights 2..9 from the right. */
export function accessKeyCheckDigit(first43: string): number {
  let sum = 0
  for (let i = 0; i < first43.length; i++) {
    const digit = Number(first43[first43.length - 1 - i])
    sum += digit * ((i % 8) + 2)
  }
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

export function parseAccessKey(input: string): AccessKeyResult {
  const digits = normalizeAccessKey(input)
  if (digits.length !== 44) return { ok: false, reason: 'length' }
  if (accessKeyCheckDigit(digits.slice(0, 43)) !== Number(digits[43])) {
    return { ok: false, reason: 'check_digit' }
  }
  return {
    ok: true,
    key: {
      digits,
      uf: digits.slice(0, 2),
      yearMonth: digits.slice(2, 6),
      cnpj: digits.slice(6, 20),
      model: digits.slice(20, 22),
      series: Number(digits.slice(22, 25)),
      number: Number(digits.slice(25, 34)),
    },
  }
}
