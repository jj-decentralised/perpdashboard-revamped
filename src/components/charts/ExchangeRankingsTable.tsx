import React, { useState, useMemo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { EnrichedExchange } from '../../types'
import { formatUSD, formatPercent, formatNumber, formatMultiple, formatBPS, percentClass, classNames } from '../../utils/format'
import { CategoryFilter, type CategorySelection } from '../CategoryFilter'

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
  { key: 'tvl', label: 'TVL', sortable: true, align: 'right', tooltip: 'Total Value Locked — deposited collateral/liquidity' },
  { key: 'volumeToTvl', label: 'Vol/TVL', sortable: true, align: 'right', tooltip: 'Capital turnover: 24h Volume / TVL' },
  { key: 'dailyFees', label: 'Daily Fees', sortable: true, align: 'right' },
  { key: 'takeRate', label: 'Take Rate', sortable: true, align: 'right', tooltip: 'Fees as % of volume (in basis points)' },
  { key: 'mcap', label: 'Mcap', sortable: true, align: 'right' },
  { key: 'psRatio', label: 'P/S', sortable: true, align: 'right', tooltip: 'Price-to-Sales: Mcap / Annualized Fees' },
  { key: 'peRatio', label: 'P/E', sortable: true, align: 'right', tooltip: 'Price-to-Earnings: Mcap / Annualized Revenue' },
  { key: 'change_1d', label: '1d %', sortable: true, align: 'right' },
  { key: 'change_7d', label: '7d %', sortable: true, align: 'right' },
]

const PAGE_SIZE = 50

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

function isDataAnomaly(exchange: EnrichedExchange): string | null {
  const oi = exchange.openInterest
  const vol = exchange.total24h ?? 0
  const volPer1M = getVolPer1MFees(exchange)
  const issues: string[] = []
  if (oi > 0 && oi < 100) issues.push('OI below $100')
  if (volPer1M != null && volPer1M > 1e12) issues.push('Vol/$1M Fees exceeds $1T')
  if (vol > 0 && exchange.change_7d != null && Math.abs(exchange.change_7d) > 1000) issues.push('Extreme weekly change')
  return issues.length > 0 ? issues.join('; ') : null
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
    case 'tvl':
      return exchange.tvl ?? -Infinity
    case 'volumeToTvl':
      return exchange.volumeToTvl ?? -Infinity
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

function DashCell({ tooltip }: { tooltip?: string }) {
  return (
    <span
      className="text-ink-muted cursor-help"
      title={tooltip || 'Data not available from source'}
    >
      {'\u2014'}
    </span>
  )
}

function exportCSV(exchanges: EnrichedExchange[]) {
  const headers = ['Rank', 'Name', 'Token', 'Chains', '24h Volume', '7d Volume', 'Open Interest', 'TVL', 'Vol/TVL', 'Daily Fees', 'Take Rate (bps)', 'Mcap', 'P/S', 'P/E', '1d Change %', '7d Change %']
  const rows = exchanges.map((e, i) => [
    i + 1,
    e.displayName || e.name,
    e.tokenSymbol || '',
    (e.chains || []).join('; '),
    e.total24h ?? '',
    e.total7d ?? '',
    e.openInterest || '',
    e.tvl || '',
    e.volumeToTvl?.toFixed(2) ?? '',
    getDailyFees(e) ?? '',
    getTakeRate(e)?.toFixed(2) ?? '',
    e.mcap ?? '',
    e.psRatio?.toFixed(1) ?? '',
    e.peRatio?.toFixed(1) ?? '',
    e.change_1d?.toFixed(2) ?? '',
    e.change_7d?.toFixed(2) ?? '',
  ])
  const csv = [headers, ...rows].map((row) =>
    row.map((cell) => {
      const str = String(cell)
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')
  ).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `perp-exchange-rankings-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ExchangeRankingsTable({ exchanges }: Props) {
  const [category, setCategory] = useState<CategorySelection>('all')
  const [sortBy, setSortBy] = useState<string>('total24h')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [tokenFilter, setTokenFilter] = useState<'all' | 'token' | 'no-token'>('all')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const sectionRef = useRef<HTMLElement>(null)

  const filtered = category === 'all' ? exchanges : exchanges.filter(e => e.venueType === category)

  const handleSort = (key: string) => {
    if (key === 'rank') return
    if (sortBy === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(key)
      const ascByDefault = ['name', 'psRatio', 'peRatio', 'volPer1MFees']
      setSortDir(ascByDefault.includes(key) ? 'asc' : 'desc')
    }
    setPage(0)
  }

  const handleFilterChange = useCallback((filter: 'all' | 'token' | 'no-token') => {
    setTokenFilter(filter)
    setPage(0)
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const filteredExchanges = useMemo(() => {
    let result = filtered
    if (tokenFilter === 'token') result = result.filter((e) => e.hasToken)
    if (tokenFilter === 'no-token') result = result.filter((e) => !e.hasToken)
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter((e) =>
        (e.displayName || e.name).toLowerCase().includes(q) ||
        (e.tokenSymbol || '').toLowerCase().includes(q) ||
        (e.chains || []).some((c) => c.toLowerCase().includes(q))
      )
    }
    return result
  }, [filtered, tokenFilter, search])

  const sortedExchanges = useMemo(() => {
    return [...filteredExchanges].sort((a, b) => {
      const aVal = getSortValue(a, sortBy)
      const bVal = getSortValue(b, sortBy)

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }

      const aNum = aVal as number
      const bNum = bVal as number
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum
    })
  }, [filteredExchanges, sortBy, sortDir])

  const totalPages = Math.ceil(sortedExchanges.length / PAGE_SIZE)
  const pagedExchanges = sortedExchanges.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const sortIndicator = (key: string) => {
    if (sortBy !== key) return null
    return (
      <span className="ml-1 text-ink-muted">
        {sortDir === 'desc' ? '\u25BC' : '\u25B2'}
      </span>
    )
  }

  const tokenCount = filtered.filter((e) => e.hasToken).length
  const noTokenCount = filtered.length - tokenCount

  // Summary stats
  const stats = useMemo(() => {
    const withFees = filtered.filter((e) => getDailyFees(e) != null && getDailyFees(e)! > 0)
    const takeRates = withFees.map((e) => getTakeRate(e)!).filter((v) => v != null && isFinite(v))
    const medianTakeRate = takeRates.length > 0
      ? takeRates.sort((a, b) => a - b)[Math.floor(takeRates.length / 2)]
      : null
    const totalDailyFees = withFees.reduce((sum, e) => sum + (getDailyFees(e) || 0), 0)
    return { medianTakeRate, totalDailyFees, exchangesWithFees: withFees.length }
  }, [filtered])

  return (
    <section className="section-rule" ref={sectionRef}>
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-ink mb-1">
            Exchange Rankings
          </h2>
          <p className="font-sans text-sm text-ink-muted">
            All {filtered.length} perpetual exchanges by 24-hour trading volume
          </p>
        </div>

        {/* Token Filter */}
        <div className="flex items-center gap-1 font-sans text-xs">
          <button
            onClick={() => handleFilterChange('all')}
            className={classNames(
              'px-3 py-1.5 border transition-colors',
              tokenFilter === 'all'
                ? 'bg-ink text-paper border-ink font-semibold'
                : 'bg-paper text-ink-muted border-rule hover:border-ink'
            )}
          >
            All ({filtered.length})
          </button>
          <button
            onClick={() => handleFilterChange('token')}
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
            onClick={() => handleFilterChange('no-token')}
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

      {/* Search + Category Filter + Export */}
      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search by name, token, or chain..."
          className="w-full max-w-sm px-3 py-2 border border-rule bg-paper font-sans text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink transition-colors"
        />
        {(() => {
          const dc = exchanges.filter(e => e.venueType === 'defi').length
          const cc = exchanges.filter(e => e.venueType === 'cefi').length
          return dc > 0 && cc > 0 ? (
            <CategoryFilter selected={category} onChange={setCategory} defiCount={dc} cefiCount={cc} />
          ) : null
        })()}
        <button
          onClick={() => exportCSV(sortedExchanges)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border border-rule bg-paper text-ink-muted font-sans text-xs hover:border-ink hover:text-ink transition-colors cursor-pointer"
          type="button"
          title="Export to CSV"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          CSV
        </button>
      </div>

      {/* Summary stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-rule">
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Total Daily Fees</p>
          <p className="font-mono text-sm font-bold text-ink">
            {stats.totalDailyFees > 0 ? formatUSD(stats.totalDailyFees, true) : <DashCell />}
          </p>
        </div>
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Median Take Rate</p>
          <p className="font-mono text-sm font-bold text-ink">
            {stats.medianTakeRate != null ? formatBPS(stats.medianTakeRate) : <DashCell />}
          </p>
        </div>
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Exchanges w/ Fee Data</p>
          <p className="font-mono text-sm font-bold text-ink">
            {stats.exchangesWithFees} / {filtered.length}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border border-rule bg-paper relative">
        <table className="data-table w-full border-collapse">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={classNames(
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer select-none hover:text-ink',
                    'sticky top-0 bg-paper z-10 whitespace-nowrap',
                    col.key === 'name' && 'sticky left-0 z-20 bg-paper'
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
            {pagedExchanges.map((exchange, index) => {
              const takeRate = getTakeRate(exchange)
              const volPer1M = getVolPer1MFees(exchange)
              const dailyFees = getDailyFees(exchange)
              const anomaly = isDataAnomaly(exchange)
              const globalIndex = page * PAGE_SIZE + index

              return (
                <tr
                  key={exchange.slug || exchange.name}
                  className={classNames(
                    index % 2 === 1 ? 'bg-paper-warm' : undefined,
                    anomaly ? 'opacity-60' : undefined,
                  )}
                >
                  <td className="text-ink-muted w-10">{globalIndex + 1}</td>
                  <td className={classNames(
                    'font-sans text-sm font-medium text-ink whitespace-nowrap',
                    'sticky left-0 z-10',
                    index % 2 === 1 ? 'bg-paper-warm' : 'bg-paper'
                  )}>
                    <div className="flex items-center gap-2">
                      <Link to={`/exchange/${exchange.slug}?cgId=${exchange.cgExchangeId || ''}`} className="hover:underline" style={{ color: '#2e5e8e' }}>
                        {exchange.displayName || exchange.name}
                      </Link>
                      {exchange.hasToken && (
                        <span className="tag-token">{exchange.tokenSymbol}</span>
                      )}
                      {anomaly && (
                        <span className="text-amber-600 cursor-help" title={`Data anomaly: ${anomaly}`}>&#9888;</span>
                      )}
                    </div>
                  </td>
                  <td className="text-right">{exchange.total24h != null ? formatUSD(exchange.total24h, true) : <DashCell />}</td>
                  <td className="text-right">{exchange.total7d != null ? formatUSD(exchange.total7d, true) : <DashCell />}</td>
                  <td className="text-right">{exchange.openInterest > 0 ? formatUSD(exchange.openInterest, true) : <DashCell tooltip="OI data requires CoinGecko exchange listing" />}</td>
                  <td className="text-right">{exchange.tvl > 0 ? formatUSD(exchange.tvl, true) : <DashCell tooltip="TVL data not available from DefiLlama" />}</td>
                  <td className="text-right font-mono text-xs">{exchange.volumeToTvl != null && isFinite(exchange.volumeToTvl) ? `${exchange.volumeToTvl.toFixed(1)}x` : <DashCell tooltip="Requires both volume and TVL data" />}</td>
                  <td className="text-right">{dailyFees != null && dailyFees > 0 ? formatUSD(dailyFees, true) : <DashCell tooltip="Fee data not tracked by DefiLlama for this exchange" />}</td>
                  <td className="text-right font-mono text-xs">{takeRate != null ? formatBPS(takeRate) : <DashCell tooltip="Requires both fee and volume data" />}</td>
                  <td className="text-right">{exchange.mcap && exchange.mcap > 0 ? formatUSD(exchange.mcap, true) : <DashCell tooltip="No governance token or market cap data unavailable" />}</td>
                  <td className="text-right">{exchange.psRatio != null ? formatMultiple(exchange.psRatio) : <DashCell tooltip="Requires market cap and fee data" />}</td>
                  <td className="text-right">{exchange.peRatio != null ? formatMultiple(exchange.peRatio) : <DashCell tooltip="Requires market cap and revenue data" />}</td>
                  <td className={classNames('text-right', percentClass(exchange.change_1d))}>{formatPercent(exchange.change_1d)}</td>
                  <td className={classNames('text-right', percentClass(exchange.change_7d))}>{formatPercent(exchange.change_7d)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 font-sans text-sm">
          <p className="text-ink-muted">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedExchanges.length)} of {sortedExchanges.length}
            {filteredExchanges.length !== filtered.length && ` (filtered from ${filtered.length})`}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(0)}
              disabled={page === 0}
              className={classNames(
                'px-2 py-1 border transition-colors',
                page === 0
                  ? 'border-rule text-ink-muted cursor-not-allowed'
                  : 'border-rule hover:border-ink text-ink cursor-pointer'
              )}
            >
              &laquo;
            </button>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0}
              className={classNames(
                'px-3 py-1 border transition-colors',
                page === 0
                  ? 'border-rule text-ink-muted cursor-not-allowed'
                  : 'border-rule hover:border-ink text-ink cursor-pointer'
              )}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter((i) => i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1)
              .reduce<(number | 'gap')[]>((acc, i, idx, arr) => {
                if (idx > 0 && i - (arr[idx - 1] as number) > 1) acc.push('gap')
                acc.push(i)
                return acc
              }, [])
              .map((item, idx) =>
                item === 'gap' ? (
                  <span key={`gap-${idx}`} className="px-1 text-ink-muted">&hellip;</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => handlePageChange(item)}
                    className={classNames(
                      'px-3 py-1 border transition-colors',
                      page === item
                        ? 'bg-ink text-paper border-ink font-semibold'
                        : 'border-rule hover:border-ink text-ink cursor-pointer'
                    )}
                  >
                    {item + 1}
                  </button>
                )
              )}
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className={classNames(
                'px-3 py-1 border transition-colors',
                page >= totalPages - 1
                  ? 'border-rule text-ink-muted cursor-not-allowed'
                  : 'border-rule hover:border-ink text-ink cursor-pointer'
              )}
            >
              Next
            </button>
            <button
              onClick={() => handlePageChange(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className={classNames(
                'px-3 py-1 border transition-colors',
                page >= totalPages - 1
                  ? 'border-rule text-ink-muted cursor-not-allowed'
                  : 'border-rule hover:border-ink text-ink cursor-pointer'
              )}
            >
              &raquo;
            </button>
          </div>
        </div>
      )}

      {/* Legend / footnote */}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-sans text-[10px] text-ink-muted">
        <span><strong>TVL</strong> = Total Value Locked (deposited collateral)</span>
        <span><strong>Vol/TVL</strong> = Capital turnover (24h Volume / TVL)</span>
        <span><strong>Take Rate</strong> = Daily Fees / Daily Volume (bps)</span>
        <span><strong>P/S</strong> = Mcap / Annualized Fees</span>
        <span><strong>P/E</strong> = Mcap / Annualized Revenue</span>
        <span><strong>{'\u2014'}</strong> = Data not available from source (hover for details)</span>
        <span><strong>&#9888;</strong> = Possible data anomaly</span>
      </div>
    </section>
  )
}
