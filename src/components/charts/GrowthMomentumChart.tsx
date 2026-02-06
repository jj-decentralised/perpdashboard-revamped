import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, TOKEN_COLOR, NO_TOKEN_COLOR, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatPercent, formatUSD, percentClass, classNames } from '../../utils/format'

interface Props {
  exchanges: EnrichedExchange[]
}

type ChangeKey = 'change_1d' | 'change_7d' | 'change_1m' | 'change_7dover7d' | 'change_30dover30d'

interface GrowthCategory {
  label: string
  key: ChangeKey
}

const GROWTH_CATEGORIES: GrowthCategory[] = [
  { label: '1 Day', key: 'change_1d' },
  { label: '7 Day', key: 'change_7d' },
  { label: '1 Month', key: 'change_1m' },
  { label: '7d/7d', key: 'change_7dover7d' },
  { label: '30d/30d', key: 'change_30dover30d' },
]

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = average(values)
  const squaredDiffs = values.map((v) => (v - mean) ** 2)
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1))
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || !payload.length) return null

  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ margin: 0, color: entry.color, fontSize: 12 }}>
          {entry.name}: {formatPercent(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function GrowthMomentumChart({ exchanges }: Props) {
  const { chartData, tokenStdDev, noTokenStdDev, topGainers, topLosers } = useMemo(() => {
    const tokenExchanges = exchanges.filter((e) => e.hasToken)
    const noTokenExchanges = exchanges.filter((e) => !e.hasToken)

    // Build grouped bar data
    const chartData = GROWTH_CATEGORIES.map(({ label, key }) => {
      const tokenValues = tokenExchanges
        .map((e) => e[key])
        .filter((v): v is number => v != null && isFinite(v))
      const noTokenValues = noTokenExchanges
        .map((e) => e[key])
        .filter((v): v is number => v != null && isFinite(v))

      return {
        category: label,
        Token: tokenValues.length > 0 ? average(tokenValues) : 0,
        'No Token': noTokenValues.length > 0 ? average(noTokenValues) : 0,
      }
    })

    // Volatility: std dev of 1d changes
    const token1dValues = tokenExchanges
      .map((e) => e.change_1d)
      .filter((v): v is number => v != null && isFinite(v))
    const noToken1dValues = noTokenExchanges
      .map((e) => e.change_1d)
      .filter((v): v is number => v != null && isFinite(v))

    const tokenStdDev = standardDeviation(token1dValues)
    const noTokenStdDev = standardDeviation(noToken1dValues)

    // Top movers by change_1d
    const validExchanges = exchanges.filter(
      (e) => e.change_1d != null && isFinite(e.change_1d)
    )
    const sorted = [...validExchanges].sort(
      (a, b) => (b.change_1d ?? 0) - (a.change_1d ?? 0)
    )

    const topGainers = sorted.slice(0, 5)
    const topLosers = sorted.slice(-5).reverse()

    return { chartData, tokenStdDev, noTokenStdDev, topGainers, topLosers }
  }, [exchanges])

  const moreVolatileGroup = tokenStdDev > noTokenStdDev ? 'Token' : 'No-Token'
  const volatilityRatio =
    noTokenStdDev > 0 && tokenStdDev > 0
      ? Math.max(tokenStdDev, noTokenStdDev) / Math.min(tokenStdDev, noTokenStdDev)
      : 0

  return (
    <div className="chart-container">
      <h3 className="chart-title">Growth Momentum</h3>
      <p className="chart-subtitle">
        Comparative growth dynamics — tokenised vs non-tokenised exchanges
      </p>

      {/* Grouped bar chart */}
      <ResponsiveContainer width="100%" height={360}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke={GRID_STYLE.stroke}
            strokeDasharray={GRID_STYLE.strokeDasharray}
          />
          <XAxis
            dataKey="category"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
          />
          <YAxis
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={58}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="square"
            iconSize={10}
            wrapperStyle={{
              fontSize: 11,
              fontFamily: AXIS_STYLE.fontFamily,
              paddingBottom: 8,
            }}
          />
          <Bar
            dataKey="Token"
            fill={TOKEN_COLOR}
            radius={[2, 2, 0, 0]}
            maxBarSize={40}
          />
          <Bar
            dataKey="No Token"
            fill={NO_TOKEN_COLOR}
            radius={[2, 2, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Volatility stat box */}
      <div className="border border-rule p-4 mt-6">
        <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-2 font-semibold">
          1-Day Volatility Comparison
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="font-sans text-xs text-ink-muted">Token Std Dev</p>
            <p className="font-mono text-sm font-bold text-ink">
              {tokenStdDev.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="font-sans text-xs text-ink-muted">No-Token Std Dev</p>
            <p className="font-mono text-sm font-bold text-ink">
              {noTokenStdDev.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="font-sans text-xs text-ink-muted">More Volatile</p>
            <p className="font-mono text-sm font-bold text-ink">
              {moreVolatileGroup}{' '}
              {volatilityRatio > 0 && (
                <span className="font-sans text-xs text-ink-muted font-normal">
                  ({volatilityRatio.toFixed(2)}x)
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Top movers table */}
      <div className="mt-6">
        <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-3 font-semibold">
          Top Movers — 24h Change
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Gainers */}
          <div>
            <p className="font-serif text-sm font-bold text-ink mb-2">
              Top 5 Gainers
            </p>
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Exchange</th>
                  <th className="text-right">24h Vol</th>
                  <th className="text-right">1d Change</th>
                  <th className="text-center">Token</th>
                </tr>
              </thead>
              <tbody>
                {topGainers.map((ex) => (
                  <tr key={ex.name}>
                    <td className="font-sans text-sm text-ink">{ex.name}</td>
                    <td className="text-right">
                      {ex.total24h != null ? formatUSD(ex.total24h, true) : '—'}
                    </td>
                    <td className={classNames('text-right', percentClass(ex.change_1d))}>
                      {formatPercent(ex.change_1d)}
                    </td>
                    <td className="text-center">
                      {ex.hasToken ? (
                        <span className="tag-token">Yes</span>
                      ) : (
                        <span className="tag-no-token">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top Losers */}
          <div>
            <p className="font-serif text-sm font-bold text-ink mb-2">
              Top 5 Losers
            </p>
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Exchange</th>
                  <th className="text-right">24h Vol</th>
                  <th className="text-right">1d Change</th>
                  <th className="text-center">Token</th>
                </tr>
              </thead>
              <tbody>
                {topLosers.map((ex) => (
                  <tr key={ex.name}>
                    <td className="font-sans text-sm text-ink">{ex.name}</td>
                    <td className="text-right">
                      {ex.total24h != null ? formatUSD(ex.total24h, true) : '—'}
                    </td>
                    <td className={classNames('text-right', percentClass(ex.change_1d))}>
                      {formatPercent(ex.change_1d)}
                    </td>
                    <td className="text-center">
                      {ex.hasToken ? (
                        <span className="tag-token">Yes</span>
                      ) : (
                        <span className="tag-no-token">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
