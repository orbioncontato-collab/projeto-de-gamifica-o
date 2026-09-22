import '@/styles/base.css' // importa ./tokens.css (bloco @theme) junto com o Tailwind
import '@/styles/components.css'
import { StrictMode, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { queryClient, registerAuthNavigator } from '@/lib/query-client'
import { isSupabaseConfigured } from '@/lib/supabase'
import { installZodPtBr } from '@/lib/forms'
import { AuthProvider, useAuth } from '@/features/auth/auth-provider'
import { ThemeProvider } from '@/features/theme/theme-provider'
import { BrandingProvider } from '@/features/branding/branding-provider'
import { SplashScreen } from '@/features/auth/components/splash-screen'
import { ConfigMissingScreen } from '@/components/shared/config-missing-screen'
import { router } from './router'

installZodPtBr()

registerAuthNavigator({
  toLogin: () => void router.navigate({ to: '/login' }),
  toAwaiting: () => void router.navigate({ to: '/aguardando' }),
})

function InnerApp() {
  const auth = useAuth()
  const previous = useRef(auth.status)

  // SIGNED_OUT → limpa o cache e volta ao login (FRONTEND-ARCH §3.1); qualquer mudança de sessão re-roda os guards.
  useEffect(() => {
    if (auth.status === 'loading') return
    const was = previous.current
    previous.current = auth.status
    if (was === 'signed_in' && auth.status === 'signed_out') {
      queryClient.clear()
      void router.navigate({ to: '/login' })
    }
    void router.invalidate()
  }, [auth.status])

  if (auth.status === 'loading') return <SplashScreen /> // não monta rotas sem saber a sessão
  return <RouterProvider router={router} context={{ auth }} />
}

function Root() {
  if (!isSupabaseConfigured()) return <ConfigMissingScreen />
  return (
    <BrandingProvider>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </BrandingProvider>
  )
}

const container = document.getElementById('app')
if (!container) throw new Error('Elemento #app não encontrado em index.html')

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
