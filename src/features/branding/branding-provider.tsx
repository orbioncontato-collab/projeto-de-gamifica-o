import { useEffect, type ReactNode } from 'react'
import { readStoredTheme, useTheme } from '@/features/theme/use-theme'
import { useBrandingQuery } from './hooks'
import { DEFAULT_BRAND_PRESET, isBrandPreset } from './presets'

/** Único lugar que escreve em `html[data-brand]` e em `document.title` a partir da marca do cliente. */
export function applyBrandPreset(preset: string): void {
  document.documentElement.dataset['brand'] = isBrandPreset(preset) ? preset : DEFAULT_BRAND_PRESET
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { data } = useBrandingQuery()
  const { setTheme } = useTheme()

  useEffect(() => {
    if (!data) return
    applyBrandPreset(data.brand_preset)
    document.title = `${data.company_name} ${data.platform_name}`.trim()
  }, [data])

  // Tema padrão escolhido pelo gestor vale só para quem nunca escolheu o próprio (sem preferência salva).
  useEffect(() => {
    if (!data) return
    if (readStoredTheme() === null) setTheme(data.default_theme, { persist: false })
  }, [data, setTheme])

  return <>{children}</>
}
