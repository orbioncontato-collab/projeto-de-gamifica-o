import { Settings2 } from 'lucide-react'
import { missingSupabaseEnv } from '@/lib/supabase'

/** Tela mostrada quando as variáveis VITE_* não existem — nunca tela branca no primeiro deploy (FRONTEND-ARCH §3.2). */
export function ConfigMissingScreen() {
  const missing = missingSupabaseEnv()
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-text">
      <section className="premium-card w-full max-w-lg p-6 sm:p-8" aria-labelledby="config-missing-title">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold">
          <Settings2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="eyebrow">Configuração pendente</div>
        <h1 id="config-missing-title" className="mt-2 text-2xl font-black tracking-tight">
          O app ainda não está conectado ao Supabase
        </h1>
        <p className="mt-2 text-sm text-muted">
          Defina as variáveis de ambiente abaixo e publique novamente. Localmente, copie{' '}
          <code className="font-mono text-text-2">.env.example</code> para{' '}
          <code className="font-mono text-text-2">.env</code>; na Vercel, em Project → Settings → Environment
          Variables (Production e Preview) e faça um novo deploy (Deployments → ⋯ → Redeploy).
        </p>
        <ul className="mt-4 space-y-2">
          {missing.map((name) => (
            <li
              key={name}
              className="rounded-xl border border-red/25 bg-red/10 px-3 py-2 font-mono text-xs font-bold text-red-soft"
            >
              {name}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-2">
          Os valores estão em Supabase → Project Settings → API Keys. Use a{' '}
          <strong className="text-text-2">Publishable key</strong> (sb_publishable_…); nunca a Secret
          key/service_role. Passo a passo no Manual, capítulos 3 e 4.
        </p>
      </section>
    </main>
  )
}
