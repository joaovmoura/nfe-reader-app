// Gemini calls: reading a receipt image and classifying its items.
// Never log the model output: it could contain the consumer's CPF.
import {
  classificationJsonSchema,
  classificationPrompt,
  type ExistingClass,
  type ItemToClassify,
} from '../../../src/domain/classification.ts'
import { receiptJsonSchema } from '../../../src/domain/receipt.ts'

const API = 'https://generativelanguage.googleapis.com/v1beta/models'

// First model that answers wins; the next one is tried on overload or timeout.
export const DEFAULT_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash']

const EXTRACTION_PROMPT = `Você recebe a imagem de um cupom fiscal eletrônico (NFC-e) da Paraíba,
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

type Part = { text: string } | { inline_data: { mime_type: string; data: string } }

async function callModel(
  model: string,
  apiKey: string,
  parts: Part[],
  schema: object,
  timeoutMs: number,
): Promise<{ data: unknown; tokens: number | undefined }> {
  let response: Response
  try {
    response = await fetch(`${API}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
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
    return { data: JSON.parse(text), tokens: body?.usageMetadata?.totalTokenCount }
  } catch {
    throw new GeminiError(`${model}: response is not JSON`, true)
  }
}

// Below this, a call isn't worth starting.
const MIN_CALL_MS = 8_000

/**
 * Tries each model in order; logs timing and token usage (never content).
 * Each call gets at most `timeoutMs`, and never runs past `deadline` (epoch ms),
 * so the whole request ends before the Edge Function is killed.
 */
async function generateJson(
  purpose: string,
  apiKey: string,
  parts: Part[],
  schema: object,
  models: string[],
  timeoutMs: number,
  deadline: number,
): Promise<{ data: unknown; model: string }> {
  let lastError: GeminiError | undefined
  for (const model of models) {
    const available = Math.min(timeoutMs, deadline - Date.now())
    if (available < MIN_CALL_MS) {
      console.warn(`gemini ${purpose}: no time left for ${model}`)
      break
    }
    const started = Date.now()
    try {
      const { data, tokens } = await callModel(model, apiKey, parts, schema, available)
      console.log(`gemini ${purpose}: ${model} ${Date.now() - started}ms ${tokens ?? '?'} tokens`)
      return { data, model }
    } catch (error) {
      if (!(error instanceof GeminiError) || !error.retryable) throw error
      console.warn(`gemini ${purpose}: trying next model after:`, error.message)
      lastError = error
    }
  }
  throw lastError ?? new GeminiError('no time left', false)
}

export function extractReceipt(
  apiKey: string,
  image: { base64: string; mimeType: string },
  deadline: number,
  models: string[] = DEFAULT_MODELS,
  timeoutMs = 75_000,
): Promise<{ data: unknown; model: string }> {
  const parts: Part[] = [
    { text: EXTRACTION_PROMPT },
    { inline_data: { mime_type: image.mimeType, data: image.base64 } },
  ]
  return generateJson('extract', apiKey, parts, receiptJsonSchema, models, timeoutMs, deadline)
}

export function classifyItems(
  apiKey: string,
  items: ItemToClassify[],
  existing: ExistingClass[],
  deadline: number,
  models: string[] = DEFAULT_MODELS,
  timeoutMs = 45_000,
): Promise<{ data: unknown; model: string }> {
  const parts: Part[] = [{ text: classificationPrompt(items, existing) }]
  return generateJson(
    'classify',
    apiKey,
    parts,
    classificationJsonSchema,
    models,
    timeoutMs,
    deadline,
  )
}
