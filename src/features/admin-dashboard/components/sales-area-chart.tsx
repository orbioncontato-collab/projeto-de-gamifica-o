import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { VSalesTimeline } from '@/lib/database.types'
import { formatBRL } from '@/lib/format'
import { useChartTheme, CHART_HEIGHT } from '../chart-theme'
import { dayLabel, hasTimelineData, toSalesSeries } from '../admin-utils'
import { ChartCard } from './chart-card'

const GRADIENT_ID = 'sales-area-fill'

/** Evolução de vendas acumulada na temporada (área). */
export function SalesAreaChart({ rows }: { rows: VSalesTimeline[] }) {
  const ct = useChartTheme()
  const data = toSalesSeries(rows)
  return (
    <ChartCard eyebrow="Vendas" title="Evolução acumulada na temporada" hasData={hasTimelineData(rows)}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ct.palette.accent} stopOpacity={0.45} />
              <stop offset="100%" stopColor={ct.palette.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={ct.grid.stroke} strokeDasharray={ct.grid.strokeDasharray} vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={dayLabel}
            tick={{ fill: ct.axis.stroke, fontSize: ct.axis.fontSize }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => formatBRL(v, { compact: true })}
            tick={{ fill: ct.axis.stroke, fontSize: ct.axis.fontSize }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            cursor={{ stroke: ct.grid.stroke }}
            contentStyle={{
              background: ct.tooltip.background,
              border: `1px solid ${ct.tooltip.border}`,
              borderRadius: 12,
              color: ct.tooltip.color,
            }}
            labelFormatter={(label) => dayLabel(String(label))}
            formatter={(value) => [formatBRL(Number(value)), 'Acumulado']}
          />
          <Area
            type="monotone"
            dataKey="salesCum"
            name="Acumulado"
            stroke={ct.palette.accent}
            strokeWidth={2.5}
            fill={`url(#${GRADIENT_ID})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
