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
  ReferenceLine,
  Cell,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD, formatPercent, formatNumber } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

interface ScatterPoint {
  name: string
  turnover: number
  feeYield: number
  volume: number
  fees: number
  openInterest: number
  hasToken: boolean
  tokenSymbol: string | null
}

interface Stats {
  avgFeeYield: number
  avgTurnover: number
  mostEfficient: ScatterPoint | null
  highestTurnover: ScatterPoint | null
}

const TOKEN_DOT = COLORS.green
const NO_TOKEN_DOT = COLORS.blue

function formatAxisPercent(value: number): string {
  if (value >= 1) return `${value.toFixed(0)}%`
  if (value >= 0.01) return `${value.toFixed(2)}%`
  return `${value.toFixed(4)}%`
}

function formatAxisTurnover(value: number): string {
  if (value >= 1) return `${value.toFixed(0)}x`
  if (value >= 0.01) return `${value.toFixed(2)}x`
  return `${value.toFixed(3)}x`
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ScatterPoint }>
}) {
  if (!active || !payload || !payload.length) return null

  const point = payload[0].payload

  return (
    <div
      style={{
        ...TOOLTIP_STYLE.contentStyle,
        lineHeight: 1.6,
      }}
    >
      <p style={{ ...TOOLTIP_STYLE.labelStyle, margin: 0 }}>
        {point.name}
        {point.tokenSymbol ? ` (${point.tokenSymbol})` : ''}
      </p>
      <p style={{ margin: 0, color: COLORS.inkLight }}>
        Fee Yield: {point.feeYield.toFixed(4)}%
      </p>
      <p style={{ margin: 0, color: COLORS.inkLight }}>
        Turnover: {point.turnover.toFixed(3)}x
      </p>
      <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 11 }}>
        24h Fees: {formatUSD(point.fees, true)}
      </p>
      <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 11 }}>
        24h Volume: {formatUSD(point.volume, true)}
      </p>
      <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 11 }}>
        Open Interest: {formatUSD(point.openInterest, true)}
      </p>
    </div>
  )
}

export function CapitalEfficiencyChart({ exchanges }: Props) {
  const data = useMemo<ScatterPoint[]>(() => {
    return exchanges
      .filter(
        (e) =>
          e.openInterest > 0 &&
          e.feeData != null &&
          e.feeData.total24h != null &&
          e.feeData.total24h > 0
      )
      .map((e) => {
        const fees = e.feeData!.total24h!
        const volume = e.total24h ?? 0
        const oi = e.openInterest
        return {
          name: e.name,
          turnover: volume / oi,
          feeYield: (fees / oi) * 100,
          volume,
          fees,
          openInterest: oi,
          hasToken: e.hasToken,
          tokenSymbol: e.tokenSymbol,
        }
      })
      .filter((p) => p.turnover > 0 && p.feeYield > 0)
      .sort((a, b) => b.volume - a.volume)
  }, [exchanges])

  const stats = useMemo<Stats>(() => {
    if (data.length === 0) {
      return {
        avgFeeYield: 0,
        avgTurnover: 0,
        mostEfficient: null,
        highestTurnover: null,
      }
    }

    const avgFeeYield =
      data.reduce((sum, p) => sum + p.feeYield, 0) / data.length
    const avgTurnover =
      data.reduce((sum, p) => sum + p.turnover, 0) / data.length

    const mostEfficient = data.reduce((best, p) =>
      p.feeYield > best.feeYield ? p : best
    )
    const highestTurnover = data.reduce((best, p) =>
      p.turnover > best.turnover ? p : best
    )

    return { avgFeeYield, avgTurnover, mostEfficient, highestTurnover }
  }, [data])

  const volumeRange: [number, number] = useMemo(() => {
    if (data.length === 0) return [0, 1]
    const volumes = data.map((p) => p.volume)
    return [Math.min(...volumes), Math.max(...volumes)]
  }, [data])

  if (data.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Capital Efficiency: Fee Yield vs Turnover</h3>
        <p className="chart-subtitle">
          How efficiently each protocol converts open interest into fee revenue
        </p>
        <p className="font-sans text-sm text-ink-muted py-12 text-center">
          No data available — requires both open interest and fee data.
        </p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Capital Efficiency: Fee Yield vs Turnover</h3>
      <p className="chart-subtitle">
        How efficiently each protocol converts open interest into fee revenue
      </p>
      <MetricInfo
        description="Capital efficiency measures how well a protocol monetizes its open interest. Fee yield (fees / OI) shows the revenue generated per dollar of open interest, while turnover (volume / OI) indicates trading activity relative to positioning. Protocols in the upper-right quadrant generate high fees from active trading, while lower-left protocols have sticky capital with low fee generation. A high fee yield with low turnover suggests premium pricing, whereas high turnover with low fee yield indicates competitive fee structures."
        source="On-chain perps data for volume and open interest. Fee data from the fees endpoint. Ratios computed as 24h fees / OI (fee yield) and 24h volume / OI (turnover)."
      />

      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 28, left: 8 }}>
          <CartesianGrid
            stroke={GRID_STYLE.stroke}
            strokeDasharray={GRID_STYLE.strokeDasharray}
          />
          <XAxis
            dataKey="turnover"
            type="number"
            name="Turnover"
            scale="log"
            domain={['auto', 'auto']}
            tickFormatter={formatAxisTurnover}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
            label={{
              value: 'Turnover (Volume / OI)',
              position: 'insideBottom',
              offset: -16,
              style: { ...AXIS_STYLE, fill: COLORS.inkMuted },
            }}
          />
          <YAxis
            dataKey="feeYield"
            type="number"
            name="Fee Yield"
            scale="log"
            domain={['auto', 'auto']}
            tickFormatter={formatAxisPercent}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={62}
            label={{
              value: 'Fee Yield (Fees / OI)',
              angle: -90,
              position: 'insideLeft',
              offset: 4,
              style: { ...AXIS_STYLE, fill: COLORS.inkMuted },
            }}
          />
          <ZAxis
            dataKey="volume"
            type="number"
            range={[40, 500]}
            domain={volumeRange}
            name="24h Volume"
          />
          {/* Reference lines at median values to create quadrants */}
          <ReferenceLine
            x={stats.avgTurnover}
            stroke={COLORS.ruleDark}
            strokeDasharray="4 4"
            label={{
              value: 'Avg Turnover',
              position: 'insideTopRight',
              style: { fontSize: 10, fill: COLORS.inkMuted },
            }}
          />
          <ReferenceLine
            y={stats.avgFeeYield}
            stroke={COLORS.ruleDark}
            strokeDasharray="4 4"
            label={{
              value: 'Avg Fee Yield',
              position: 'insideTopRight',
              style: { fontSize: 10, fill: COLORS.inkMuted },
            }}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }}
          />
          <Scatter
            name="Exchanges"
            data={data}
            animationDuration={600}
          >
            {data.map((point) => (
              <Cell
                key={point.name}
                fill={point.hasToken ? TOKEN_DOT : NO_TOKEN_DOT}
                fillOpacity={0.8}
                stroke={point.hasToken ? TOKEN_DOT : NO_TOKEN_DOT}
                strokeWidth={0.5}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend + Quadrant guide */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          marginTop: 8,
          fontFamily: AXIS_STYLE.fontFamily,
          fontSize: 12,
          color: COLORS.inkLight,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: TOKEN_DOT,
            }}
          />
          With Token
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: NO_TOKEN_DOT,
            }}
          />
          Without Token
        </span>
        <span style={{ color: COLORS.inkMuted, fontSize: 11 }}>
          Dot size = 24h volume
        </span>
      </div>

      {/* Quadrant labels */}
      <div
        className="grid grid-cols-2 gap-2 mt-4 px-4"
        style={{
          fontFamily: AXIS_STYLE.fontFamily,
          fontSize: 11,
          color: COLORS.inkMuted,
        }}
      >
        <div className="text-left border border-rule rounded px-3 py-2">
          <span style={{ fontWeight: 600, color: COLORS.inkLight }}>
            Low Turnover, High Yield
          </span>
          <br />
          Premium pricing, sticky capital
        </div>
        <div className="text-right border border-rule rounded px-3 py-2">
          <span style={{ fontWeight: 600, color: COLORS.inkLight }}>
            High Turnover, High Yield
          </span>
          <br />
          Most capital-efficient
        </div>
        <div className="text-left border border-rule rounded px-3 py-2">
          <span style={{ fontWeight: 600, color: COLORS.inkLight }}>
            Low Turnover, Low Yield
          </span>
          <br />
          Dormant capital
        </div>
        <div className="text-right border border-rule rounded px-3 py-2">
          <span style={{ fontWeight: 600, color: COLORS.inkLight }}>
            High Turnover, Low Yield
          </span>
          <br />
          Competitive fees, high activity
        </div>
      </div>

      {/* Summary stats row */}
      <div className="border-t border-rule mt-6 pt-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">
              Avg Fee Yield
            </p>
            <span className="font-mono text-xl font-bold text-ink">
              {stats.avgFeeYield.toFixed(4)}%
            </span>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">
              Avg Turnover
            </p>
            <span className="font-mono text-xl font-bold text-ink">
              {stats.avgTurnover.toFixed(2)}x
            </span>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">
              Most Efficient
            </p>
            {stats.mostEfficient && (
              <>
                <span className="font-mono text-xl font-bold text-ink">
                  {stats.mostEfficient.name}
                </span>
                <span className="font-sans text-xs text-ink-muted ml-2">
                  {stats.mostEfficient.feeYield.toFixed(4)}% yield
                </span>
              </>
            )}
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">
              Highest Turnover
            </p>
            {stats.highestTurnover && (
              <>
                <span className="font-mono text-xl font-bold text-ink">
                  {stats.highestTurnover.name}
                </span>
                <span className="font-sans text-xs text-ink-muted ml-2">
                  {stats.highestTurnover.turnover.toFixed(2)}x
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
