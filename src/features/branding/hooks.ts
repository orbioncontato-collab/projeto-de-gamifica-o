import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import type { Branding } from '@/lib/database.types'
import { getBranding } from './api'
import { DEFAULT_BRAND_PRESET } from './presets'

/** Marca padrão (banco recém-instalado / antes da resposta): igual ao seed da migration 14. */
export const DEFAULT_BRANDING: Branding = {
  company_name: 'Orbion',
  platform_name: 'Sales League',
  brand_preset: DEFAULT_BRAND_PRESET,
  logo_data_url: null,
  default_theme: 'dark',
}

const BRANDING_STALE_MS = 5 * 60_000

/** Marca do cliente (rpc `get_branding`, anon ok). Invalidada em `qk.branding()` ao salvar Configurações → Marca. */
export function useBrandingQuery(): UseQueryResult<Branding> {
  return useQuery({ queryKey: qk.branding(), queryFn: getBranding, staleTime: BRANDING_STALE_MS })
}

/** Sempre devolve algo renderizável: dados reais ou o padrão enquanto carrega/falha. */
export function useBranding(): Branding {
  const q = useBrandingQuery()
  return q.data ?? DEFAULT_BRANDING
}
