import React, { useMemo } from 'react'
import type { CGDerivativeTicker } from '../../types/coingecko'
import { COLORS } from '../../utils/chartTheme'
import { formatFundingRate, formatUSD } from '../../utils/format'

interface Props {
  tickers: CGDerivativeTicker[]
}

export function FundingRateChart({ tickers }: Props) {
  const rows = useMemo(() => {
    if (!tickers || tickers.length === 0) return []

    return tickers
      .filter((t) => t.funding_rate != null && t.contract_type === 'perpetual')
      .sort((a, b) => Math.abs(b.funding_rate) - Math.abs(a.funding_rate))
      .slice(0, 25)
      .map((t) => ({
        pair: `${t.base}/${t.target}`,
        market: t.market,
        fundingRate: t.funding_rate,
        openInterest: t.open_interest_usd,
        volume24h: t.h24_volume,
        price: t.converted_last?.usd ?? t.last,
        spread: t.bid_ask_spread,
      }))
  }, [tickers])

  const stats = useMemo(() => {
    if (rows.length === 0) return null
    const rates = rows.map((r) => r.fundingRate)
    const avg = rates.reduce((s, v) => s + v, 0) / rates.length
    const positiveCount = rates.filter((r) => r >= 0).length
    return { avg, positiveCount, total: rates.length }
  }, [rows])

  if (rows.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Funding Rates</h3>
        <p className="chart-subtitle">
          Current perpetual funding rates across top markets
        </p>
        <p className="font-sans text-sm text-ink-muted py-12 text-center">
          Funding rate data unavailable. CoinGecko API may be rate-limited.
        </p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Funding Rates</h3>
      <p className="chart-subtitle">
        Current perpetual funding rates — positive means longs pay shorts
      </p>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-rule">
          <div>
            <p className="font-sans text-xs text-ink-muted">Avg Rate</p>
            <p className="font-mono text-sm font-bold text-ink">
              {formatFundingRate(stats.avg)}
            </p>
          </div>
          <div>
            <p className="font-sans text-xs text-ink-muted">Positive / Total</p>
            <p className="font-mono text-sm font-bold text-ink">
              {stats.positiveCount} / {stats.total}
            </p>
          </div>
          <div>
            <p className="font-sans text-xs text-ink-muted">Sentiment</p>
            <p className="font-mono text-sm font-bold" style={{ color: stats.positiveCount > stats.total / 2 ? COLORS.green : COLORS.red }}>
              {stats.positiveCount > stats.total / 2 ? 'Net Long' : 'Net Short'}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="data-table w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left">Pair</th>
              <th className="text-left">Market</th>
              <th className="text-right">Funding Rate</th>
              <th className="text-right">Open Interest</th>
              <th className="text-right">24h Volume</th>
              <th className="text-right">Price</th>
              <th className="text-right">Spread</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${row.pair}-${row.market}-${i}`}
                className={i % 2 === 1 ? 'bg-paper-warm' : ''}
              >
                <td className="font-sans text-sm font-medium text-ink whitespace-nowrap">
                  {row.pair}
                </td>
                <td className="font-sans text-sm text-ink-light whitespace-nowrap">
                  {row.market}
                </td>
                <td className="text-right font-mono text-sm whitespace-nowrap">
                  <span style={{ color: row.fundingRate >= 0 ? COLORS.green : COLORS.red, fontWeight: 600 }}>
                    {formatFundingRate(row.fundingRate)}
                  </span>
                </td>
                <td className="text-right font-mono text-sm text-ink-light whitespace-nowrap">
                  {row.openInterest > 0 ? formatUSD(row.openInterest, true) : '\u2014'}
                </td>
                <td className="text-right font-mono text-sm text-ink-light whitespace-nowrap">
                  {row.volume24h > 0 ? formatUSD(row.volume24h, true) : '\u2014'}
                </td>
                <td className="text-right font-mono text-sm text-ink-light whitespace-nowrap">
                  {row.price > 0 ? formatUSD(row.price) : '\u2014'}
                </td>
                <td className="text-right font-mono text-sm text-ink-muted whitespace-nowrap">
                  {row.spread != null ? `${(row.spread * 100).toFixed(2)}%` : '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-sans text-[11px] text-ink-muted mt-3">
        Funding rates are current snapshot rates. Positive = longs pay shorts; negative = shorts pay longs.
      </p>
    </div>
  )
}
