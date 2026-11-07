import { useState, type FormEvent } from 'react'
import { renameMarket } from '../lib/api.ts'

type Props = {
  marketId: number
  legalName: string
  nickname: string | null
  onSaved: (nickname: string | null) => void
  onCancel?: () => void
}

// RF04: the nickname shown instead of the legal name printed on the receipt.
export function NicknameForm({ marketId, legalName, nickname, onSaved, onCancel }: Props) {
  const [value, setValue] = useState(nickname ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await renameMarket(marketId, value)
      onSaved(value.trim() || null)
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label>
        Apelido do mercado
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex.: Atacadão Jardim Tavares"
          maxLength={60}
          autoFocus
        />
      </label>
      <p className="muted small">Na nota: {legalName}</p>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar apelido'}
        </button>
      </div>
    </form>
  )
}
