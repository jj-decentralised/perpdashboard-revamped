import { useMemo } from 'react'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

interface ValuationPoint {
  name: string
  vol30d: number
  mcap: number
  logVol: number
  logMcap: number
  residualPct: number
  annualizedFees: number
  showLabel: boolean
}

function get30dVolume(e: EnrichedExchange): number {
  if (e.total30d && e.total30d > 0) return e.total30d
  if (e.total24h && e.total24h > 0) return e.total24h * 30
  return 0
}

function formatAxisTick(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(0)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ValuationPoint }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (!d) return null
  const label = d.residualPct >= 0 ? 'Overvalued' : 'Undervalued'
  const color = d.residualPct >= 0 ? COLORS.red : COLORS.green

  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
      <p style={{ ...TOOLTIP_STYLE.labelStyle, margin: 0 }}>{d.name}</p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
        30d Volume: {formatUSD(d.vol30d, true)}
      </p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
        Market Cap: {formatUSD(d.mcap, true)}
      </p>
      {d.annualizedFees > 0 && (
        <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
          Ann. Fees: {formatUSD(d.annualizedFees, true)}
        </p>
      )}
      <p style={{ margin: 0, color, fontSize: 12, fontWeight: 600 }}>
        {label}: {Math.abs(d.residualPct).toFixed(0)}% vs peers
      </p>
    </div>
  )
}

function CustomLabel(props: any) {
  const { x, y, value, index } = props
  const point = props.data?.[index]
  if (!point?.showLabel) return null
  return (
    <text x={x} y={y - 10} textAnchor="middle" fill={COLORS.inkMuted} fontSize={9} fontFamily={AXIS_STYLE.fontFamily}>
      {value}
    </text>
  )
}

export function ValuationScatterChart({ exchanges }: Props) {
  const { points, regression } = useMemo(() => {
    const filtered = exchanges.filter(
      (e) => e.hasToken && e.mcap && e.mcap > 0 && get30dVolume(e) > 0
    )

    if (filtered.length < 3) return { points: [], regression: null }

    // Sort by volume to determine which get labels
    const sorted = [...filtered].sort((a, b) => get30dVolume(b) - get30dVolume(a))
    const topNames = new Set(sorted.slice(0, 10).map((e) => e.name))

    const pts: ValuationPoint[] = filtered.map((e) => {
      const vol30d = get30dVolume(e)
      const mcap = e.mcap!
      return {
        name: e.displayName || e.name,
        vol30d,
        mcap,
        logVol: Math.log10(vol30d),
        logMcap: Math.log10(mcap),
        residualPct: 0,
        annualizedFees: e.annualizedFees || 0,
        showLabel: topNames.has(e.name),
      }
    })

    // OLS regression on log-log
    const n = pts.length
    const sumX = pts.reduce((s, p) => s + p.logVol, 0)
    const sumY = pts.reduce((s, p) => s + p.logMcap, 0)
    const sumXY = pts.reduce((s, p) => s + p.logVol * p.logMcap, 0)
    const sumX2 = pts.reduce((s, p) => s + p.logVol * p.logVol, 0)
    const denom = n * sumX2 - sumX * sumX
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
    const intercept = (sumY - slope * sumX) / n

    // Compute residuals
    for (const p of pts) {
      const predicted = Math.pow(10, slope * p.logVol + intercept)
      p.residualPct = ((p.mcap - predicted) / predicted) * 100
    }

    // Regression line endpoints
    const logVols = pts.map((p) => p.logVol)
    const minLog = Math.min(...logVols)
    const maxLog = Math.max(...logVols)
    const reg = {
      x1: Math.pow(10, minLog) * 0.5,
      y1: Math.pow(10, slope * minLog + intercept) * Math.pow(0.5, slope),
      x2: Math.pow(10, maxLog) * 2,
      y2: Math.pow(10, slope * maxLog + intercept) * Math.pow(2, slope),
    }

    return { points: pts, regression: reg }
  }, [exchanges])

  if (points.length < 3) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Relative Valuation: Volume vs Market Cap</h3>
        <p className="chart-subtitle">Not enough protocols with tokens and volume data.</p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Relative Valuation: Volume vs Market Cap</h3>
      <p className="chart-subtitle">
        Protocols below the regression line are undervalued relative to peers given their volume
      </p>

      <MetricInfo
        description="Plots 30-day trading volume against market cap for all tokenised perp protocols on a log-log scale. A linear regression shows the 'fair value' line — protocols below the line trade at a discount to what volume peers command, while those above trade at a premium. Bubble size reflects annualised fee revenue."
        source="Volume and market cap from DefiLlama + CoinGecko. Only protocols with active tokens and measurable volume are shown."
      />

      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 28, left: 8 }}>
          <CartesianGrid stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
          <XAxis
            dataKey="vol30d"
            type="number"
            name="30d Volume"
            scale="log"
            domain={['auto', 'auto']}
            tickFormatter={formatAxisTick}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
            label={{
              value: '30d Volume (USD)',
              position: 'insideBottom',
              offset: -18,
              style: { ...AXIS_STYLE, fill: COLORS.inkMuted },
            }}
          />
          <YAxis
            dataKey="mcap"
            type="number"
            name="Market Cap"
            scale="log"
            domain={['auto', 'auto']}
            tickFormatter={formatAxisTick}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={58}
            label={{
              value: 'Market Cap (USD)',
              angle: -90,
              position: 'insideLeft',
              offset: 4,
              style: { ...AXIS_STYLE, fill: COLORS.inkMuted },
            }}
          />
          <ZAxis
            dataKey="annualizedFees"
            type="number"
            range={[50, 500]}
            name="Ann. Fees"
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }}
          />
          {/* Regression line — invisible dots, visible connecting line */}
          {regression && (
            <Scatter
              data={[
                { vol30d: regression.x1, mcap: regression.y1, name: '', residualPct: 0, annualizedFees: 0, showLabel: false, logVol: 0, logMcap: 0 },
                { vol30d: regression.x2, mcap: regression.y2, name: '', residualPct: 0, annualizedFees: 0, showLabel: false, logVol: 0, logMcap: 0 },
              ]}
              line={{ stroke: COLORS.inkMuted, strokeWidth: 1.5, strokeDasharray: '6 4' }}
              lineType="fitting"
              fill="transparent"
              legendType="none"
              isAnimationActive={false}
            >
              <Cell fill="transparent" />
              <Cell fill="transparent" />
            </Scatter>
          )}
          <Scatter
            data={points}
            fillOpacity={0.85}
            strokeWidth={0}
            shape="circle"
            animationDuration={600}
          >
            {points.map((p, i) => (
              <Cell
                key={i}
                fill={p.residualPct < 0 ? COLORS.green : COLORS.red}
                fillOpacity={0.8}
              />
            ))}
            <LabelList
              dataKey="name"
              content={<CustomLabel data={points} />}
            />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-5 mt-2" style={{ fontFamily: AXIS_STYLE.fontFamily, fontSize: 12, color: COLORS.inkLight }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.green }} />
          Undervalued vs peers
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.red }} />
          Overvalued vs peers
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0" style={{ borderTop: `1.5px dashed ${COLORS.inkMuted}` }} />
          Fair value line
        </span>
      </div>

      <p className="font-sans text-[10px] text-ink-muted mt-3 italic">
        Log-log regression of 30d volume vs market cap. Bubble size reflects annualised fee revenue. Only protocols with active tokens shown.
      </p>
    </div>
  )
}
