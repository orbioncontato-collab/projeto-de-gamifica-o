import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { subscribeToTables, type TableSubscription, type RealtimeTable } from '@/lib/realtime'
import type { WheelSpinRow } from '@/lib/database.types'
import { useMe } from '@/features/auth/bootstrap-query'

const INVALIDATE_DEBOUNCE_MS = 250
const CHANNEL = 'wheel'

export interface WheelRealtimeOptions {
  /** INSERT em `wheel_spins` feito por outra pessoa (outras telas animam com o mesmo `prize_id`). */
  onRemoteSpin?: (spin: WheelSpinRow) => void
  /** Mudança em `wheel_prizes` (o `prizes_hash` mudou) — a roda recarrega a configuração. */
  onPrizesChanged?: () => void
  enabled?: boolean
}

/**
 * Canal `wheel` (FRONTEND-ARCH §4.5/§4.6): `wheel_queue` (*), `wheel_spins` (INSERT, UPDATE), `wheel_prizes` (*)
 * → invalida `wheel.all()` com debounce; INSERT em `wheel_spins` cujo `spun_by !== me.id` dispara `onRemoteSpin`.
 */
export function useWheelRealtime(opts: WheelRealtimeOptions = {}): void {
  const qc = useQueryClient()
  const { me } = useMe()
  const meId = me.id
  const enabled = opts.enabled ?? true
  const callbacks = useRef(opts)
  callbacks.current = opts

  useEffect(() => {
    if (!enabled) return undefined
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleInvalidate = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void qc.invalidateQueries({ queryKey: qk.wheel.all() })
        void qc.invalidateQueries({ queryKey: qk.bootstrap() })
      }, INVALIDATE_DEBOUNCE_MS)
    }
    const subs: TableSubscription<RealtimeTable>[] = [
      { table: 'wheel_queue', event: '*', onChange: scheduleInvalidate },
      {
        table: 'wheel_spins',
        event: 'INSERT',
        onChange: (payload) => {
          const spin = payload.new as Partial<WheelSpinRow>
          if (spin.id && spin.prize_id && spin.spun_by !== meId) {
            callbacks.current.onRemoteSpin?.(spin as WheelSpinRow)
          }
          scheduleInvalidate()
        },
      },
      { table: 'wheel_spins', event: 'UPDATE', onChange: scheduleInvalidate },
      {
        table: 'wheel_prizes',
        event: '*',
        onChange: () => {
          callbacks.current.onPrizesChanged?.()
          scheduleInvalidate()
        },
      },
    ]
    const unsubscribe = subscribeToTables(CHANNEL, subs)
    return () => {
      if (timer) clearTimeout(timer)
      unsubscribe()
    }
  }, [qc, meId, enabled])
}
