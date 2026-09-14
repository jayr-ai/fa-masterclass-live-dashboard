import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { CATEGORICAL, CHART_SURFACE } from '../utils/chartPalette'
import { formatCurrency, formatPct } from '../utils/format'

interface DonutSliceInput {
  label: string
  amount: number
  pct: number
}

interface DonutChartProps {
  title: string
  slices: DonutSliceInput[]
}

export function DonutChart({ title, slices }: DonutChartProps) {
  const data = slices.map((s, i) => ({ ...s, fill: CATEGORICAL[i % CATEGORICAL.length] }))

  return (
    <div className="rounded-xl border border-fa-border bg-fa-surface p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-fa-text-dim">{title}</div>
      <div className="mt-2 flex items-center gap-4">
        <div className="h-40 w-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="pct"
                nameKey="label"
                innerRadius="65%"
                outerRadius="100%"
                paddingAngle={2}
                stroke={CHART_SURFACE}
                strokeWidth={2}
              >
                {data.map((d) => (
                  <Cell key={d.label} fill={d.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1c2a24', border: '1px solid rgba(237,237,238,0.1)', borderRadius: 8, fontSize: 12 }}
                formatter={(value, _n, entry) => {
                  const amount = (entry?.payload as DonutSliceInput | undefined)?.amount
                  return [`${formatPct(Number(value))} · ${amount !== undefined ? formatCurrency(amount) : ''}`, '']
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2">
          {data.map((d) => (
            <div key={d.label} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.fill }} />
              <span className="text-fa-text-dim">{d.label}</span>
              <span className="font-medium text-fa-text">{formatCurrency(d.amount, { compact: true })}</span>
              <span className="text-fa-text-faint">{formatPct(d.pct)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
