import type { MasterclassStage } from '../types/dashboard'

interface FunnelStagesProps {
  stages: MasterclassStage[]
}

export function FunnelStages({ stages }: FunnelStagesProps) {
  const maxCount = Math.max(1, ...(stages || []).map((s) => s.count ?? 0))

  return (
    <div className="rounded-xl border border-fa-border bg-fa-surface p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-fa-text-dim">
        Registration → Attendance
        <span className="ml-2 normal-case text-fa-text-faint">— live snapshot, all runs combined</span>
      </div>
      <div className="mt-1 text-[11px] text-fa-text-faint">
        Current opportunity count per stage, GoHighLevel pipeline{' '}
        <code className="text-fa-text-faint">djiSwm3hJsW7Rv9tyqSl</code> — not scoped to the run selected above
      </div>
      <div className="mt-4 space-y-2.5">
        {stages.map((s) => {
          const pct = s.count === null ? 0 : Math.max(4, (s.count / maxCount) * 100)
          return (
            <div key={s.stage} className="flex items-center gap-3">
              <div className="w-52 shrink-0 truncate text-sm text-fa-text-dim">{s.stage}</div>
              <div className="relative h-6 flex-1 overflow-hidden rounded bg-fa-surface-2">
                {s.count === null ? (
                  <div className="absolute inset-0 flex items-center justify-center border border-dashed border-fa-border text-[11px] text-fa-text-faint">
                    TODO: confirm exact count
                  </div>
                ) : (
                  <div
                    className="h-full rounded bg-gradient-to-r from-fa-accent-dim to-fa-accent"
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              <div className="w-14 shrink-0 text-right text-sm font-medium text-fa-text">
                {s.count === null ? '—' : s.count.toLocaleString('en-AU')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
