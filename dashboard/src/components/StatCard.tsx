import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  trendPct?: number | null // undefined = no trend shown, null = "N/A"
  trendDirection?: 'higher-is-better' | 'lower-is-better' // default: higher-is-better
  sublabel?: string
  variant?: 'default' | 'hero' | 'noData'
  icon?: ReactNode
}

export function StatCard({ label, value, trendPct, trendDirection = 'higher-is-better', sublabel, variant = 'default', icon }: StatCardProps) {
  const getTrendColor = (pct: number): string => {
    if (trendDirection === 'lower-is-better') {
      return pct <= 0 ? 'text-fa-neon' : 'text-fa-red'
    }
    return pct >= 0 ? 'text-fa-neon' : 'text-fa-red'
  }

  const getTrendArrow = (pct: number): string => {
    if (trendDirection === 'lower-is-better') {
      return pct <= 0 ? '▼' : '▲'
    }
    return pct >= 0 ? '▲' : '▼'
  }

  if (variant === 'noData') {
    return (
      <div className="rounded-xl border border-dashed border-fa-border bg-fa-surface/40 p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-fa-text-faint">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-fa-text-faint">No data</div>
        <div className="mt-1 text-xs text-fa-text-faint">Not yet wired — Phase 2</div>
      </div>
    )
  }

  if (variant === 'hero') {
    return (
      <div className="rounded-xl border border-fa-accent/30 bg-fa-surface p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-fa-text-dim">{label}</div>
        <div className="mt-2 text-4xl font-bold text-fa-neon">{value}</div>
        {sublabel && <div className="mt-1 text-sm text-fa-text-dim">{sublabel}</div>}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-fa-border bg-fa-surface p-5 transition-colors hover:border-fa-accent/40">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-fa-text-dim">{label}</div>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold text-fa-text">{value}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        {typeof trendPct === 'number' && (
          <span className={getTrendColor(trendPct)}>
            {getTrendArrow(trendPct)} {Math.abs(trendPct).toFixed(1)}%
          </span>
        )}
        {(trendPct === null || trendPct === undefined) && <span className="text-fa-text-faint">—</span>}
        {sublabel && <span className="text-fa-text-faint">{sublabel}</span>}
      </div>
    </div>
  )
}
