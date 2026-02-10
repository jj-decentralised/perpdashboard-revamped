import { useMemo, useState, useCallback } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHART_PALETTE } from '../../utils/chartTheme'
import { formatUSD } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

interface ExchangeContribution {
  name: string
  displayName: string
  volume: number
}

interface ChainVolume {
  chain: string
  volume: number
  share: number
  exchangeCount: number
  exchangeContributions: ExchangeContribution[]
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
  payload?: Array<{ payload: ChainVolume; value: number }>
  label?: string
}) {
  if (!active || !payload || !payload.length || label == null) return null

  const data = payload[0].payload

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
      <p style={{ margin: 0, color: COLORS.inkLight }}>
        Share: {data.share.toFixed(1)}%
      </p>
      <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 11 }}>
        {data.exchangeCount} exchange{data.exchangeCount !== 1 ? 's' : ''} on this chain
      </p>
      <p style={{ margin: '4px 0 0', color: COLORS.inkMuted, fontSize: 10, fontStyle: 'italic' }}>
        Click bar to see exchange breakdown
      </p>
    </div>
  )
}

interface CustomLabelProps {
  x?: number
  y?: number
  width?: number
  height?: number
  value?: number
  index?: number
  chartData: ChainVolume[]
}

function BarLabel({ x, y, width, height, index, chartData }: CustomLabelProps) {
  if (x == null || y == null || width == null || height == null || index == null) return null

  const data = chartData[index]
  if (!data) return null

  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      dominantBaseline="central"
      style={{
        fontSize: 10,
        fontFamily: AXIS_STYLE.fontFamily,
        fill: COLORS.inkMuted,
      }}
    >
      {data.share.toFixed(1)}% · {data.exchangeCount} exch
    </text>
  )
}

export function VolumeByChainChart({ exchanges }: Props) {
  const [selectedChain, setSelectedChain] = useState<string | null>(null)

  const chartData = useMemo(() => {
    const volumeByChain: Record<string, number> = {}
    const exchangesByChain: Record<string, Map<string, ExchangeContribution>> = {}

    for (const exchange of exchanges) {
      if (exchange.breakdown24h && Object.keys(exchange.breakdown24h).length > 0) {
        for (const [chain, exchangeVolumes] of Object.entries(exchange.breakdown24h)) {
          const chainTotal = Object.values(exchangeVolumes).reduce(
            (sum, v) => sum + (v || 0),
            0
          )
          volumeByChain[chain] = (volumeByChain[chain] || 0) + chainTotal

          if (!exchangesByChain[chain]) {
            exchangesByChain[chain] = new Map()
          }
          const existing = exchangesByChain[chain].get(exchange.name)
          if (existing) {
            existing.volume += chainTotal
          } else {
            exchangesByChain[chain].set(exchange.name, {
              name: exchange.name,
              displayName: exchange.displayName,
              volume: chainTotal,
            })
          }
        }
      } else if (exchange.total24h && exchange.chains && exchange.chains.length > 0) {
        const perChain = exchange.total24h / exchange.chains.length
        for (const chain of exchange.chains) {
          volumeByChain[chain] = (volumeByChain[chain] || 0) + perChain

          if (!exchangesByChain[chain]) {
            exchangesByChain[chain] = new Map()
          }
          const existing = exchangesByChain[chain].get(exchange.name)
          if (existing) {
            existing.volume += perChain
          } else {
            exchangesByChain[chain].set(exchange.name, {
              name: exchange.name,
              displayName: exchange.displayName,
              volume: perChain,
            })
          }
        }
      }
    }

    const totalVolume = Object.values(volumeByChain).reduce((sum, v) => sum + v, 0)

    const sorted: ChainVolume[] = Object.entries(volumeByChain)
      .map(([chain, volume]) => {
        const contributions = exchangesByChain[chain]
          ? Array.from(exchangesByChain[chain].values()).sort((a, b) => b.volume - a.volume)
          : []
        return {
          chain,
          volume,
          share: totalVolume > 0 ? (volume / totalVolume) * 100 : 0,
          exchangeCount: contributions.length,
          exchangeContributions: contributions,
        }
      })
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20)

    return sorted
  }, [exchanges])

  const selectedChainData = useMemo(() => {
    if (!selectedChain) return null
    return chartData.find((d) => d.chain === selectedChain) ?? null
  }, [chartData, selectedChain])

  const handleBarClick = useCallback(
    (data: ChainVolume) => {
      setSelectedChain((prev) => (prev === data.chain ? null : data.chain))
    },
    []
  )

  const chartHeight = Math.max(400, chartData.length * 28)

  return (
    <div className="chart-container">
      <h3 className="chart-title">Volume Distribution by Chain</h3>
      <p className="chart-subtitle">
        24-hour trading volume concentration across blockchain networks
      </p>
      <MetricInfo
        description="Chain-level volume distribution shows where perpetual trading activity is concentrated. This helps identify which L1/L2 ecosystems are capturing the most derivatives activity and reveals infrastructure preferences. Stablecoin collateral composition on each chain further affects capital efficiency and risk profiles."
        source="Perps volume data broken down by chain. Chain-level stablecoin data also available for context."
      />
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 100, bottom: 0, left: 0 }}
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
            onClick={(_data: Record<string, unknown>, index: number) => {
              const item = chartData[index]
              if (item) handleBarClick(item)
            }}
            style={{ cursor: 'pointer' }}
            label={<BarLabel chartData={chartData} />}
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.chain}
                fill={
                  selectedChain === entry.chain
                    ? CHART_PALETTE[3]
                    : CHART_PALETTE[0]
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {selectedChainData && (
        <div
          style={{
            marginTop: 16,
            border: `1px solid ${COLORS.rule}`,
            background: COLORS.paperWarm,
            padding: '16px 20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div>
              <span
                style={{
                  fontFamily: AXIS_STYLE.fontFamily,
                  fontSize: 14,
                  fontWeight: 600,
                  color: COLORS.ink,
                }}
              >
                {selectedChainData.chain}
              </span>
              <span
                style={{
                  fontFamily: AXIS_STYLE.fontFamily,
                  fontSize: 12,
                  color: COLORS.inkMuted,
                  marginLeft: 8,
                }}
              >
                {formatUSD(selectedChainData.volume)} &middot;{' '}
                {selectedChainData.share.toFixed(1)}% of total &middot;{' '}
                {selectedChainData.exchangeCount} exchange
                {selectedChainData.exchangeCount !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => setSelectedChain(null)}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: AXIS_STYLE.fontFamily,
                fontSize: 11,
                color: COLORS.inkMuted,
                padding: '2px 6px',
              }}
            >
              Close
            </button>
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: AXIS_STYLE.fontFamily,
              fontSize: 12,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${COLORS.rule}`,
                }}
              >
                <th
                  style={{
                    textAlign: 'left',
                    padding: '4px 8px 4px 0',
                    fontWeight: 600,
                    color: COLORS.inkLight,
                    fontSize: 11,
                  }}
                >
                  Exchange
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '4px 0 4px 8px',
                    fontWeight: 600,
                    color: COLORS.inkLight,
                    fontSize: 11,
                  }}
                >
                  Volume (24h)
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '4px 0 4px 8px',
                    fontWeight: 600,
                    color: COLORS.inkLight,
                    fontSize: 11,
                    width: 80,
                  }}
                >
                  Chain Share
                </th>
              </tr>
            </thead>
            <tbody>
              {selectedChainData.exchangeContributions.map((contrib) => {
                const chainShare =
                  selectedChainData.volume > 0
                    ? (contrib.volume / selectedChainData.volume) * 100
                    : 0
                return (
                  <tr
                    key={contrib.name}
                    style={{
                      borderBottom: `1px solid ${COLORS.paperAlt}`,
                    }}
                  >
                    <td
                      style={{
                        padding: '6px 8px 6px 0',
                        color: COLORS.ink,
                      }}
                    >
                      {contrib.displayName}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '6px 0 6px 8px',
                        color: COLORS.inkLight,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatUSD(contrib.volume)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '6px 0 6px 8px',
                        color: COLORS.inkMuted,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {chainShare.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
