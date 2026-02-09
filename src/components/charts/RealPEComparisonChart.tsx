import React, { useMemo, useState } from 'react'
import type { EnrichedExchange } from '../../types'
import { COLORS } from '../../utils/chartTheme'
import { formatMultiple, formatUSD } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

interface Row {
  name: string
  llamaPE: number | null
  ttPE: number | null
  llamaPS: number | null
  ttPS: number | null
  mcap: number
  tokenSymbol: string | null
}

type SortKey = 'name' | 'ttPE' | 'llamaPE' | 'delta' | 'mcap'

export function RealPEComparisonChart({ exchanges }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('mcap')
  const [sortAsc, setSortAsc] = useState(false)

  const rows = useMemo(() => {
    return exchanges
      .filter(
        (e) =>
          e.mcap != null &&
          e.mcap > 0 &&
          (e.peRatio != null || e.ttPE != null)
      )
      .map((e): Row => ({
        name: e.displayName || e.name,
        llamaPE: e.peRatio,
        ttPE: e.ttPE,
        llamaPS: e.psRatio,
        ttPS: e.ttPS,
        mcap: e.mcap!,
        tokenSymbol: e.tokenSymbol,
      }))
      .filter((r) => r.llamaPE != null || r.ttPE != null)
  }, [exchanges])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av: number, bv: number
      switch (sortKey) {
        case 'name':
          return sortAsc
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name)
        case 'ttPE':
          av = a.ttPE ?? Infinity
          bv = b.ttPE ?? Infinity
          break
        case 'llamaPE':
          av = a.llamaPE ?? Infinity
          bv = b.llamaPE ?? Infinity
          break
        case 'delta':
          av = a.ttPE != null && a.llamaPE != null ? a.ttPE - a.llamaPE : Infinity
          bv = b.ttPE != null && b.llamaPE != null ? b.ttPE - b.llamaPE : Infinity
          break
        case 'mcap':
        default:
          av = a.mcap
          bv = b.mcap
          break
      }
      return sortAsc ? av - bv : bv - av
    })
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
        <h3 className="chart-title">P/E Comparison: DefiLlama vs Token Terminal</h3>
        <p className="chart-subtitle">Token Terminal data not available</p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">P/E Comparison: DefiLlama vs Token Terminal</h3>
      <p className="chart-subtitle">
        Side-by-side valuation multiples from two independent data sources
      </p>
      <MetricInfo
        description="Compares P/E ratios computed from DefiLlama estimated revenue vs Token Terminal's verified revenue data. Large discrepancies highlight where DefiLlama's assumed 30% take rate diverges from actual protocol economics. Token Terminal P/E is generally more accurate as it uses audited on-chain revenue."
        source="P/E (DL) from DefiLlama fees with estimated 30% revenue take rate. P/E (TT) from Token Terminal verified revenue data. Market cap from CoinGecko."
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-ink">
              {([
                { key: 'name' as SortKey, label: 'Exchange', align: 'text-left' },
                { key: 'llamaPE' as SortKey, label: 'P/E (DL)', align: 'text-right' },
                { key: 'ttPE' as SortKey, label: 'P/E (TT)', align: 'text-right' },
                { key: 'delta' as SortKey, label: '\u0394', align: 'text-right' },
                { key: 'mcap' as SortKey, label: 'Mcap', align: 'text-right' },
              ]).map(({ key, label, align }) => (
                <th
                  key={key}
                  className={`${align} py-2 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-ink-muted cursor-pointer hover:text-ink select-none`}
                  onClick={() => handleSort(key)}
                >
                  {label}{sortIndicator(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const delta = row.ttPE != null && row.llamaPE != null
                ? row.ttPE - row.llamaPE
                : null
              const deltaColor = delta != null
                ? delta > 0 ? COLORS.red : COLORS.green
                : COLORS.inkMuted

              return (
                <tr
                  key={row.name}
                  className={`border-b border-rule ${i % 2 === 1 ? 'bg-paper-alt' : ''} hover:bg-paper-warm transition-colors`}
                >
                  <td className="py-2 px-3 font-sans text-sm text-ink font-medium">
                    {row.name}
                    {row.tokenSymbol && (
                      <span className="text-ink-muted text-xs ml-1.5">{row.tokenSymbol}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm text-ink">
                    {row.llamaPE != null ? formatMultiple(row.llamaPE) : '\u2014'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm font-semibold" style={{ color: COLORS.blue }}>
                    {row.ttPE != null ? formatMultiple(row.ttPE) : '\u2014'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm" style={{ color: deltaColor }}>
                    {delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}x` : '\u2014'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm text-ink-light">
                    {formatUSD(row.mcap, true)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="font-sans text-[11px] text-ink-muted mt-4 leading-relaxed">
        <strong>DL</strong> = DefiLlama (estimated revenue: fees &times; 0.3 assumed take rate).{' '}
        <strong>TT</strong> = Token Terminal (verified on-chain revenue).{' '}
        <strong>&Delta;</strong> = TT P/E &minus; DL P/E. Negative delta means TT shows the protocol is cheaper than DL estimates.
      </p>
    </div>
  )
}
