// Calls Gemini to read a receipt image into the receipt JSON schema.
// Never log the model output: it could contain the consumer's CPF.
import { receiptJsonSchema } from '../../../src/domain/receipt.ts'

const API = 'https://generativelanguage.googleapis.com/v1beta/models'

// First model that answers wins; the next one is tried on overload or timeout.
export const DEFAULT_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash']

const PROMPT = `Você recebe a imagem de um cupom fiscal eletrônico (NFC-e) da Paraíba,
como impresso ou como exibido na página de consulta da SEFAZ-PB.
Extraia os dados exatamente como aparecem, no formato JSON pedido.

Regras:
- NUNCA inclua CPF, nome ou qualquer dado do consumidor, mesmo que apareçam na imagem.
- market: dados do emitente (cabeçalho). cnpj e access_key só com dígitos.
- issued_at: "Data de emissão", em ISO 8601 com fuso -03:00.
- items: uma entrada por linha do cupom, na ordem, mesmo que o mesmo produto apareça
  em várias linhas (itens a granel pesados separadamente). line_number começa em 1.
- code: o código impresso, mesmo que pareça cortado; null se não houver.
- Números em reais com ponto decimal (25,90 -> 25.9). quantity pode ser fracionada (0,214 -> 0.214).
- unit_price é o "Vl Unit" e total_price o "Vl Total" de cada linha.
- products_total: "Total produtos"; discount_total: "Descontos" (0 se não houver);
  paid_total: "Total da nota" / "Valor a pagar".
- payments: cada forma de pagamento listada com seu valor.
- Se algum campo estiver ilegível, devolva o que conseguir ler; não invente valores.`

export class GeminiError extends Error {
  retryable: boolean

  constructor(message: string, retryable: boolean) {
    super(message)
    this.retryable = retryable
  }
}

async function callModel(
  model: string,
  apiKey: string,
  image: { base64: string; mimeType: string },
  timeoutMs: number,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${API}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: image.mimeType, data: image.base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: receiptJsonSchema,
        },
      }),
    })
  } catch {
    throw new GeminiError(`${model}: timeout or network error`, true)
  }

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500
    throw new GeminiError(`${model}: HTTP ${response.status}`, retryable)
  }

  const body = await response.json()
  const text = body?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? '')
    .join('')
  if (!text) throw new GeminiError(`${model}: empty response`, true)

  try {
    return JSON.parse(text)
  } catch {
    throw new GeminiError(`${model}: response is not JSON`, true)
  }
}

export async function extractReceipt(
  apiKey: string,
  image: { base64: string; mimeType: string },
  models: string[] = DEFAULT_MODELS,
  timeoutMs = 60_000,
): Promise<{ data: unknown; model: string }> {
  let lastError: GeminiError | undefined
  for (const model of models) {
    try {
      return { data: await callModel(model, apiKey, image, timeoutMs), model }
    } catch (error) {
      if (!(error instanceof GeminiError) || !error.retryable) throw error
      console.warn('trying next model after:', error.message)
      lastError = error
    }
  }
  throw lastError ?? new GeminiError('no model configured', false)
}
