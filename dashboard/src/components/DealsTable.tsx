import type { Deal } from '../types/dashboard'
import { formatCurrency, formatDateShort } from '../utils/format'

export function DealsTable({ deals }: { deals: Deal[] }) {
  return (
    <div className="rounded-xl border border-fa-border bg-fa-surface p-5">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-fa-text-dim">
        Deals Closed — Detail
        <span className="ml-2 normal-case text-fa-text-faint">
          — matched via cash-attribution.json, see README
        </span>
      </div>
      {deals.length === 0 ? (
        <div className="text-sm text-fa-text-faint">No matched deals to show for this run.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-fa-text-faint">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Email</th>
                <th className="pb-2 pr-4 font-medium">Product</th>
                <th className="pb-2 pr-4 text-right font-medium">Amount</th>
                <th className="pb-2 pr-4 font-medium">Closer</th>
                <th className="pb-2 font-medium">Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fa-border/60">
              {deals.map((d, i) => (
                <tr key={`${d.email}-${d.date}-${i}`}>
                  <td className="whitespace-nowrap py-2 pr-4 text-fa-text-dim">{formatDateShort(d.date)}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-fa-text">{d.name}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-fa-text-dim">{d.email}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-fa-text-dim">{d.product}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right text-fa-text">
                    {formatCurrency(d.amount, { exact: true })}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-fa-text-dim">{d.closer}</td>
                  <td className="whitespace-nowrap py-2 text-fa-text-dim">{d.mode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
