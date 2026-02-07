import { useState } from 'react'

interface Props {
  description: string
  source: string
}

export function MetricInfo({ description, source }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 font-sans text-[11px] text-ink-muted hover:text-ink-light transition-colors duration-150 cursor-pointer bg-transparent border-none p-0"
        type="button"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="8" cy="8" r="7" />
          <line x1="8" y1="7" x2="8" y2="11.5" />
          <circle cx="8" cy="4.75" r="0.75" fill="currentColor" stroke="none" />
        </svg>
        {open ? 'Hide details' : 'Why this matters'}
      </button>
      {open && (
        <div className="mt-2 border-l-2 border-rule pl-3 space-y-1.5">
          <p className="font-sans text-xs text-ink-light leading-relaxed">
            {description}
          </p>
          <p className="font-sans text-[11px] text-ink-muted leading-relaxed">
            <span className="font-semibold">Source:</span> {source}
          </p>
        </div>
      )}
    </div>
  )
}
