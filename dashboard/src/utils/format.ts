// AUD assumption — see README (Meta account + GHL location are AU-based, unconfirmed for all figures)
export function formatCurrency(value: number, opts?: { compact?: boolean; exact?: boolean }): string {
  if (opts?.compact) {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: opts?.exact ? 2 : undefined,
    maximumFractionDigits: opts?.exact ? 2 : value % 1 === 0 ? 0 : 2,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-AU').format(value)
}

export function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { month: 'short', day: '2-digit' })
}
