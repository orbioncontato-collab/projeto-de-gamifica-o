import { getISOWeek, getISOWeekYear } from 'date-fns'
import { DEFAULT_TZ } from './format'

/**
 * Datas no fuso do app (`settings.timezone`), não no do navegador (FRONTEND-ARCH §4.10).
 * Inputs `datetime-local` trabalham com "parede" local; aqui convertemos de/para ISO UTC.
 */

interface WallParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const partsFormatter = (tz: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

/** Componentes de "parede" de um instante no fuso. */
export function wallParts(date: Date, tz = DEFAULT_TZ): WallParts {
  const parts = partsFormatter(tz).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  }
}

/** Offset (ms) do fuso em relação ao UTC no instante dado: local = utc + offset. */
export function tzOffsetMs(date: Date, tz = DEFAULT_TZ): number {
  const w = wallParts(date, tz)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** "YYYY-MM-DD" do dia local no fuso. */
export function localDay(iso: string | Date, tz = DEFAULT_TZ): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  const w = wallParts(d, tz)
  return `${w.year}-${pad2(w.month)}-${pad2(w.day)}`
}

/** ISO → valor de `<input type="datetime-local">` ("YYYY-MM-DDTHH:mm") no fuso do app. */
export function toDateTimeLocalValue(iso: string | null | undefined, tz = DEFAULT_TZ): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const w = wallParts(d, tz)
  return `${w.year}-${pad2(w.month)}-${pad2(w.day)}T${pad2(w.hour)}:${pad2(w.minute)}`
}

/** Valor de `datetime-local` (parede no fuso do app) → ISO UTC. Retorna null se inválido. */
export function fromDateTimeLocalValue(value: string, tz = DEFAULT_TZ): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const guess = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? '0'))
  if (Number.isNaN(guess)) return null
  const first = guess - tzOffsetMs(new Date(guess), tz)
  const second = guess - tzOffsetMs(new Date(first), tz) // corrige virada de horário de verão
  return new Date(second).toISOString()
}

/** Valor de `<input type="date">` ("YYYY-MM-DD") → ISO da meia-noite local no fuso. */
export function fromDateLocalValue(value: string, tz = DEFAULT_TZ): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null
  return fromDateTimeLocalValue(`${value.trim()}T00:00`, tz)
}

/** "YYYY-MM-DD" de hoje no fuso. */
export function todayLocal(tz = DEFAULT_TZ, now: Date = new Date()): string {
  return localDay(now, tz)
}

/** Soma dias a um "YYYY-MM-DD" (calendário, sem fuso). */
export function addDaysLocal(day: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return day
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days))
  return d.toISOString().slice(0, 10)
}

/** starts_at <= iso < ends_at (fim exclusivo, DATA-MODEL §4.3) */
export function seasonContains(season: { starts_at: string; ends_at: string }, iso: string | Date): boolean {
  const t = (typeof iso === 'string' ? new Date(iso) : iso).getTime()
  if (Number.isNaN(t)) return false
  return t >= new Date(season.starts_at).getTime() && t < new Date(season.ends_at).getTime()
}

/** "2026-W37" (semana ISO) — mesma chave de `milestone_awards.period_key` */
export function isoWeekKey(date: Date): string {
  return `${getISOWeekYear(date)}-W${pad2(getISOWeek(date))}`
}
