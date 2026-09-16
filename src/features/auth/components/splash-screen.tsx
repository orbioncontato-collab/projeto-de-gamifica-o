import { AppSplash } from '@/components/shared/skeletons'

/** Tela cheia enquanto a sessão é desconhecida (FRONTEND-ARCH §3.2) — reaproveita o `AppSplash` compartilhado. */
export function SplashScreen({ label }: { label?: string }) {
  return <AppSplash label={label ?? 'Carregando…'} />
}
