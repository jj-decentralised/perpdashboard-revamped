import React, { useMemo, useState } from 'react'
import type { EnrichedExchange } from '../../types'
import { COLORS } from '../../utils/chartTheme'
import { formatUSD, formatMultiple, formatPercent, percentClass } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

interface ValuationRow {
  name: string
  pe: number
  ps: number
  mcap: number
  volume24h: number
  fees24h: number
  change1d: number | null
  hasToken: boolean
  tokenSymbol: string | null
}

type SortKey = 'pe' | 'ps' | 'mcap' | 'volume24h' | 'name'

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export function ValuationChart({ exchanges }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('pe')
  const [sortAsc, setSortAsc] = useState(true)

  const { rows, peQ, psQ } = useMemo(() => {
    const valid = exchanges
      .filter(
        (e) =>
          e.peRatio != null &&
          e.psRatio != null &&
          e.peRatio > 0 &&
          e.psRatio > 0 &&
          e.peRatio < 1000 &&
          e.psRatio < 1000 &&
          e.mcap != null &&
          e.mcap > 0
      )

    const rows: ValuationRow[] = valid.map((e) => ({
      name: e.displayName || e.name,
      pe: e.peRatio!,
      ps: e.psRatio!,
      mcap: e.mcap!,
      volume24h: e.total24h ?? 0,
      fees24h: e.feeData?.total24h ?? 0,
      change1d: e.change_1d,
      hasToken: e.hasToken,
      tokenSymbol: e.tokenSymbol,
    }))

    const peValues = rows.map((r) => r.pe).sort((a, b) => a - b)
    const psValues = rows.map((r) => r.ps).sort((a, b) => a - b)

    return {
      rows,
      peQ: {
        q1: percentile(peValues, 25),
        median: percentile(peValues, 50),
        q3: percentile(peValues, 75),
      },
      psQ: {
        q1: percentile(psValues, 25),
        median: percentile(psValues, 50),
        q3: percentile(psValues, 75),
      },
    }
  }, [exchanges])

  const sorted = useMemo(() => {
    const s = [...rows].sort((a, b) => {
      const av = sortKey === 'name' ? a.name.toLowerCase() : a[sortKey]
      const bv = sortKey === 'name' ? b.name.toLowerCase() : b[sortKey]
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })
    return s
  }, [rows, sortKey, sortAsc])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(key === 'name')
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ''
    return sortAsc ? ' \u25B2' : ' \u25BC'
  }

  if (rows.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Valuation Multiples</h3>
        <p className="chart-subtitle">
          P/E and P/S ratios for token-based perpetual exchanges
        </p>
        <p className="font-sans text-sm text-ink-muted py-12 text-center">
          Insufficient data — requires exchanges with both market cap and fee data.
        </p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Valuation Multiples</h3>
      <p className="chart-subtitle">
        P/E and P/S ratios for perpetual exchanges with governance tokens
      </p>
      <MetricInfo
        description="Valuation multiples compare a protocol's market cap to its revenue (P/E) and fees (P/S). Lower ratios suggest relative undervaluation compared to peers. Traditional finance exchange benchmarks (CME, ICE) typically trade at 20-30x P/E, providing a reference point for DeFi perpetual protocol valuations."
        source="Market cap from CoinGecko. Revenue and fees from DefiLlama fees endpoint, annualised from trailing data."
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 pb-4 border-b border-rule">
        <div>
          <p className="font-sans text-xs text-ink-muted">P/E — Q1 / Median / Q3</p>
          <p className="font-mono text-sm font-bold text-ink">
            {formatMultiple(peQ.q1)} / {formatMultiple(peQ.median)} / {formatMultiple(peQ.q3)}
          </p>
        </div>
        <div>
          <p className="font-sans text-xs text-ink-muted">P/S — Q1 / Median / Q3</p>
          <p className="font-mono text-sm font-bold text-ink">
            {formatMultiple(psQ.q1)} / {formatMultiple(psQ.median)} / {formatMultiple(psQ.q3)}
          </p>
        </div>
        <div>
          <p className="font-sans text-xs text-ink-muted">Exchanges with Data</p>
          <p className="font-mono text-sm font-bold text-ink">{rows.length}</p>
        </div>
        <div>
          <p className="font-sans text-xs text-ink-muted">TradFi Benchmark</p>
          <p className="font-mono text-sm font-bold text-ink-muted">~20-30x P/E</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-ink">
              {[
                { key: 'name' as SortKey, label: 'Exchange', align: 'text-left' },
                { key: 'pe' as SortKey, label: 'P/E', align: 'text-right' },
                { key: 'ps' as SortKey, label: 'P/S', align: 'text-right' },
                { key: 'mcap' as SortKey, label: 'Market Cap', align: 'text-right' },
                { key: 'volume24h' as SortKey, label: '24h Volume', align: 'text-right' },
              ].map(({ key, label, align }) => (
                <th
                  key={key}
                  className={`${align} py-2 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-ink-muted cursor-pointer hover:text-ink select-none`}
                  onClick={() => handleSort(key)}
                >
                  {label}{sortIndicator(key)}
                </th>
              ))}
              <th className="text-right py-2 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-ink-muted">
                24h Change
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              // Color-code P/E relative to median
              const peColor = row.pe <= peQ.median ? COLORS.green : row.pe <= peQ.q3 ? COLORS.ink : COLORS.red
              const psColor = row.ps <= psQ.median ? COLORS.green : row.ps <= psQ.q3 ? COLORS.ink : COLORS.red

              return (
                <tr key={row.name} className={`border-b border-rule ${i % 2 === 1 ? 'bg-paper-alt' : ''} hover:bg-paper-warm transition-colors`}>
                  <td className="py-2 px-3 font-sans text-sm text-ink font-medium">
                    {row.name}
                    {row.tokenSymbol && (
                      <span className="text-ink-muted text-xs ml-1.5">{row.tokenSymbol}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm" style={{ color: peColor, fontWeight: 600 }}>
                    {formatMultiple(row.pe)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm" style={{ color: psColor, fontWeight: 600 }}>
                    {formatMultiple(row.ps)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm text-ink">
                    {formatUSD(row.mcap, true)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm text-ink-light">
                    {formatUSD(row.volume24h, true)}
                  </td>
                  <td className={`py-2 px-3 text-right font-mono text-sm ${percentClass(row.change1d)}`}>
                    {row.change1d != null ? formatPercent(row.change1d) : '\u2014'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Methodology footnote */}
      <p className="font-sans text-[11px] text-ink-muted mt-4 leading-relaxed">
        <strong>Methodology:</strong> P/E = Circulating Market Cap / Annualised Revenue.
        P/S = Circulating Market Cap / Annualised Fees.
        Market cap uses circulating supply (not FDV) sourced from CoinGecko.
        Annualisation prefers trailing 30d fees &times; 12 when available; falls back to 24h &times; 365.
        Revenue is estimated as fees &times; 0.3 assumed take rate where actual protocol revenue data
        is not available from DefiLlama; when DefiLlama provides explicit revenue figures, those are
        used instead. Values color-coded: <span style={{ color: COLORS.green }}>green</span> = below median,
        black = median to Q3, <span style={{ color: COLORS.red }}>red</span> = above Q3.
        TradFi exchange benchmarks (CME, ICE) typically trade at 20&ndash;30x P/E.
      </p>
    </div>
  )
}
