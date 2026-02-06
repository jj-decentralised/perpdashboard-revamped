import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHART_PALETTE } from '../../utils/chartTheme'
import { formatUSD } from '../../utils/format'

interface Props {
  exchanges: EnrichedExchange[]
}

interface ChainVolume {
  chain: string
  volume: number
}

function formatAxisVolume(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload || !payload.length || label == null) return null

  return (
    <div
      style={{
        ...TOOLTIP_STYLE.contentStyle,
        lineHeight: 1.5,
      }}
    >
      <p style={TOOLTIP_STYLE.labelStyle}>{label}</p>
      <p style={{ margin: 0, color: COLORS.inkLight }}>
        Volume: {formatUSD(payload[0].value)}
      </p>
    </div>
  )
}

export function VolumeByChainChart({ exchanges }: Props) {
  const chartData = useMemo(() => {
    const volumeByChain: Record<string, number> = {}

    for (const exchange of exchanges) {
      if (exchange.breakdown24h && Object.keys(exchange.breakdown24h).length > 0) {
        for (const [chain, exchangeVolumes] of Object.entries(exchange.breakdown24h)) {
          const chainTotal = Object.values(exchangeVolumes).reduce(
            (sum, v) => sum + (v || 0),
            0
          )
          volumeByChain[chain] = (volumeByChain[chain] || 0) + chainTotal
        }
      } else if (exchange.total24h && exchange.chains && exchange.chains.length > 0) {
        const perChain = exchange.total24h / exchange.chains.length
        for (const chain of exchange.chains) {
          volumeByChain[chain] = (volumeByChain[chain] || 0) + perChain
        }
      }
    }

    const sorted: ChainVolume[] = Object.entries(volumeByChain)
      .map(([chain, volume]) => ({ chain, volume }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20)

    return sorted
  }, [exchanges])

  const chartHeight = Math.max(400, chartData.length * 28)

  return (
    <div className="chart-container">
      <h3 className="chart-title">Volume Distribution by Chain</h3>
      <p className="chart-subtitle">
        24-hour trading volume concentration across blockchain networks
      </p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke={GRID_STYLE.stroke}
            strokeDasharray={GRID_STYLE.strokeDasharray}
          />
          <XAxis
            type="number"
            tickFormatter={formatAxisVolume}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
          />
          <YAxis
            type="category"
            dataKey="chain"
            width={100}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: COLORS.paperAlt }}
          />
          <Bar
            dataKey="volume"
            fill={CHART_PALETTE[0]}
            radius={[0, 2, 2, 0]}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
