import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { VRanking } from '@/lib/database.types'
import { firstName, formatPoints } from '@/lib/format'
import { useChartTheme, CHART_HEIGHT } from '../chart-theme'
import { toPersonPoints } from '../admin-utils'
import { ChartCard } from './chart-card'

const BAR_RADIUS: [number, number, number, number] = [8, 8, 0, 0]

/** Pontos por colaborador (barras, cor da pessoa). Vazio quando ninguém pontuou. */
export function PointsBarChart({ ranking }: { ranking: VRanking[] }) {
  const ct = useChartTheme()
  const data = toPersonPoints(ranking)
  return (
    <ChartCard
      eyebrow="Time"
      title="Pontos por colaborador"
      hasData={data.length > 0}
      emptyTitle="Ninguém pontuou ainda"
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={ct.grid.stroke} strokeDasharray={ct.grid.strokeDasharray} vertical={false} />
          <XAxis
            dataKey="name"
            tickFormatter={(v: string) => firstName(v)}
            tick={{ fill: ct.axis.stroke, fontSize: ct.axis.fontSize }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tickFormatter={(v: number) => formatPoints(v)}
            tick={{ fill: ct.axis.stroke, fontSize: ct.axis.fontSize }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ fill: ct.grid.stroke, opacity: 0.35 }}
            contentStyle={{
              background: ct.tooltip.background,
              border: `1px solid ${ct.tooltip.border}`,
              borderRadius: 12,
              color: ct.tooltip.color,
            }}
            formatter={(value) => [formatPoints(Number(value)), 'Pontos']}
          />
          <Bar dataKey="points" name="Pontos" radius={BAR_RADIUS} isAnimationActive={false} maxBarSize={44}>
            {data.map((p) => (
              <Cell key={p.profileId} fill={p.color || ct.palette.accent} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
