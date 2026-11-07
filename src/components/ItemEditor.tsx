import { useState, type FormEvent } from 'react'
import { BASE_UNITS, type BaseUnit } from '../domain/classification.ts'
import {
  createClass,
  setClassCategory,
  setItemClass,
  updateItem,
  type Category,
  type ItemClass,
  type PurchaseItem,
} from '../lib/api.ts'
import { brl, lineTotal, parseDecimal, quantity as formatQuantity } from '../lib/format.ts'

const NEW_CLASS = 'new'
const UNIT_LABELS: Record<BaseUnit, string> = { kg: 'por kg', l: 'por litro', un: 'por unidade' }

type Props = {
  item: PurchaseItem
  classes: ItemClass[]
  categories: Category[]
  onSaved: () => void
  onCancel: () => void
}

// RF07: edit any field of a saved item. The class change is remembered (RF06).
export function ItemEditor({ item, classes, categories, onSaved, onCancel }: Props) {
  const [description, setDescription] = useState(item.description)
  const [quantityText, setQuantityText] = useState(formatQuantity(item.quantity))
  const [priceText, setPriceText] = useState(item.unit_price.toFixed(2).replace('.', ','))
  const [classValue, setClassValue] = useState(item.class_id ? String(item.class_id) : '')
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState<BaseUnit>(item.unit === 'KG' ? 'kg' : 'un')
  const currentClass = classes.find((c) => String(c.id) === classValue)
  const [categoryId, setCategoryId] = useState(
    String(currentClass?.category_id ?? categories[0]?.id ?? ''),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const quantity = parseDecimal(quantityText)
  const unitPrice = parseDecimal(priceText)
  const creating = classValue === NEW_CLASS

  function chooseClass(value: string) {
    setClassValue(value)
    const chosen = classes.find((c) => String(c.id) === value)
    if (chosen) setCategoryId(String(chosen.category_id))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!description.trim()) return setError('A descrição não pode ficar vazia.')
    if (!quantity) return setError('Quantidade inválida.')
    if (unitPrice === null) return setError('Preço inválido.')
    setSaving(true)
    setError(null)
    try {
      await updateItem(item.id, {
        description: description.trim(),
        quantity,
        unit_price: unitPrice,
      })
      let classId = currentClass?.id ?? null
      if (creating) {
        classId = await createClass({
          name: newName,
          category_id: Number(categoryId),
          base_unit: newUnit,
        })
      } else if (currentClass && String(currentClass.category_id) !== categoryId) {
        await setClassCategory(currentClass.id, Number(categoryId))
      }
      if (classId !== null && classId !== item.class_id) await setItemClass(item.id, classId)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  // Classes grouped by category in the native picker (works well on phones).
  const groups = categories.map((category) => ({
    category,
    classes: classes.filter((c) => c.category_id === category.id),
  }))

  return (
    <form className="stack editor" onSubmit={handleSubmit}>
      <label>
        Descrição
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="row">
        <label>
          Quantidade ({item.unit})
          <input
            inputMode="decimal"
            value={quantityText}
            onChange={(e) => setQuantityText(e.target.value)}
          />
        </label>
        <label>
          Preço unitário (R$)
          <input
            inputMode="decimal"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
          />
        </label>
      </div>
      {quantity && unitPrice !== null && (
        <p className="muted small">Total da linha: {brl(lineTotal(quantity, unitPrice))}</p>
      )}

      <label>
        Classe
        <select value={classValue} onChange={(e) => chooseClass(e.target.value)}>
          <option value="" disabled>
            Sem classe — escolha uma
          </option>
          {groups.map(
            ({ category, classes }) =>
              classes.length > 0 && (
                <optgroup key={category.id} label={category.name}>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ),
          )}
          <option value={NEW_CLASS}>+ Nova classe…</option>
        </select>
      </label>

      {creating && (
        <div className="row">
          <label>
            Nome da nova classe
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: Arroz parboilizado"
            />
          </label>
          <label>
            Comparar preço
            <select value={newUnit} onChange={(e) => setNewUnit(e.target.value as BaseUnit)}>
              {BASE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {(creating || currentClass) && (
        <label>
          Categoria
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {currentClass && String(currentClass.category_id) !== categoryId && (
        <p className="muted small">
          A categoria é da classe: muda para todos os itens de “{currentClass.name}”.
        </p>
      )}
      {item.product_id && classValue && String(item.class_id ?? '') !== classValue && (
        <p className="muted small">
          A nova classe vale também para as outras linhas deste produto e para os próximos cupons
          deste mercado.
        </p>
      )}

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
