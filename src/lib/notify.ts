import { toast } from 'sonner'
import { getErrorMessage } from './rpc-errors'

/** Wrapper do sonner — única forma de mostrar toast no app (FRONTEND-ARCH §4.7). */
export const notify = {
  success: (message: string, description?: string) => toast.success(message, { description }),
  info: (message: string, description?: string) => toast(message, { description }),
  warning: (message: string, description?: string) => toast.warning(message, { description }),
  error: (error: unknown, fallback?: string) =>
    toast.error(fallback ?? 'Não foi possível concluir', { description: getErrorMessage(error) }),
  promise: <T>(p: Promise<T>, msgs: { loading: string; success: string; error?: string }) =>
    toast.promise(p, { ...msgs, error: (e: unknown) => msgs.error ?? getErrorMessage(e) }),
}
