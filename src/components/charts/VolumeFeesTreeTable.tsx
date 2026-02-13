import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EnrichedExchange } from '../../types'
import { COLORS } from '../../utils/chartTheme'
import { formatUSD, formatPercent, percentClass, classNames } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

interface ChainBreakdown {
  chain: string
  volume: number
  pctOfExchange: number
}

interface TreeRow {
  name: string
  slug: string
  volume24h: number
  fees24h: number
  takeRateBps: number | null
  change1d: number | null
  pctOfTotal: number
  chains: ChainBreakdown[]
  hasToken: boolean
  tokenSymbol: string | null
  cgExchangeId: string | null
}

type SortKey = 'name' | 'volume24h' | 'fees24h' | 'takeRateBps' | 'change1d'

export function VolumeFeesTreeTable({ exchanges }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('volume24h')
  const [sortAsc, setSortAsc] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [showCount, setShowCount] = useState(25)

  const { rows, totalVolume, totalFees } = useMemo(() => {
    const totalVolume = exchanges.reduce((sum, e) => sum + (e.total24h || 0), 0)
    const totalFees = exchanges.reduce((sum, e) => sum + (e.feeData?.total24h || 0), 0)

    const rows: TreeRow[] = exchanges
      .filter((e) => (e.total24h || 0) > 0)
      .map((e) => {
        const vol = e.total24h || 0
        const fees = e.feeData?.total24h || 0

        // Build per-chain breakdown from breakdown24h
        const chains: ChainBreakdown[] = []
        if (e.breakdown24h && Object.keys(e.breakdown24h).length > 0) {
          for (const [chain, assets] of Object.entries(e.breakdown24h)) {
            const chainVol = Object.values(assets).reduce((s, v) => s + v, 0)
            if (chainVol > 0) {
              chains.push({
                chain,
                volume: chainVol,
                pctOfExchange: vol > 0 ? (chainVol / vol) * 100 : 0,
              })
            }
          }
          chains.sort((a, b) => b.volume - a.volume)
        } else if (e.chains && e.chains.length > 0) {
          // Fallback: split evenly across chains
          const perChain = vol / e.chains.length
          for (const chain of e.chains) {
            chains.push({
              chain,
              volume: perChain,
              pctOfExchange: 100 / e.chains.length,
            })
          }
        }

        return {
          name: e.displayName || e.name,
          slug: e.slug,
          volume24h: vol,
          fees24h: fees,
          takeRateBps: vol > 0 && fees > 0 ? (fees / vol) * 10_000 : null,
          change1d: e.change_1d,
          pctOfTotal: totalVolume > 0 ? (vol / totalVolume) * 100 : 0,
          chains,
          hasToken: e.hasToken,
          tokenSymbol: e.tokenSymbol,
          cgExchangeId: e.cgExchangeId,
        }
      })

    return { rows, totalVolume, totalFees }
  }, [exchanges])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av: number | string, bv: number | string
      switch (sortKey) {
        case 'name':
          av = a.name.toLowerCase()
          bv = b.name.toLowerCase()
          return sortAsc ? (av < bv ? -1 : 1) : (bv < av ? -1 : 1)
        case 'fees24h':
          av = a.fees24h
          bv = b.fees24h
          break
        case 'takeRateBps':
          av = a.takeRateBps ?? -Infinity
          bv = b.takeRateBps ?? -Infinity
          break
        case 'change1d':
          av = a.change1d ?? -Infinity
          bv = b.change1d ?? -Infinity
          break
        default:
          av = a.volume24h
          bv = b.volume24h
          break
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [rows, sortKey, sortAsc])

  const visible = sorted.slice(0, showCount)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(key === 'name')
    }
  }

  function toggleExpand(slug: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ''
    return sortAsc ? ' \u25B2' : ' \u25BC'
  }

  // Compute max volume for bar width
  const maxVol = rows.length > 0 ? rows[0]?.volume24h || 1 : 1 // rows are sorted by vol default initially
  const actualMaxVol = Math.max(...rows.map((r) => r.volume24h))

  return (
    <div className="chart-container">
      <h3 className="chart-title">Volume & Fees Captured</h3>
      <p className="chart-subtitle">
        24-hour volume and fee generation for all perpetual exchanges — click rows to expand chain breakdown
      </p>
      <MetricInfo
        description="Tree table showing each exchange's 24h trading volume, fees captured, and take rate (fees as percentage of volume). Click any row to see the per-chain volume breakdown. Take rate reveals how efficiently each protocol monetizes its volume."
        source="Volume and fee data from on-chain aggregators. Chain breakdown from protocol-reported data where available."
      />

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 pb-4 border-b border-rule">
        <div>
          <p className="font-sans text-xs text-ink-muted">Total 24h Volume</p>
          <p className="font-mono text-sm font-bold text-ink">{formatUSD(totalVolume, true)}</p>
        </div>
        <div>
          <p className="font-sans text-xs text-ink-muted">Total 24h Fees</p>
          <p className="font-mono text-sm font-bold text-ink">{formatUSD(totalFees, true)}</p>
        </div>
        <div>
          <p className="font-sans text-xs text-ink-muted">Avg Take Rate</p>
          <p className="font-mono text-sm font-bold text-ink">
            {totalVolume > 0 ? `${((totalFees / totalVolume) * 10_000).toFixed(1)} bps` : '\u2014'}
          </p>
        </div>
        <div>
          <p className="font-sans text-xs text-ink-muted">Exchanges</p>
          <p className="font-mono text-sm font-bold text-ink">{rows.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-rule">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-paper-alt">
              <th className="text-left py-2 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-ink-muted w-8">
                #
              </th>
              {([
                { key: 'name' as SortKey, label: 'Exchange', align: 'text-left' },
                { key: 'volume24h' as SortKey, label: '24h Volume', align: 'text-right' },
                { key: 'fees24h' as SortKey, label: '24h Fees', align: 'text-right' },
                { key: 'takeRateBps' as SortKey, label: 'Take Rate', align: 'text-right' },
                { key: 'change1d' as SortKey, label: '1d Change', align: 'text-right' },
              ]).map(({ key, label, align }) => (
                <th
                  key={key}
                  className={`${align} py-2 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-ink-muted cursor-pointer hover:text-ink select-none`}
                  onClick={() => handleSort(key)}
                >
                  {label}{sortIndicator(key)}
                </th>
              ))}
              <th className="text-left py-2 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-ink-muted" style={{ minWidth: 140 }}>
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const isExpanded = expandedRows.has(row.slug)
              const hasChains = row.chains.length > 1

              return (
                <React.Fragment key={row.slug}>
                  {/* Main exchange row */}
                  <tr
                    className={classNames(
                      'border-t border-rule transition-colors',
                      hasChains ? 'cursor-pointer hover:bg-paper-warm' : 'hover:bg-paper-warm',
                      i % 2 === 1 && !isExpanded ? 'bg-paper-alt' : undefined,
                    )}
                    onClick={() => hasChains && toggleExpand(row.slug)}
                  >
                    <td className="py-2 px-3 font-mono text-xs text-ink-muted">{i + 1}</td>
                    <td className="py-2 px-3 font-sans text-sm text-ink font-medium">
                      <div className="flex items-center gap-1.5">
                        {hasChains && (
                          <span className="text-ink-muted text-xs w-3 inline-block flex-shrink-0">
                            {isExpanded ? '\u25BC' : '\u25B6'}
                          </span>
                        )}
                        {!hasChains && <span className="w-3 inline-block flex-shrink-0" />}
                        <Link
                          to={`/exchange/${row.slug}?cgId=${row.cgExchangeId || ''}`}
                          className="hover:underline"
                          style={{ color: COLORS.blue }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.name}
                        </Link>
                        {row.hasToken && row.tokenSymbol && (
                          <span className="tag-token">{row.tokenSymbol}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-sm text-ink">
                      {formatUSD(row.volume24h, true)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-sm text-ink">
                      {row.fees24h > 0 ? formatUSD(row.fees24h, true) : <span className="text-ink-muted">{'\u2014'}</span>}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-sm text-ink">
                      {row.takeRateBps != null ? `${row.takeRateBps.toFixed(1)} bps` : <span className="text-ink-muted">{'\u2014'}</span>}
                    </td>
                    <td className={classNames('py-2 px-3 text-right font-mono text-sm', percentClass(row.change1d))}>
                      {formatPercent(row.change1d)}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-rule/40 rounded-sm overflow-hidden" style={{ maxWidth: 100 }}>
                          <div
                            className="h-full rounded-sm"
                            style={{
                              width: `${Math.min((row.volume24h / actualMaxVol) * 100, 100)}%`,
                              backgroundColor: COLORS.ink,
                              opacity: 0.6,
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs text-ink-muted w-10 text-right">
                          {row.pctOfTotal.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded chain breakdown */}
                  {isExpanded && row.chains.map((chain) => (
                    <tr key={`${row.slug}-${chain.chain}`} className="bg-paper-warm border-t border-rule/50">
                      <td className="py-1.5 px-3" />
                      <td className="py-1.5 px-3 font-sans text-xs text-ink-light pl-10">
                        <span className="text-ink-muted mr-1">{'\u2514'}</span>
                        {chain.chain}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-xs text-ink-light">
                        {formatUSD(chain.volume, true)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-xs text-ink-muted" />
                      <td className="py-1.5 px-3 text-right font-mono text-xs text-ink-muted" />
                      <td className="py-1.5 px-3 text-right font-mono text-xs text-ink-muted" />
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-rule/30 rounded-sm overflow-hidden" style={{ maxWidth: 100 }}>
                            <div
                              className="h-full rounded-sm"
                              style={{
                                width: `${Math.min(chain.pctOfExchange, 100)}%`,
                                backgroundColor: COLORS.blue,
                                opacity: 0.5,
                              }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-ink-muted w-10 text-right">
                            {chain.pctOfExchange.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Show more / less */}
      {sorted.length > showCount && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setShowCount((c) => Math.min(c + 25, sorted.length))}
            className="font-sans text-xs text-ink-muted hover:text-ink border border-rule px-4 py-1.5 transition-colors"
            type="button"
          >
            Show more ({sorted.length - showCount} remaining)
          </button>
        </div>
      )}
      {showCount > 25 && (
        <div className="mt-2 text-center">
          <button
            onClick={() => setShowCount(25)}
            className="font-sans text-[11px] text-ink-muted hover:text-ink transition-colors"
            type="button"
          >
            Collapse
          </button>
        </div>
      )}

      <p className="font-sans text-[11px] text-ink-muted mt-3">
        <strong>Take Rate</strong> = Daily Fees / Daily Volume (basis points).
        Chain breakdown uses protocol-reported per-chain data where available; otherwise estimates equal distribution.
      </p>
    </div>
  )
}
