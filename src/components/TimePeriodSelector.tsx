import { useMemo } from 'react'

interface Props {
  selected: string
  onChange: (period: string) => void
  periods?: string[]
}

const DEFAULT_PERIODS = ['7d', '30d', '90d', '1y', 'All']

const PERIOD_MS: Record<string, number> = {
  '7d': 7 * 86400000,
  '30d': 30 * 86400000,
  '90d': 90 * 86400000,
  '1y': 365 * 86400000,
}

export function TimePeriodSelector({ selected, onChange, periods = DEFAULT_PERIODS }: Props) {
  return (
    <div className="flex items-center gap-1">
      {periods.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={
            selected === p
              ? 'px-2.5 py-1 border bg-ink text-paper border-ink font-semibold font-sans text-xs transition-colors'
              : 'px-2.5 py-1 border bg-paper text-ink-muted border-rule hover:border-ink font-sans text-xs transition-colors cursor-pointer'
          }
          type="button"
        >
          {p}
        </button>
      ))}
    </div>
  )
}

export function filterDataByPeriod<T extends { date: number }>(data: T[], period: string): T[] {
  if (period === 'All' || !PERIOD_MS[period]) return data
  const cutoff = Date.now() - PERIOD_MS[period]
  return data.filter((d) => d.date >= cutoff)
}
