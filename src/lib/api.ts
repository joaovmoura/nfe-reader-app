// Data access used by the screens. Every function throws an Error with a
// message ready to show (pt-BR), so screens only render it.
import { normalizeClassName } from '../domain/classification.ts'
import { lineTotal } from './format.ts'
import { supabase } from './supabase.ts'

function fail(action: string, error: { code?: string } | null): never {
  console.error(action, error?.code)
  throw new Error(`Não foi possível ${action}. Verifique a conexão e tente de novo.`)
}

export const marketName = (market: { nickname: string | null; legal_name: string }) =>
  market.nickname ?? market.legal_name

export type PurchaseSummary = Awaited<ReturnType<typeof listPurchases>>[number]

export async function listPurchases() {
  const { data, error } = await supabase
    .from('purchases')
    .select('id, issued_at, paid_total, markets(nickname, legal_name), purchase_items(count)')
    .order('issued_at', { ascending: false })
  if (error) fail('carregar as compras', error)
  return data.map((p) => ({
    id: p.id,
    issued_at: p.issued_at,
    paid_total: p.paid_total,
    market: p.markets,
    items_count: p.purchase_items[0]?.count ?? 0,
  }))
}

export type PurchaseDetail = Awaited<ReturnType<typeof getPurchase>>
export type PurchaseItem = PurchaseDetail['items'][number]

export async function getPurchase(id: number) {
  const { data, error } = await supabase
    .from('purchases')
    .select(
      `id, access_key, issued_at, products_total, discount_total, paid_total,
       markets(id, cnpj, legal_name, nickname, address),
       purchase_payments(method, amount),
       purchase_items(id, line_number, code, description, quantity, unit, unit_price,
         total_price, product_id, class_id)`,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) fail('carregar a compra', error)
  if (!data) throw new Error('Compra não encontrada.')
  const { markets, purchase_payments, purchase_items, ...purchase } = data
  return {
    ...purchase,
    market: markets,
    payments: purchase_payments,
    items: [...purchase_items].sort((a, b) => a.line_number - b.line_number),
  }
}

export async function deletePurchase(id: number) {
  const { error } = await supabase.from('purchases').delete().eq('id', id)
  if (error) fail('excluir a compra', error)
}

export type Market = Awaited<ReturnType<typeof listMarkets>>[number]

export async function listMarkets() {
  const { data, error } = await supabase
    .from('markets')
    .select('id, cnpj, legal_name, nickname, address, purchases(count)')
    .order('nickname', { nullsFirst: true })
    .order('legal_name')
  if (error) fail('carregar os mercados', error)
  return data.map(({ purchases, ...market }) => ({
    ...market,
    purchases_count: purchases[0]?.count ?? 0,
  }))
}

export async function getMarket(id: number) {
  const { data, error } = await supabase
    .from('markets')
    .select('id, legal_name, nickname')
    .eq('id', id)
    .single()
  if (error) fail('carregar o mercado', error)
  return data
}

/** RF04: an empty nickname goes back to showing the legal name. */
export async function renameMarket(id: number, nickname: string) {
  const value = nickname.trim().replace(/\s+/g, ' ') || null
  const { error } = await supabase.from('markets').update({ nickname: value }).eq('id', id)
  if (error) fail('salvar o apelido', error)
}

export type Category = { id: number; name: string }
export type ItemClass = Awaited<ReturnType<typeof listClasses>>[number]

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('id, name').order('sort_order')
  if (error) fail('carregar as categorias', error)
  return data
}

export async function listClasses() {
  const { data, error } = await supabase
    .from('item_classes')
    .select('id, name, category_id, base_unit')
    .order('name')
  if (error) fail('carregar as classes', error)
  return data
}

export async function createClass(input: {
  name: string
  category_id: number
  base_unit: 'kg' | 'l' | 'un'
}): Promise<number> {
  const name = normalizeClassName(input.name)
  if (name.length < 2) throw new Error('Dê um nome à classe.')
  const { data, error } = await supabase
    .from('item_classes')
    .insert({ ...input, name })
    .select('id')
    .single()
  if (error?.code === '23505') throw new Error(`Já existe uma classe chamada “${name}”.`)
  if (error) fail('criar a classe', error)
  return data.id
}

/** The category belongs to the class, so this changes it for all its items. */
export async function setClassCategory(classId: number, categoryId: number) {
  const { error } = await supabase
    .from('item_classes')
    .update({ category_id: categoryId })
    .eq('id', classId)
  if (error) fail('mudar a categoria', error)
}

export async function updateItem(
  id: number,
  fields: { description: string; quantity: number; unit_price: number },
) {
  const { error } = await supabase
    .from('purchase_items')
    .update({ ...fields, total_price: lineTotal(fields.quantity, fields.unit_price) })
    .eq('id', id)
  if (error) fail('salvar o item', error)
}

/**
 * RF06: the class correction also applies to the other lines of the same
 * product and is remembered for the next receipts of the chain.
 */
export async function setItemClass(itemId: number, classId: number) {
  const { error } = await supabase.rpc('set_item_class', { item_id: itemId, class_id: classId })
  if (error) fail('mudar a classe', error)
}
