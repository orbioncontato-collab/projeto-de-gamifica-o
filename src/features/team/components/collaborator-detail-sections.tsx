import { Flag, Gift } from 'lucide-react'
import type { DashboardData, VProfileStats } from '@/lib/database.types'
import { formatBRL, formatCoins, formatNumber, formatOrdinal, formatPct, formatPoints } from '@/lib/format'
import { MISSION_KIND_LABELS } from '@/lib/labels'
import { Progress } from '@/components/shared/progress'
import { EmptyState } from '@/components/shared/empty-state'

/** Blocos internos do `CollaboratorDetailDialog` (FEATURE §2b "Modal de colaborador"). */

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-2xl border border-line bg-surface p-3">
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">{label}</p>
    <p className="nums mt-1 text-lg font-black tracking-tight text-text">{value}</p>
    {sub ? <p className="text-[11px] text-muted">{sub}</p> : null}
  </div>
)

export function DetailStatsGrid({ p }: { p: VProfileStats }) {
  const gap = p.rank === 1 ? 'líder' : p.gap_to_above !== null ? `${formatPoints(p.gap_to_above)} atrás` : '—'
  const goalPct = p.goal_amount > 0 ? formatPct(p.goal_pct) : '—'
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat
        label="Nível"
        value={String(p.level)}
        sub={`${formatPoints(p.xp_in_level)} / ${formatPoints(p.xp_per_level)} XP`}
      />
      <Stat label="Pontos" value={formatPoints(p.points)} sub={`${formatPoints(p.points_earned)} ganhos`} />
      <Stat label="Posição" value={formatOrdinal(p.rank)} sub={gap} />
      <Stat
        label="Sequência"
        value={`${p.streak_days} ${p.streak_days === 1 ? 'dia' : 'dias'}`}
        sub={`melhor: ${p.best_streak_days}`}
      />
      <Stat
        label="Moedas"
        value={formatCoins(p.coins_balance)}
        sub={`${formatCoins(p.coins_earned_lifetime)} acumuladas`}
      />
      <Stat
        label="Vendas"
        value={formatBRL(p.sales_amount, { compact: true })}
        sub={`${formatNumber(p.sales_count)} ${p.sales_count === 1 ? 'venda' : 'vendas'}`}
      />
      <Stat
        label="Reuniões"
        value={formatNumber(p.meetings_held)}
        sub={`${formatNumber(p.meetings_scheduled)} agendadas`}
      />
      <Stat
        label="Conversão"
        value={formatPct(p.conversion_pct)}
        sub={`${formatNumber(p.missions_completed)} missões`}
      />
      <div className="col-span-2 rounded-2xl border border-line bg-surface p-3 sm:col-span-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">
            Meta individual
          </p>
          <p className="nums text-sm font-black text-text">
            {p.goal_amount > 0
              ? `${formatBRL(p.sales_amount)} de ${formatBRL(p.goal_amount)} · ${goalPct}`
              : 'Meta ainda não definida'}
          </p>
        </div>
        <Progress
          value={p.goal_pct ?? 0}
          tone="green"
          size="sm"
          className="mt-2"
          label="Atingimento da meta individual"
        />
      </div>
    </div>
  )
}

export function DetailNextReward({ dash }: { dash: DashboardData }) {
  const nr = dash.next_reward
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gold/20 bg-gold/5 p-3">
      <Gift className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">
          Próxima recompensa
        </p>
        {nr ? (
          <p className="truncate font-black text-text">
            {nr.icon ? `${nr.icon} ` : ''}
            {nr.name}
            <span className="ml-2 font-semibold text-muted">
              {nr.missing_coins > 0 ? `faltam ${formatCoins(nr.missing_coins)}` : 'já pode resgatar'}
            </span>
          </p>
        ) : (
          <p className="font-semibold text-muted">Nenhuma recompensa disponível na loja.</p>
        )}
      </div>
    </div>
  )
}

export function DetailMissions({ dash }: { dash: DashboardData }) {
  const missions = dash.missions_today
  if (missions.length === 0) {
    return (
      <EmptyState
        icon={Flag}
        compact
        title="Sem missões para hoje"
        description="As missões ativas do colaborador aparecem aqui."
      />
    )
  }
  return (
    <ul className="space-y-2">
      {missions.map((m) => (
        <li key={m.mission_id} className="rounded-2xl border border-line bg-surface p-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-black text-text">
              {m.icon ? `${m.icon} ` : ''}
              {m.title}
            </span>
            <span className="shrink-0 text-[11px] font-semibold text-muted">
              {MISSION_KIND_LABELS[m.kind]} · {m.is_completed ? 'concluída' : formatPct(m.progress_pct)}
            </span>
          </div>
          <Progress
            value={m.progress_pct}
            tone={m.is_completed ? 'green' : 'blue'}
            size="sm"
            className="mt-2"
            label={`Progresso de ${m.title}`}
          />
        </li>
      ))}
    </ul>
  )
}
