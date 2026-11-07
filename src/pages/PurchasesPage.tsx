import { useCallback } from 'react'
import { Link } from 'react-router'
import { listPurchases, marketName } from '../lib/api.ts'
import { brl, dateTime } from '../lib/format.ts'
import { useLoad } from '../lib/useLoad.ts'

export default function PurchasesPage() {
  const purchases = useLoad(useCallback(() => listPurchases(), []))

  return (
    <main className="page">
      <p>
        <Link to="/">← Início</Link>
      </p>
      <h1>Compras</h1>
      {purchases.status === 'loading' && <p className="loading">Carregando…</p>}
      {purchases.status === 'error' && <p className="error">{purchases.message}</p>}
      {purchases.status === 'ready' && purchases.data.length === 0 && (
        <p>
          Nenhuma compra ainda. <Link to="/enviar">Envie o primeiro cupom.</Link>
        </p>
      )}
      {purchases.status === 'ready' && (
        <ul className="cards">
          {purchases.data.map((p) => (
            <li key={p.id}>
              <Link className="card" to={`/compras/${p.id}`}>
                <strong>{p.market ? marketName(p.market) : '—'}</strong>
                <span className="muted">
                  {dateTime(p.issued_at)} · {p.items_count} itens
                </span>
                <span className="amount">{brl(p.paid_total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
