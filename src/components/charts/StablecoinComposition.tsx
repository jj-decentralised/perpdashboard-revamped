import { useState, useEffect, useMemo } from 'react'
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
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHART_PALETTE } from '../../utils/chartTheme'
import { formatUSD } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

const PERP_CHAINS = [
  'Ethereum',
  'Arbitrum',
  'Solana',
  'Base',
  'Optimism',
  'Polygon',
  'BSC',
  'Avalanche',
]

interface ChainStablecoinEntry {
  gecko_id: string | null
  totalCirculatingUSD: {
    peggedUSD: number
  }
  tokenSymbol: string | null
  name: string
}

interface ChartDataPoint {
  chain: string
  tvl: number
}

export function StablecoinComposition() {
  const [rawData, setRawData] = useState<ChainStablecoinEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('https://stablecoins.llama.fi/stablecoinchains')
        if (!res.ok) throw new Error('Failed to fetch')
        const data: ChainStablecoinEntry[] = await res.json()
        if (!cancelled) {
          setRawData(data)
        }
      } catch {
        // leave rawData empty
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (rawData.length === 0) return []
    const matched = PERP_CHAINS.map((chain) => {
      const entry = rawData.find(
        (d) => d.name.toLowerCase() === chain.toLowerCase()
      )
      return {
        chain,
        tvl: entry?.totalCirculatingUSD?.peggedUSD ?? 0,
      }
    })
    return matched.filter((d) => d.tvl > 0).sort((a, b) => b.tvl - a.tvl)
  }, [rawData])

  const totalSupply = useMemo(() => {
    return chartData.reduce((sum, d) => sum + d.tvl, 0)
  }, [chartData])

  const topChainShare = useMemo(() => {
    if (chartData.length === 0 || totalSupply === 0) return 0
    return (chartData[0].tvl / totalSupply) * 100
  }, [chartData, totalSupply])

  const topTwoShare = useMemo(() => {
    if (chartData.length < 2 || totalSupply === 0) return 0
    return ((chartData[0].tvl + chartData[1].tvl) / totalSupply) * 100
  }, [chartData, totalSupply])

  if (loading) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Stablecoin Liquidity by Chain</h3>
        <p className="chart-subtitle">Loading stablecoin data...</p>
        <div className="loading-pulse h-80" />
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Stablecoin Liquidity by Chain</h3>
        <p className="chart-subtitle">Stablecoin data unavailable</p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Stablecoin Liquidity by Chain</h3>
      <p className="chart-subtitle">
        Total stablecoin supply on major perp trading chains — deeper liquidity
        means tighter spreads and lower slippage
      </p>
      <MetricInfo
        description="Stablecoin supply on a chain is a proxy for available collateral and settlement liquidity. Chains with deeper stablecoin pools attract more perp trading activity because traders can enter and exit large positions with less slippage. A shift in stablecoin distribution across chains often foreshadows where perp volume will migrate next."
        source="Stablecoin data aggregating circulating supply of all tracked stablecoins per chain."
      />

      <div className="grid grid-cols-3 gap-4 mb-5 pb-4 border-b border-rule">
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">
            Total Supply (Perp Chains)
          </p>
          <p className="font-mono text-sm font-bold" style={{ color: COLORS.ink }}>
            {formatUSD(totalSupply, true)}
          </p>
        </div>
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">
            {chartData[0]?.chain ?? '—'} Dominance
          </p>
          <p className="font-mono text-sm font-bold" style={{ color: COLORS.blue }}>
            {topChainShare.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">
            Top 2 Concentration
          </p>
          <p className="font-mono text-sm font-bold" style={{ color: COLORS.slate }}>
            {topTwoShare.toFixed(1)}%
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke={GRID_STYLE.stroke}
            strokeDasharray={GRID_STYLE.strokeDasharray}
          />
          <XAxis
            type="number"
            tickFormatter={(v: number) => {
              if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
              if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`
              if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
              return `$${(v / 1e3).toFixed(0)}K`
            }}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
          />
          <YAxis
            type="category"
            dataKey="chain"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={76}
          />
          <Tooltip
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              if (!d) return null
              const share = totalSupply > 0 ? (d.tvl / totalSupply) * 100 : 0
              return (
                <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                  <p style={TOOLTIP_STYLE.labelStyle}>{d.chain}</p>
                  <p style={{ margin: 0, fontSize: 12, color: COLORS.ink }}>
                    Supply: {formatUSD(d.tvl, true)}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: COLORS.inkMuted }}>
                    Share: {share.toFixed(1)}%
                  </p>
                </div>
              )
            }}
            cursor={{ fill: COLORS.paperAlt }}
          />
          <Bar dataKey="tvl" animationDuration={800} radius={[0, 2, 2, 0]}>
            {chartData.map((_entry, index) => (
              <Cell
                key={_entry.chain}
                fill={CHART_PALETTE[index % CHART_PALETTE.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        {chartData.map((d, i) => (
          <span key={d.chain} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5"
              style={{
                backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length],
              }}
            />
            <span className="font-sans text-[11px] text-ink-muted">
              {d.chain}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
