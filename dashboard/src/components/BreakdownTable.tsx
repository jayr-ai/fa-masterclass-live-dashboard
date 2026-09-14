import type { BreakdownRow, CellValue } from '../data/mockWeeklyBreakdown'
import { formatCurrency, formatNumber, formatPct } from '../utils/format'

// One tint per row group, cycling the app's validated chart palette at low
// opacity — a dark-surface-friendly stand-in for the source sheet's pastel
// row-group colors (those were designed for a white sheet background).
export const GROUP_TINTS: Record<string, string> = {
  adSpend: 'rgba(217, 89, 38, 0.10)',
  charlie: 'rgba(57, 135, 229, 0.10)',
  dialer: 'rgba(57, 135, 229, 0.10)',
  outbound: 'rgba(25, 158, 112, 0.10)',
  otherBookings: 'rgba(201, 133, 0, 0.10)',
  overall: 'rgba(0, 131, 0, 0.10)',
  calls: 'rgba(213, 81, 129, 0.10)',
  sales: 'rgba(213, 81, 129, 0.10)',
  efficiency: 'rgba(144, 133, 233, 0.10)',
}

function formatCell(value: CellValue, format: BreakdownRow['format']): string {
  if (value === null) return '—'
  if (value === 'N/A') return 'N/A'
  if (format === 'currency') return formatCurrency(value, { exact: true })
  if (format === 'percent') return formatPct(value, 2)
  return formatNumber(value)
}

export interface BreakdownColumn {
  key: string
  headerTop: string
  headerBottom: string
}

interface BreakdownTableProps {
  rows: BreakdownRow[]
  columns: BreakdownColumn[]
}

export function BreakdownTable({ rows, columns }: BreakdownTableProps) {
  let lastGroup: string | null = null

  return (
    <div className="overflow-x-auto rounded-xl border border-fa-border">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 min-w-[220px] border-b border-fa-border bg-fa-surface-2 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-fa-text-dim">
              Metric
            </th>
            <th className="sticky left-[220px] z-20 min-w-[110px] border-b border-r border-fa-border bg-fa-surface-2 px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-fa-text-dim">
              YTD
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                className="min-w-[92px] whitespace-nowrap border-b border-fa-border bg-fa-surface-2 px-3 py-2 text-right text-xs font-medium text-fa-text-dim"
              >
                <div>{c.headerTop}</div>
                <div className="font-normal text-fa-text-faint">{c.headerBottom}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isNewGroup = row.group !== lastGroup && !row.indent
            lastGroup = row.group
            const tint = GROUP_TINTS[row.group] ?? 'transparent'
            return (
              <tr key={row.key} style={{ background: tint }} className={isNewGroup ? 'border-t border-fa-border' : ''}>
                <td
                  className={
                    'sticky left-0 z-10 whitespace-nowrap border-b border-fa-border px-3 py-2 ' +
                    (row.indent ? 'pl-7 text-fa-text-faint' : 'font-medium text-fa-text')
                  }
                  style={{ background: tint === 'transparent' ? '#172114' : `color-mix(in srgb, ${tint}, #172114)` }}
                >
                  {row.label}
                </td>
                <td
                  className="sticky left-[220px] z-10 whitespace-nowrap border-b border-r border-fa-border px-3 py-2 text-right font-medium text-fa-text"
                  style={{ background: tint === 'transparent' ? '#172114' : `color-mix(in srgb, ${tint}, #172114)` }}
                >
                  {row.ytd === null ? '—' : formatCell(row.ytd, row.format)}
                </td>
                {columns.map((c) => (
                  <td key={c.key} className="whitespace-nowrap border-b border-fa-border px-3 py-2 text-right text-fa-text-dim">
                    {formatCell(row.values[c.key] ?? null, row.format)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
