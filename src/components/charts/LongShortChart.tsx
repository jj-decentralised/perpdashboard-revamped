import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import type { LongShortPoint } from '../../services/coinglass'
import { fetchLongShortHistory } from '../../services/coinglass'
import { COINGLASS_ENABLED } from '../../config/api'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatDateShort } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { TimePeriodSelector, filterDataByPeriod } from '../TimePeriodSelector'

// Top futures assets by market cap / trading activity
const ASSETS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'AVAX', 'LINK',
  'DOT', 'SUI', 'UNI', 'NEAR', 'APT', 'OP', 'ARB', 'FIL', 'ATOM',
  'TIA', 'SEI', 'INJ', 'FET', 'RENDER', 'WIF', 'PEPE', 'JUP',
  'AAVE', 'MKR', 'LDO', 'TRX',
] as const

// All major exchanges that provide long/short data on CoinGlass
const EXCHANGES = [
  'Binance', 'OKX', 'Bybit', 'Bitget', 'dYdX', 'HTX', 'Gate',
  'CoinEx', 'Kraken', 'BingX', 'Phemex', 'MEXC',
] as const

const AVG_KEY = 'Average'

type CacheKey = string // `${asset}:${exchange}`
const dataCache = new Map<CacheKey, LongShortPoint[]>()

function cacheKey(asset: string, exchange: string): CacheKey {
  return `${asset}:${exchange}`
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
      <p style={{ ...TOOLTIP_STYLE.labelStyle, margin: 0 }}>{formatDateShort(label)}</p>
      <p style={{ margin: 0, color: COLORS.green, fontSize: 12 }}>
        Long: {d.longPct.toFixed(1)}%
      </p>
      <p style={{ margin: 0, color: COLORS.red, fontSize: 12 }}>
        Short: {d.shortPct.toFixed(1)}%
      </p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
        L/S Ratio: {d.ratio.toFixed(2)}
      </p>
    </div>
  )
}

/** Average long/short data across multiple exchange datasets. */
function computeAverage(datasets: LongShortPoint[][]): LongShortPoint[] {
  if (datasets.length === 0) return []
  if (datasets.length === 1) return datasets[0]

  const byDate = new Map<number, { longSum: number; shortSum: number; ratioSum: number; count: number }>()
  for (const points of datasets) {
    for (const pt of points) {
      const existing = byDate.get(pt.date)
      if (existing) {
        existing.longSum += pt.longPct
        existing.shortSum += pt.shortPct
        existing.ratioSum += pt.ratio
        existing.count += 1
      } else {
        byDate.set(pt.date, { longSum: pt.longPct, shortSum: pt.shortPct, ratioSum: pt.ratio, count: 1 })
      }
    }
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a - b)
    .map(([date, v]) => ({
      date,
      longPct: v.longSum / v.count,
      shortPct: v.shortSum / v.count,
      ratio: v.ratioSum / v.count,
    }))
}

export function LongShortChart() {
  const [asset, setAsset] = useState('BTC')
  const [exchange, setExchange] = useState(AVG_KEY)
  const [period, setPeriod] = useState('6m')

  // Per-exchange data for the current asset
  const [exchangeData, setExchangeData] = useState<Record<string, LongShortPoint[]>>({})
  const [loading, setLoading] = useState(true)
  const [availableExchanges, setAvailableExchanges] = useState<string[]>([])

  const fetchForAsset = useCallback(async (sym: string) => {
    if (!COINGLASS_ENABLED) return

    setLoading(true)
    const symbol = `${sym}USDT`
    const results: Record<string, LongShortPoint[]> = {}

    // Check cache first, fetch missing
    const toFetch: string[] = []
    for (const ex of EXCHANGES) {
      const cached = dataCache.get(cacheKey(sym, ex))
      if (cached) {
        results[ex] = cached
      } else {
        toFetch.push(ex)
      }
    }

    if (toFetch.length > 0) {
      // Fetch in batches of 4 to avoid rate limiting
      for (let i = 0; i < toFetch.length; i += 4) {
        const batch = toFetch.slice(i, i + 4)
        const batchResults = await Promise.all(
          batch.map(async (ex) => {
            const data = await fetchLongShortHistory(ex, symbol, '24h', 365).catch(() => null)
            return [ex, data] as const
          }),
        )
        for (const [ex, data] of batchResults) {
          if (data?.length) {
            results[ex] = data
            dataCache.set(cacheKey(sym, ex), data)
          }
        }
      }
    }

    setExchangeData(results)
    setAvailableExchanges(Object.keys(results))
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchForAsset(asset)
  }, [asset, fetchForAsset])

  // If selected exchange has no data for new asset, fall back to Average
  useEffect(() => {
    if (exchange !== AVG_KEY && !exchangeData[exchange]) {
      setExchange(AVG_KEY)
    }
  }, [exchangeData, exchange])

  const averageData = useMemo(() => computeAverage(Object.values(exchangeData)), [exchangeData])

  const rawData = useMemo(() => {
    if (exchange === AVG_KEY) return averageData
    return exchangeData[exchange] || averageData
  }, [exchange, exchangeData, averageData])

  const chartData = useMemo(() => {
    if (!rawData.length) return []
    return filterDataByPeriod(rawData, period)
  }, [rawData, period])

  const stats = useMemo(() => {
    if (!chartData.length) return null
    const latest = chartData[chartData.length - 1]
    const avg = chartData.reduce((s, d) => s + d.longPct, 0) / chartData.length
    const maxLong = Math.max(...chartData.map((d) => d.longPct))
    const minLong = Math.min(...chartData.map((d) => d.longPct))
    return { latestLong: latest.longPct, latestRatio: latest.ratio, avg, maxLong, minLong }
  }, [chartData])

  if (!COINGLASS_ENABLED) return null

  const subtitle = exchange === AVG_KEY
    ? `${asset} futures — averaged across ${availableExchanges.length} exchanges`
    : `${exchange} ${asset} futures — percentage of accounts positioned long vs short`

  return (
    <div className="chart-container">
      <h3 className="chart-title">Long/Short Account Ratio</h3>
      <p className="chart-subtitle">{subtitle}</p>

      <div className="flex flex-col gap-2 mb-3">
        {/* Row 1: MetricInfo + time period */}
        <div className="flex items-center justify-between">
          <MetricInfo
            description="Shows what percentage of trader accounts hold long vs short futures positions. When longs are crowded (high ratio), the market is vulnerable to long squeezes. When shorts dominate, short squeezes become more likely. The 50% line marks neutral positioning. 'Average' combines data from all available exchanges."
            source="CoinGlass global long/short account ratio data."
          />
          <TimePeriodSelector selected={period} onChange={setPeriod} periods={['1m', '3m', '6m', '1y']} />
        </div>

        {/* Row 2: Asset selector + Exchange selector */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Asset dropdown */}
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="px-2 py-1 text-[11px] font-sans rounded border bg-transparent text-ink border-rule"
            style={{ fontFamily: AXIS_STYLE.fontFamily }}
          >
            {ASSETS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Exchange pills */}
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setExchange(AVG_KEY)}
              className={`px-2 py-0.5 text-[10px] font-sans rounded border transition-colors ${
                exchange === AVG_KEY
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-transparent text-ink-muted border-rule hover:border-ink'
              }`}
            >
              Average
            </button>
            {availableExchanges.map((ex) => (
              <button
                key={ex}
                onClick={() => setExchange(ex)}
                className={`px-2 py-0.5 text-[10px] font-sans rounded border transition-colors ${
                  exchange === ex
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-transparent text-ink-muted border-rule hover:border-ink'
                }`}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-[320px]">
          <p className="font-sans text-xs text-ink-muted">Loading {asset} data...</p>
        </div>
      )}

      {!loading && chartData.length < 3 && (
        <div className="flex items-center justify-center h-[320px]">
          <p className="font-sans text-xs text-ink-muted">No long/short data available for {asset}</p>
        </div>
      )}

      {!loading && chartData.length >= 3 && (
        <>
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wide">Current Long %</p>
                <p className="font-serif text-lg font-bold" style={{ color: COLORS.green }}>{stats.latestLong.toFixed(1)}%</p>
              </div>
              <div>
                <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wide">Current Ratio</p>
                <p className="font-serif text-lg font-bold">{stats.latestRatio.toFixed(2)}</p>
              </div>
              <div>
                <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wide">Period Avg Long</p>
                <p className="font-serif text-lg font-bold">{stats.avg.toFixed(1)}%</p>
              </div>
              <div>
                <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wide">Range</p>
                <p className="font-serif text-lg font-bold">{stats.minLong.toFixed(0)}% – {stats.maxLong.toFixed(0)}%</p>
              </div>
            </div>
          )}

          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="longGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.green} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="shortGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.red} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
              <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
                axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
              <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={AXIS_STYLE} tickLine={false}
                axisLine={false} width={42} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={50} stroke={COLORS.inkMuted} strokeDasharray="4 4" />
              <Area type="monotone" dataKey="longPct" stackId="ls" stroke={COLORS.green} strokeWidth={1.5}
                fill="url(#longGrad)" animationDuration={800} />
              <Area type="monotone" dataKey="shortPct" stackId="ls" stroke={COLORS.red} strokeWidth={1.5}
                fill="url(#shortGrad)" animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>

          <div className="flex items-center justify-center gap-5 mt-2" style={{ fontFamily: AXIS_STYLE.fontFamily, fontSize: 12, color: COLORS.inkLight }}>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.green }} />
              Long %
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.red }} />
              Short %
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0" style={{ borderTop: `1.5px dashed ${COLORS.inkMuted}` }} />
              50% Neutral
            </span>
          </div>
        </>
      )}
    </div>
  )
}
