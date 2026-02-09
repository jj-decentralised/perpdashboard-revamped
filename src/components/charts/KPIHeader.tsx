import React, { useState, useEffect } from 'react'
import type { DashboardData } from '../../types'
import { formatUSD, formatPercent, formatNumber, percentClass } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  data: DashboardData
}

function currentDateFormatted(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function useTimeSinceLoad() {
  const [loadTime] = useState(() => new Date())
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    function update() {
      const diff = Math.floor((Date.now() - loadTime.getTime()) / 1000)
      if (diff < 60) setElapsed('just now')
      else if (diff < 3600) setElapsed(`${Math.floor(diff / 60)}m ago`)
      else setElapsed(`${Math.floor(diff / 3600)}h ago`)
    }
    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [loadTime])

  return { loadTime, elapsed }
}

export function KPIHeader({ data }: Props) {
  const { dexOverview, enrichedExchanges, feeOverview } = data
  const { loadTime, elapsed } = useTimeSinceLoad()

  const withToken = enrichedExchanges.filter((e) => e.hasToken).length
  const withoutToken = enrichedExchanges.length - withToken

  const totalDefiFees24h = feeOverview?.total24h ?? 0
  const perpFees24h = enrichedExchanges.reduce((sum, e) => sum + ((e.feeData?.total24h as number) || 0), 0)
  const perpFeeShare = totalDefiFees24h > 0 ? (perpFees24h / totalDefiFees24h) * 100 : null

  const kpis: {
    label: string
    value: string
    change?: number | null
    sublabel?: string
  }[] = [
    {
      label: 'Total 24h Volume',
      value: formatUSD(dexOverview.total24h, true),
      change: dexOverview.change_1d,
    },
    {
      label: 'Total 30d Volume',
      value: formatUSD(dexOverview.total30d, true),
      change: dexOverview.change_1m,
    },
    {
      label: 'Exchanges Tracked',
      value: formatNumber(enrichedExchanges.length),
      sublabel: `${formatNumber(withToken)} with token / ${formatNumber(withoutToken)} without`,
    },
    {
      label: 'Total Open Interest',
      value: formatUSD(data.totalOpenInterest, true),
    },
    {
      label: 'Perp 24h Fees',
      value: formatUSD(perpFees24h, true),
      sublabel: perpFeeShare != null ? `${perpFeeShare.toFixed(1)}% of all DeFi fees` : undefined,
    },
    {
      label: 'All-Time Cumulative Volume',
      value: formatUSD(dexOverview.totalAllTime, true),
    },
  ]

  // Add perps dominance KPI if spot volume data is available
  const perpsDominance = data.spotVolume24h > 0
    ? (dexOverview.total24h / (dexOverview.total24h + data.spotVolume24h)) * 100
    : null
  if (perpsDominance != null) {
    kpis.push({
      label: 'Perps Dominance',
      value: `${perpsDominance.toFixed(1)}%`,
      sublabel: `vs ${formatUSD(data.spotVolume24h, true)} spot`,
    })
  }

  // Perps fee revenue share of all DeFi
  if (perpFeeShare != null && perpFeeShare > 0) {
    kpis.push({
      label: 'Perps Fee Share',
      value: `${perpFeeShare.toFixed(1)}%`,
      sublabel: `of ${formatUSD(totalDefiFees24h, true)} total DeFi`,
    })
  }

  // Global context KPIs
  if (data.globalContext) {
    kpis.push({
      label: 'Perps % of Crypto Vol',
      value: `${data.globalContext.perpsShare.toFixed(1)}%`,
      sublabel: `of ${formatUSD(data.globalContext.totalCryptoVolume, true)} total`,
    })
  }

  // BTC basis KPI
  if (data.basisMetrics?.btcBasisBps != null) {
    kpis.push({
      label: 'BTC Basis',
      value: `${data.basisMetrics.btcBasisBps.toFixed(1)} bps`,
      sublabel: data.basisMetrics.btcBasisBps >= 0 ? 'premium (bullish)' : 'discount (bearish)',
    })
  }

  return (
    <header className="bg-paper">
      {/* Masthead */}
      <div className="border-b-2 border-ink pb-4 mb-4">
        <p className="font-sans text-xs uppercase tracking-widest text-ink-muted mb-2">
          {currentDateFormatted()}
        </p>
        <h1 className="font-serif text-4xl font-bold text-ink leading-tight tracking-tight">
          Perpetual Exchanges in Numbers
        </h1>
        <div className="border-t border-rule mt-3 pt-2 flex items-center justify-between">
          <p className="font-serif text-sm text-ink-light italic">
            Volume, Open Interest, Fees, Valuations &amp; Market Structure
          </p>
          <p className="font-sans text-[11px] text-ink-muted" title={`Data loaded at ${loadTime.toLocaleTimeString()}`}>
            Updated {elapsed}
          </p>
        </div>
      </div>

      {/* KPI description */}
      <MetricInfo
        description="These headline figures provide a real-time snapshot of the perpetual futures market. Total volume and open interest gauge overall trading activity and leverage exposure, while perps dominance shows the balance between derivatives and spot trading. BTC basis indicates whether futures trade at a premium or discount to spot, signaling market sentiment. All figures refresh on each page load."
        source="DefiLlama perps and DEX overview endpoints for volume and OI. CoinGecko for global crypto volume context. Funding rate and basis data from yields.llama.fi."
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 py-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-2 leading-tight">
              {kpi.label}
            </p>
            <p className="font-mono text-2xl font-bold text-ink leading-none mb-1">
              {kpi.value}
            </p>
            {kpi.change != null && (
              <p className={`font-mono text-xs mt-1 ${percentClass(kpi.change)}`}>
                {formatPercent(kpi.change)} <span className="text-ink-muted font-sans">1d</span>
              </p>
            )}
            {kpi.sublabel && (
              <p className="font-sans text-xs text-ink-muted mt-1">
                {kpi.sublabel}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Section divider */}
      <div className="border-t border-rule" />
    </header>
  )
}
