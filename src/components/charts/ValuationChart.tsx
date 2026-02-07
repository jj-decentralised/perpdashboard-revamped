import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHART_PALETTE } from '../../utils/chartTheme'
import { formatUSD, formatMultiple } from '../../utils/format'
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
  change1d: number | null
  hasToken: boolean
}

/** Compute a percentile value from a sorted array using linear interpolation. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

interface QuartileStats {
  q1: number
  median: number
  q3: number
  values: number[]
}

function computeQuartiles(values: number[]): QuartileStats {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    q1: percentile(sorted, 25),
    median: percentile(sorted, 50),
    q3: percentile(sorted, 75),
    values: sorted,
  }
}

interface CategoryStats {
  label: string
  count: number
  peStats: QuartileStats
  psStats: QuartileStats
  rows: ValuationRow[]
}

/** Horizontal distribution strip showing Q1, median, Q3, and individual data points. */
function DistributionStrip({
  stats,
  color,
  label,
}: {
  stats: QuartileStats
  color: string
  label: string
}) {
  if (stats.values.length < 2) return null
  const min = stats.values[0]
  const max = stats.values[stats.values.length - 1]
  const range = max - min
  if (range === 0) return null

  const toPercent = (v: number) => ((v - min) / range) * 100

  return (
    <div style={{ marginBottom: 8 }}>
      <p className="font-sans text-[10px] text-ink-muted mb-1">{label}</p>
      <svg
        width="100%"
        height={28}
        viewBox="0 0 200 28"
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        {/* Full range line */}
        <line x1={0} y1={14} x2={200} y2={14} stroke={COLORS.rule} strokeWidth={1} />
        {/* IQR box */}
        <rect
          x={toPercent(stats.q1) * 2}
          y={6}
          width={Math.max(1, (toPercent(stats.q3) - toPercent(stats.q1)) * 2)}
          height={16}
          fill={color}
          opacity={0.12}
          rx={2}
        />
        {/* Q1 tick */}
        <line
          x1={toPercent(stats.q1) * 2}
          y1={4}
          x2={toPercent(stats.q1) * 2}
          y2={24}
          stroke={color}
          strokeWidth={1.5}
          opacity={0.5}
        />
        {/* Q3 tick */}
        <line
          x1={toPercent(stats.q3) * 2}
          y1={4}
          x2={toPercent(stats.q3) * 2}
          y2={24}
          stroke={color}
          strokeWidth={1.5}
          opacity={0.5}
        />
        {/* Median tick */}
        <line
          x1={toPercent(stats.median) * 2}
          y1={2}
          x2={toPercent(stats.median) * 2}
          y2={26}
          stroke={color}
          strokeWidth={2}
        />
        {/* Individual data points */}
        {stats.values.map((v, i) => (
          <circle
            key={i}
            cx={toPercent(v) * 2}
            cy={14}
            r={2.5}
            fill={color}
            opacity={0.45}
          />
        ))}
      </svg>
      <div className="flex justify-between font-mono text-[9px] text-ink-muted" style={{ marginTop: 1 }}>
        <span>{min.toFixed(1)}x</span>
        <span>{max.toFixed(1)}x</span>
      </div>
    </div>
  )
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; payload: ValuationRow }>
  label?: string
}) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload

  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{d.name}</p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
        P/E Ratio: {formatMultiple(d.pe)}
      </p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
        P/S Ratio: {formatMultiple(d.ps)}
      </p>
      <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 11 }}>
        Market Cap: {formatUSD(d.mcap, true)}
      </p>
      <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 11 }}>
        24h Volume: {formatUSD(d.volume24h, true)}
      </p>
    </div>
  )
}

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload

  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{d.name}</p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
        P/E: {formatMultiple(d.pe)}
      </p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
        24h Change: {d.change1d != null ? `${d.change1d.toFixed(1)}%` : '\u2014'}
      </p>
      <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 11 }}>
        Market Cap: {formatUSD(d.mcap, true)}
      </p>
    </div>
  )
}

export function ValuationChart({ exchanges }: Props) {
  const [showCategoryView, setShowCategoryView] = useState(false)

  const { barData, scatterData, peStats, psStats, tokenCategory, noTokenCategory } = useMemo(() => {
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
      .sort((a, b) => (a.peRatio ?? Infinity) - (b.peRatio ?? Infinity))

    const barData: ValuationRow[] = valid.map((e) => ({
      name: e.displayName || e.name,
      pe: e.peRatio!,
      ps: e.psRatio!,
      mcap: e.mcap!,
      volume24h: e.total24h ?? 0,
      change1d: e.change_1d,
      hasToken: e.hasToken,
    }))

    const scatterData = valid
      .filter((e) => e.change_1d != null)
      .map((e) => ({
        name: e.displayName || e.name,
        pe: e.peRatio!,
        change1d: e.change_1d!,
        mcap: e.mcap!,
        ps: e.psRatio!,
        volume24h: e.total24h ?? 0,
        hasToken: e.hasToken,
      }))

    const peValues = valid.map((e) => e.peRatio!)
    const psValues = valid.map((e) => e.psRatio!)
    const peStats = computeQuartiles(peValues)
    const psStats = computeQuartiles(psValues)

    // Category breakdowns
    const tokenRows = barData.filter((r) => r.hasToken)
    const noTokenRows = barData.filter((r) => !r.hasToken)

    const tokenCategory: CategoryStats = {
      label: 'Token',
      count: tokenRows.length,
      peStats: computeQuartiles(tokenRows.map((r) => r.pe)),
      psStats: computeQuartiles(tokenRows.map((r) => r.ps)),
      rows: tokenRows,
    }

    const noTokenCategory: CategoryStats = {
      label: 'No Token',
      count: noTokenRows.length,
      peStats: computeQuartiles(noTokenRows.map((r) => r.pe)),
      psStats: computeQuartiles(noTokenRows.map((r) => r.ps)),
      rows: noTokenRows,
    }

    return { barData, scatterData, peStats, psStats, tokenCategory, noTokenCategory }
  }, [exchanges])

  if (barData.length === 0) {
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

      <ResponsiveContainer width="100%" height={Math.max(360, barData.length * 32)}>
        <BarChart
          data={barData}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            horizontal={false}
            stroke={GRID_STYLE.stroke}
            strokeDasharray={GRID_STYLE.strokeDasharray}
          />
          <XAxis
            type="number"
            tickFormatter={(v: number) => `${v.toFixed(0)}x`}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ ...AXIS_STYLE, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: COLORS.paperAlt }} />
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
            dataKey="pe"
            name="P/E Ratio"
            fill={COLORS.blue}
            radius={[0, 2, 2, 0]}
            animationDuration={800}
          />
          <Bar
            dataKey="ps"
            name="P/S Ratio"
            fill={COLORS.slate}
            radius={[0, 2, 2, 0]}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Scatter: P/E vs Volume Growth */}
      {scatterData.length >= 3 && (
        <div className="mt-8">
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-3 font-semibold">
            Value vs Momentum — P/E Ratio vs 24h Volume Change
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 8, right: 24, bottom: 24, left: 0 }}>
              <CartesianGrid
                stroke={GRID_STYLE.stroke}
                strokeDasharray={GRID_STYLE.strokeDasharray}
              />
              <XAxis
                type="number"
                dataKey="pe"
                name="P/E Ratio"
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={{ stroke: COLORS.rule }}
                label={{ value: 'P/E Ratio', position: 'bottom', offset: 8, ...AXIS_STYLE }}
              />
              <YAxis
                type="number"
                dataKey="change1d"
                name="24h Change %"
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                width={48}
              />
              <ZAxis type="number" dataKey="mcap" range={[40, 300]} />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter data={scatterData} animationDuration={800}>
                {scatterData.map((entry, index) => (
                  <Cell
                    key={`scatter-${index}`}
                    fill={entry.change1d >= 0 ? COLORS.green : COLORS.red}
                    opacity={0.7}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary stats with quartile distribution */}
      <div className="border-t border-rule mt-4 pt-4">
        {/* Category View toggle */}
        <div className="flex items-center justify-between mb-4">
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted font-semibold">
            Distribution Summary
          </p>
          <button
            onClick={() => setShowCategoryView((v) => !v)}
            className="font-sans text-[11px] px-3 py-1 border border-rule rounded-sm hover:bg-paper-alt transition-colors"
            style={{
              background: showCategoryView ? COLORS.paperAlt : COLORS.paper,
              color: COLORS.inkLight,
              cursor: 'pointer',
            }}
          >
            {showCategoryView ? 'All Exchanges' : 'Category View'}
          </button>
        </div>

        {!showCategoryView ? (
          <>
            {/* All-exchange quartile stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="font-sans text-xs text-ink-muted">P/E Distribution</p>
                <p className="font-mono text-sm font-bold text-ink">
                  Q1: {formatMultiple(peStats.q1)}, Median: {formatMultiple(peStats.median)}, Q3: {formatMultiple(peStats.q3)}
                </p>
              </div>
              <div>
                <p className="font-sans text-xs text-ink-muted">P/S Distribution</p>
                <p className="font-mono text-sm font-bold text-ink">
                  Q1: {formatMultiple(psStats.q1)}, Median: {formatMultiple(psStats.median)}, Q3: {formatMultiple(psStats.q3)}
                </p>
              </div>
              <div>
                <p className="font-sans text-xs text-ink-muted">Exchanges Tracked</p>
                <p className="font-mono text-sm font-bold text-ink">{barData.length}</p>
              </div>
              <div>
                <p className="font-sans text-xs text-ink-muted">TradFi Benchmark</p>
                <p className="font-mono text-sm font-bold text-ink-muted">~20-30x P/E</p>
              </div>
            </div>

            {/* Distribution visualization strips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <DistributionStrip
                stats={peStats}
                color={COLORS.blue}
                label="P/E Ratio — Q1 / Median / Q3"
              />
              <DistributionStrip
                stats={psStats}
                color={COLORS.slate}
                label="P/S Ratio — Q1 / Median / Q3"
              />
            </div>
          </>
        ) : (
          <>
            {/* Category View: Token vs No-Token */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[tokenCategory, noTokenCategory].map((cat) => (
                <div key={cat.label} className="border border-rule rounded-sm p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-sans text-xs font-semibold text-ink">
                      {cat.label} ({cat.count})
                    </p>
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: cat.label === 'Token' ? COLORS.ink : COLORS.slate,
                      }}
                    />
                  </div>
                  {cat.count > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <p className="font-sans text-[10px] text-ink-muted">P/E</p>
                          <p className="font-mono text-xs text-ink">
                            Q1: {formatMultiple(cat.peStats.q1)}, Median: {formatMultiple(cat.peStats.median)}, Q3: {formatMultiple(cat.peStats.q3)}
                          </p>
                        </div>
                        <div>
                          <p className="font-sans text-[10px] text-ink-muted">P/S</p>
                          <p className="font-mono text-xs text-ink">
                            Q1: {formatMultiple(cat.psStats.q1)}, Median: {formatMultiple(cat.psStats.median)}, Q3: {formatMultiple(cat.psStats.q3)}
                          </p>
                        </div>
                      </div>
                      <DistributionStrip
                        stats={cat.peStats}
                        color={cat.label === 'Token' ? COLORS.blue : COLORS.slate}
                        label="P/E Distribution"
                      />
                      <DistributionStrip
                        stats={cat.psStats}
                        color={cat.label === 'Token' ? COLORS.ink : COLORS.inkMuted}
                        label="P/S Distribution"
                      />
                      {/* Individual exchange list */}
                      <div className="mt-2 border-t border-rule pt-2">
                        {cat.rows.map((r) => (
                          <div
                            key={r.name}
                            className="flex justify-between font-mono text-[10px] text-ink-light py-0.5"
                          >
                            <span className="truncate mr-2">{r.name}</span>
                            <span className="whitespace-nowrap text-ink-muted">
                              P/E {formatMultiple(r.pe)} &middot; P/S {formatMultiple(r.ps)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="font-sans text-[11px] text-ink-muted">
                      No exchanges with valuation data in this category.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Methodology footnote */}
        <p className="font-sans text-[11px] text-ink-muted mt-4 leading-relaxed">
          <strong>Methodology:</strong> P/E = Circulating Market Cap / Annualised Revenue.
          P/S = Circulating Market Cap / Annualised Fees.
          Market cap uses circulating supply (not FDV) sourced from CoinGecko.
          Annualisation uses trailing 24h values extrapolated over 365 days (24h &times; 365).
          Revenue is estimated as fees &times; 0.3 assumed take rate where actual protocol revenue data
          is not available from DefiLlama; when DefiLlama provides explicit revenue figures, those are
          used instead. Lower ratios suggest relative undervaluation compared to peers.
          TradFi exchange benchmarks (CME, ICE) typically trade at 20&ndash;30x P/E.
        </p>
      </div>
    </div>
  )
}
