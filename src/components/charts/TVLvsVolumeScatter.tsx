import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, TOKEN_COLOR, NO_TOKEN_COLOR, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD } from '../../utils/format'

interface Props {
  exchanges: EnrichedExchange[]
}

interface ScatterPoint {
  name: string
  tvl: number
  volume: number
  hasToken: boolean
  tokenSymbol: string | null
  chainCount: number
}

function formatAxisTick(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(0)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toFixed(0)}`
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
      <p style={{ ...TOOLTIP_STYLE.labelStyle, margin: 0 }}>{point.name}</p>
      <p style={{ margin: 0, color: COLORS.inkLight }}>
        TVL: {formatUSD(point.tvl, true)}
      </p>
      <p style={{ margin: 0, color: COLORS.inkLight }}>
        24h Volume: {formatUSD(point.volume, true)}
      </p>
      {point.tokenSymbol && (
        <p style={{ margin: 0, color: COLORS.inkLight }}>
          Token: {point.tokenSymbol}
        </p>
      )}
      <p style={{ margin: 0, color: COLORS.inkMuted }}>
        Chains: {point.chainCount}
      </p>
    </div>
  )
}

export function TVLvsVolumeScatter({ exchanges }: Props) {
  const { withToken, withoutToken } = useMemo(() => {
    const valid = exchanges
      .filter((e) => (e.total24h ?? 0) > 0 && e.tvl > 0)
      .sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
      .slice(0, 100)

    const toPoint = (e: EnrichedExchange): ScatterPoint => ({
      name: e.name,
      tvl: e.tvl,
      volume: e.total24h ?? 0,
      hasToken: e.hasToken,
      tokenSymbol: e.tokenSymbol,
      chainCount: e.chainCount,
    })

    return {
      withToken: valid.filter((e) => e.hasToken).map(toPoint),
      withoutToken: valid.filter((e) => !e.hasToken).map(toPoint),
    }
  }, [exchanges])

  const chainRange: [number, number] = useMemo(() => {
    const all = [...withToken, ...withoutToken]
    if (all.length === 0) return [1, 10]
    const counts = all.map((p) => p.chainCount)
    return [Math.min(...counts), Math.max(...counts)]
  }, [withToken, withoutToken])

  return (
    <div className="chart-container">
      <h3 className="chart-title">Capital Efficiency: TVL vs Volume</h3>
      <p className="chart-subtitle">
        Relationship between locked capital and trading activity — size indicates multi-chain presence
      </p>

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 12, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid
            stroke={GRID_STYLE.stroke}
            strokeDasharray={GRID_STYLE.strokeDasharray}
          />
          <XAxis
            dataKey="tvl"
            type="number"
            name="TVL"
            scale="log"
            domain={['auto', 'auto']}
            tickFormatter={formatAxisTick}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
            label={{
              value: 'Total Value Locked (USD)',
              position: 'insideBottom',
              offset: -16,
              style: { ...AXIS_STYLE, fill: COLORS.inkMuted },
            }}
          />
          <YAxis
            dataKey="volume"
            type="number"
            name="24h Volume"
            scale="log"
            domain={['auto', 'auto']}
            tickFormatter={formatAxisTick}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={58}
            label={{
              value: '24h Trading Volume (USD)',
              angle: -90,
              position: 'insideLeft',
              offset: 4,
              style: { ...AXIS_STYLE, fill: COLORS.inkMuted },
            }}
          />
          <ZAxis
            dataKey="chainCount"
            type="number"
            range={[40, 400]}
            domain={chainRange}
            name="Chains"
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }}
          />
          <Scatter
            name="With Token"
            data={withToken}
            fill={TOKEN_COLOR}
            fillOpacity={0.85}
            strokeWidth={0}
            shape="circle"
            animationDuration={600}
          />
          <Scatter
            name="Without Token"
            data={withoutToken}
            fill="transparent"
            stroke={NO_TOKEN_COLOR}
            strokeWidth={1.5}
            shape="circle"
            animationDuration={600}
          />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Manual legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
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
              backgroundColor: TOKEN_COLOR,
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
              backgroundColor: 'transparent',
              border: `1.5px solid ${NO_TOKEN_COLOR}`,
            }}
          />
          Without Token
        </span>
      </div>
    </div>
  )
}
