import { useDashboardData } from './hooks/useDashboardData'
import { LoadingSkeleton, ErrorDisplay } from './components/LoadingSkeleton'
import { ErrorBoundary } from './components/ErrorBoundary'
import { KPIHeader } from './components/charts/KPIHeader'
import { HistoricalVolumeChart } from './components/charts/HistoricalVolumeChart'
import { TokenComparisonPanel } from './components/charts/TokenComparisonPanel'
import { ExchangeRankingsTable } from './components/charts/ExchangeRankingsTable'
import { VolumeByChainChart } from './components/charts/VolumeByChainChart'
import { VolumeShareChart } from './components/charts/VolumeShareChart'
import { FeeRevenueChart } from './components/charts/FeeRevenueChart'
import { MarketConcentrationChart } from './components/charts/MarketConcentrationChart'
import { TVLvsVolumeScatter } from './components/charts/TVLvsVolumeScatter'
import { GrowthMomentumChart } from './components/charts/GrowthMomentumChart'
import { ChainDiversityChart } from './components/charts/ChainDiversityChart'
import { TokenPriceTable } from './components/charts/TokenPriceTable'

export default function App() {
  const { data, loading, error } = useDashboardData()

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorDisplay message={error} />
  if (!data) return <ErrorDisplay message="No data available" />

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Masthead & KPIs */}
        <ErrorBoundary fallbackLabel="Dashboard header">
          <KPIHeader data={data} />
        </ErrorBoundary>

        {/* Section 1: Aggregate Volume History */}
        <section className="section-rule">
          <ErrorBoundary fallbackLabel="Historical volume chart">
            <HistoricalVolumeChart data={data.historicalVolume} />
          </ErrorBoundary>
        </section>

        {/* Section 2: Token Classification — the core analytical thesis */}
        <section className="section-rule-heavy">
          <ErrorBoundary fallbackLabel="Token comparison">
            <TokenComparisonPanel
              tokenGroup={data.tokenGroup}
              noTokenGroup={data.noTokenGroup}
            />
          </ErrorBoundary>
        </section>

        {/* Section 3: Market Structure — share & concentration */}
        <section className="section-rule">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ErrorBoundary fallbackLabel="Volume share chart">
              <VolumeShareChart exchanges={data.enrichedExchanges} />
            </ErrorBoundary>
            <ErrorBoundary fallbackLabel="Market concentration">
              <MarketConcentrationChart exchanges={data.enrichedExchanges} />
            </ErrorBoundary>
          </div>
        </section>

        {/* Section 4: Volume by Chain */}
        <section className="section-rule">
          <ErrorBoundary fallbackLabel="Volume by chain">
            <VolumeByChainChart exchanges={data.enrichedExchanges} />
          </ErrorBoundary>
        </section>

        {/* Section 5: Capital Efficiency & Fees */}
        <section className="section-rule">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ErrorBoundary fallbackLabel="TVL vs Volume scatter">
              <TVLvsVolumeScatter exchanges={data.enrichedExchanges} />
            </ErrorBoundary>
            <ErrorBoundary fallbackLabel="Fee revenue chart">
              <FeeRevenueChart exchanges={data.enrichedExchanges} />
            </ErrorBoundary>
          </div>
        </section>

        {/* Section 6: Growth & Volatility */}
        <section className="section-rule">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ErrorBoundary fallbackLabel="Growth momentum">
              <GrowthMomentumChart exchanges={data.enrichedExchanges} />
            </ErrorBoundary>
            <ErrorBoundary fallbackLabel="Chain diversity">
              <ChainDiversityChart exchanges={data.enrichedExchanges} />
            </ErrorBoundary>
          </div>
        </section>

        {/* Section 7: DEX Governance Token Prices */}
        <section className="section-rule">
          <ErrorBoundary fallbackLabel="Token prices">
            <TokenPriceTable
              tokenPrices={data.topTokenPrices}
              exchanges={data.enrichedExchanges}
            />
          </ErrorBoundary>
        </section>

        {/* Section 8: Full Rankings Table */}
        <section className="section-rule-heavy">
          <ErrorBoundary fallbackLabel="Exchange rankings">
            <ExchangeRankingsTable exchanges={data.enrichedExchanges} />
          </ErrorBoundary>
        </section>

        {/* Footer */}
        <footer className="border-t-2 border-ink mt-16 pt-6 pb-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="font-serif text-sm font-bold text-ink">
                DEX Economics Monitor
              </p>
              <p className="font-sans text-xs text-ink-muted mt-1">
                Data sourced from DefiLlama and CoinGecko APIs. Updated in
                real-time.
              </p>
            </div>
            <div className="text-right">
              <p className="font-sans text-xs text-ink-muted">
                Analysis classifies exchanges by governance token issuance.
              </p>
              <p className="font-sans text-xs text-ink-muted mt-1">
                Volume, TVL, and fee metrics reflect on-chain activity only.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-rule">
            <p className="font-mono text-xs text-ink-muted text-center">
              {data.enrichedExchanges.length} exchanges tracked across{' '}
              {data.dexOverview.allChains?.length || 0} chains •{' '}
              {data.tokenGroup.count} with governance tokens •{' '}
              {data.noTokenGroup.count} without
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
