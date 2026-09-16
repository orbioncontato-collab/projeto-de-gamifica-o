import { z } from 'zod'
import { zText } from '@/lib/forms'

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

/** Formulário "Editar perfil" (FEATURE §9): nome e cor; foto tem fluxo próprio (`AvatarUpload`). `color: ''` = manter. */
export const editProfileSchema = z.object({
  full_name: zText(80, 2),
  color: z.string().refine((v) => v === '' || HEX_RE.test(v), 'Cor inválida.'),
})
export type EditProfileInput = z.input<typeof editProfileSchema>
export type EditProfileOutput = z.output<typeof editProfileSchema>

/** Tokens do tema usados como paleta sugerida da cor do avatar (sem hex no código — lidos do CSS em runtime). */
export const AVATAR_COLOR_TOKENS: readonly string[] = [
  '--accent',
  '--gold',
  '--blue',
  '--purple',
  '--red',
  '--cyan',
  '--bronze',
  '--silver',
  '--avatar-fallback',
]

/** Lê os tokens no `<html>` e devolve só os que são hex válidos (formato de `profiles.color`, DATA-MODEL §4.6). */
export function readAvatarPresets(
  root: Element | null = typeof document === 'undefined' ? null : document.documentElement,
): string[] {
  if (!root) return []
  const style = getComputedStyle(root)
  const seen = new Set<string>()
  for (const token of AVATAR_COLOR_TOKENS) {
    const value = style.getPropertyValue(token).trim().toUpperCase()
    if (HEX_RE.test(value)) seen.add(value)
  }
  return [...seen]
}

export const isHexColor = (value: string): boolean => HEX_RE.test(value)

/** Só envia o que mudou; devolve `null` quando nada mudou (evita update vazio). Cor vazia = manter a atual. */
export function diffProfilePatch(
  current: { full_name: string; color: string },
  next: EditProfileOutput,
): { full_name?: string; color?: string } | null {
  const patch: { full_name?: string; color?: string } = {}
  const name = next.full_name.trim()
  if (name !== current.full_name) patch.full_name = name
  if (next.color !== '' && next.color.toUpperCase() !== current.color.toUpperCase())
    patch.color = next.color.toUpperCase()
  return Object.keys(patch).length === 0 ? null : patch
}
