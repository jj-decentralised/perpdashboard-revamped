import type { VenueType } from '../utils/classification'

export type CategorySelection = 'all' | VenueType

interface Props {
  selected: CategorySelection
  onChange: (value: CategorySelection) => void
  /** Optional counts to show in labels */
  defiCount?: number
  cefiCount?: number
}

const OPTIONS: { value: CategorySelection; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'defi', label: 'DeFi' },
  { value: 'cefi', label: 'CeFi' },
]

export function CategoryFilter({ selected, onChange, defiCount, cefiCount }: Props) {
  return (
    <div className="flex items-center gap-1">
      {OPTIONS.map(({ value, label }) => {
        const count = value === 'defi' ? defiCount : value === 'cefi' ? cefiCount : undefined
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={
              selected === value
                ? 'px-3 py-1.5 border bg-ink text-paper border-ink font-semibold font-sans text-xs'
                : 'px-3 py-1.5 border bg-paper text-ink-muted border-rule hover:border-ink font-sans text-xs cursor-pointer'
            }
            type="button"
          >
            {label}
            {count != null && (
              <span className="ml-1 opacity-60">({count})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
