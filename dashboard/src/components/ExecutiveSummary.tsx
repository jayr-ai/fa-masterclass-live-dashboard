interface ExecutiveSummaryProps {
  bullets: string[]
}

export function ExecutiveSummary({ bullets }: ExecutiveSummaryProps) {
  if (bullets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-fa-border bg-fa-surface/40 p-5 text-sm text-fa-text-faint">
        No executive summary available for this period.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-fa-accent/25 bg-fa-surface p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-fa-neon" />
        <div className="text-xs font-medium uppercase tracking-wide text-fa-accent">Executive Summary</div>
      </div>
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="text-sm leading-relaxed text-fa-text-dim">
            {b}
          </li>
        ))}
      </ul>
    </div>
  )
}
