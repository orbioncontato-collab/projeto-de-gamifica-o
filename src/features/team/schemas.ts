import { z } from 'zod'
import { zEmail, zMoney, zText, zTextOptional } from '@/lib/forms'
import type { AdminProfilePatch, JobTitle, UserRole, VProfileStats } from '@/lib/database.types'

/** Schemas do editor de colaborador (FEATURE §11). O formulário NUNCA inclui pontos — `record_initial_points` é à parte. */

export const JOB_TITLES: readonly JobTitle[] = ['sdr', 'closer', 'social_seller', 'supervisor', 'manager']
export const USER_ROLES: readonly UserRole[] = ['collaborator', 'admin']
const STATUSES = ['active', 'inactive'] as const

const NAME_MAX = 80
const TEAM_MAX = 40
const PHONE_MAX = 30
const NOTES_MAX = 500

export const collaboratorSchema = z.object({
  full_name: zText(NAME_MAX, 2),
  email: zEmail,
  job_title: z.enum(JOB_TITLES),
  role: z.enum(USER_ROLES),
  status: z.enum(STATUSES),
  team: zTextOptional(TEAM_MAX),
  phone: zTextOptional(PHONE_MAX),
  goal_amount: zMoney,
  notes: zTextOptional(NOTES_MAX),
})

export type CollaboratorFormInput = z.input<typeof collaboratorSchema>
export type CollaboratorFormOutput = z.output<typeof collaboratorSchema>

/** Valores iniciais a partir de `v_profile_stats` (e-mail/telefone vêm da view, admin). */
export function profileToForm(p: VProfileStats): CollaboratorFormInput {
  return {
    full_name: p.full_name,
    email: p.email ?? '',
    job_title: p.job_title,
    role: p.role,
    status: p.status === 'active' ? 'active' : 'inactive',
    team: p.team ?? '',
    phone: p.phone ?? '',
    goal_amount: p.goal_amount,
    notes: '',
  }
}

/**
 * Só as chaves que mudaram entram no patch (`INVALID_PATCH_KEY` nunca; `status` igual é no-op no banco).
 * Pendente: `status` fica fora — aprovar/recusar é pela seção Pendentes (DATA-MODEL §7.2).
 */
export function formToPatch(values: CollaboratorFormOutput, current: VProfileStats): AdminProfilePatch {
  const patch: AdminProfilePatch = {}
  if (values.full_name !== current.full_name) patch.full_name = values.full_name
  if (values.email !== (current.email ?? '')) patch.email = values.email
  if (values.job_title !== current.job_title) patch.job_title = values.job_title
  if (values.role !== current.role) patch.role = values.role
  if (current.status !== 'pending' && values.status !== current.status) patch.status = values.status
  if (values.team !== (current.team ?? null)) patch.team = values.team
  if (values.phone !== (current.phone ?? null)) patch.phone = values.phone
  if (values.goal_amount !== current.goal_amount) {
    patch.goal_amount = values.goal_amount
    patch.default_goal_amount = values.goal_amount
  }
  if (values.notes) patch.notes = values.notes
  return patch
}

export const isEmptyPatch = (patch: AdminProfilePatch): boolean => Object.keys(patch).length === 0

const INITIAL_POINTS_MIN = 1
const INITIAL_POINTS_MAX = 100_000

export const initialPointsSchema = z.object({
  points: z.coerce
    .number({ error: 'Informe os pontos.' })
    .int('Informe um número inteiro.')
    .min(INITIAL_POINTS_MIN, `Mínimo de ${INITIAL_POINTS_MIN} ponto.`)
    .max(INITIAL_POINTS_MAX, `Máximo de ${INITIAL_POINTS_MAX} pontos.`),
})
export type InitialPointsInput = z.input<typeof initialPointsSchema>
export type InitialPointsOutput = z.output<typeof initialPointsSchema>
