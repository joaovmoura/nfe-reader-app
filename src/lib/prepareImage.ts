// Turns the user's crop into the JPEG sent to the server: cuts the selected
// area, shrinks it to a size Gemini reads well and drops EXIF metadata (GPS).

export type Area = { x: number; y: number; width: number; height: number }

/** Receipts are tall: limit the width, and the total pixels for very long ones. */
export function outputSize(
  width: number,
  height: number,
  maxWidth = 1600,
  maxPixels = 12_000_000,
): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, Math.sqrt(maxPixels / (width * height)))
  // floor keeps the result within the limits after rounding
  return { width: Math.floor(width * scale), height: Math.floor(height * scale) }
}

/** `area` is in the image's natural pixels. */
export async function cropToJpeg(image: HTMLImageElement, area: Area): Promise<Blob> {
  const size = outputSize(area.width, area.height)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas não disponível')
  // White background in case the source has transparency (PNG screenshots).
  context.fillStyle = '#fff'
  context.fillRect(0, 0, size.width, size.height)
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size.width, size.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem'))),
      'image/jpeg',
      0.9,
    ),
  )
}
