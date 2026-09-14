export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-fa-text-faint">{label}</div>
      <div className="mt-1 text-lg font-semibold text-fa-text">{value}</div>
    </div>
  )
}
