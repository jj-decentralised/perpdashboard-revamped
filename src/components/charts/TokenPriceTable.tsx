import React, { useMemo } from 'react'
import type { CoinGeckoMarketData, EnrichedExchange } from '../../types'
import { formatUSD, formatPercent, percentClass, classNames } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  tokenPrices: CoinGeckoMarketData[]
  exchanges: EnrichedExchange[]
}

/**
 * Build an SVG polyline path from an array of price values.
 * The path is scaled to fit within the given width/height.
 */
function buildSparklinePath(
  prices: number[],
  width: number,
  height: number,
): string {
  if (prices.length < 2) return ''

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const stepX = width / (prices.length - 1)
  const padding = 2 // vertical padding so the line doesn't clip edges

  return prices
    .map((p, i) => {
      const x = (i * stepX).toFixed(2)
      const y = (height - padding - ((p - min) / range) * (height - padding * 2)).toFixed(2)
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
}

function Sparkline({ prices }: { prices: number[] }) {
  const width = 100
  const height = 30

  if (!prices || prices.length < 2) {
    return <span className="text-ink-muted font-sans text-xs">—</span>
  }

  const path = buildSparklinePath(prices, width, height)
  const wentUp = prices[prices.length - 1] >= prices[0]
  const strokeColor = wentUp ? '#1a1a1a' : '#c1352d'

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      style={{ display: 'block' }}
    >
      <path
        d={path}
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChangeCell({ value }: { value: number | null | undefined }) {
  return (
    <td className={classNames('text-right', percentClass(value ?? null))}>
      {formatPercent(value)}
    </td>
  )
}

export function TokenPriceTable({ tokenPrices, exchanges }: Props) {
  // Build a lookup from geckoId -> exchange for volume matching
  const exchangeByGeckoId = useMemo(() => {
    const map = new Map<string, EnrichedExchange>()
    for (const ex of exchanges) {
      if (ex.geckoId) {
        map.set(ex.geckoId, ex)
      }
    }
    return map
  }, [exchanges])

  if (!tokenPrices || tokenPrices.length === 0) {
    return (
      <section className="section-rule">
        <h3 className="font-serif text-lg font-bold text-ink mb-1">
          DEX Governance Tokens
        </h3>
        <p className="font-sans text-sm text-ink-muted">
          Token price data unavailable — rate limit may apply
        </p>
      </section>
    )
  }

  return (
    <section className="section-rule">
      {/* Section header */}
      <h3 className="font-serif text-lg font-bold text-ink mb-1">
        DEX Governance Tokens
      </h3>
      <p className="font-sans text-sm text-ink-muted mb-6">
        Price performance of exchange governance tokens
      </p>
      <MetricInfo
        description="Governance token prices reflect market expectations for each protocol's future fee revenue and growth. Comparing token performance across timeframes (24h, 7d, 30d) alongside exchange volume data helps identify disconnects between token valuation and actual protocol usage. Tokens with strong volume growth but lagging price may represent relative value opportunities, while tokens outperforming their protocol's fundamentals may be overextended."
        source="Token prices, market caps, and sparkline data from market aggregators. Exchange volume data for cross-referencing protocol activity."
      />

      {/* Data table */}
      <div className="overflow-x-auto">
        <table className="data-table w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left">Token</th>
              <th className="text-right">Price</th>
              <th className="text-right">Market Cap</th>
              <th className="text-right">24h</th>
              <th className="text-right">7d</th>
              <th className="text-right">30d</th>
              <th className="text-right">7d Sparkline</th>
            </tr>
          </thead>
          <tbody>
            {tokenPrices.map((token) => {
              const matchedExchange = exchangeByGeckoId.get(token.id)

              return (
                <tr key={token.id}>
                  {/* Token identity */}
                  <td>
                    <span className="font-mono font-semibold text-ink uppercase">
                      {token.symbol}
                    </span>
                    <span className="font-sans text-ink-muted text-xs ml-2">
                      {token.name}
                    </span>
                    {matchedExchange && (
                      <span className="font-sans text-ink-muted text-xs ml-1">
                        · Vol {formatUSD(matchedExchange.total24h ?? 0, true)}
                      </span>
                    )}
                  </td>

                  {/* Price */}
                  <td className="text-right">
                    {token.current_price < 1
                      ? `$${token.current_price.toFixed(4)}`
                      : formatUSD(token.current_price)}
                  </td>

                  {/* Market Cap */}
                  <td className="text-right">
                    {formatUSD(token.market_cap, true)}
                  </td>

                  {/* Change columns */}
                  <ChangeCell value={token.price_change_percentage_24h} />
                  <ChangeCell value={token.price_change_percentage_7d_in_currency} />
                  <ChangeCell value={token.price_change_percentage_30d_in_currency} />

                  {/* Sparkline */}
                  <td className="text-right">
                    <div className="inline-block align-middle">
                      <Sparkline prices={token.sparkline_in_7d?.price ?? []} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
