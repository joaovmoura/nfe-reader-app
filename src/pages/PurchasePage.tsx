import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ItemEditor } from '../components/ItemEditor.tsx'
import { NicknameForm } from '../components/NicknameForm.tsx'
import { deletePurchase, getPurchase, listCategories, listClasses, marketName } from '../lib/api.ts'
import { brl, dateTime, quantity } from '../lib/format.ts'
import { useLoad } from '../lib/useLoad.ts'

export default function PurchasePage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  // One load for everything the screen needs; reloaded after each edit.
  const loaded = useLoad(
    useCallback(async () => {
      const [purchase, classes, categories] = await Promise.all([
        getPurchase(id),
        listClasses(),
        listCategories(),
      ])
      return { purchase, classes, categories }
    }, [id]),
  )
  const [editingItem, setEditingItem] = useState<number | null>(null)
  const [editingMarket, setEditingMarket] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (loaded.status === 'loading') return <p className="loading">Carregando…</p>
  if (loaded.status === 'error') {
    return (
      <main className="page">
        <p>
          <Link to="/compras">← Compras</Link>
        </p>
        <p className="error">{loaded.message}</p>
      </main>
    )
  }

  const { purchase, classes, categories } = loaded.data
  const market = purchase.market
  const classById = new Map(classes.map((c) => [c.id, c]))
  const categoryById = new Map(categories.map((c) => [c.id, c.name]))
  const unclassified = purchase.items.filter((item) => item.class_id === null).length

  async function handleDelete() {
    if (!window.confirm('Excluir esta compra e todos os itens? Não dá para desfazer.')) return
    try {
      await deletePurchase(purchase.id)
      navigate('/compras', { replace: true })
    } catch (e) {
      setDeleteError((e as Error).message)
    }
  }

  return (
    <main className="page">
      <p>
        <Link to="/compras">← Compras</Link>
      </p>

      {market && (
        <section className="card">
          {editingMarket || !market.nickname ? (
            <>
              {!market.nickname && <p>Este mercado ainda não tem apelido.</p>}
              <NicknameForm
                marketId={market.id}
                legalName={market.legal_name}
                nickname={market.nickname}
                onSaved={() => {
                  setEditingMarket(false)
                  loaded.reload()
                }}
                onCancel={market.nickname ? () => setEditingMarket(false) : undefined}
              />
            </>
          ) : (
            <>
              <h1>{marketName(market)}</h1>
              <p className="muted small">
                {market.legal_name}
                {market.address && <> · {market.address}</>}
              </p>
              <button type="button" className="link" onClick={() => setEditingMarket(true)}>
                Renomear mercado
              </button>
            </>
          )}
        </section>
      )}

      <section className="summary">
        <p>{dateTime(purchase.issued_at)}</p>
        <dl>
          <dt>Total dos produtos</dt>
          <dd>{brl(purchase.products_total)}</dd>
          {purchase.discount_total > 0 && (
            <>
              <dt>Descontos</dt>
              <dd>−{brl(purchase.discount_total)}</dd>
            </>
          )}
          <dt>Total pago</dt>
          <dd>
            <strong>{brl(purchase.paid_total)}</strong>
          </dd>
          {purchase.payments.map((payment, index) => (
            <div key={index} className="contents">
              <dt>{payment.method}</dt>
              <dd>{brl(payment.amount)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <h2>
        Itens ({purchase.items.length})
        {unclassified > 0 && <span className="badge">{unclassified} sem classe</span>}
      </h2>
      <ul className="cards">
        {purchase.items.map((item) => {
          const itemClass = item.class_id ? classById.get(item.class_id) : undefined
          return (
            <li key={item.id} className="card">
              {editingItem === item.id ? (
                <ItemEditor
                  item={item}
                  classes={classes}
                  categories={categories}
                  onSaved={() => {
                    setEditingItem(null)
                    loaded.reload()
                  }}
                  onCancel={() => setEditingItem(null)}
                />
              ) : (
                <>
                  <div className="item-head">
                    <strong>{item.description}</strong>
                    <span className="amount">{brl(item.total_price)}</span>
                  </div>
                  <span className="muted small">
                    {quantity(item.quantity)} {item.unit} × {brl(item.unit_price)}
                    {item.code && <> · cód. {item.code}</>}
                  </span>
                  <span className="small">
                    {itemClass ? (
                      <>
                        {itemClass.name} · {categoryById.get(itemClass.category_id)}
                      </>
                    ) : (
                      <span className="badge">sem classe</span>
                    )}
                  </span>
                  <div className="actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setEditingItem(item.id)}
                    >
                      Editar
                    </button>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>

      <section className="danger-zone">
        <p className="muted small">Chave de acesso: {purchase.access_key}</p>
        {deleteError && <p className="error">{deleteError}</p>}
        <button type="button" className="danger" onClick={handleDelete}>
          Excluir compra
        </button>
      </section>
    </main>
  )
}
