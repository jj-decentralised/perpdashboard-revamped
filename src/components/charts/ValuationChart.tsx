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
  const { barData, scatterData, medianPE, medianPS } = useMemo(() => {
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
      }))

    const peValues = valid.map((e) => e.peRatio!).sort((a, b) => a - b)
    const psValues = valid.map((e) => e.psRatio!).sort((a, b) => a - b)
    const mid = Math.floor(peValues.length / 2)
    const medianPE = peValues.length > 0
      ? peValues.length % 2 ? peValues[mid] : (peValues[mid - 1] + peValues[mid]) / 2
      : 0
    const medianPS = psValues.length > 0
      ? psValues.length % 2 ? psValues[mid] : (psValues[mid - 1] + psValues[mid]) / 2
      : 0

    return { barData, scatterData, medianPE, medianPS }
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

      {/* Summary stats */}
      <div className="border-t border-rule mt-4 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="font-sans text-xs text-ink-muted">Median P/E</p>
            <p className="font-mono text-sm font-bold text-ink">{formatMultiple(medianPE)}</p>
          </div>
          <div>
            <p className="font-sans text-xs text-ink-muted">Median P/S</p>
            <p className="font-mono text-sm font-bold text-ink">{formatMultiple(medianPS)}</p>
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
        <p className="font-sans text-[11px] text-ink-muted mt-2">
          P/E = Market Cap / Annualised Revenue. P/S = Market Cap / Annualised Fees.
          Lower ratios suggest relative undervaluation. TradFi exchange benchmarks (CME, ICE) typically trade at 20-30x P/E.
        </p>
      </div>
    </div>
  )
}
