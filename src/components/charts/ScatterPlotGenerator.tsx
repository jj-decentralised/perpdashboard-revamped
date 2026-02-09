import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ZAxis,
  Cell,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { formatUSD, formatPercent, formatMultiple, formatNumber, classNames } from '../../utils/format'
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, COLORS } from '../../utils/chartTheme'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

interface MetricDef {
  key: string
  label: string
  getValue: (e: EnrichedExchange) => number | null
  format: (v: number) => string
  logScale?: boolean
}

function getDailyFees(e: EnrichedExchange): number | null {
  return e.feeData?.total24h ?? null
}

function getTakeRate(e: EnrichedExchange): number | null {
  const fees = getDailyFees(e)
  const vol = e.total24h
  if (fees == null || !vol || vol <= 0 || fees <= 0) return null
  return (fees / vol) * 10_000
}

const METRICS: MetricDef[] = [
  { key: 'total24h', label: '24h Volume', getValue: (e) => e.total24h, format: (v) => formatUSD(v, true), logScale: true },
  { key: 'total7d', label: '7d Volume', getValue: (e) => e.total7d, format: (v) => formatUSD(v, true), logScale: true },
  { key: 'openInterest', label: 'Open Interest', getValue: (e) => e.openInterest > 0 ? e.openInterest : null, format: (v) => formatUSD(v, true), logScale: true },
  { key: 'mcap', label: 'Market Cap', getValue: (e) => e.mcap && e.mcap > 0 ? e.mcap : null, format: (v) => formatUSD(v, true), logScale: true },
  { key: 'tvl', label: 'TVL', getValue: (e) => e.tvl > 0 ? e.tvl : null, format: (v) => formatUSD(v, true), logScale: true },
  { key: 'dailyFees', label: 'Daily Fees', getValue: getDailyFees, format: (v) => formatUSD(v, true), logScale: true },
  { key: 'psRatio', label: 'P/S Ratio', getValue: (e) => e.psRatio, format: (v) => formatMultiple(v) },
  { key: 'peRatio', label: 'P/E Ratio', getValue: (e) => e.peRatio, format: (v) => formatMultiple(v) },
  { key: 'takeRate', label: 'Take Rate (bps)', getValue: getTakeRate, format: (v) => `${v.toFixed(1)} bps` },
  { key: 'volumeToTvl', label: 'Volume/TVL', getValue: (e) => e.volumeToTvl != null && isFinite(e.volumeToTvl) ? e.volumeToTvl : null, format: (v) => `${v.toFixed(1)}x` },
  { key: 'change_1d', label: '1d Change %', getValue: (e) => e.change_1d, format: (v) => formatPercent(v) ?? `${v.toFixed(1)}%` },
  { key: 'change_7d', label: '7d Change %', getValue: (e) => e.change_7d, format: (v) => formatPercent(v) ?? `${v.toFixed(1)}%` },
  { key: 'change_1m', label: '1m Change %', getValue: (e) => e.change_1m, format: (v) => formatPercent(v) ?? `${v.toFixed(1)}%` },
]

const PRESETS = [
  { label: 'Mcap vs Volume', x: 'total24h', y: 'mcap' },
  { label: 'P/S vs Volume', x: 'total24h', y: 'psRatio' },
  { label: 'Fees vs OI', x: 'openInterest', y: 'dailyFees' },
  { label: 'Take Rate vs Volume', x: 'total24h', y: 'takeRate' },
  { label: 'TVL vs Volume', x: 'total24h', y: 'tvl' },
]

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  return (
    <div style={TOOLTIP_STYLE.contentStyle as React.CSSProperties}>
      <p className="font-sans text-sm font-bold text-ink mb-1">{d.name}</p>
      <p className="font-mono text-xs text-ink-light">{d.xLabel}: {d.xFormatted}</p>
      <p className="font-mono text-xs text-ink-light">{d.yLabel}: {d.yFormatted}</p>
    </div>
  )
}

export function ScatterPlotGenerator({ exchanges }: Props) {
  const [xKey, setXKey] = useState('total24h')
  const [yKey, setYKey] = useState('mcap')

  const xMetric = METRICS.find(m => m.key === xKey)!
  const yMetric = METRICS.find(m => m.key === yKey)!

  const data = useMemo(() => {
    return exchanges
      .map(e => {
        const xVal = xMetric.getValue(e)
        const yVal = yMetric.getValue(e)
        if (xVal == null || yVal == null || !isFinite(xVal) || !isFinite(yVal)) return null
        return {
          x: xVal,
          y: yVal,
          name: e.displayName || e.name,
          xLabel: xMetric.label,
          yLabel: yMetric.label,
          xFormatted: xMetric.format(xVal),
          yFormatted: yMetric.format(yVal),
          hasToken: e.hasToken,
          volume: e.total24h ?? 0,
        }
      })
      .filter(Boolean) as any[]
  }, [exchanges, xMetric, yMetric])

  const handlePreset = (x: string, y: string) => {
    setXKey(x)
    setYKey(y)
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Scatter Plot Explorer</h3>
      <p className="chart-subtitle">
        Pick any two metrics to compare {data.length} exchanges
      </p>
      <MetricInfo
        description="Compare any two metrics across all exchanges. Each dot is an exchange. Use presets for common comparisons or pick your own axes. Log scale is used for dollar-denominated metrics."
        source="DefiLlama + CoinGecko"
      />

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.x, p.y)}
            className={classNames(
              'px-3 py-1 font-sans text-xs border transition-colors cursor-pointer',
              xKey === p.x && yKey === p.y
                ? 'bg-ink text-paper border-ink font-semibold'
                : 'bg-paper text-ink-muted border-rule hover:border-ink hover:text-ink'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Axis pickers */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="font-sans text-[11px] uppercase tracking-wider text-ink-muted mb-1 block">X-Axis</label>
          <select
            value={xKey}
            onChange={(e) => setXKey(e.target.value)}
            className="w-full px-3 py-2 border border-rule bg-paper font-sans text-sm text-ink focus:outline-none focus:border-ink"
          >
            {METRICS.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-sans text-[11px] uppercase tracking-wider text-ink-muted mb-1 block">Y-Axis</label>
          <select
            value={yKey}
            onChange={(e) => setYKey(e.target.value)}
            className="w-full px-3 py-2 border border-rule bg-paper font-sans text-sm text-ink focus:outline-none focus:border-ink"
          >
            {METRICS.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart */}
      {data.length > 0 ? (
        <div className="mt-2" style={{ height: 420 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis
                type="number"
                dataKey="x"
                name={xMetric.label}
                scale={xMetric.logScale ? 'log' : 'auto'}
                domain={xMetric.logScale ? ['auto', 'auto'] : undefined}
                tickFormatter={(v) => xMetric.format(v)}
                {...AXIS_STYLE}
                label={{ value: xMetric.label, position: 'bottom', offset: 20, style: { fontSize: 11, fill: '#7a7a7a' } }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={yMetric.label}
                scale={yMetric.logScale ? 'log' : 'auto'}
                domain={yMetric.logScale ? ['auto', 'auto'] : undefined}
                tickFormatter={(v) => yMetric.format(v)}
                {...AXIS_STYLE}
                width={80}
                label={{ value: yMetric.label, angle: -90, position: 'insideLeft', offset: -5, style: { fontSize: 11, fill: '#7a7a7a' } }}
              />
              <ZAxis range={[40, 400]} dataKey="volume" />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={data}>
                {data.map((d: any, i: number) => (
                  <Cell
                    key={i}
                    fill={d.hasToken ? COLORS.blue : COLORS.slate}
                    fillOpacity={0.7}
                    stroke={d.hasToken ? COLORS.blue : COLORS.slate}
                    strokeWidth={1}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="font-sans text-sm text-ink-muted">
            No exchanges have data for both {xMetric.label} and {yMetric.label}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-rule">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.blue, opacity: 0.7 }} />
          <span className="font-sans text-[11px] text-ink-muted">With token ({data.filter((d: any) => d.hasToken).length})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.slate, opacity: 0.7 }} />
          <span className="font-sans text-[11px] text-ink-muted">No token ({data.filter((d: any) => !d.hasToken).length})</span>
        </span>
        <span className="font-sans text-[11px] text-ink-muted ml-auto">
          Dot size = 24h volume • {data.length} exchanges plotted
        </span>
      </div>
    </div>
  )
}
