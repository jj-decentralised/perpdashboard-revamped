import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts'
import type { CGDerivativeTicker } from '../../types/coingecko'
import { COLORS, AXIS_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatFundingRate, formatUSD } from '../../utils/format'

interface Props {
  tickers: CGDerivativeTicker[]
}

function parsePairLabel(ticker: CGDerivativeTicker): string {
  // symbol is like "BTCUSDT", "ETHUSDT", "SOLUSDT"
  // index_id is like "BTC", "ETH", "SOL"
  const sym = ticker.symbol || ''
  const idx = ticker.index_id || ''

  if (idx && sym.startsWith(idx)) {
    const quote = sym.slice(idx.length) || 'USD'
    return `${idx}/${quote}`
  }
  // Fallback: just use symbol
  return sym || '???'
}

function shortenMarket(market: string): string {
  return market
    .replace(/\s*\(Futures\)/i, '')
    .replace(/\s*\(Derivatives\)/i, '')
    .replace(/\s*\(Perps?\)/i, '')
    .trim()
}

export function FundingRateChart({ tickers }: Props) {
  const chartData = useMemo(() => {
    if (!tickers || tickers.length === 0) return []

    // Deduplicate: keep one entry per index_id (the one with highest OI)
    const bestByPair = new Map<string, CGDerivativeTicker>()
    for (const t of tickers) {
      if (t.contract_type !== 'perpetual' || t.funding_rate == null) continue
      if (Math.abs(t.funding_rate) > 1) continue // filter garbage
      const key = t.index_id || t.symbol
      const existing = bestByPair.get(key)
      if (!existing || (t.open_interest || 0) > (existing.open_interest || 0)) {
        bestByPair.set(key, t)
      }
    }

    return Array.from(bestByPair.values())
      .sort((a, b) => (b.open_interest || 0) - (a.open_interest || 0))
      .slice(0, 20)
      .map((t) => ({
        label: `${parsePairLabel(t)} · ${shortenMarket(t.market)}`,
        pair: parsePairLabel(t),
        market: shortenMarket(t.market),
        rate: t.funding_rate,
        oi: t.open_interest || 0,
        volume: t.volume_24h || 0,
      }))
      .sort((a, b) => b.rate - a.rate) // positive at top, negative at bottom
  }, [tickers])

  const stats = useMemo(() => {
    if (chartData.length === 0) return null
    const rates = chartData.map((r) => r.rate)
    const avg = rates.reduce((s, v) => s + v, 0) / rates.length
    const positiveCount = rates.filter((r) => r >= 0).length
    return { avg, positiveCount, total: rates.length }
  }, [chartData])

  if (chartData.length === 0) {
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
    <div>
      <h3 className="chart-title">Funding Rates</h3>
      <p className="chart-subtitle">
        Top perpetual pairs by open interest — positive means longs pay shorts
      </p>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-5 pb-4 border-b border-rule">
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Avg Rate</p>
            <p className="font-mono text-sm font-bold text-ink">
              {formatFundingRate(stats.avg)}
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Positive / Total</p>
            <p className="font-mono text-sm font-bold text-ink">
              {stats.positiveCount} / {stats.total}
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Sentiment</p>
            <p
              className="font-mono text-sm font-bold"
              style={{ color: stats.positiveCount > stats.total / 2 ? COLORS.green : COLORS.red }}
            >
              {stats.positiveCount > stats.total / 2 ? 'Net Long' : 'Net Short'}
            </p>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={Math.max(400, chartData.length * 28 + 40)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
        >
          <XAxis
            type="number"
            tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}%`}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
            domain={['dataMin', 'dataMax']}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={160}
            tick={{ ...AXIS_STYLE, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return (
                <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                  <p style={TOOLTIP_STYLE.labelStyle}>
                    {d.pair} — {d.market}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      color: d.rate >= 0 ? COLORS.green : COLORS.red,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Funding: {formatFundingRate(d.rate)}
                  </p>
                  <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
                    Open Interest: {formatUSD(d.oi, true)}
                  </p>
                  <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
                    24h Volume: {formatUSD(d.volume, true)}
                  </p>
                </div>
              )
            }}
            cursor={{ fill: COLORS.paperAlt }}
          />
          <ReferenceLine x={0} stroke={COLORS.ink} strokeWidth={1} />
          <Bar dataKey="rate" radius={[0, 2, 2, 0]} animationDuration={800} maxBarSize={18}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.rate >= 0 ? COLORS.green : COLORS.red}
                opacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5"
            style={{ backgroundColor: COLORS.green, opacity: 0.8 }}
          />
          <span className="font-sans text-[11px] text-ink-muted">
            Positive (longs pay shorts)
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5"
            style={{ backgroundColor: COLORS.red, opacity: 0.8 }}
          />
          <span className="font-sans text-[11px] text-ink-muted">
            Negative (shorts pay longs)
          </span>
        </span>
      </div>
    </div>
  )
}
