import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { VSalesTimeline } from '@/lib/database.types'
import { formatPoints } from '@/lib/format'
import { useChartTheme, CHART_HEIGHT } from '../chart-theme'
import { dayLabel, hasTimelineData, toPointsSeries } from '../admin-utils'
import { ChartCard } from './chart-card'

/** Evolução de pontos do time (linha acumulada + pontos do dia). */
export function PointsLineChart({ rows }: { rows: VSalesTimeline[] }) {
  const ct = useChartTheme()
  const data = toPointsSeries(rows)
  return (
    <ChartCard eyebrow="Pontos" title="Evolução de pontos" hasData={hasTimelineData(rows)}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            tickFormatter={(v: number) => formatPoints(v)}
            tick={{ fill: ct.axis.stroke, fontSize: ct.axis.fontSize }}
            axisLine={false}
            tickLine={false}
            width={56}
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
            formatter={(value, name) => [
              formatPoints(Number(value)),
              name === 'pointsCum' ? 'Acumulado' : 'No dia',
            ]}
          />
          <Line
            type="monotone"
            dataKey="pointsCum"
            name="pointsCum"
            stroke={ct.palette.gold}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="points"
            name="points"
            stroke={ct.palette.blueSoft}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
