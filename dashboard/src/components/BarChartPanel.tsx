import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { CATEGORICAL, GRIDLINE, AXIS_MUTED } from '../utils/chartPalette'
import { formatCurrency } from '../utils/format'

interface BarDatum {
  label: string
  amount: number
  muted?: boolean // e.g. notCaptured day — render as faint/empty
  approximate?: boolean
}

interface BarChartPanelProps {
  title: string
  data: BarDatum[]
  orientation?: 'vertical' | 'horizontal' // vertical = bars go up (time series), horizontal = bars go right (comparison)
  height?: number
  colorIndex?: number
}

export function BarChartPanel({
  title,
  data,
  orientation = 'vertical',
  height = 220,
  colorIndex = 0,
}: BarChartPanelProps) {
  const color = CATEGORICAL[colorIndex % CATEGORICAL.length]

  return (
    <div className="rounded-xl border border-fa-border bg-fa-surface p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-fa-text-dim">{title}</div>
      </div>
      <div className="mt-3" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {orientation === 'vertical' ? (
            <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRIDLINE} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fill: AXIS_MUTED, fontSize: 11 }}
                axisLine={{ stroke: GRIDLINE }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: AXIS_MUTED, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
                width={54}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                contentStyle={{ background: '#1c2a24', border: '1px solid rgba(237,237,238,0.1)', borderRadius: 8, fontSize: 12 }}
                formatter={(value, _n, entry) => {
                  const d = entry?.payload as BarDatum
                  if (d?.muted) return ['not captured in source', '']
                  return [formatCurrency(Number(value)) + (d?.approximate ? ' (approx.)' : ''), 'Cash']
                }}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.muted ? 'transparent' : color}
                    stroke={d.muted ? GRIDLINE : d.approximate ? color : 'none'}
                    strokeDasharray={d.muted ? '3 3' : d.approximate ? '2 2' : undefined}
                    strokeWidth={d.muted || d.approximate ? 1 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={GRIDLINE} strokeDasharray="3 3" />
              <XAxis
                type="number"
                tick={{ fill: AXIS_MUTED, fontSize: 11 }}
                axisLine={{ stroke: GRIDLINE }}
                tickLine={false}
                tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fill: AXIS_MUTED, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={190}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                contentStyle={{ background: '#1c2a24', border: '1px solid rgba(237,237,238,0.1)', borderRadius: 8, fontSize: 12 }}
                formatter={(value) => formatCurrency(Number(value))}
              />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.amount < 0 ? '#f87171' : color} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
