import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { BreakdownColumn } from './BreakdownTable'
import type { BreakdownRow } from '../data/mockWeeklyBreakdown'
import { GRIDLINE, AXIS_MUTED, CHART_SURFACE } from '../utils/chartPalette'
import { formatCurrency } from '../utils/format'

export interface TrendSeries {
  key: string
  label: string
  color: string
}

interface TrendLineChartProps {
  title: string
  subtitle?: string
  columns: BreakdownColumn[]
  rows: BreakdownRow[]
  series: TrendSeries[]
  height?: number
}

export function TrendLineChart({ title, subtitle, columns, rows, series, height = 260 }: TrendLineChartProps) {
  const rowByKey = Object.fromEntries(rows.map((r) => [r.key, r]))

  // Only chart periods where at least one series has a real value — a mostly-empty
  // axis (most weeks/months have no data yet in this mock) isn't a trend, it's noise.
  const populated = columns.filter((c) =>
    series.some((s) => typeof rowByKey[s.key]?.values[c.key] === 'number'),
  )

  const data = populated.map((c) => {
    const point: Record<string, string | number | null> = {
      label: c.headerTop,
      sublabel: c.headerBottom,
    }
    for (const s of series) {
      const v = rowByKey[s.key]?.values[c.key]
      point[s.key] = typeof v === 'number' ? v : null
    }
    return point
  })

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-fa-border bg-fa-surface/40 p-5 text-sm text-fa-text-faint">
        No periods with reported data to chart yet.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-fa-border bg-fa-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-fa-text-dim">{title}</div>
          {subtitle && <div className="mt-0.5 text-[11px] text-fa-text-faint">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-4">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-fa-text-dim">
              <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`trend-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke={GRIDLINE} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: AXIS_MUTED, fontSize: 11 }}
              axisLine={{ stroke: GRIDLINE }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: AXIS_MUTED, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
              width={54}
            />
            <Tooltip
              cursor={{ stroke: AXIS_MUTED, strokeWidth: 1, strokeDasharray: '3 3' }}
              contentStyle={{
                background: '#1c2a24',
                border: '1px solid rgba(237,237,238,0.1)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(label, payload) => {
                const sub = payload?.[0]?.payload?.sublabel
                return sub ? `${label} · ${sub}` : label
              }}
              formatter={(value, name) => [
                formatCurrency(Number(value), { exact: true }),
                series.find((s) => s.key === name)?.label ?? name,
              ]}
            />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.key}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#trend-fill-${s.key})`}
                dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: s.color, stroke: CHART_SURFACE, strokeWidth: 2 }}
                connectNulls={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
