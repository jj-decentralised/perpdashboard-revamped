import { useMemo, useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD, formatDateShort } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { TimePeriodSelector, filterDataByPeriod } from '../TimePeriodSelector'

const PERP_CHAINS = ['Arbitrum', 'Solana', 'Base', 'Optimism']

interface BridgeDataPoint {
  date: number
  depositUSD: number
  withdrawUSD: number
  netFlow: number
}

interface ChainBridgeData {
  chain: string
  data: BridgeDataPoint[]
  totalDeposits30d: number
  totalWithdrawals30d: number
  netFlow30d: number
}

async function fetchBridgeVolume(chain: string): Promise<BridgeDataPoint[]> {
  try {
    const res = await fetch(`https://bridges.llama.fi/bridgevolume/${chain}`)
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map((d: any) => ({
      date: Number(d.date) * 1000,
      depositUSD: d.depositUSD || 0,
      withdrawUSD: d.withdrawUSD || 0,
      netFlow: (d.depositUSD || 0) - (d.withdrawUSD || 0),
    }))
  } catch {
    return []
  }
}

export function BridgeFlowChart() {
  const [chainData, setChainData] = useState<ChainBridgeData[]>([])
  const [selectedChain, setSelectedChain] = useState('Arbitrum')
  const [period, setPeriod] = useState('90d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const results = await Promise.all(
        PERP_CHAINS.map(async (chain) => {
          const data = await fetchBridgeVolume(chain)
          const recent = data.slice(-30)
          const totalDeposits30d = recent.reduce((s, d) => s + d.depositUSD, 0)
          const totalWithdrawals30d = recent.reduce((s, d) => s + d.withdrawUSD, 0)
          return {
            chain,
            data,
            totalDeposits30d,
            totalWithdrawals30d,
            netFlow30d: totalDeposits30d - totalWithdrawals30d,
          }
        })
      )
      if (!cancelled) {
        setChainData(results.filter((r) => r.data.length > 0))
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const selectedData = useMemo(() => {
    const chain = chainData.find((c) => c.chain === selectedChain)
    if (!chain) return []
    // Sample weekly for smoother chart
    const filtered = filterDataByPeriod(chain.data, period)
    if (filtered.length <= 100) return filtered
    return filtered.filter((_, i) => i % 7 === 0 || i === filtered.length - 1)
  }, [chainData, selectedChain, period])

  const selectedStats = useMemo(() => {
    const chain = chainData.find((c) => c.chain === selectedChain)
    return chain || null
  }, [chainData, selectedChain])

  if (loading) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Bridge Flows to Perp Chains</h3>
        <p className="chart-subtitle">Loading bridge data...</p>
        <div className="loading-pulse h-80" />
      </div>
    )
  }

  if (chainData.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Bridge Flows to Perp Chains</h3>
        <p className="chart-subtitle">Bridge flow data unavailable</p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Bridge Flows to Perp Chains</h3>
      <p className="chart-subtitle">
        Capital inflows and outflows via bridges — a leading indicator for trading activity
      </p>
      <MetricInfo
        description="Bridge flows show capital entering and leaving blockchain ecosystems. Rising net inflows (deposits > withdrawals) to perp-heavy chains like Arbitrum typically lead volume spikes by 3-7 days. Sustained outflows signal capital flight and potential volume decline."
        source="Bridge data providing daily deposit and withdrawal volumes per chain across all tracked bridges."
      />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          {chainData.map((c) => (
            <button
              key={c.chain}
              onClick={() => setSelectedChain(c.chain)}
              className={
                selectedChain === c.chain
                  ? 'px-3 py-1.5 border bg-ink text-paper border-ink font-semibold font-sans text-xs'
                  : 'px-3 py-1.5 border bg-paper text-ink-muted border-rule hover:border-ink font-sans text-xs cursor-pointer'
              }
              type="button"
            >
              {c.chain}
            </button>
          ))}
        </div>
        <TimePeriodSelector selected={period} onChange={setPeriod} />
      </div>

      {selectedStats && (
        <div className="grid grid-cols-3 gap-4 mb-5 pb-4 border-b border-rule">
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">30d Deposits</p>
            <p className="font-mono text-sm font-bold" style={{ color: COLORS.green }}>
              {formatUSD(selectedStats.totalDeposits30d, true)}
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">30d Withdrawals</p>
            <p className="font-mono text-sm font-bold" style={{ color: COLORS.red }}>
              {formatUSD(selectedStats.totalWithdrawals30d, true)}
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">30d Net Flow</p>
            <p
              className="font-mono text-sm font-bold"
              style={{ color: selectedStats.netFlow30d >= 0 ? COLORS.green : COLORS.red }}
            >
              {selectedStats.netFlow30d >= 0 ? '+' : ''}{formatUSD(selectedStats.netFlow30d, true)}
            </p>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={selectedData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
            tickFormatter={(v: number) => {
              if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
              if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
              return `$${(v / 1e3).toFixed(0)}K`
            }}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={58}
          />
          <Tooltip
            content={({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              if (!d) return null
              return (
                <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                  <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
                  <p style={{ margin: 0, color: COLORS.green, fontSize: 12 }}>
                    Deposits: {formatUSD(d.depositUSD, true)}
                  </p>
                  <p style={{ margin: 0, color: COLORS.red, fontSize: 12 }}>
                    Withdrawals: {formatUSD(d.withdrawUSD, true)}
                  </p>
                  <p style={{ margin: 0, color: d.netFlow >= 0 ? COLORS.green : COLORS.red, fontSize: 12, fontWeight: 600 }}>
                    Net: {d.netFlow >= 0 ? '+' : ''}{formatUSD(d.netFlow, true)}
                  </p>
                </div>
              )
            }}
            cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }}
          />
          <Bar dataKey="depositUSD" fill={COLORS.green} opacity={0.3} animationDuration={800} />
          <Bar dataKey="withdrawUSD" fill={COLORS.red} opacity={0.3} animationDuration={800} />
          <Line
            type="monotone"
            dataKey="netFlow"
            stroke={COLORS.blue}
            strokeWidth={1.5}
            dot={false}
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: COLORS.green, opacity: 0.3 }} />
          <span className="font-sans text-[11px] text-ink-muted">Deposits</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: COLORS.red, opacity: 0.3 }} />
          <span className="font-sans text-[11px] text-ink-muted">Withdrawals</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.blue }} />
          <span className="font-sans text-[11px] text-ink-muted">Net Flow</span>
        </span>
      </div>
    </div>
  )
}
