import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Tables } from './database.types'

/** Só as 5 tabelas da publicação (DATA-MODEL §12). `point_entries` não é realtime. */
export type RealtimeTable = 'wheel_queue' | 'wheel_spins' | 'wheel_prizes' | 'notifications' | 'feed_events'
export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export interface TableSubscription<T extends RealtimeTable> {
  table: T
  event?: RealtimeEvent
  filter?: string
  onChange: (payload: RealtimePostgresChangesPayload<Tables<T>>) => void
}

/** Um canal por chamada; retorna unsubscribe. Reconecta sozinho (supabase-js). */
export function subscribeToTables(channelName: string, subs: TableSubscription<RealtimeTable>[]): () => void {
  let channel = supabase.channel(channelName)
  for (const sub of subs) {
    const options: { event: RealtimeEvent; schema: 'public'; table: RealtimeTable; filter?: string } = {
      event: sub.event ?? '*',
      schema: 'public',
      table: sub.table,
    }
    if (sub.filter) options.filter = sub.filter
    channel = channel.on(
      'postgres_changes',
      options as { event: '*'; schema: 'public'; table: RealtimeTable; filter?: string },
      (payload) => sub.onChange(payload as RealtimePostgresChangesPayload<Tables<RealtimeTable>>),
    )
  }
  channel.subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

const DEBOUNCE_MS = 250

/** Invalida chaves quando a tabela muda; debounce 250 ms para rajadas. */
export function useRealtimeInvalidate(opts: {
  table: RealtimeTable
  filter?: string
  keys: readonly (readonly unknown[])[]
  enabled?: boolean
}): void {
  const qc = useQueryClient()
  const keysRef = useRef(opts.keys)
  keysRef.current = opts.keys
  const { table, filter, enabled = true } = opts

  useEffect(() => {
    if (!enabled) return undefined
    let timer: ReturnType<typeof setTimeout> | null = null
    const channelName = `${table}${filter ? `:${filter}` : ''}:${Math.random().toString(36).slice(2, 8)}`
    const sub: TableSubscription<RealtimeTable> = {
      table,
      onChange: () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = null
          for (const queryKey of keysRef.current) void qc.invalidateQueries({ queryKey })
        }, DEBOUNCE_MS)
      },
    }
    if (filter) sub.filter = filter
    const unsubscribe = subscribeToTables(channelName, [sub])
    return () => {
      if (timer) clearTimeout(timer)
      unsubscribe()
    }
  }, [qc, table, filter, enabled])
}
