import React, { useMemo, useCallback } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { CHART_PALETTE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD } from '../../utils/format'

interface Props {
  exchanges: EnrichedExchange[]
}

interface SliceData {
  name: string
  value: number
  percent: number
}

const RADIAN = Math.PI / 180

function CustomLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  percent: number
}) {
  if (percent < 0.03) return null

  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
      fontFamily='-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    >
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  )
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: SliceData }>
}) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload

  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{data.name}</p>
      <p style={{ margin: 0, color: '#4a4a4a' }}>
        Volume: {formatUSD(data.value, true)}
      </p>
      <p style={{ margin: 0, color: '#4a4a4a' }}>
        Share: {data.percent.toFixed(2)}%
      </p>
    </div>
  )
}

export function VolumeShareChart({ exchanges }: Props) {
  const { slices, totalVolume } = useMemo(() => {
    const valid = exchanges
      .filter((e) => e.total24h != null && e.total24h > 0)
      .sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))

    const total = valid.reduce((sum, e) => sum + (e.total24h ?? 0), 0)

    const top = valid.slice(0, 8)
    const rest = valid.slice(8)
    const otherVolume = rest.reduce((sum, e) => sum + (e.total24h ?? 0), 0)

    const result: SliceData[] = top.map((e) => ({
      name: e.name,
      value: e.total24h ?? 0,
      percent: total > 0 ? ((e.total24h ?? 0) / total) * 100 : 0,
    }))

    if (otherVolume > 0) {
      result.push({
        name: 'Other',
        value: otherVolume,
        percent: total > 0 ? (otherVolume / total) * 100 : 0,
      })
    }

    return { slices: result, totalVolume: total }
  }, [exchanges])

  const renderLegend = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => {
      const { payload } = props as {
        payload?: Array<{ color: string; value: string; payload: SliceData }>
      }
      if (!payload) return null

      return (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            fontSize: 12,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            lineHeight: 1.8,
          }}
        >
          {payload.map((entry, index) => {
            const data = entry.payload
            return (
              <li
                key={`legend-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    backgroundColor: entry.color,
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    color: '#1a1a1a',
                    fontWeight: 500,
                    minWidth: 90,
                  }}
                >
                  {entry.value}
                </span>
                <span style={{ color: '#7a7a7a', minWidth: 70, textAlign: 'right' }}>
                  {formatUSD(data.value, true)}
                </span>
                <span style={{ color: '#7a7a7a', minWidth: 48, textAlign: 'right' }}>
                  {data.percent.toFixed(1)}%
                </span>
              </li>
            )
          })}
        </ul>
      )
    },
    [],
  )

  return (
    <div className="chart-container">
      <h3 className="chart-title">Market Share</h3>
      <p className="chart-subtitle">
        24-hour volume distribution among top exchanges
      </p>
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={slices}
            cx="35%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
            nameKey="name"
            label={CustomLabel}
            labelLine={false}
            animationDuration={800}
            stroke="none"
          >
            {slices.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CHART_PALETTE[index % CHART_PALETTE.length]}
              />
            ))}
          </Pie>

          {/* Center label showing total volume */}
          <text
            x="35%"
            y="47%"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fill="#7a7a7a"
            fontFamily='-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          >
            Total
          </text>
          <text
            x="35%"
            y="55%"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={14}
            fontWeight={600}
            fill="#1a1a1a"
            fontFamily='-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          >
            {formatUSD(totalVolume, true)}
          </text>

          <Tooltip content={<CustomTooltip />} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            content={renderLegend}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
