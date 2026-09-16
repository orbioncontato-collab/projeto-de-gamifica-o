import { callRpc, supabase, unwrap } from '@/lib/supabase'
import type {
  ChallengeRow,
  ChallengeStatus,
  FinishChallengePayload,
  SaveChallengeInput,
  VChallengeBoard,
} from '@/lib/database.types'

/** Acesso a dados de Desafios (FRONTEND-ARCH §4.5 features/challenges). */

export const BOARD_STATUSES: readonly ChallengeStatus[] = ['active', 'draft', 'finished']

/** `v_challenge_board` da temporada por status; `participants` já vem como jsonb tipado. */
export async function getChallengeBoard(
  seasonId: string,
  statuses: readonly ChallengeStatus[] = BOARD_STATUSES,
): Promise<VChallengeBoard[]> {
  const rows = await unwrap(
    supabase
      .from('v_challenge_board')
      .select('*')
      .eq('season_id', seasonId)
      .in('status', [...statuses])
      .order('status', { ascending: true })
      .order('ends_at', { ascending: true }),
  )
  return (rows ?? []) as VChallengeBoard[]
}

export async function saveChallenge(input: SaveChallengeInput): Promise<ChallengeRow> {
  return callRpc('save_challenge', { p: input })
}

export async function activateChallenge(challengeId: string): Promise<ChallengeRow> {
  return callRpc('activate_challenge', { p_challenge_id: challengeId })
}

export async function finishChallenge(challengeId: string): Promise<FinishChallengePayload> {
  return callRpc('finish_challenge', { p_challenge_id: challengeId })
}

export async function cancelChallenge(challengeId: string, reason?: string): Promise<ChallengeRow> {
  return callRpc('cancel_challenge', { p_challenge_id: challengeId, p_reason: reason ?? null })
}
