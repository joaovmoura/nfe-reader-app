import { describe, expect, it } from 'vitest'
import {
  classificationPrompt,
  classificationSchema,
  itemsToClassify,
  normalizeClassName,
} from './classification.ts'

describe('normalizeClassName', () => {
  it('padroniza espaços e maiúsculas', () => {
    expect(normalizeClassName('  arroz   BRANCO ')).toBe('Arroz branco')
    expect(normalizeClassName('ÓLEO de soja')).toBe('Óleo de soja')
  })
})

describe('itemsToClassify', () => {
  const items = [
    { line_number: 1, code: '399', description: 'CALDO DE GALINHA' },
    { line_number: 2, code: '399', description: 'CALDO DE GALINHA' },
    { line_number: 3, code: '57', description: 'CHIA' },
    { line_number: 4, code: null, description: 'SEM CODIGO' },
  ]

  it('manda para a IA só os itens sem classe lembrada e os sem código', () => {
    const lines = itemsToClassify(items, new Set(['399'])).map((item) => item.line_number)
    expect(lines).toEqual([3, 4])
  })

  it('não chama a IA quando todos os itens já são conhecidos', () => {
    expect(itemsToClassify(items.slice(0, 3), new Set(['399', '57']))).toEqual([])
  })
})

describe('classificationSchema', () => {
  const answer = {
    items: [
      { line_number: 3, class_name: 'chia', category: 'Não perecíveis', base_unit: 'kg' },
      { line_number: 4, class_name: 'Ovos', category: 'Perecíveis', base_unit: 'un' },
    ],
  }

  it('aceita uma resposta completa e normaliza o nome', () => {
    const parsed = classificationSchema([4, 3]).parse(answer)
    expect(parsed.items[0]!.class_name).toBe('Chia')
  })

  it('recusa linha faltando, repetida ou a mais', () => {
    expect(classificationSchema([3, 4, 5]).safeParse(answer).success).toBe(false)
    expect(classificationSchema([3]).safeParse(answer).success).toBe(false)
    const repeated = { items: [answer.items[0]!, answer.items[0]!] }
    expect(classificationSchema([3, 4]).safeParse(repeated).success).toBe(false)
  })

  it('recusa categoria ou unidade fora da lista', () => {
    const wrong = (patch: object) => ({ items: [{ ...answer.items[0]!, ...patch }] })
    expect(classificationSchema([3]).safeParse(wrong({ category: 'Grãos' })).success).toBe(false)
    expect(classificationSchema([3]).safeParse(wrong({ base_unit: 'g' })).success).toBe(false)
  })
})

describe('classificationPrompt', () => {
  it('lista as classes existentes e os itens', () => {
    const prompt = classificationPrompt(
      [{ line_number: 3, description: 'CHIA HISPANICA PRETA', unit: 'KG' }],
      [{ name: 'Arroz branco', category: 'Não perecíveis', base_unit: 'kg' }],
    )
    expect(prompt).toContain('- Arroz branco | Não perecíveis | kg')
    expect(prompt).toContain('3. CHIA HISPANICA PRETA (KG)')
  })
})
