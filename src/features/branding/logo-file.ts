import { LOGO_DATA_URL_MAX, LOGO_MIME } from './presets'

export class LogoFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LogoFileError'
  }
}

const RASTER_SIZES = [512, 256, 128] as const

const readAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new LogoFileError('Não foi possível ler o arquivo.'))
    reader.readAsDataURL(blob)
  })

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new LogoFileError('A imagem não pôde ser decodificada.'))
    img.src = url
  })

/** Redesenha em um quadrado de `size` px (proporção mantida, fundo transparente) → data-URL PNG. */
async function rasterToDataUrl(img: HTMLImageElement, size: number): Promise<string> {
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight))
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new LogoFileError('Este navegador não consegue processar a imagem.')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

/**
 * Arquivo → data-URL que cabe em `app_settings.logo_data_url` (≤ 280 KB).
 * SVG vai como está (base64). PNG/JPEG/WebP são redimensionados até caber (512 → 256 → 128 px).
 */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!(LOGO_MIME as readonly string[]).includes(file.type)) {
    throw new LogoFileError('Use PNG, JPG, WebP ou SVG.')
  }
  if (file.type === 'image/svg+xml') {
    const url = await readAsDataUrl(file)
    if (url.length > LOGO_DATA_URL_MAX) throw new LogoFileError('SVG grande demais (máximo ~200 KB).')
    return url
  }
  const original = await readAsDataUrl(file)
  if (original.length <= LOGO_DATA_URL_MAX && file.type === 'image/png') return original
  const img = await loadImage(original)
  for (const size of RASTER_SIZES) {
    const url = await rasterToDataUrl(img, size)
    if (url.length <= LOGO_DATA_URL_MAX) return url
  }
  throw new LogoFileError('Imagem grande demais mesmo reduzida. Envie um PNG mais simples ou um SVG.')
}
