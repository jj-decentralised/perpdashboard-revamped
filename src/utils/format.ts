export function formatUSD(value: number | null | undefined, compact = false): string {
  if (value == null || !isFinite(value)) return '$0'
  if (compact) {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
    return `$${value.toFixed(0)}`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value == null || !isFinite(value)) return '0'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  })
}

export function formatDateShort(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })
}

export function percentClass(value: number | null | undefined): string {
  if (value == null) return ''
  return value >= 0 ? 'positive' : 'negative'
}

export function classNames(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatFundingRate(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '—'
  // CoinGecko funding_rate is already a percentage (0.01 = 0.01%)
  return `${value >= 0 ? '+' : ''}${value.toFixed(4)}%`
}

export function formatMultiple(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '—'
  if (value > 1000) return '>1000x'
  return `${value.toFixed(1)}x`
}

export function fundingRateClass(value: number | null | undefined): string {
  if (value == null) return ''
  return value >= 0 ? 'positive' : 'negative'
}

export function formatBPS(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '—'
  if (value < 0.1) return `${value.toFixed(2)} bps`
  if (value < 10) return `${value.toFixed(1)} bps`
  return `${value.toFixed(0)} bps`
}
