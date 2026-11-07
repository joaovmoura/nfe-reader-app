// RF01-RF03: receives a receipt image, reads it with Gemini, validates the
// result and saves the purchase. The image is never stored.
import { createClient } from '@supabase/supabase-js'
import { encodeBase64 } from '@std/encoding/base64'
import { checkReceipt, receiptSchema } from '../../../src/domain/receipt.ts'
import type { Database } from '../../../src/types/database.ts'
import { extractReceipt } from './gemini.ts'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Auth is a bearer token, not a cookie, so any origin is safe here.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(
    new Date(iso),
  )

function duplicate(createdAt: string, purchaseId: number): Response {
  return reply(409, {
    error: 'duplicate',
    message: `Este cupom já foi enviado em ${formatDate(createdAt)}.`,
    purchase_id: purchaseId,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' })

  // verify_jwt is off in config.toml (incompatible with asymmetric signing
  // keys), so the token is verified here.
  const authorization = req.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  const supabase = createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  )
  const { data: auth } = token ? await supabase.auth.getClaims(token) : { data: null }
  if (auth?.claims.role !== 'authenticated') {
    return reply(401, { error: 'unauthorized', message: 'Sua sessão expirou. Entre de novo.' })
  }

  let image: File
  try {
    const form = await req.formData()
    const value = form.get('image')
    if (!(value instanceof File)) throw new Error('missing image')
    image = value
  } catch {
    return reply(400, { error: 'bad_request', message: 'Nenhuma imagem foi enviada.' })
  }
  if (!IMAGE_TYPES.includes(image.type)) {
    return reply(415, { error: 'bad_image', message: 'Envie uma imagem JPG, PNG ou WebP.' })
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return reply(413, { error: 'bad_image', message: 'A imagem passa de 8 MB.' })
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set')
    return reply(500, {
      error: 'config',
      message: 'O servidor não está configurado para ler cupons.',
    })
  }

  let extracted: Awaited<ReturnType<typeof extractReceipt>>
  try {
    const base64 = encodeBase64(new Uint8Array(await image.arrayBuffer()))
    extracted = await extractReceipt(apiKey, { base64, mimeType: image.type })
  } catch (error) {
    console.error('gemini failed:', error instanceof Error ? error.message : 'unknown')
    return reply(502, {
      error: 'ai_unavailable',
      message: 'A leitura por IA está indisponível agora. Tente de novo em alguns minutos.',
    })
  }

  const parsed = receiptSchema.safeParse(extracted.data)
  if (!parsed.success) {
    // Paths and codes only: the values could contain personal data.
    console.error(
      'invalid extraction:',
      parsed.error.issues.map((issue) => `${issue.path.join('.')}:${issue.code}`).join(', '),
    )
    return reply(422, {
      error: 'unreadable',
      message: 'Não foi possível ler o cupom nesta imagem. Envie uma imagem mais nítida e inteira.',
    })
  }
  const receipt = parsed.data

  const { errors, warnings } = checkReceipt(receipt)
  if (errors.length > 0) {
    return reply(422, { error: errors[0]!.code, message: errors[0]!.message, errors })
  }

  // RF03: refuse a receipt already saved (the unique index is the final guard).
  const { data: existing } = await supabase
    .from('purchases')
    .select('id, created_at')
    .eq('access_key', receipt.access_key)
    .maybeSingle()
  if (existing) return duplicate(existing.created_at, existing.id)

  const { data: saved, error } = await supabase.rpc('save_receipt', { payload: receipt })
  if (error) {
    if (error.code === '23505') {
      const { data: raced } = await supabase
        .from('purchases')
        .select('id, created_at')
        .eq('access_key', receipt.access_key)
        .single()
      if (raced) return duplicate(raced.created_at, raced.id)
    }
    console.error('save_receipt failed:', error.code, error.message)
    return reply(500, { error: 'save_failed', message: 'Não foi possível salvar a compra.' })
  }

  return reply(201, {
    ...(saved as Record<string, unknown>),
    market: receipt.market.legal_name,
    issued_at: receipt.issued_at,
    items_count: receipt.items.length,
    paid_total: receipt.paid_total,
    warnings,
    model: extracted.model,
  })
})
