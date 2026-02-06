import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { EnrichedExchange } from '../../types'
import { formatUSD, formatPercent, formatNumber, formatMultiple, percentClass, classNames } from '../../utils/format'

interface Props {
  exchanges: EnrichedExchange[]
}

interface ColumnDef {
  key: string
  label: string
  sortable: boolean
  align: 'left' | 'right'
}

const columns: ColumnDef[] = [
  { key: 'rank', label: '#', sortable: false, align: 'left' },
  { key: 'name', label: 'Name', sortable: true, align: 'left' },
  { key: 'total24h', label: '24h Volume', sortable: true, align: 'right' },
  { key: 'total7d', label: '7d Volume', sortable: true, align: 'right' },
  { key: 'openInterest', label: 'Open Interest', sortable: true, align: 'right' },
  { key: 'perpPairsCount', label: 'Pairs', sortable: true, align: 'right' },
  { key: 'mcap', label: 'Mcap', sortable: true, align: 'right' },
  { key: 'psRatio', label: 'P/S', sortable: true, align: 'right' },
  { key: 'peRatio', label: 'P/E', sortable: true, align: 'right' },
  { key: 'change_1d', label: '1d Change', sortable: true, align: 'right' },
  { key: 'change_7d', label: '7d Change', sortable: true, align: 'right' },
  { key: 'volumeToOI', label: 'Vol/OI', sortable: true, align: 'right' },
]

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
    case 'chainCount':
      return exchange.chainCount ?? 0
    case 'volumeToOI':
      return exchange.volumeToOI ?? -Infinity
    case 'perpPairsCount':
      return exchange.perpPairsCount ?? -Infinity
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
      // For valuation ratios, lower is "better" so default asc
      setSortDir(key === 'name' || key === 'psRatio' || key === 'peRatio' ? 'asc' : 'desc')
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
                    'sticky top-0 bg-paper z-10 px-3 whitespace-nowrap'
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.label}
                  {col.sortable && sortIndicator(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedExchanges.map((exchange, index) => (
              <tr
                key={exchange.slug || exchange.name}
                className={classNames(
                  index % 2 === 1 && 'bg-paper-warm',
                  'hover:bg-paper-alt transition-colors'
                )}
              >
                {/* Rank */}
                <td className="px-3 text-ink-muted w-10">
                  {index + 1}
                </td>

                {/* Name + Token Badge */}
                <td className="px-3 font-sans text-sm font-medium text-ink whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Link to={`/exchange/${exchange.slug}?cgId=${exchange.cgExchangeId || ''}`} className="hover:underline" style={{color: '#2e5e8e'}}>
                      {exchange.displayName || exchange.name}
                    </Link>
                    {exchange.hasToken ? (
                      <span className="tag-token">{exchange.tokenSymbol}</span>
                    ) : (
                      <span className="text-ink-muted">&mdash;</span>
                    )}
                  </div>
                </td>

                {/* 24h Volume */}
                <td className="px-3 text-right">
                  {exchange.total24h != null
                    ? formatUSD(exchange.total24h, true)
                    : '\u2014'}
                </td>

                {/* 7d Volume */}
                <td className="px-3 text-right">
                  {exchange.total7d != null
                    ? formatUSD(exchange.total7d, true)
                    : '\u2014'}
                </td>

                {/* Open Interest */}
                <td className="px-3 text-right">
                  {exchange.openInterest != null && exchange.openInterest > 0
                    ? formatUSD(exchange.openInterest, true)
                    : '\u2014'}
                </td>

                {/* Pairs */}
                <td className="px-3 text-right">
                  {exchange.perpPairsCount != null
                    ? formatNumber(exchange.perpPairsCount)
                    : '\u2014'}
                </td>

                {/* Market Cap */}
                <td className="px-3 text-right">
                  {exchange.mcap != null && exchange.mcap > 0
                    ? formatUSD(exchange.mcap, true)
                    : '\u2014'}
                </td>

                {/* P/S Ratio */}
                <td className="px-3 text-right font-mono">
                  {exchange.psRatio != null
                    ? formatMultiple(exchange.psRatio)
                    : '\u2014'}
                </td>

                {/* P/E Ratio */}
                <td className="px-3 text-right font-mono">
                  {exchange.peRatio != null
                    ? formatMultiple(exchange.peRatio)
                    : '\u2014'}
                </td>

                {/* 1d Change */}
                <td className={classNames(
                  'px-3 text-right',
                  percentClass(exchange.change_1d)
                )}>
                  {formatPercent(exchange.change_1d)}
                </td>

                {/* 7d Change */}
                <td className={classNames(
                  'px-3 text-right',
                  percentClass(exchange.change_7d)
                )}>
                  {formatPercent(exchange.change_7d)}
                </td>

                {/* Vol/OI */}
                <td className="px-3 text-right">
                  {exchange.volumeToOI != null
                    ? exchange.volumeToOI.toFixed(2)
                    : '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
