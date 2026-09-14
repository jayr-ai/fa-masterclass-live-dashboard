import type { MasterclassRun } from '../types/dashboard'

interface RunSelectorProps {
  runs: MasterclassRun[]
  selected: string
  onChange: (value: string) => void
}

export function RunSelector({ runs, selected, onChange }: RunSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="run-selector" className="text-xs font-medium uppercase tracking-wide text-fa-text-dim">
        Masterclass Date
      </label>
      <select
        id="run-selector"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-fa-border bg-fa-surface px-3 py-2 text-sm text-fa-text focus:border-fa-accent focus:outline-none"
      >
        {runs.map((r) => (
          <option key={r.date} value={r.date}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  )
}
