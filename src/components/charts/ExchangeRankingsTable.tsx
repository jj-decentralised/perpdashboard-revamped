import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { EnrichedExchange } from '../../types'
import { formatUSD, formatPercent, formatNumber, formatMultiple, formatBPS, percentClass, classNames } from '../../utils/format'

interface Props {
  exchanges: EnrichedExchange[]
}

interface ColumnDef {
  key: string
  label: string
  sublabel?: string
  sortable: boolean
  align: 'left' | 'right'
  tooltip?: string
}

const columns: ColumnDef[] = [
  { key: 'rank', label: '#', sortable: false, align: 'left' },
  { key: 'name', label: 'Name', sortable: true, align: 'left' },
  { key: 'total24h', label: '24h Volume', sortable: true, align: 'right' },
  { key: 'total7d', label: '7d Volume', sortable: true, align: 'right' },
  { key: 'openInterest', label: 'Open Interest', sortable: true, align: 'right' },
  { key: 'dailyFees', label: 'Daily Fees', sortable: true, align: 'right' },
  { key: 'takeRate', label: 'Take Rate', sortable: true, align: 'right', tooltip: 'Fees as % of volume (in basis points)' },
  { key: 'volPer1MFees', label: 'Vol / $1M Fees', sortable: true, align: 'right', tooltip: 'Volume needed to generate $1M in fees' },
  { key: 'mcap', label: 'Mcap', sortable: true, align: 'right' },
  { key: 'psRatio', label: 'P/S', sortable: true, align: 'right', tooltip: 'Price-to-Sales: Mcap / Annualized Fees' },
  { key: 'peRatio', label: 'P/E', sortable: true, align: 'right', tooltip: 'Price-to-Earnings: Mcap / Annualized Revenue' },
  { key: 'change_1d', label: '1d %', sortable: true, align: 'right' },
  { key: 'change_7d', label: '7d %', sortable: true, align: 'right' },
]

function getDailyFees(exchange: EnrichedExchange): number | null {
  return exchange.feeData?.total24h ?? null
}

function getTakeRate(exchange: EnrichedExchange): number | null {
  const fees = getDailyFees(exchange)
  const vol = exchange.total24h
  if (fees == null || !vol || vol <= 0 || fees <= 0) return null
  return (fees / vol) * 10_000 // basis points
}

function getVolPer1MFees(exchange: EnrichedExchange): number | null {
  const fees = getDailyFees(exchange)
  const vol = exchange.total24h
  if (fees == null || !vol || vol <= 0 || fees <= 0) return null
  return (vol / fees) * 1_000_000
}

function getSortValue(exchange: EnrichedExchange, key: string): number | string {
  switch (key) {
    case 'name':
      return (exchange.displayName || exchange.name).toLowerCase()
    case 'total24h':
      return exchange.total24h ?? -Infinity
    case 'total7d':
      return exchange.total7d ?? -Infinity
    case 'openInterest':
      return exchange.openInterest ?? -Infinity
    case 'dailyFees':
      return getDailyFees(exchange) ?? -Infinity
    case 'takeRate':
      return getTakeRate(exchange) ?? -Infinity
    case 'volPer1MFees':
      return getVolPer1MFees(exchange) ?? Infinity
    case 'mcap':
      return exchange.mcap ?? -Infinity
    case 'psRatio':
      return exchange.psRatio ?? Infinity
    case 'peRatio':
      return exchange.peRatio ?? Infinity
    case 'change_1d':
      return exchange.change_1d ?? -Infinity
    case 'change_7d':
      return exchange.change_7d ?? -Infinity
    default:
      return 0
  }
}

export function ExchangeRankingsTable({ exchanges }: Props) {
  const [sortBy, setSortBy] = useState<string>('total24h')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [tokenFilter, setTokenFilter] = useState<'all' | 'token' | 'no-token'>('all')

  const handleSort = (key: string) => {
    if (key === 'rank') return
    if (sortBy === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(key)
      // For valuation ratios and vol/$1M, lower is "better" so default asc
      const ascByDefault = ['name', 'psRatio', 'peRatio', 'volPer1MFees']
      setSortDir(ascByDefault.includes(key) ? 'asc' : 'desc')
    }
  }

  const filteredExchanges = useMemo(() => {
    if (tokenFilter === 'token') return exchanges.filter((e) => e.hasToken)
    if (tokenFilter === 'no-token') return exchanges.filter((e) => !e.hasToken)
    return exchanges
  }, [exchanges, tokenFilter])

  const sortedExchanges = useMemo(() => {
    const sorted = [...filteredExchanges].sort((a, b) => {
      const aVal = getSortValue(a, sortBy)
      const bVal = getSortValue(b, sortBy)

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }

      const aNum = aVal as number
      const bNum = bVal as number
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum
    })

    return sorted.slice(0, 50)
  }, [filteredExchanges, sortBy, sortDir])

  const sortIndicator = (key: string) => {
    if (sortBy !== key) return null
    return (
      <span className="ml-1 text-ink-muted">
        {sortDir === 'desc' ? '\u25BC' : '\u25B2'}
      </span>
    )
  }

  const tokenCount = exchanges.filter((e) => e.hasToken).length
  const noTokenCount = exchanges.length - tokenCount

  // Summary stats
  const stats = useMemo(() => {
    const withFees = exchanges.filter((e) => getDailyFees(e) != null && getDailyFees(e)! > 0)
    const takeRates = withFees.map((e) => getTakeRate(e)!).filter((v) => v != null && isFinite(v))
    const medianTakeRate = takeRates.length > 0
      ? takeRates.sort((a, b) => a - b)[Math.floor(takeRates.length / 2)]
      : null
    const totalDailyFees = withFees.reduce((sum, e) => sum + (getDailyFees(e) || 0), 0)
    return { medianTakeRate, totalDailyFees, exchangesWithFees: withFees.length }
  }, [exchanges])

  return (
    <section className="section-rule">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-ink mb-1">
            Exchange Rankings
          </h2>
          <p className="font-sans text-sm text-ink-muted">
            Top perpetual exchanges by 24-hour trading volume
          </p>
        </div>

        {/* Token Filter */}
        <div className="flex items-center gap-1 font-sans text-xs">
          <button
            onClick={() => setTokenFilter('all')}
            className={classNames(
              'px-3 py-1.5 border transition-colors',
              tokenFilter === 'all'
                ? 'bg-ink text-paper border-ink font-semibold'
                : 'bg-paper text-ink-muted border-rule hover:border-ink'
            )}
          >
            All ({exchanges.length})
          </button>
          <button
            onClick={() => setTokenFilter('token')}
            className={classNames(
              'px-3 py-1.5 border transition-colors',
              tokenFilter === 'token'
                ? 'bg-ink text-paper border-ink font-semibold'
                : 'bg-paper text-ink-muted border-rule hover:border-ink'
            )}
          >
            With Token ({tokenCount})
          </button>
          <button
            onClick={() => setTokenFilter('no-token')}
            className={classNames(
              'px-3 py-1.5 border transition-colors',
              tokenFilter === 'no-token'
                ? 'bg-ink text-paper border-ink font-semibold'
                : 'bg-paper text-ink-muted border-rule hover:border-ink'
            )}
          >
            No Token ({noTokenCount})
          </button>
        </div>
      </div>

      {/* Summary stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-rule">
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Total Daily Fees</p>
          <p className="font-mono text-sm font-bold text-ink">
            {stats.totalDailyFees > 0 ? formatUSD(stats.totalDailyFees, true) : '—'}
          </p>
        </div>
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Median Take Rate</p>
          <p className="font-mono text-sm font-bold text-ink">
            {stats.medianTakeRate != null ? formatBPS(stats.medianTakeRate) : '—'}
          </p>
        </div>
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Exchanges w/ Fee Data</p>
          <p className="font-mono text-sm font-bold text-ink">
            {stats.exchangesWithFees} / {exchanges.length}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border border-rule bg-paper">
        <table className="data-table w-full border-collapse">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={classNames(
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer select-none hover:text-ink',
                    'sticky top-0 bg-paper z-10 whitespace-nowrap'
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                  title={col.tooltip}
                >
                  {col.label}
                  {col.sortable && sortIndicator(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedExchanges.map((exchange, index) => {
              const takeRate = getTakeRate(exchange)
              const volPer1M = getVolPer1MFees(exchange)
              const dailyFees = getDailyFees(exchange)

              return (
                <tr
                  key={exchange.slug || exchange.name}
                  className={index % 2 === 1 ? 'bg-paper-warm' : undefined}
                >
                  <td className="text-ink-muted w-10">{index + 1}</td>
                  <td className="font-sans text-sm font-medium text-ink whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Link to={`/exchange/${exchange.slug}?cgId=${exchange.cgExchangeId || ''}`} className="hover:underline" style={{ color: '#2e5e8e' }}>
                        {exchange.displayName || exchange.name}
                      </Link>
                      {exchange.hasToken && (
                        <span className="tag-token">{exchange.tokenSymbol}</span>
                      )}
                    </div>
                  </td>
                  <td className="text-right">{exchange.total24h != null ? formatUSD(exchange.total24h, true) : '\u2014'}</td>
                  <td className="text-right">{exchange.total7d != null ? formatUSD(exchange.total7d, true) : '\u2014'}</td>
                  <td className="text-right">{exchange.openInterest > 0 ? formatUSD(exchange.openInterest, true) : '\u2014'}</td>
                  <td className="text-right">{dailyFees != null && dailyFees > 0 ? formatUSD(dailyFees, true) : '\u2014'}</td>
                  <td className="text-right font-mono text-xs">{takeRate != null ? formatBPS(takeRate) : '\u2014'}</td>
                  <td className="text-right font-mono text-xs">{volPer1M != null ? formatUSD(volPer1M, true) : '\u2014'}</td>
                  <td className="text-right">{exchange.mcap && exchange.mcap > 0 ? formatUSD(exchange.mcap, true) : '\u2014'}</td>
                  <td className="text-right">{exchange.psRatio != null ? formatMultiple(exchange.psRatio) : '\u2014'}</td>
                  <td className="text-right">{exchange.peRatio != null ? formatMultiple(exchange.peRatio) : '\u2014'}</td>
                  <td className={classNames('text-right', percentClass(exchange.change_1d))}>{formatPercent(exchange.change_1d)}</td>
                  <td className={classNames('text-right', percentClass(exchange.change_7d))}>{formatPercent(exchange.change_7d)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend / footnote */}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-sans text-[10px] text-ink-muted">
        <span><strong>Take Rate</strong> = Daily Fees / Daily Volume (bps)</span>
        <span><strong>Vol / $1M Fees</strong> = Volume needed to generate $1M in fees</span>
        <span><strong>P/S</strong> = Mcap / Annualized Fees</span>
        <span><strong>P/E</strong> = Mcap / Annualized Revenue</span>
      </div>
    </section>
  )
}
