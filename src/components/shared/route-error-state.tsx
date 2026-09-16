import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { ErrorState } from './error-state'

/** `defaultErrorComponent` do router: "Não foi possível carregar seus dados" + Tentar novamente. */
export function RouteErrorState({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <ErrorState
        error={error}
        title="Não foi possível carregar seus dados"
        onRetry={() => {
          reset()
          void router.invalidate()
        }}
      />
    </div>
  )
}
