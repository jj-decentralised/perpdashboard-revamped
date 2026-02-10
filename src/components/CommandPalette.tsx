import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

interface Exchange {
  name: string
  displayName: string
  slug: string
  hasToken: boolean
  tokenSymbol: string | null
  cgExchangeId: string | null
  total24h: number | null
}

interface Props {
  exchanges: Exchange[]
}

function formatCompactUSD(value: number | null): string {
  if (value == null || !isFinite(value)) return ''
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

export function CommandPalette({ exchanges }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
        setQuery('')
        setSelectedIndex(0)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const results = useMemo(() => {
    if (!query.trim()) {
      return exchanges
        .filter((e) => e.total24h != null && e.total24h > 0)
        .sort((a, b) => (b.total24h || 0) - (a.total24h || 0))
        .slice(0, 10)
    }
    const q = query.toLowerCase().trim()
    return exchanges
      .filter(
        (e) =>
          (e.displayName || e.name).toLowerCase().includes(q) ||
          (e.tokenSymbol || '').toLowerCase().includes(q) ||
          e.slug.toLowerCase().includes(q)
      )
      .sort((a, b) => (b.total24h || 0) - (a.total24h || 0))
      .slice(0, 12)
  }, [exchanges, query])

  const navigateTo = useCallback(
    (exchange: Exchange) => {
      setOpen(false)
      setQuery('')
      navigate(`/exchange/${exchange.slug}?cgId=${exchange.cgExchangeId || ''}`)
    },
    [navigate]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault()
        navigateTo(results[selectedIndex])
      }
    },
    [results, selectedIndex, navigateTo]
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setQuery(''); setSelectedIndex(0) }}
        className="flex items-center gap-2 px-3 py-1.5 border border-rule bg-paper text-ink-muted font-sans text-xs hover:border-ink transition-colors cursor-pointer"
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        Search exchanges...
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 border border-rule text-[10px] font-mono text-ink-muted bg-paper-alt">
          {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl+'}K
        </kbd>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div className="fixed inset-0 bg-ink/20" />
      <div
        className="relative w-full max-w-lg bg-paper border-2 border-ink shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-rule px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7a7a7a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search exchanges by name, token, or slug..."
            className="w-full px-3 py-3 font-sans text-sm text-ink bg-transparent border-none outline-none placeholder:text-ink-muted"
          />
          <kbd className="flex-shrink-0 px-1.5 py-0.5 border border-rule text-[10px] font-mono text-ink-muted bg-paper-alt">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center font-sans text-sm text-ink-muted">
              No exchanges found
            </div>
          ) : (
            <ul className="py-1">
              {results.map((exchange, index) => (
                <li key={exchange.slug}>
                  <button
                    onClick={() => navigateTo(exchange)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors cursor-pointer border-none ${
                      index === selectedIndex ? 'bg-paper-alt' : 'bg-paper'
                    }`}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-sm font-medium text-ink">
                        {exchange.displayName || exchange.name}
                      </span>
                      {exchange.hasToken && exchange.tokenSymbol && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono bg-paper-alt text-ink-light border border-rule">
                          {exchange.tokenSymbol}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-ink-muted">
                      {formatCompactUSD(exchange.total24h)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-rule px-4 py-2 flex items-center gap-4 font-sans text-[10px] text-ink-muted">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
