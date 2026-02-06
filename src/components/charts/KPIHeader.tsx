import React from 'react'
import type { DashboardData } from '../../types'
import { formatUSD, formatPercent, formatNumber, percentClass } from '../../utils/format'

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

export function KPIHeader({ data }: Props) {
  const { dexOverview, enrichedExchanges, feeOverview } = data

  const withToken = enrichedExchanges.filter((e) => e.hasToken).length
  const withoutToken = enrichedExchanges.length - withToken

  const totalTvl = enrichedExchanges.reduce((sum, e) => sum + (e.tvl ?? 0), 0)

  const totalFees24h = feeOverview.total24h

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
      label: 'Active Exchanges',
      value: formatNumber(enrichedExchanges.length),
      sublabel: `${formatNumber(withToken)} with token / ${formatNumber(withoutToken)} without`,
    },
    {
      label: 'Total DEX TVL',
      value: formatUSD(totalTvl, true),
    },
    {
      label: 'Total 24h Fees',
      value: formatUSD(totalFees24h, true),
    },
    {
      label: 'All-Time Cumulative Volume',
      value: formatUSD(dexOverview.totalAllTime, true),
    },
  ]

  return (
    <header className="bg-paper">
      {/* Masthead */}
      <div className="border-b-2 border-ink pb-4 mb-4">
        <p className="font-sans text-xs uppercase tracking-widest text-ink-muted mb-2">
          {currentDateFormatted()}
        </p>
        <h1 className="font-serif text-4xl font-bold text-ink leading-tight tracking-tight">
          DEX Economics Monitor
        </h1>
        <div className="border-t border-rule mt-3 pt-2">
          <p className="font-serif text-sm text-ink-light italic">
            Decentralised Exchange Analytics — Historical Performance &amp; Token Classification
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 py-6">
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
