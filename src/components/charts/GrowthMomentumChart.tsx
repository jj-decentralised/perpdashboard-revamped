import { useState, useMemo } from 'react'
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
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, TOKEN_COLOR, NO_TOKEN_COLOR, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatPercent, formatUSD, classNames } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { CategoryFilter, type CategorySelection } from '../CategoryFilter'

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

const MIN_VOLUME_24H = 10_000_000 // $10M minimum 24h volume
const EMERGING_MIN_VOLUME = 1_000_000 // $1M floor for emerging exchanges
const MAX_CHANGE_DISPLAY = 300 // cap at ±300% for visual sanity

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function interquartileRange(values: number[]): { q1: number; q3: number; iqr: number } {
  if (values.length < 4) return { q1: 0, q3: 0, iqr: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const lowerHalf = sorted.slice(0, Math.floor(sorted.length / 2))
  const upperHalf = sorted.slice(Math.ceil(sorted.length / 2))
  const q1 = median(lowerHalf)
  const q3 = median(upperHalf)
  return { q1, q3, iqr: q3 - q1 }
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

interface ScatterEntry {
  name: string
  volume24h: number
  growth7d: number
  openInterest: number
  hasToken: boolean
  tokenSymbol: string | null
}

interface IQRStats {
  q1: number
  q3: number
  iqr: number
}

export function GrowthMomentumChart({ exchanges }: Props) {
  const [category, setCategory] = useState<CategorySelection>('all')

  const filtered = category === 'all' ? exchanges : exchanges.filter(e => e.venueType === category)

  const {
    chartData,
    tokenStdDev,
    noTokenStdDev,
    tokenMedian1d,
    noTokenMedian1d,
    tokenIQR,
    noTokenIQR,
    topGainers,
    topLosers,
    emergingExchanges,
    scatterData,
  } = useMemo(() => {
    // Filter to meaningful exchanges for growth categories
    const meaningful = filtered.filter((e) => (e.total24h || 0) >= MIN_VOLUME_24H)
    const tokenExchanges = meaningful.filter((e) => e.hasToken)
    const noTokenExchanges = meaningful.filter((e) => !e.hasToken)

    // Build grouped bar data using medians
    const chartData = GROWTH_CATEGORIES.map(({ label, key }) => {
      const tokenValues = tokenExchanges
        .map((e) => e[key])
        .filter((v): v is number => v != null && isFinite(v))
      const noTokenValues = noTokenExchanges
        .map((e) => e[key])
        .filter((v): v is number => v != null && isFinite(v))

      return {
        category: label,
        Token: tokenValues.length > 0 ? median(tokenValues) : 0,
        'No Token': noTokenValues.length > 0 ? median(noTokenValues) : 0,
      }
    })

    // Volatility: std dev + median + IQR of 1d changes
    const token1dValues = tokenExchanges
      .map((e) => e.change_1d)
      .filter((v): v is number => v != null && isFinite(v))
    const noToken1dValues = noTokenExchanges
      .map((e) => e.change_1d)
      .filter((v): v is number => v != null && isFinite(v))

    const tokenStdDev = standardDeviation(token1dValues)
    const noTokenStdDev = standardDeviation(noToken1dValues)
    const tokenMedian1d = median(token1dValues)
    const noTokenMedian1d = median(noToken1dValues)
    const tokenIQR: IQRStats = interquartileRange(token1dValues)
    const noTokenIQR: IQRStats = interquartileRange(noToken1dValues)

    // Top movers: require minimum volume AND reasonable change range
    const validExchanges = filtered.filter(
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

    // Emerging exchanges: $1M-$10M daily volume
    const emerging = filtered
      .filter(
        (e) =>
          (e.total24h || 0) >= EMERGING_MIN_VOLUME &&
          (e.total24h || 0) < MIN_VOLUME_24H &&
          e.change_7d != null &&
          isFinite(e.change_7d)
      )
      .sort((a, b) => (b.change_7d ?? 0) - (a.change_7d ?? 0))
      .slice(0, 10)
      .map(mapToMover)

    // Scatter data: momentum vs size (exchanges with valid 7d change and volume)
    const scatterData: ScatterEntry[] = filtered
      .filter(
        (e) =>
          e.change_7d != null &&
          isFinite(e.change_7d) &&
          (e.total24h || 0) > 0 &&
          Math.abs(e.change_7d) < 1000
      )
      .map((e) => ({
        name: e.displayName || e.name,
        volume24h: e.total24h || 0,
        growth7d: e.change_7d ?? 0,
        openInterest: e.openInterest || 0,
        hasToken: e.hasToken,
        tokenSymbol: e.tokenSymbol,
      }))

    return {
      chartData,
      tokenStdDev,
      noTokenStdDev,
      tokenMedian1d,
      noTokenMedian1d,
      tokenIQR,
      noTokenIQR,
      topGainers,
      topLosers,
      emergingExchanges: emerging,
      scatterData,
    }
  }, [filtered])

  const moreVolatileGroup = tokenStdDev > noTokenStdDev ? 'Token' : 'No-Token'
  const volatilityRatio =
    noTokenStdDev > 0 && tokenStdDev > 0
      ? Math.max(tokenStdDev, noTokenStdDev) / Math.min(tokenStdDev, noTokenStdDev)
      : 0

  // Compute OI range for scatter dot sizing
  const oiValues = scatterData.map((d) => d.openInterest).filter((v) => v > 0)
  const maxOI = oiValues.length > 0 ? Math.max(...oiValues) : 1

  return (
    <div className="chart-container">
      <h3 className="chart-title">Growth Momentum</h3>
      <p className="chart-subtitle">
        Comparative growth dynamics — tokenised vs non-tokenised perpetual exchanges (min. $10M daily volume)
      </p>
      <MetricInfo
        description="Realized volatility (standard deviation of daily volume changes) reveals how erratic trading activity is across exchanges. High volatility often signals speculative surges or market stress. Comparing tokenised vs non-tokenised exchange volatility highlights whether governance token incentives amplify or dampen volume swings. Median growth rates are used instead of means to prevent outlier skew."
        source="Computed from DefiLlama daily volume change data. Statistics measured across all exchanges with >$10M daily volume. Emerging exchanges ($1M-$10M) shown separately."
      />

      <div className="flex items-center gap-3 mb-4">
        <CategoryFilter
          selected={category}
          onChange={setCategory}
          defiCount={exchanges.filter(e => e.venueType === 'defi').length}
          cefiCount={exchanges.filter(e => e.venueType === 'cefi').length}
        />
      </div>

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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
            <p className="font-sans text-xs text-ink-muted">Token Median / IQR</p>
            <p className="font-mono text-sm font-bold text-ink">
              {tokenMedian1d.toFixed(2)}%
              <span className="font-sans text-xs text-ink-muted font-normal ml-1">
                (IQR {tokenIQR.iqr.toFixed(2)}%)
              </span>
            </p>
          </div>
          <div>
            <p className="font-sans text-xs text-ink-muted">No-Token Median / IQR</p>
            <p className="font-mono text-sm font-bold text-ink">
              {noTokenMedian1d.toFixed(2)}%
              <span className="font-sans text-xs text-ink-muted font-normal ml-1">
                (IQR {noTokenIQR.iqr.toFixed(2)}%)
              </span>
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
          Top Movers — 24h Volume Change (exchanges with {'>'}$10M daily volume)
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

      {/* Emerging Exchanges — $1M-$10M daily volume */}
      {emergingExchanges.length > 0 && (
        <div className="mt-6">
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-3 font-semibold">
            Emerging Exchanges — 7d Volume Change ($1M–$10M daily volume)
          </p>
          <div className="border border-rule p-4">
            <div className="overflow-x-auto">
              <table className="w-full font-sans text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-muted uppercase tracking-wider">
                    <th className="pb-2 pr-4">Exchange</th>
                    <th className="pb-2 pr-4 text-right">24h Volume</th>
                    <th className="pb-2 pr-4 text-right">7d Change</th>
                    <th className="pb-2 text-right">Token</th>
                  </tr>
                </thead>
                <tbody>
                  {emergingExchanges.map((ex) => (
                    <tr key={ex.name} className="border-t border-rule">
                      <td className="py-1.5 pr-4 font-medium">{ex.name}</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">{ex.volume}</td>
                      <td
                        className="py-1.5 pr-4 text-right font-mono text-xs font-semibold"
                        style={{ color: ex.change >= 0 ? COLORS.green : COLORS.red }}
                      >
                        {formatPercent(ex.change)}
                      </td>
                      <td className="py-1.5 text-right text-xs text-ink-muted">
                        {ex.tokenSymbol || (ex.hasToken ? 'Yes' : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Momentum vs Size Scatter */}
      {scatterData.length > 0 && (
        <div className="mt-6">
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-3 font-semibold">
            Momentum vs Size — 7d Volume Growth vs 24h Volume (dot size = open interest)
          </p>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 8, right: 24, bottom: 24, left: 8 }}>
              <CartesianGrid
                stroke={GRID_STYLE.stroke}
                strokeDasharray={GRID_STYLE.strokeDasharray}
              />
              <XAxis
                type="number"
                dataKey="volume24h"
                name="24h Volume"
                scale="log"
                domain={['auto', 'auto']}
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={{ stroke: COLORS.rule }}
                tickFormatter={(v: number) => formatUSD(v, true)}
                label={{
                  value: '24h Volume (log scale)',
                  position: 'insideBottom',
                  offset: -16,
                  style: { ...AXIS_STYLE, fontSize: 10 },
                }}
              />
              <YAxis
                type="number"
                dataKey="growth7d"
                name="7d Growth"
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={false}
                width={58}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                label={{
                  value: '7d Volume Growth (%)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 4,
                  style: { ...AXIS_STYLE, fontSize: 10 },
                }}
              />
              <ZAxis
                type="number"
                dataKey="openInterest"
                range={[30, 400]}
                name="Open Interest"
              />
              <ReferenceLine y={0} stroke={COLORS.rule} strokeDasharray="3 3" />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as ScatterEntry
                  return (
                    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                      <p style={TOOLTIP_STYLE.labelStyle}>
                        {d.name}
                        {d.tokenSymbol ? ` (${d.tokenSymbol})` : ''}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: COLORS.inkLight }}>
                        24h Volume: {formatUSD(d.volume24h, true)}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          fontWeight: 600,
                          color: d.growth7d >= 0 ? COLORS.green : COLORS.red,
                        }}
                      >
                        7d Growth: {formatPercent(d.growth7d)}
                      </p>
                      {d.openInterest > 0 && (
                        <p style={{ margin: 0, fontSize: 12, color: COLORS.inkLight }}>
                          Open Interest: {formatUSD(d.openInterest, true)}
                        </p>
                      )}
                    </div>
                  )
                }}
                cursor={{ strokeDasharray: '3 3' }}
              />
              <Scatter data={scatterData} animationDuration={600}>
                {scatterData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.growth7d >= 0 ? COLORS.green : COLORS.red}
                    fillOpacity={0.6}
                    stroke={entry.growth7d >= 0 ? COLORS.green : COLORS.red}
                    strokeOpacity={0.8}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
