// Item classification (RF05-RF06): the classes the AI may create, the shape of
// its answer, and how remembered classes skip the AI. Shared by the Edge
// Function and Vitest.
import { z } from 'zod'

export const CATEGORIES = [
  'Não perecíveis',
  'Laticínios e frios',
  'Carnes',
  'Perecíveis',
  'Hortifruti',
  'Bebidas',
  'Limpeza e higiene',
] as const

export const BASE_UNITS = ['kg', 'l', 'un'] as const

export type Category = (typeof CATEGORIES)[number]
export type BaseUnit = (typeof BASE_UNITS)[number]

/** "  arroz   BRANCO " -> "Arroz branco": one spelling per class avoids duplicates. */
export function normalizeClassName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
  return clean.charAt(0).toLocaleUpperCase('pt-BR') + clean.slice(1)
}

export type ItemToClassify = { line_number: number; description: string; unit: string }
export type ExistingClass = { name: string; category: string; base_unit: string }

/**
 * Items whose product already has a class (remembered or corrected before)
 * don't go to the AI. `remembered` holds the product codes with a class.
 */
export function itemsToClassify<T extends { code: string | null }>(
  items: T[],
  remembered: Set<string>,
): T[] {
  return items.filter((item) => item.code === null || !remembered.has(item.code))
}

const classifiedItem = z.object({
  line_number: z.number().int().positive(),
  class_name: z.string().transform(normalizeClassName).pipe(z.string().min(2).max(60)),
  category: z.enum(CATEGORIES),
  base_unit: z.enum(BASE_UNITS),
})

export type ClassifiedItem = z.output<typeof classifiedItem>

/** Validates the AI answer: every requested line classified exactly once. */
export function classificationSchema(lineNumbers: number[]) {
  const expected = [...lineNumbers].sort((a, b) => a - b).join(',')
  return z.object({ items: z.array(classifiedItem) }).refine(
    ({ items }) =>
      items
        .map((item) => item.line_number)
        .sort((a, b) => a - b)
        .join(',') === expected,
    { message: 'the answer must classify each requested line exactly once' },
  )
}

export const classificationJsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          line_number: { type: 'integer' },
          class_name: {
            type: 'string',
            description: 'Nome da classe, curto, sem marca nem tamanho de embalagem',
          },
          category: { type: 'string', enum: [...CATEGORIES] },
          base_unit: {
            type: 'string',
            enum: [...BASE_UNITS],
            description: 'kg para sólidos, l para líquidos, un quando se compara por unidade',
          },
        },
        required: ['line_number', 'class_name', 'category', 'base_unit'],
      },
    },
  },
  required: ['items'],
} as const

export function classificationPrompt(items: ItemToClassify[], existing: ExistingClass[]): string {
  const classes = existing.length
    ? existing.map((c) => `- ${c.name} | ${c.category} | ${c.base_unit}`).join('\n')
    : '(nenhuma ainda)'
  const lines = items.map((i) => `${i.line_number}. ${i.description} (${i.unit})`).join('\n')
  return `Classifique itens de cupons fiscais de supermercado do Brasil (descrições abreviadas).

Cada item recebe uma CLASSE: o tipo de produto comparável entre mercados, sem marca e sem
tamanho de embalagem, que distingue variações relevantes para o preço.
Exemplos: "Arroz branco", "Arroz integral", "Arroz parboilizado", "Feijão carioca",
"Leite UHT integral", "Peito de frango", "Caldo de galinha", "Detergente líquido".

Classes que já existem (nome | categoria | unidade):
${classes}

Regras:
- Se uma classe existente servir, use exatamente o mesmo nome dela.
- Só crie uma classe nova quando nenhuma existente servir; nome em português, só a
  primeira letra maiúscula.
- category: uma das categorias permitidas no schema. Carnes inclui frango, porco, peixe e boi;
  Perecíveis inclui ovos, tapioca e panificados; Hortifruti inclui frutas, verduras e legumes.
- base_unit: como comparar o preço da classe: "kg" para sólidos vendidos a peso ou em
  embalagem com peso, "l" para líquidos, "un" para itens comparados por unidade (ex.: ovos em bandeja).
- Responda uma entrada para cada linha abaixo, com o mesmo line_number.

Itens:
${lines}`
}
