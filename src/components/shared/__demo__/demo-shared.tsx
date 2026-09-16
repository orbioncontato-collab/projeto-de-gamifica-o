import { useState } from 'react'
import { Bolt, Gift, Inbox, Medal, Trophy } from 'lucide-react'
import { useMeOptional } from '@/features/auth/bootstrap-query'
import { formatBRL, formatDateTime, formatPoints } from '@/lib/format'
import { RpcError } from '@/lib/rpc-errors'
import { Button } from '@/components/ui/button'
import { AchievementsMiniGrid } from '@/components/shared/achievements-mini-grid'
import { Avatar } from '@/components/shared/avatar'
import { Badge } from '@/components/shared/badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Countdown } from '@/components/shared/countdown'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { FormField } from '@/components/shared/form-field'
import { IconTile } from '@/components/shared/icon-tile'
import { MoneyInput } from '@/components/shared/money-input'
import { PageFrame } from '@/components/shared/page-frame'
import { PremiumCard } from '@/components/shared/premium-card'
import { Progress } from '@/components/shared/progress'
import { SectionHeader } from '@/components/shared/section-header'
import {
  CardSkeleton,
  ListSkeleton,
  LoadingState,
  TableSkeleton,
  WheelSkeleton,
} from '@/components/shared/skeletons'
import { StatCard } from '@/components/shared/stat-card'
import { StatusPill } from '@/components/shared/status-pill'
import { UnderConstruction } from '@/components/shared/under-construction'
import { TONE_PILL } from '@/components/shared/types'
import { Demo } from './demo-block'
import { ALL_TONES, CATALOG_COLUMNS, CATALOG_ROWS, STATUS_MAP } from './demo-data'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export interface SharedDemosProps {
  /** cores de exemplo para `profiles.color` (hex de 6 dígitos, DATA-MODEL §4.6) — vêm da rota, como dado */
  avatarColors: readonly string[]
}

/** Coluna com todos os componentes de `components/shared` (uma por tema na vitrine). */
export function SharedDemos({ avatarColors }: SharedDemosProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [money, setMoney] = useState<number | null>(8500)
  const me = useMeOptional()
  const inOneHour = Date.now() + HOUR_MS
  const sampleError = new RpcError('SEASON_NOT_ACTIVE', 'SEASON_NOT_ACTIVE', null, null)

  return (
    <div className="space-y-8">
      <Demo title="PageFrame + SectionHeader" stack>
        <PageFrame
          eyebrow="Exemplo"
          title="Título da página"
          subtitle="Subtítulo opcional"
          action={<Button size="sm">Ação</Button>}
        >
          <SectionHeader
            eyebrow="Seção"
            title="Cabeçalho de seção"
            action={
              <Button variant="secondary" size="sm">
                Ver tudo
              </Button>
            }
          />
        </PageFrame>
      </Demo>

      <Demo title="PremiumCard (tons + glow)">
        {(['default', 'green', 'gold', 'purple', 'red', 'blue'] as const).map((tone) => (
          <PremiumCard key={tone} tone={tone} glow={tone !== 'default'} padding="sm" className="min-w-40">
            <div className="text-xs font-bold uppercase text-muted">{tone}</div>
            <div className="nums text-lg font-black">{formatBRL(12500)}</div>
          </PremiumCard>
        ))}
      </Demo>

      <Demo title="Badge (todos os tons)">
        {ALL_TONES.map((tone) => (
          <Badge key={tone} tone={tone}>
            {tone}
          </Badge>
        ))}
      </Demo>

      <Demo title="IconTile">
        {(['green', 'gold', 'red', 'blue', 'purple', 'cyan', 'dark'] as const).map((tone) => (
          <IconTile key={tone} icon={Bolt} tone={tone} />
        ))}
        <IconTile icon={Trophy} tone="gold" size="lg" />
        <IconTile icon={Gift} tone="purple" size="sm" />
      </Demo>

      <Demo title="StatCard">
        <StatCard
          label="Pontos"
          value={formatPoints(1250)}
          icon={Bolt}
          tone="green"
          hint="nesta temporada"
          className="min-w-48"
        />
        <StatCard
          label="Vendas"
          value={formatBRL(48000, { compact: true })}
          icon={Trophy}
          tone="gold"
          to="/ranking"
          className="min-w-48"
        />
      </Demo>

      <Demo title="Progress" stack>
        <Progress value={35} tone="green" label="Progresso de exemplo" />
        <Progress value={70} tone="gold" size="lg" glow label="Meta" />
        <Progress value={100} tone="purple" size="sm" label="Concluído" />
        <Progress value={55} tone="red" label="Duelo" />
        <Progress value={20} tone="blue" glow label="Desafio coletivo" />
      </Demo>

      <Demo title="Avatar (sem foto — iniciais)">
        {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size, i) => (
          <Avatar
            key={size}
            name="Regra Exemplo"
            color={avatarColors[i % avatarColors.length] ?? ''}
            size={size}
            ring={size === 'lg'}
          />
        ))}
      </Demo>

      <Demo title="StatusPill">
        <StatusPill status="active" map={STATUS_MAP} />
        <StatusPill status="inactive" map={STATUS_MAP} />
        <StatusPill status="desconhecido" map={STATUS_MAP} />
        <span className={`rounded-full border px-2 py-0.5 text-xs ${TONE_PILL.cyan}`}>classe TONE_PILL</span>
      </Demo>

      <Demo title="Countdown">
        <Countdown to={inOneHour} />
        <Countdown to={inOneHour + 3 * DAY_MS} mode="days" />
        <span className="text-xs text-muted">{formatDateTime(new Date(inOneHour).toISOString())}</span>
      </Demo>

      <Demo title="FormField + MoneyInput">
        <FormField
          label="Valor da venda"
          htmlFor="money-demo"
          hint="Use vírgula para centavos"
          required
          className="w-full max-w-64"
        >
          <MoneyInput id="money-demo" value={money} onChange={setMoney} />
        </FormField>
        <FormField
          label="Com erro"
          htmlFor="money-err"
          error="Informe um valor em reais válido."
          className="w-full max-w-64"
        >
          <MoneyInput
            id="money-err"
            value={null}
            onChange={() => undefined}
          />
        </FormField>
      </Demo>

      <Demo title="DataTable (catálogo seed)" stack>
        <DataTable
          columns={CATALOG_COLUMNS}
          rows={CATALOG_ROWS}
          rowKey={(r) => r.key}
          caption="Regras de pontuação do catálogo"
          onRowClick={() => undefined}
          empty={<EmptyState compact icon={Inbox} title="Nada aqui" description="Sem linhas." />}
          mobileCard={(r) => (
            <div className="premium-card flex items-center justify-between p-4">
              <span className="font-semibold">{r.label}</span>
              <StatusPill status={r.status} map={STATUS_MAP} />
            </div>
          )}
        />
        <DataTable
          columns={CATALOG_COLUMNS}
          rows={[]}
          rowKey={(r) => r.key}
          empty={
            <EmptyState compact icon={Inbox} title="Tabela vazia" description="Sem linhas para mostrar." />
          }
        />
      </Demo>

      <Demo title="EmptyState / ErrorState / UnderConstruction" stack>
        <EmptyState
          icon={Medal}
          title="Nenhuma conquista ainda"
          description="As conquistas aparecem quando forem desbloqueadas."
          action={{ label: 'Ver ranking', to: '/ranking' }}
          adminHint="Cadastre conquistas em Administração."
        />
        <EmptyState compact icon={Inbox} title="Vazio compacto" description="Variante compacta." />
        <ErrorState error={sampleError} onRetry={() => undefined} />
        <ErrorState error={new Error('Falha genérica')} compact />
        <UnderConstruction eyebrow="Stub" title="Tela em construção" owner="WP0" />
      </Demo>

      <Demo title="Skeletons" stack>
        <CardSkeleton />
        <ListSkeleton rows={3} />
        <TableSkeleton rows={2} cols={3} />
        <WheelSkeleton />
        <LoadingState label="Carregando exemplo…" />
      </Demo>

      <Demo title="ConfirmDialog (foco preso, Esc cancela, Enter confirma)">
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          Abrir confirmação
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Estornar lançamento?"
          description="Esta ação cria um lançamento inverso e não pode ser desfeita."
          confirmLabel="Estornar"
          tone="danger"
          onConfirm={() => setConfirmOpen(false)}
        />
      </Demo>

      <Demo title="AchievementsMiniGrid (precisa de sessão)">
        {me ? (
          <AchievementsMiniGrid limit={6} className="w-full" />
        ) : (
          <span className="text-sm text-muted">Entre no app para ver o mini-grid com dados reais.</span>
        )}
      </Demo>
    </div>
  )
}
