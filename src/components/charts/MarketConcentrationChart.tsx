import React, { useMemo } from 'react'
import { ResponsiveContainer, Treemap, Tooltip, Cell } from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, TOKEN_COLOR, NO_TOKEN_COLOR, CHART_PALETTE } from '../../utils/chartTheme'
import { formatUSD, formatPercent, formatNumber } from '../../utils/format'

interface Props {
  exchanges: EnrichedExchange[]
}

interface TreemapEntry {
  name: string
  size: number
  share: number
  volume: number
  hasToken: boolean
  tokenSymbol: string | null
  fill: string
}

interface BarSegment {
  name: string
  share: number
  volume: number
  color: string
  hasToken: boolean
}

function CustomTreemapContent(props: any) {
  const { x, y, width, height, name, share, hasToken } = props

  if (!name || width < 30 || height < 20) return null

  const showLabel = width > 50 && height > 30
  const showShare = width > 60 && height > 44

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={hasToken ? TOKEN_COLOR : NO_TOKEN_COLOR}
        stroke={COLORS.paper}
        strokeWidth={2}
        style={{ opacity: hasToken ? 0.85 : 0.6 }}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showShare ? 7 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          fill={hasToken ? COLORS.paper : COLORS.ink}
          fontSize={width > 80 ? 12 : 10}
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight={600}
        >
          {name.length > Math.floor(width / 7) ? name.slice(0, Math.floor(width / 7)) + '...' : name}
        </text>
      )}
      {showShare && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="central"
          fill={hasToken ? 'rgba(255,255,255,0.8)' : COLORS.inkMuted}
          fontSize={10}
          fontFamily="Consolas, 'Courier New', monospace"
        >
          {share.toFixed(1)}%
        </text>
      )}
    </g>
  )
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]?.payload
  if (!data) return null

  return (
    <div
      style={{
        background: COLORS.paper,
        border: `1px solid ${COLORS.rule}`,
        padding: '8px 12px',
        fontSize: 12,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <p style={{ fontWeight: 600, color: COLORS.ink, marginBottom: 4 }}>{data.name}</p>
      <p style={{ color: COLORS.inkLight, margin: 0 }}>
        Volume: {formatUSD(data.volume, true)}
      </p>
      <p style={{ color: COLORS.inkLight, margin: 0 }}>
        Share: {data.share.toFixed(2)}%
      </p>
      <p style={{ color: COLORS.inkMuted, margin: 0, fontSize: 11 }}>
        {data.hasToken ? `Token: ${data.tokenSymbol}` : 'No governance token'}
      </p>
    </div>
  )
}

function HHIGauge({ hhi }: { hhi: number }) {
  const maxHHI = 5000
  const position = Math.min(hhi / maxHHI, 1) * 100

  let interpretation: string
  let color: string
  if (hhi < 1500) {
    interpretation = 'Competitive'
    color = COLORS.green
  } else if (hhi <= 2500) {
    interpretation = 'Moderately Concentrated'
    color = COLORS.amber
  } else {
    interpretation = 'Highly Concentrated'
    color = COLORS.red
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-sans text-xs uppercase tracking-wider text-ink-muted">
          Herfindahl-Hirschman Index
        </span>
      </div>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-3xl font-bold text-ink leading-none">
          {formatNumber(Math.round(hhi))}
        </span>
        <span
          className="font-sans text-sm font-semibold"
          style={{ color }}
        >
          {interpretation}
        </span>
      </div>
      {/* Gauge bar */}
      <div className="relative h-2 w-full mb-1" style={{ background: COLORS.paperAlt }}>
        {/* Gradient zones */}
        <div className="absolute inset-0 flex">
          <div style={{ width: '30%', background: COLORS.green, opacity: 0.25 }} />
          <div style={{ width: '20%', background: COLORS.amber, opacity: 0.25 }} />
          <div style={{ width: '50%', background: COLORS.red, opacity: 0.25 }} />
        </div>
        {/* Marker */}
        <div
          className="absolute top-0 h-full"
          style={{
            left: `${position}%`,
            width: 3,
            background: color,
            transform: 'translateX(-50%)',
          }}
        />
      </div>
      <div className="flex justify-between">
        <span className="font-mono text-[10px] text-ink-muted">0</span>
        <span className="font-mono text-[10px] text-ink-muted">1,500</span>
        <span className="font-mono text-[10px] text-ink-muted">2,500</span>
        <span className="font-mono text-[10px] text-ink-muted">5,000+</span>
      </div>
    </div>
  )
}

export function MarketConcentrationChart({ exchanges }: Props) {
  const analysis = useMemo(() => {
    const valid = exchanges
      .filter((e) => e.total24h != null && e.total24h > 0)
      .sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))

    const totalVolume = valid.reduce((sum, e) => sum + (e.total24h ?? 0), 0)
    if (totalVolume === 0) return null

    // Market shares as percentages
    const shares = valid.map((e) => ((e.total24h ?? 0) / totalVolume) * 100)

    // HHI: sum of squared market shares (using percentage points)
    const hhi = shares.reduce((sum, s) => sum + s * s, 0)

    // Top-5 and Top-10 dominance
    const top5Share = shares.slice(0, 5).reduce((s, v) => s + v, 0)
    const top10Share = shares.slice(0, 10).reduce((s, v) => s + v, 0)

    // Token vs No-Token concentration
    const tokenVolume = valid
      .filter((e) => e.hasToken)
      .reduce((sum, e) => sum + (e.total24h ?? 0), 0)
    const noTokenVolume = totalVolume - tokenVolume
    const tokenCount = valid.filter((e) => e.hasToken).length
    const noTokenCount = valid.length - tokenCount

    // Treemap data: top 20
    const top20: TreemapEntry[] = valid.slice(0, 20).map((e) => ({
      name: e.name,
      size: e.total24h ?? 0,
      share: ((e.total24h ?? 0) / totalVolume) * 100,
      volume: e.total24h ?? 0,
      hasToken: e.hasToken,
      tokenSymbol: e.tokenSymbol,
      fill: e.hasToken ? TOKEN_COLOR : NO_TOKEN_COLOR,
    }))

    // Stacked bar data: top 10 + Other
    const top10Exchanges = valid.slice(0, 10)
    const otherVolume = totalVolume - top10Exchanges.reduce((s, e) => s + (e.total24h ?? 0), 0)

    const barSegments: BarSegment[] = top10Exchanges.map((e, i) => ({
      name: e.name,
      share: ((e.total24h ?? 0) / totalVolume) * 100,
      volume: e.total24h ?? 0,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
      hasToken: e.hasToken,
    }))

    if (otherVolume > 0) {
      barSegments.push({
        name: 'Other',
        share: (otherVolume / totalVolume) * 100,
        volume: otherVolume,
        color: COLORS.rule,
        hasToken: false,
      })
    }

    return {
      totalVolume,
      hhi,
      top5Share,
      top10Share,
      tokenVolume,
      noTokenVolume,
      tokenCount,
      noTokenCount,
      tokenSharePct: (tokenVolume / totalVolume) * 100,
      noTokenSharePct: (noTokenVolume / totalVolume) * 100,
      top20,
      barSegments,
      exchangeCount: valid.length,
    }
  }, [exchanges])

  if (!analysis) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Market Concentration</h3>
        <p className="chart-subtitle">No volume data available</p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Market Concentration</h3>
      <p className="chart-subtitle">
        Volume distribution and competitive dynamics across perpetual exchanges
      </p>

      {/* Stacked percentage bar */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <span className="font-sans text-xs uppercase tracking-wider text-ink-muted">
            Top 10 Volume Share
          </span>
          <span className="font-mono text-xs text-ink-muted">
            {formatUSD(analysis.totalVolume, true)} total 24h
          </span>
        </div>
        <div className="flex w-full h-8 border border-rule overflow-hidden">
          {analysis.barSegments.map((seg) => (
            <div
              key={seg.name}
              className="relative group h-full"
              style={{
                width: `${seg.share}%`,
                backgroundColor: seg.color,
                minWidth: seg.share > 0.5 ? 2 : 0,
              }}
            >
              {/* Hover tooltip via CSS */}
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 whitespace-nowrap"
                style={{
                  background: COLORS.paper,
                  border: `1px solid ${COLORS.rule}`,
                  padding: '4px 8px',
                  fontSize: 11,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              >
                <span style={{ fontWeight: 600 }}>{seg.name}</span>
                <span className="text-ink-muted ml-2">{seg.share.toFixed(1)}%</span>
                <span className="text-ink-muted ml-2">{formatUSD(seg.volume, true)}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {analysis.barSegments.map((seg) => (
            <div key={seg.name} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 flex-shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="font-sans text-[11px] text-ink-light">
                {seg.name}
              </span>
              <span className="font-mono text-[11px] text-ink-muted">
                {seg.share.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Treemap */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <span className="font-sans text-xs uppercase tracking-wider text-ink-muted">
            Top 20 Exchanges by Volume Share
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5"
                style={{ backgroundColor: TOKEN_COLOR, opacity: 0.85 }}
              />
              <span className="font-sans text-[11px] text-ink-muted">Has token</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5"
                style={{ backgroundColor: NO_TOKEN_COLOR, opacity: 0.6 }}
              />
              <span className="font-sans text-[11px] text-ink-muted">No token</span>
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <Treemap
            data={analysis.top20}
            dataKey="size"
            aspectRatio={4 / 3}
            content={<CustomTreemapContent />}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* Stats grid */}
      <div className="border-t border-rule pt-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* HHI */}
          <div>
            <HHIGauge hhi={analysis.hhi} />
          </div>

          {/* Dominance stats */}
          <div>
            <span className="font-sans text-xs uppercase tracking-wider text-ink-muted block mb-3">
              Concentration Ratios
            </span>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-sans text-sm text-ink-light">Top 5 dominance</span>
                  <span className="font-mono text-sm font-semibold text-ink">
                    {analysis.top5Share.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full" style={{ background: COLORS.paperAlt }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${analysis.top5Share}%`,
                      background: COLORS.ink,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-sans text-sm text-ink-light">Top 10 dominance</span>
                  <span className="font-mono text-sm font-semibold text-ink">
                    {analysis.top10Share.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full" style={{ background: COLORS.paperAlt }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${analysis.top10Share}%`,
                      background: COLORS.inkLight,
                    }}
                  />
                </div>
              </div>
              <p className="font-sans text-[11px] text-ink-muted mt-1">
                {analysis.exchangeCount} active exchanges tracked
              </p>
            </div>
          </div>

          {/* Token vs No-token split */}
          <div>
            <span className="font-sans text-xs uppercase tracking-wider text-ink-muted block mb-3">
              Token vs No-Token Split
            </span>
            <div className="flex w-full h-5 mb-2 overflow-hidden">
              <div
                style={{
                  width: `${analysis.tokenSharePct}%`,
                  background: TOKEN_COLOR,
                  opacity: 0.85,
                }}
              />
              <div
                style={{
                  width: `${analysis.noTokenSharePct}%`,
                  background: NO_TOKEN_COLOR,
                  opacity: 0.6,
                }}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2"
                    style={{ backgroundColor: TOKEN_COLOR, opacity: 0.85 }}
                  />
                  <span className="font-sans text-sm text-ink-light">
                    With token ({analysis.tokenCount})
                  </span>
                </span>
                <span className="font-mono text-sm text-ink">
                  {analysis.tokenSharePct.toFixed(1)}%
                  <span className="text-ink-muted text-xs ml-1.5">
                    {formatUSD(analysis.tokenVolume, true)}
                  </span>
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2"
                    style={{ backgroundColor: NO_TOKEN_COLOR, opacity: 0.6 }}
                  />
                  <span className="font-sans text-sm text-ink-light">
                    No token ({analysis.noTokenCount})
                  </span>
                </span>
                <span className="font-mono text-sm text-ink">
                  {analysis.noTokenSharePct.toFixed(1)}%
                  <span className="text-ink-muted text-xs ml-1.5">
                    {formatUSD(analysis.noTokenVolume, true)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
