// RF01-RF03: receives a receipt image, reads it with Gemini, validates the
// result and saves the purchase. The image is never stored.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { encodeBase64 } from '@std/encoding/base64'
import {
  classificationSchema,
  itemsToClassify,
  type ClassifiedItem,
} from '../../../src/domain/classification.ts'
import { checkReceipt, receiptSchema, type Receipt } from '../../../src/domain/receipt.ts'
import type { Database } from '../../../src/types/database.ts'
import { classifyItems, extractReceipt } from './gemini.ts'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
// The platform stops a request after ~150 s; finish the AI work before that.
const AI_BUDGET_MS = 130_000
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
  const deadline = Date.now() + AI_BUDGET_MS

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
    extracted = await extractReceipt(apiKey, { base64, mimeType: image.type }, deadline)
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

  // RF05-RF06: products of this chain that already have a class skip the AI.
  const codes = [...new Set(receipt.items.flatMap((item) => (item.code ? [item.code] : [])))]
  const { data: known } = codes.length
    ? await supabase
        .from('products')
        .select('code')
        .eq('cnpj_root', receipt.market.cnpj.slice(0, 8))
        .in('code', codes)
        .not('class_id', 'is', null)
    : { data: [] }
  const pending = itemsToClassify(receipt.items, new Set((known ?? []).map((p) => p.code)))
  const suggestions = await suggestClasses(supabase, apiKey, pending, deadline)

  const unclassified = pending.length - suggestions.size
  if (unclassified > 0) {
    warnings.push({
      code: 'unclassified',
      message:
        unclassified === 1
          ? '1 item ficou sem classe. Classifique pela tela da compra.'
          : `${unclassified} itens ficaram sem classe. Classifique pela tela da compra.`,
    })
  }

  const payload = {
    ...receipt,
    items: receipt.items.map((item) => {
      const suggestion = suggestions.get(item.line_number)
      return {
        ...item,
        class: suggestion
          ? {
              name: suggestion.class_name,
              category: suggestion.category,
              base_unit: suggestion.base_unit,
            }
          : null,
      }
    }),
  }

  const { data: saved, error } = await supabase.rpc('save_receipt', { payload })
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
    remembered: receipt.items.length - pending.length,
    classified: suggestions.size,
    model: extracted.model,
  })
})

/**
 * Asks the AI for the classes of the items the memory doesn't know. A failure
 * here never loses the receipt: the items are saved without a class.
 */
async function suggestClasses(
  supabase: SupabaseClient<Database>,
  apiKey: string,
  pending: Receipt['items'],
  deadline: number,
): Promise<Map<number, ClassifiedItem>> {
  const suggestions = new Map<number, ClassifiedItem>()
  if (pending.length === 0) return suggestions

  try {
    const { data: classes, error } = await supabase
      .from('item_classes')
      .select('name, base_unit, categories(name)')
      .order('name')
    if (error) throw new Error(`item_classes: ${error.code}`)
    const existing = classes.map((c) => ({
      name: c.name,
      base_unit: c.base_unit,
      category: c.categories?.name ?? '',
    }))

    const { data } = await classifyItems(
      apiKey,
      pending.map(({ line_number, description, unit }) => ({ line_number, description, unit })),
      existing,
      deadline,
    )
    const parsed = classificationSchema(pending.map((item) => item.line_number)).safeParse(data)
    if (!parsed.success) {
      console.error(
        'invalid classification:',
        parsed.error.issues.map((issue) => `${issue.path.join('.')}:${issue.code}`).join(', '),
      )
      return suggestions
    }
    for (const item of parsed.data.items) suggestions.set(item.line_number, item)
  } catch (error) {
    console.error('classification failed:', error instanceof Error ? error.message : 'unknown')
  }
  return suggestions
}
