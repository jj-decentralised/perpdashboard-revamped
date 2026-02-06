import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
  ReferenceLine,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, TOKEN_COLOR, NO_TOKEN_COLOR, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatPercent, formatUSD, classNames } from '../../utils/format'

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

const MIN_VOLUME_24H = 1_000_000 // $1M minimum 24h volume
const MAX_CHANGE_DISPLAY = 300 // cap at ±300% for visual sanity

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

interface MoverEntry {
  name: string
  change: number
  changeCapped: number
  volume: string
  hasToken: boolean
  tokenSymbol: string | null
  rawVolume: number
}

export function GrowthMomentumChart({ exchanges }: Props) {
  const { chartData, tokenStdDev, noTokenStdDev, topGainers, topLosers } = useMemo(() => {
    // Filter to meaningful exchanges for growth categories
    const meaningful = exchanges.filter((e) => (e.total24h || 0) >= MIN_VOLUME_24H)
    const tokenExchanges = meaningful.filter((e) => e.hasToken)
    const noTokenExchanges = meaningful.filter((e) => !e.hasToken)

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

    // Top movers: require minimum volume AND reasonable change range
    const validExchanges = exchanges.filter(
      (e) =>
        e.change_1d != null &&
        isFinite(e.change_1d) &&
        (e.total24h || 0) >= MIN_VOLUME_24H &&
        Math.abs(e.change_1d) < 1000 // filter absurd data
    )
    const sorted = [...validExchanges].sort(
      (a, b) => (b.change_1d ?? 0) - (a.change_1d ?? 0)
    )

    const mapToMover = (ex: EnrichedExchange): MoverEntry => ({
      name: ex.displayName || ex.name,
      change: ex.change_1d ?? 0,
      changeCapped: Math.max(-MAX_CHANGE_DISPLAY, Math.min(MAX_CHANGE_DISPLAY, ex.change_1d ?? 0)),
      volume: formatUSD(ex.total24h, true),
      hasToken: ex.hasToken,
      tokenSymbol: ex.tokenSymbol,
      rawVolume: ex.total24h || 0,
    })

    const topGainers = sorted.slice(0, 8).filter((e) => (e.change_1d ?? 0) > 0).map(mapToMover)
    const topLosers = sorted.slice(-8).reverse().filter((e) => (e.change_1d ?? 0) < 0).map(mapToMover)

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
        Comparative growth dynamics — tokenised vs non-tokenised perpetual exchanges (min. $1M daily volume)
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

      {/* Top Movers — horizontal bar charts */}
      <div className="mt-6">
        <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-3 font-semibold">
          Top Movers — 24h Volume Change (exchanges with {'>'}$1M daily volume)
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gainers */}
          <div>
            <p className="font-serif text-sm font-bold mb-3" style={{ color: COLORS.green }}>
              Gainers
            </p>
            {topGainers.length === 0 ? (
              <p className="font-sans text-sm text-ink-muted">No gainers today</p>
            ) : (
              <ResponsiveContainer width="100%" height={topGainers.length * 36 + 30}>
                <BarChart
                  data={topGainers}
                  layout="vertical"
                  margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={{ stroke: COLORS.rule }}
                    tickFormatter={(v: number) => `+${v.toFixed(0)}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    tick={{ ...AXIS_STYLE, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as MoverEntry
                      return (
                        <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                          <p style={TOOLTIP_STYLE.labelStyle}>
                            {d.name}
                            {d.tokenSymbol ? ` (${d.tokenSymbol})` : ''}
                          </p>
                          <p style={{ margin: 0, color: COLORS.green, fontSize: 12, fontWeight: 600 }}>
                            {formatPercent(d.change)}
                          </p>
                          <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
                            24h Volume: {d.volume}
                          </p>
                        </div>
                      )
                    }}
                    cursor={{ fill: COLORS.paperAlt }}
                  />
                  <Bar dataKey="changeCapped" radius={[0, 3, 3, 0]} maxBarSize={22} animationDuration={600}>
                    {topGainers.map((_, i) => (
                      <Cell key={i} fill={COLORS.green} opacity={0.75 - i * 0.05} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Losers */}
          <div>
            <p className="font-serif text-sm font-bold mb-3" style={{ color: COLORS.red }}>
              Losers
            </p>
            {topLosers.length === 0 ? (
              <p className="font-sans text-sm text-ink-muted">No losers today</p>
            ) : (
              <ResponsiveContainer width="100%" height={topLosers.length * 36 + 30}>
                <BarChart
                  data={topLosers}
                  layout="vertical"
                  margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={{ stroke: COLORS.rule }}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                    reversed
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    tick={{ ...AXIS_STYLE, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    orientation="right"
                  />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as MoverEntry
                      return (
                        <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                          <p style={TOOLTIP_STYLE.labelStyle}>
                            {d.name}
                            {d.tokenSymbol ? ` (${d.tokenSymbol})` : ''}
                          </p>
                          <p style={{ margin: 0, color: COLORS.red, fontSize: 12, fontWeight: 600 }}>
                            {formatPercent(d.change)}
                          </p>
                          <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
                            24h Volume: {d.volume}
                          </p>
                        </div>
                      )
                    }}
                    cursor={{ fill: COLORS.paperAlt }}
                  />
                  <Bar dataKey="changeCapped" radius={[3, 0, 0, 3]} maxBarSize={22} animationDuration={600}>
                    {topLosers.map((_, i) => (
                      <Cell key={i} fill={COLORS.red} opacity={0.75 - i * 0.05} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
