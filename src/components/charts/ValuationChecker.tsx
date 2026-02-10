import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { EnrichedExchange } from '../../types'
import { formatUSD, formatBPS } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

function getDailyFees(e: EnrichedExchange): number {
  return e.feeData?.total24h || 0
}

function getTakeRate(e: EnrichedExchange): number | null {
  const fees = getDailyFees(e)
  const vol = e.total24h
  if (!vol || vol <= 0 || fees <= 0) return null
  return fees / vol
}

function get30dVolume(e: EnrichedExchange): number {
  if (e.total30d && e.total30d > 0) return e.total30d
  if (e.total24h && e.total24h > 0) return e.total24h * 30
  return 0
}

function formatBillions(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

export function ValuationChecker({ exchanges }: Props) {
  // Exchanges that can be selected as the reference protocol (must have token + mcap + fees)
  const selectableExchanges = useMemo(() =>
    exchanges
      .filter((e) => e.hasToken && e.mcap && e.mcap > 0 && e.annualizedFees && e.annualizedFees > 0 && getTakeRate(e) != null)
      .sort((a, b) => (b.total24h || 0) - (a.total24h || 0)),
    [exchanges]
  )

  // Default to Drift if available, otherwise first selectable
  const defaultSlug = useMemo(() => {
    const drift = selectableExchanges.find((e) => e.slug.includes('drift'))
    return drift?.slug || selectableExchanges[0]?.slug || ''
  }, [selectableExchanges])

  const [selectedSlug, setSelectedSlug] = useState(defaultSlug)

  // Selected protocol's economics
  const selected = useMemo(() => {
    const ex = selectableExchanges.find((e) => e.slug === selectedSlug)
    if (!ex) return null

    const takeRate = getTakeRate(ex)!
    const takeRateBps = takeRate * 10_000
    const pfMultiple = ex.mcap! / ex.annualizedFees!
    const vol30d = get30dVolume(ex)

    return {
      exchange: ex,
      takeRate,
      takeRateBps,
      pfMultiple,
      mcap: ex.mcap!,
      annualizedFees: ex.annualizedFees!,
      vol30d,
    }
  }, [selectableExchanges, selectedSlug])

  // Top 10 exchanges by 30d volume, excluding selected
  const compRows = useMemo(() => {
    if (!selected) return []

    return exchanges
      .filter((e) => e.slug !== selectedSlug && get30dVolume(e) > 0)
      .sort((a, b) => get30dVolume(b) - get30dVolume(a))
      .slice(0, 10)
      .map((e, i) => {
        const vol30d = get30dVolume(e)
        const takeRateAmount30d = vol30d * selected.takeRate
        const feesAnnualized = takeRateAmount30d * 12
        const projectedValuation = feesAnnualized * selected.pfMultiple
        const multiple = projectedValuation / selected.mcap

        return {
          rank: i + 1,
          exchange: e,
          vol30d,
          takeRateAmount30d,
          feesAnnualized,
          projectedValuation,
          multiple,
        }
      })
  }, [exchanges, selectedSlug, selected])

  if (selectableExchanges.length === 0) return null

  const displayName = selected?.exchange.displayName || selected?.exchange.name || ''

  return (
    <div className="chart-container">
      <h3 className="chart-title">Valuation Checker</h3>
      <p className="chart-subtitle">
        Project what a protocol would be worth at the volume of the top exchanges, using its current take rate and valuation multiple
      </p>

      <div className="flex items-center justify-between mb-4">
        <MetricInfo
          description="Select a protocol to use as the reference. The table applies its take rate (fees/volume) and P/F multiple (market cap / annualized fees) to the 30-day volume of the top 10 exchanges. This shows what the selected protocol's implied valuation would be if it captured each exchange's volume."
          source="Volume and fee data from DefiLlama. Market cap from CoinGecko. Take rate = daily fees / daily volume. P/F = market cap / annualized fees."
        />
        <select
          value={selectedSlug}
          onChange={(e) => setSelectedSlug(e.target.value)}
          className="font-mono text-sm bg-paper border border-rule px-3 py-1.5 text-ink focus:outline-none focus:border-ink"
        >
          {selectableExchanges.map((e) => (
            <option key={e.slug} value={e.slug}>
              {e.displayName || e.name}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          {/* KPI row for selected protocol */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 pb-4 border-b border-rule">
            <div>
              <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Market Cap</p>
              <p className="font-mono text-sm font-bold text-ink">{formatUSD(selected.mcap, true)}</p>
            </div>
            <div>
              <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Take Rate</p>
              <p className="font-mono text-sm font-bold text-ink">{formatBPS(selected.takeRateBps)}</p>
            </div>
            <div>
              <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">P/F Multiple</p>
              <p className="font-mono text-sm font-bold text-ink">{selected.pfMultiple.toFixed(1)}x</p>
            </div>
            <div>
              <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">30d Volume</p>
              <p className="font-mono text-sm font-bold text-ink">{formatBillions(selected.vol30d)}</p>
            </div>
          </div>

          {/* Comp table */}
          <div className="overflow-x-auto">
            <table className="data-table w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left w-10">Rank</th>
                  <th className="text-left">Protocol</th>
                  <th className="text-right">30d Volume</th>
                  <th className="text-right">{displayName} Take Rate</th>
                  <th className="text-right">Fees (Annualised)</th>
                  <th className="text-right">Projected Valuation</th>
                  <th className="text-right">Multiple</th>
                </tr>
              </thead>
              <tbody>
                {compRows.map((row) => (
                  <tr key={row.exchange.slug}>
                    <td className="text-ink-muted w-10">{row.rank}</td>
                    <td>
                      <Link
                        to={`/exchange/${row.exchange.slug}`}
                        className="font-medium text-ink hover:underline"
                      >
                        {row.exchange.displayName || row.exchange.name}
                      </Link>
                    </td>
                    <td className="text-right font-mono text-xs">{formatBillions(row.vol30d)}</td>
                    <td className="text-right font-mono text-xs">{formatBillions(row.takeRateAmount30d)}</td>
                    <td className="text-right font-mono text-xs">{formatBillions(row.feesAnnualized)}</td>
                    <td className="text-right font-mono text-xs font-bold">{formatBillions(row.projectedValuation)}</td>
                    <td className="text-right font-mono text-xs font-bold">{row.multiple.toFixed(1)}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="font-sans text-[10px] text-ink-muted mt-3 italic">
            Indicative only. Assumes uniform take rate and valuation multiple across exchanges. Actual economics vary by protocol design, fee structure, and market conditions.
          </p>
        </>
      )}
    </div>
  )
}
