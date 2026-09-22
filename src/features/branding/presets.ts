import type { BrandPreset } from '@/lib/database.types'

/**
 * Presets de cor da marca (migration 14). As cores reais vivem em `styles/tokens.css`
 * (`[data-brand='…']`); aqui só o catálogo para o formulário e o fallback.
 */
export const BRAND_PRESETS: readonly { id: BrandPreset; label: string; hint: string }[] = [
  { id: 'esmeralda', label: 'Esmeralda', hint: 'Verde — padrão' },
  { id: 'safira', label: 'Safira', hint: 'Azul' },
  { id: 'ametista', label: 'Ametista', hint: 'Roxo' },
  { id: 'ambar', label: 'Âmbar', hint: 'Dourado' },
  { id: 'coral', label: 'Coral', hint: 'Laranja' },
  { id: 'ciano', label: 'Ciano', hint: 'Azul-claro' },
  { id: 'rosa', label: 'Rosa', hint: 'Magenta' },
]

export const BRAND_PRESET_IDS = BRAND_PRESETS.map((p) => p.id) as readonly BrandPreset[]
export const DEFAULT_BRAND_PRESET: BrandPreset = 'esmeralda'

export const isBrandPreset = (v: unknown): v is BrandPreset =>
  typeof v === 'string' && (BRAND_PRESET_IDS as readonly string[]).includes(v)

export const PLATFORM_NAME_MAX = 40
/** Limite do data-URL da logo (check constraint) ≈ 200 KB de imagem. */
export const LOGO_DATA_URL_MAX = 280_000
export const LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const
