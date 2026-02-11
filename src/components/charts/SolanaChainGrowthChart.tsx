import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { ChainGrowthData } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD, formatDateShort } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { TimePeriodSelector, filterDataByPeriod } from '../TimePeriodSelector'

interface Props {
  data: ChainGrowthData
}

const CHAIN_COLORS: Record<string, string> = {
  Hyperliquid: '#00D1A7',
  Arbitrum: '#28A0F0',
  Solana: '#9945FF',
  Base: '#0052FF',
  Optimism: '#FF0420',
  BSC: '#F0B90B',
  Ethereum: '#627EEA',
  Blast: '#FCFC03',
  Avalanche: '#E84142',
  Polygon: '#8247E5',
  zkSync: '#4E529A',
  Sui: '#6FBCF0',
  Sei: '#9B1C1C',
  Mantle: '#000',
  Sonic: '#14F195',
  Berachain: '#734A30',
  Starknet: '#EC796B',
  Injective: '#00F2FE',
  Abstract: '#6366F1',
  Mode: '#DFFE00',
}

function getChainColor(chain: string): string {
  return CHAIN_COLORS[chain] || COLORS.ink
}

function formatBillions(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return `$${value.toFixed(0)}`
}

export function SolanaChainGrowthChart({ data }: Props) {
  const { chains } = data
  const [selectedChain, setSelectedChain] = useState(chains[0] || 'Hyperliquid')
  const [period, setPeriod] = useState('1y')

  const chainData = data.data[selectedChain] || []
  const color = getChainColor(selectedChain)

  const chartData = useMemo(() => {
    if (!chainData.length) return []
    const window = Math.min(4, chainData.length)
    const smoothed = []
    for (let i = window - 1; i < chainData.length; i++) {
      let sumPct = 0
      for (let j = i - window + 1; j <= i; j++) sumPct += chainData[j].chainPct
      smoothed.push({ ...chainData[i], chainPct: sumPct / window })
    }
    return filterDataByPeriod(smoothed, period)
  }, [chainData, period])

  const stats = useMemo(() => {
    if (chartData.length < 2) return null
    const latest = chartData[chartData.length - 1]
    const monthAgo = chartData.length > 4 ? chartData[chartData.length - 5] : chartData[0]
    return {
      currentPct: latest.chainPct,
      monthChange: latest.chainPct - monthAgo.chainPct,
      chainVol: latest.chainVol,
      totalDexVol: latest.totalDexVol,
    }
  }, [chartData])

  if (chains.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Chain Volume Share</h3>
        <p className="chart-subtitle">Loading chain breakdown data...</p>
        <div className="loading-pulse h-80" />
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Chain Volume Share</h3>
      <p className="chart-subtitle">
        Per-chain share of on-chain perpetual futures volume across all DEX protocols
      </p>

      <div className="flex items-center justify-between mb-4">
        <MetricInfo
          description="Tracks each chain's share of on-chain perpetual futures volume. Includes all DEX protocols on each chain. A rising share indicates growing adoption of that chain for derivatives trading."
          source="DefiLlama derivatives overview with per-chain breakdown. Only counts DEX (on-chain) protocols."
        />
        <TimePeriodSelector selected={period} onChange={setPeriod} />
      </div>

      {/* Chain selector pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {chains.map((chain) => (
          <button
            key={chain}
            type="button"
            onClick={() => setSelectedChain(chain)}
            className={
              selectedChain === chain
                ? 'px-3 py-1.5 border font-semibold font-sans text-xs'
                : 'px-3 py-1.5 border bg-paper text-ink-muted border-rule hover:border-ink font-sans text-xs cursor-pointer'
            }
            style={
              selectedChain === chain
                ? { backgroundColor: getChainColor(chain), color: ['Blast', 'BSC', 'Mode', 'Sonic'].includes(chain) ? '#000' : '#fff', borderColor: getChainColor(chain) }
                : undefined
            }
          >
            {chain}
          </button>
        ))}
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 pb-4 border-b border-rule">
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">{selectedChain} Share</p>
            <p className="font-mono text-sm font-bold text-ink">{stats.currentPct.toFixed(1)}%</p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">30d Change</p>
            <p className={`font-mono text-sm font-bold ${stats.monthChange >= 0 ? 'positive' : 'negative'}`}>
              {stats.monthChange >= 0 ? '+' : ''}{stats.monthChange.toFixed(1)}pp
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">{selectedChain} Vol (7d avg)</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(stats.chainVol, true)}</p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Total DEX Vol (7d avg)</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(stats.totalDexVol, true)}</p>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 60, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="chainFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
          <XAxis
            dataKey="date"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(v: number) => formatDateShort(v)}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
            minTickGap={60}
          />
          <YAxis
            yAxisId="vol"
            tickFormatter={formatBillions}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={58}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            tick={{ ...AXIS_STYLE, fill: color }}
            tickLine={false}
            axisLine={false}
            width={48}
            domain={[0, (dataMax: number) => Math.min(100, Math.ceil(dataMax * 1.2))]}
          />
          <Tooltip
            content={({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              if (!d) return null
              return (
                <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                  <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
                  <p style={{ margin: 0, color, fontSize: 12 }}>
                    {selectedChain} Vol: {formatUSD(d.chainVol, true)}
                  </p>
                  <p style={{ margin: 0, color: COLORS.ink, fontSize: 12 }}>
                    Total DEX Vol: {formatUSD(d.totalDexVol, true)}
                  </p>
                  <p style={{ margin: 0, color, fontSize: 12, fontWeight: 600 }}>
                    {selectedChain} Share: {d.chainPct.toFixed(1)}%
                  </p>
                </div>
              )
            }}
            cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }}
          />
          <Area
            yAxisId="vol"
            type="monotone"
            dataKey="chainVol"
            stroke={color}
            strokeWidth={1}
            fill="url(#chainFill)"
            animationDuration={800}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="chainPct"
            stroke={color}
            strokeWidth={2}
            dot={false}
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: color, opacity: 0.4 }} />
          <span className="font-sans text-[11px] text-ink-muted">{selectedChain} Volume</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5" style={{ backgroundColor: color }} />
          <span className="font-sans text-[11px] text-ink-muted">{selectedChain} Share %</span>
        </span>
      </div>

      <p className="font-sans text-[10px] text-ink-muted mt-3 italic">
        Based on DefiLlama per-chain breakdown for on-chain derivatives protocols only.
      </p>
    </div>
  )
}
