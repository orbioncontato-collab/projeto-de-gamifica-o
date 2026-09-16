/**
 * Formatadores pt-BR (FRONTEND-ARCH §4.8). Proibido `toLocaleString` direto nas features — tudo passa por aqui.
 * Fuso: `settings.timezone` (default America/Sao_Paulo).
 */

export const DEFAULT_TZ = 'America/Sao_Paulo'
const LOCALE = 'pt-BR'
const NBSP = /\u00A0/g // Intl pt-BR separa "R$" do número com NBSP

const normalizeSpaces = (s: string): string => s.replace(NBSP, ' ')
const safe = (n: number): number => (Number.isFinite(n) ? n : 0)

export const formatBRL = (n: number, opts?: { compact?: boolean; cents?: boolean }): string => {
  const value = safe(n)
  const options: Intl.NumberFormatOptions = { style: 'currency', currency: 'BRL' }
  if (opts?.compact && Math.abs(value) >= 1000) {
    options.notation = 'compact'
    options.maximumFractionDigits = 1
  } else if (opts?.cents) {
    options.minimumFractionDigits = 2
    options.maximumFractionDigits = 2
  } else {
    options.minimumFractionDigits = 0
    options.maximumFractionDigits = 0
  }
  return normalizeSpaces(new Intl.NumberFormat(LOCALE, options).format(value))
}

export const formatNumber = (n: number, digits = 0): string =>
  normalizeSpaces(
    new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
      safe(n),
    ),
  )

/** "1.850 pts" — sinal tipográfico quando negativo: "−200 pts" */
export const formatPoints = (n: number): string => {
  const value = safe(n)
  const abs = formatNumber(Math.abs(value))
  return `${value < 0 ? '−' : ''}${abs} pts`
}

/** "740 moedas" / "1 moeda" */
export const formatCoins = (n: number): string => {
  const value = safe(n)
  const abs = Math.abs(value)
  return `${value < 0 ? '−' : ''}${formatNumber(abs)} ${abs === 1 ? 'moeda' : 'moedas'}`
}

/** "92,5%" | "—"; acima de 100 em conversão/comparecimento a UI decide mostrar "100%+" */
export const formatPct = (n: number | null, digits = 0): string => {
  if (n === null || !Number.isFinite(n)) return '—'
  return `${formatNumber(n, digits)}%`
}

/** "3º" | "—" */
export const formatOrdinal = (n: number | null): string => (n === null || !Number.isFinite(n) ? '—' : `${n}º`)

const dateParts = (iso: string, tz: string, options: Intl.DateTimeFormatOptions): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(LOCALE, { timeZone: tz, ...options }).format(d)
}

/** "27/09" */
export const formatDateShort = (iso: string, tz = DEFAULT_TZ): string =>
  dateParts(iso, tz, { day: '2-digit', month: '2-digit' })

/** "27/09/2026" */
export const formatDate = (iso: string, tz = DEFAULT_TZ): string =>
  dateParts(iso, tz, { day: '2-digit', month: '2-digit', year: 'numeric' })

/** "14:00" */
export const formatTime = (iso: string, tz = DEFAULT_TZ): string =>
  dateParts(iso, tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "27/09/2026 14:00" */
export const formatDateTime = (iso: string, tz = DEFAULT_TZ): string => {
  const date = formatDate(iso, tz)
  if (date === '—') return date
  return `${date} ${formatTime(iso, tz)}`
}

/** "14:00 às 16:00" */
export const formatTimeRange = (startIso: string, endIso: string, tz = DEFAULT_TZ): string =>
  `${formatTime(startIso, tz)} às ${formatTime(endIso, tz)}`

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "Agora" (<60s), "12 min", "1 h", "Ontem", "3 d", senão formatDateShort */
export const formatRelative = (iso: string, now: number = Date.now(), tz = DEFAULT_TZ): string => {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(now - t, 0)
  if (diff < MINUTE) return 'Agora'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h`
  if (diff < 2 * DAY) return 'Ontem'
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} d`
  return formatDateShort(iso, tz)
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** "02:14:30" (HH:MM:SS, nunca negativo; > 99 h → "4d 02:14") */
export const formatCountdown = (seconds: number): string => {
  const total = Math.max(0, Math.floor(safe(seconds)))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 99) {
    const days = Math.floor(hours / 24)
    return `${days}d ${pad2(hours % 24)}:${pad2(minutes)}`
  }
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(secs)}`
}

/** "finaliza em 2 dias" | "finaliza em 1 dia" | "finaliza hoje" | "encerrado" */
export const formatDaysLeft = (days: number): string => {
  const d = Math.floor(safe(days))
  if (d < 0) return 'encerrado'
  if (d === 0) return 'finaliza hoje'
  return `finaliza em ${d} ${d === 1 ? 'dia' : 'dias'}`
}

/** "Nome Sobrenome" → "NS" (primeira e última palavra; nome único → 2 primeiras letras) */
export const initials = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

export const firstName = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? ''

/** "A3F9C21B7E04" → "A3F9-C21B-7E04" */
export const maskTeamCode = (code: string): string => {
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return clean.replace(/(.{4})(?=.)/g, '$1-')
}

const TEAM_CODE_VISIBLE_TAIL = 4

/** "A3F9-C21B-7E04" → "••••-••••-7E04" (só os 4 últimos visíveis, DATA-MODEL §4.2). */
export const hideTeamCode = (masked: string): string => {
  if (masked.length <= TEAM_CODE_VISIBLE_TAIL) return masked
  return (
    masked.slice(0, -TEAM_CODE_VISIBLE_TAIL).replace(/[A-Z0-9]/gi, '•') +
    masked.slice(-TEAM_CODE_VISIBLE_TAIL)
  )
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" sem passar por `Date` (dia de calendário, não vira o dia no fuso). */
export const formatLocalDay = (day: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : day
}

export const pluralize = (n: number, singular: string, plural: string): string =>
  `${formatNumber(n)} ${Math.abs(n) === 1 ? singular : plural}`
