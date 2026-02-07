import { useMemo, useState } from 'react'
import type { FundingRateEntry } from '../../types'
import { COLORS } from '../../utils/chartTheme'
import { formatUSD, formatPercent } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { CategoryFilter } from '../CategoryFilter'
import type { CategorySelection } from '../CategoryFilter'

interface Props {
  data: FundingRateEntry[]
}

function rateColor(rate: number): string {
  if (rate > 0.01) return '#16a34a'
  if (rate > 0.005) return '#4ade80'
  if (rate > 0.001) return '#bbf7d0'
  if (rate > -0.001) return '#f5f5f4'
  if (rate > -0.005) return '#fecaca'
  if (rate > -0.01) return '#f87171'
  return '#dc2626'
}

function rateTextColor(rate: number): string {
  if (Math.abs(rate) > 0.005) return '#fff'
  return COLORS.ink
}

function formatRate(rate: number | null): string {
  if (rate == null || !isFinite(rate)) return '\u2014'
  return `${rate >= 0 ? '+' : ''}${(rate * 100).toFixed(4)}%`
}

export function FundingRateHeatmap({ data }: Props) {
  const [view, setView] = useState<'heatmap' | 'arb' | 'rateAvg'>('heatmap')
  const [category, setCategory] = useState<CategorySelection>('all')

  const defiCount = data.filter(d => d.venueType === 'defi').length
  const cefiCount = data.filter(d => d.venueType === 'cefi').length

  const { coins, exchanges, matrix, sentiment, arbOpportunities, rateVsAvg } = useMemo(() => {
    const filtered = category === 'all' ? data : data.filter(d => d.venueType === category)
    if (!filtered || filtered.length === 0) return { coins: [], exchanges: [], matrix: new Map(), sentiment: null, arbOpportunities: [], rateVsAvg: [] }

    // Filter valid entries
    const valid = filtered.filter(
      (d) => d.baseAsset && d.marketplace && d.fundingRate != null && isFinite(d.fundingRate) && Math.abs(d.fundingRate) < 0.01
    )

    // Aggregate OI per coin
    const coinOI = new Map<string, number>()
    for (const d of valid) {
      coinOI.set(d.baseAsset, (coinOI.get(d.baseAsset) || 0) + (d.openInterest || 0))
    }
    const topCoins = [...coinOI.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([coin]) => coin)

    // Aggregate OI per exchange
    const exchangeOI = new Map<string, number>()
    for (const d of valid) {
      if (!topCoins.includes(d.baseAsset)) continue
      exchangeOI.set(d.marketplace, (exchangeOI.get(d.marketplace) || 0) + (d.openInterest || 0))
    }
    const topExchanges = [...exchangeOI.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ex]) => ex)

    // Build matrix: coin -> exchange -> entry (deduplicated: one entry per coin×exchange)
    const matrix = new Map<string, Map<string, FundingRateEntry>>()
    for (const d of valid) {
      if (!topCoins.includes(d.baseAsset) || !topExchanges.includes(d.marketplace)) continue
      if (!matrix.has(d.baseAsset)) matrix.set(d.baseAsset, new Map())
      const existing = matrix.get(d.baseAsset)!.get(d.marketplace)
      if (!existing || (d.openInterest || 0) > (existing.openInterest || 0)) {
        matrix.get(d.baseAsset)!.set(d.marketplace, d)
      }
    }

    // OI-weighted average funding rate — DEDUPLICATED by (baseAsset, marketplace)
    // Use the best entry per (baseAsset, marketplace) to avoid counting OI multiple times
    const dedupedEntries = new Map<string, FundingRateEntry>()
    for (const d of valid) {
      const key = `${d.baseAsset}|${d.marketplace}`
      const existing = dedupedEntries.get(key)
      if (!existing || (d.openInterest || 0) > (existing.openInterest || 0)) {
        dedupedEntries.set(key, d)
      }
    }
    let weightedSum = 0
    let totalOI = 0
    let positiveOI = 0
    for (const d of dedupedEntries.values()) {
      if (d.openInterest && d.openInterest > 0) {
        weightedSum += d.fundingRate * d.openInterest
        totalOI += d.openInterest
        if (d.fundingRate >= 0) positiveOI += d.openInterest
      }
    }
    const avgRate = totalOI > 0 ? weightedSum / totalOI : 0

    // Rate dispersion: interquartile range of all funding rates
    const allRates = valid.map((d) => d.fundingRate).sort((a, b) => a - b)
    const q1 = allRates[Math.floor(allRates.length * 0.25)] ?? 0
    const q3 = allRates[Math.floor(allRates.length * 0.75)] ?? 0
    const rateDispersion = q3 - q1

    const sentiment = { avgRate, totalOI, positiveOI, pctPositive: totalOI > 0 ? (positiveOI / totalOI) * 100 : 50, rateDispersion }

    // Funding rate arbitrage: find same coin across exchanges with largest spread
    const arbOpportunities: { coin: string; highExchange: string; highRate: number; lowExchange: string; lowRate: number; spread: number; totalOI: number }[] = []
    for (const coin of topCoins) {
      const entries = matrix.get(coin)
      if (!entries || entries.size < 2) continue
      const sorted = [...entries.entries()].sort((a, b) => b[1].fundingRate - a[1].fundingRate)
      const high = sorted[0]
      const low = sorted[sorted.length - 1]
      const spread = high[1].fundingRate - low[1].fundingRate
      if (spread > 0.0001) {
        arbOpportunities.push({
          coin,
          highExchange: high[0],
          highRate: high[1].fundingRate,
          lowExchange: low[0],
          lowRate: low[1].fundingRate,
          spread,
          totalOI: (high[1].openInterest || 0) + (low[1].openInterest || 0),
        })
      }
    }
    arbOpportunities.sort((a, b) => b.spread - a.spread)

    // Rate vs Average: compare current rates to 7d and 30d averages
    const rateVsAvg: { asset: string; exchange: string; current: number; avg7d: number | null; avg30d: number | null; signal: 'Elevated' | 'Depressed' | 'Normal' }[] = []
    for (const d of valid) {
      if (!topCoins.includes(d.baseAsset)) continue
      const avg7d = d.fundingRate7dAverage
      let signal: 'Elevated' | 'Depressed' | 'Normal' = 'Normal'
      if (avg7d != null && avg7d !== 0 && isFinite(avg7d)) {
        const ratio = d.fundingRate / avg7d
        if (ratio > 2) signal = 'Elevated'
        else if (ratio < 0.5) signal = 'Depressed'
      }
      rateVsAvg.push({
        asset: d.baseAsset,
        exchange: d.marketplace,
        current: d.fundingRate,
        avg7d,
        avg30d: d.fundingRate30dAverage,
        signal,
      })
    }
    // Sort elevated first, then depressed, then normal
    const signalOrder = { Elevated: 0, Depressed: 1, Normal: 2 }
    rateVsAvg.sort((a, b) => signalOrder[a.signal] - signalOrder[b.signal] || Math.abs(b.current) - Math.abs(a.current))

    return { coins: topCoins, exchanges: topExchanges, matrix, sentiment, arbOpportunities, rateVsAvg }
  }, [data, category])

  if (!data || data.length === 0 || coins.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Funding Rate Heatmap</h3>
        <p className="chart-subtitle">Cross-exchange funding rates for top perpetual pairs</p>
        <p className="font-sans text-sm text-ink-muted py-12 text-center">
          Funding rate data unavailable.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="chart-title">Funding Rate Heatmap</h3>
      <p className="chart-subtitle">
        Current funding rates across exchanges — colored by rate direction and magnitude
      </p>
      <MetricInfo
        description="Funding rates show the cost of holding long/short perp positions and are a leading sentiment indicator. This heatmap reveals cross-exchange funding differentials. Extreme rates signal over-leveraged markets, while large spreads between exchanges present arbitrage opportunities."
        source="DeFiLlama yields/perps endpoint providing per-market funding rates, 7d/30d averages, and open interest across all tracked exchanges."
      />

      {/* Sentiment bar */}
      {sentiment && (
        <div className="grid grid-cols-4 gap-4 mb-5 pb-4 border-b border-rule">
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">OI-Weighted Avg Rate</p>
            <p className="font-mono text-sm font-bold" style={{ color: sentiment.avgRate >= 0 ? COLORS.green : COLORS.red }}>
              {formatRate(sentiment.avgRate)}
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Sentiment</p>
            <p className="font-mono text-sm font-bold" style={{ color: sentiment.pctPositive > 50 ? COLORS.green : COLORS.red }}>
              {sentiment.pctPositive > 50 ? 'Net Long' : 'Net Short'} ({sentiment.pctPositive.toFixed(0)}%)
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Total OI Tracked</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(sentiment.totalOI, true)}</p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Rate Dispersion (IQR)</p>
            <p className="font-mono text-sm font-bold text-ink">
              {(sentiment.rateDispersion * 10000).toFixed(1)} bps
            </p>
          </div>
        </div>
      )}

      {/* Category filter + View toggle */}
      <div className="flex items-center gap-4 mb-4">
        {defiCount > 0 && cefiCount > 0 && (
          <>
            <CategoryFilter
              selected={category}
              onChange={setCategory}
              defiCount={defiCount}
              cefiCount={cefiCount}
            />
            <div className="w-px h-5 bg-rule" />
          </>
        )}
        <div className="flex items-center gap-1">
        <button
          onClick={() => setView('heatmap')}
          className={view === 'heatmap' ? 'px-3 py-1.5 border bg-ink text-paper border-ink font-semibold font-sans text-xs' : 'px-3 py-1.5 border bg-paper text-ink-muted border-rule hover:border-ink font-sans text-xs cursor-pointer'}
          type="button"
        >
          Heatmap
        </button>
        <button
          onClick={() => setView('arb')}
          className={view === 'arb' ? 'px-3 py-1.5 border bg-ink text-paper border-ink font-semibold font-sans text-xs' : 'px-3 py-1.5 border bg-paper text-ink-muted border-rule hover:border-ink font-sans text-xs cursor-pointer'}
          type="button"
        >
          Arbitrage ({arbOpportunities.length})
        </button>
        <button
          onClick={() => setView('rateAvg')}
          className={view === 'rateAvg' ? 'px-3 py-1.5 border bg-ink text-paper border-ink font-semibold font-sans text-xs' : 'px-3 py-1.5 border bg-paper text-ink-muted border-rule hover:border-ink font-sans text-xs cursor-pointer'}
          type="button"
        >
          Rate vs Average
        </button>
        </div>
      </div>

      {view === 'heatmap' && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th className="text-left py-2 px-2 font-sans font-semibold text-ink-muted uppercase tracking-wider border-b-2 border-ink sticky left-0 bg-paper z-10" style={{ fontSize: 10 }}>
                  Asset
                </th>
                {exchanges.map((ex) => (
                  <th key={ex} className="text-center py-2 px-1 font-sans font-semibold text-ink-muted uppercase tracking-wider border-b-2 border-ink whitespace-nowrap" style={{ fontSize: 9, maxWidth: 80 }}>
                    {ex.length > 12 ? ex.slice(0, 10) + '..' : ex}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coins.map((coin) => (
                <tr key={coin}>
                  <td className="py-1.5 px-2 font-mono font-bold text-ink border-b border-rule sticky left-0 bg-paper z-10" style={{ fontSize: 11 }}>
                    {coin}
                  </td>
                  {exchanges.map((ex) => {
                    const entry = matrix.get(coin)?.get(ex)
                    if (!entry) {
                      return <td key={ex} className="text-center py-1.5 px-1 border-b border-rule text-ink-muted">{'\u2014'}</td>
                    }
                    return (
                      <td
                        key={ex}
                        className="text-center py-1.5 px-1 border-b border-rule font-mono cursor-help"
                        style={{ backgroundColor: rateColor(entry.fundingRate), color: rateTextColor(entry.fundingRate), fontSize: 10 }}
                        title={`${coin} on ${ex}\nRate: ${formatRate(entry.fundingRate)}\n7d Avg: ${formatRate(entry.fundingRate7dAverage)}\n30d Avg: ${formatRate(entry.fundingRate30dAverage)}\nOI: ${formatUSD(entry.openInterest || 0, true)}`}
                      >
                        {formatRate(entry.fundingRate)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Color legend */}
          <div className="flex items-center justify-center gap-2 mt-3 font-sans text-[10px] text-ink-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3" style={{ backgroundColor: '#dc2626' }} />
              Strong Short
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3" style={{ backgroundColor: '#fecaca' }} />
              Mild Short
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3" style={{ backgroundColor: '#f5f5f4' }} />
              Neutral
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3" style={{ backgroundColor: '#bbf7d0' }} />
              Mild Long
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3" style={{ backgroundColor: '#16a34a' }} />
              Strong Long
            </span>
          </div>
        </div>
      )}

      {view === 'arb' && (
        <div className="overflow-x-auto">
          <table className="data-table w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left">Pair</th>
                <th className="text-left">Long Exchange</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Basis</th>
                <th className="text-left">Short Exchange</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Basis</th>
                <th className="text-right">Spread</th>
                <th className="text-right">Combined OI</th>
                <th className="text-right">Est. 8h Funding</th>
              </tr>
            </thead>
            <tbody>
              {arbOpportunities.slice(0, 15).map((arb, i) => {
                const highEntry = matrix.get(arb.coin)?.get(arb.highExchange)
                const lowEntry = matrix.get(arb.coin)?.get(arb.lowExchange)
                const highBasis = highEntry?.markPrice != null && highEntry?.indexPrice != null && highEntry.indexPrice !== 0
                  ? ((highEntry.markPrice - highEntry.indexPrice) / highEntry.indexPrice) * 10000
                  : null
                const lowBasis = lowEntry?.markPrice != null && lowEntry?.indexPrice != null && lowEntry.indexPrice !== 0
                  ? ((lowEntry.markPrice - lowEntry.indexPrice) / lowEntry.indexPrice) * 10000
                  : null
                return (
                <tr key={arb.coin} className={i % 2 === 1 ? 'bg-paper-warm' : ''}>
                  <td className="font-mono font-bold text-ink">{arb.coin}</td>
                  <td className="font-sans text-sm">{arb.highExchange}</td>
                  <td className="text-right font-mono text-xs" style={{ color: COLORS.green }}>{formatRate(arb.highRate)}</td>
                  <td className="text-right font-mono text-xs text-ink-muted">
                    {highBasis != null ? `${highBasis >= 0 ? '+' : ''}${highBasis.toFixed(1)} bps` : '\u2014'}
                  </td>
                  <td className="font-sans text-sm">{arb.lowExchange}</td>
                  <td className="text-right font-mono text-xs" style={{ color: COLORS.red }}>{formatRate(arb.lowRate)}</td>
                  <td className="text-right font-mono text-xs text-ink-muted">
                    {lowBasis != null ? `${lowBasis >= 0 ? '+' : ''}${lowBasis.toFixed(1)} bps` : '\u2014'}
                  </td>
                  <td className="text-right font-mono text-xs font-bold" style={{ color: COLORS.blue }}>
                    {(arb.spread * 10000).toFixed(1)} bps
                  </td>
                  <td className="text-right font-mono text-xs text-ink-muted">{formatUSD(arb.totalOI, true)}</td>
                  <td className="text-right font-mono text-xs font-bold" style={{ color: COLORS.green }}>
                    {formatUSD(arb.spread * arb.totalOI, true)}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
          <p className="font-sans text-[10px] text-ink-muted mt-2">
            Spread = difference between highest and lowest funding rate for the same pair across exchanges (in basis points per 8h period).
            Est. 8h Funding = spread &times; combined open interest.
          </p>
        </div>
      )}

      {view === 'rateAvg' && (
        <div className="overflow-x-auto">
          <table className="data-table w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left">Asset</th>
                <th className="text-left">Exchange</th>
                <th className="text-right">Current</th>
                <th className="text-right">7d Avg</th>
                <th className="text-right">30d Avg</th>
                <th className="text-center">Signal</th>
              </tr>
            </thead>
            <tbody>
              {rateVsAvg.slice(0, 50).map((row, i) => (
                <tr key={`${row.asset}-${row.exchange}`} className={i % 2 === 1 ? 'bg-paper-warm' : ''}>
                  <td className="font-mono font-bold text-ink">{row.asset}</td>
                  <td className="font-sans text-sm">{row.exchange}</td>
                  <td className="text-right font-mono text-xs" style={{ color: row.current >= 0 ? COLORS.green : COLORS.red }}>
                    {formatRate(row.current)}
                  </td>
                  <td className="text-right font-mono text-xs text-ink-muted">
                    {formatRate(row.avg7d)}
                  </td>
                  <td className="text-right font-mono text-xs text-ink-muted">
                    {formatRate(row.avg30d)}
                  </td>
                  <td className="text-center font-sans text-xs font-semibold">
                    {row.signal === 'Elevated' && (
                      <span style={{ color: COLORS.red }}>Elevated</span>
                    )}
                    {row.signal === 'Depressed' && (
                      <span style={{ color: COLORS.blue }}>Depressed</span>
                    )}
                    {row.signal === 'Normal' && (
                      <span className="text-ink-muted">Normal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="font-sans text-[10px] text-ink-muted mt-2">
            Signal: Elevated = current rate &gt; 2&times; 7d average, Depressed = current rate &lt; 0.5&times; 7d average, Normal = within typical range.
          </p>
        </div>
      )}
    </div>
  )
}
