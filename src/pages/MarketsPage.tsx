import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { NicknameForm } from '../components/NicknameForm.tsx'
import { listMarkets, marketName } from '../lib/api.ts'
import { useLoad } from '../lib/useLoad.ts'

const formatCnpj = (cnpj: string) =>
  cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')

export default function MarketsPage() {
  const markets = useLoad(useCallback(() => listMarkets(), []))
  const [editing, setEditing] = useState<number | null>(null)

  return (
    <main className="page">
      <p>
        <Link to="/">← Início</Link>
      </p>
      <h1>Mercados</h1>
      <p className="muted small">Cada filial (CNPJ) é um mercado.</p>
      {markets.status === 'loading' && <p className="loading">Carregando…</p>}
      {markets.status === 'error' && <p className="error">{markets.message}</p>}
      {markets.status === 'ready' && markets.data.length === 0 && (
        <p>Os mercados aparecem aqui depois do primeiro cupom.</p>
      )}
      {markets.status === 'ready' && (
        <ul className="cards">
          {markets.data.map((m) => (
            <li key={m.id} className="card">
              {editing === m.id ? (
                <NicknameForm
                  marketId={m.id}
                  legalName={m.legal_name}
                  nickname={m.nickname}
                  onSaved={() => {
                    setEditing(null)
                    markets.reload()
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <strong>{marketName(m)}</strong>
                  {!m.nickname && <span className="badge">sem apelido</span>}
                  <span className="muted small">
                    {m.nickname && <>{m.legal_name} · </>}CNPJ {formatCnpj(m.cnpj)}
                  </span>
                  {m.address && <span className="muted small">{m.address}</span>}
                  <span className="muted small">{m.purchases_count} compra(s)</span>
                  <div className="actions">
                    <button type="button" className="secondary" onClick={() => setEditing(m.id)}>
                      {m.nickname ? 'Renomear' : 'Dar apelido'}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
