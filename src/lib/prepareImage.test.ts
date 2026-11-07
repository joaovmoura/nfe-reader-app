import { describe, expect, it } from 'vitest'
import { outputSize } from './prepareImage.ts'

describe('outputSize', () => {
  it('mantém imagens pequenas como estão', () => {
    expect(outputSize(397, 821)).toEqual({ width: 397, height: 821 })
  })

  it('reduz a largura mantendo a proporção', () => {
    expect(outputSize(3200, 6000)).toEqual({ width: 1600, height: 3000 })
  })

  it('limita o total de pixels de cupons muito compridos', () => {
    const { width, height } = outputSize(1080, 20000)
    expect(width * height).toBeLessThanOrEqual(12_000_000)
    expect(width / height).toBeCloseTo(1080 / 20000, 3)
  })
})
