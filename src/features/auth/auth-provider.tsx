import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in'
export interface AuthState {
  status: AuthStatus
  session: Session | null
  userId: string | null
}

const INITIAL: AuthState = { status: 'loading', session: null, userId: null }

const AuthContext = createContext<AuthState>(INITIAL)

const fromSession = (session: Session | null): AuthState =>
  session ? { status: 'signed_in', session, userId: session.user.id } : { status: 'signed_out', session: null, userId: null }

/**
 * Estado de sessão do Supabase (FRONTEND-ARCH §3.1). O callback de `onAuthStateChange` só faz setState —
 * nunca `await` de chamadas supabase dentro dele (deadlock documentado). Efeitos colaterais (limpar cache,
 * navegar) ficam em `useEffect` sobre `status` em main.tsx.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL)

  useEffect(() => {
    let cancelled = false
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setState(fromSession(data.session))
      })
      .catch(() => {
        if (!cancelled) setState(fromSession(null))
      })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setState(fromSession(null))
        return
      }
      // INITIAL_SESSION / SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED / PASSWORD_RECOVERY
      setState(fromSession(session))
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => state, [state])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
