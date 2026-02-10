import { useDashboardData } from '../hooks/useDashboardData'
import { LoadingSkeleton, ErrorDisplay } from '../components/LoadingSkeleton'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { KPIHeader } from '../components/charts/KPIHeader'
import { HistoricalVolumeChart } from '../components/charts/HistoricalVolumeChart'
import { TokenComparisonPanel } from '../components/charts/TokenComparisonPanel'
import { ExchangeRankingsTable } from '../components/charts/ExchangeRankingsTable'
import { VolumeByChainChart } from '../components/charts/VolumeByChainChart'
import { VolumeShareChart } from '../components/charts/VolumeShareChart'
import { FeeRevenueChart } from '../components/charts/FeeRevenueChart'
import { MarketConcentrationChart } from '../components/charts/MarketConcentrationChart'
import { TVLvsVolumeScatter } from '../components/charts/TVLvsVolumeScatter'
import { GrowthMomentumChart } from '../components/charts/GrowthMomentumChart'
import { OpenInterestChart } from '../components/charts/OpenInterestChart'
import { ValuationChart } from '../components/charts/ValuationChart'
import { HistoricalOIChart } from '../components/charts/HistoricalOIChart'
import { PerpsDominanceChart } from '../components/charts/PerpsDominanceChart'
import { VolumeGrowthChart } from '../components/charts/VolumeGrowthChart'
import { TokenUnlockCalendar } from '../components/charts/TokenUnlockCalendar'
import { CapitalEfficiencyChart } from '../components/charts/CapitalEfficiencyChart'
import { ScatterPlotGenerator } from '../components/charts/ScatterPlotGenerator'
import { BasisMonitor } from '../components/charts/BasisMonitor'
import { DexCexShareChart } from '../components/charts/DexCexShareChart'
import { TreasuryOverview } from '../components/charts/TreasuryOverview'
import { PerpRevenueBreakdownChart } from '../components/charts/PerpRevenueBreakdownChart'
import { PerpFeeShareHistoryChart } from '../components/charts/PerpFeeShareHistoryChart'
import { CommandPalette } from '../components/CommandPalette'
import { DataMethodology } from '../components/DataMethodology'
import { TabNavigation, useTabNavigation } from '../components/TabNavigation'
import type { Tab } from '../components/TabNavigation'

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'market', label: 'Market Structure' },
  { id: 'fees', label: 'Fees & Valuation' },
  { id: 'rankings', label: 'Rankings' },
]

export default function DashboardPage() {
  const { data, loading, error } = useDashboardData()
  const { activeTab, selectTab } = useTabNavigation(TABS, 'overview')

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorDisplay message={error} />
  if (!data) return <ErrorDisplay message="No data available" />

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Global Search */}
        <div className="flex justify-end mb-4">
          <CommandPalette exchanges={data.enrichedExchanges} />
        </div>

        {/* Masthead & KPIs - always visible */}
        <ErrorBoundary fallbackLabel="Dashboard header">
          <KPIHeader data={data} />
        </ErrorBoundary>

        {/* Tab Navigation */}
        <div className="mt-8">
          <TabNavigation tabs={TABS} activeTab={activeTab} onSelect={selectTab} />
        </div>

        {/* Tab Content */}
        <div className="mt-8">
          {activeTab === 'overview' && (
            <OverviewTab data={data} />
          )}
          {activeTab === 'market' && (
            <MarketStructureTab data={data} />
          )}
          {activeTab === 'fees' && (
            <FeesValuationTab data={data} />
          )}
          {activeTab === 'rankings' && (
            <RankingsTab data={data} />
          )}
        </div>

        {/* Footer - always visible */}
        <footer className="border-t-2 border-ink mt-16 pt-6 pb-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="font-serif text-sm font-bold text-ink">
                Perpetual Exchanges in Numbers
              </p>
              <p className="font-sans text-xs text-ink-muted mt-1">
                Updated in real-time.
              </p>
            </div>
            <div className="text-right">
              <p className="font-sans text-xs text-ink-muted">
                Analysis classifies exchanges by governance token issuance.
              </p>
              <p className="font-sans text-xs text-ink-muted mt-1">
                Volume, OI, and fee metrics reflect on-chain derivatives activity.
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

/* ── Tab Content Components ── */

function OverviewTab({ data }: { data: any }) {
  return (
    <>
      <section>
        <ErrorBoundary fallbackLabel="Historical volume chart">
          <HistoricalVolumeChart data={data.historicalVolume} />
        </ErrorBoundary>
      </section>

      {data.historicalOI.length > 0 && (
        <section className="section-rule">
          <ErrorBoundary fallbackLabel="Historical OI chart">
            <HistoricalOIChart oiData={data.historicalOI} volumeData={data.historicalVolume} />
          </ErrorBoundary>
        </section>
      )}

      {data.spotVolumeHistory.length > 0 && (
        <section className="section-rule">
          <ErrorBoundary fallbackLabel="Perps dominance chart">
            <PerpsDominanceChart perpVolume={data.historicalVolume} spotVolume={data.spotVolumeHistory} />
          </ErrorBoundary>
        </section>
      )}

      {data.dexCexShareHistory.length > 0 && (
        <section className="section-rule">
          <ErrorBoundary fallbackLabel="DEX vs CEX share chart">
            <DexCexShareChart data={data.dexCexShareHistory} />
          </ErrorBoundary>
        </section>
      )}

      {data.basisMetrics.topAssets.length > 0 && (
        <section className="section-rule">
          <ErrorBoundary fallbackLabel="Basis monitor">
            <BasisMonitor basisMetrics={data.basisMetrics} />
          </ErrorBoundary>
        </section>
      )}
    </>
  )
}

function MarketStructureTab({ data }: { data: any }) {
  return (
    <>
      <section>
        <ErrorBoundary fallbackLabel="Token comparison">
          <TokenComparisonPanel
            tokenGroup={data.tokenGroup}
            noTokenGroup={data.noTokenGroup}
          />
        </ErrorBoundary>
      </section>

      <section className="section-rule">
        <ErrorBoundary fallbackLabel="Volume share chart">
          <VolumeShareChart
            data={data.volumeShareHistory}
            exchangeNames={data.topExchangeNames}
          />
        </ErrorBoundary>
      </section>

      <section className="section-rule">
        <ErrorBoundary fallbackLabel="Market concentration">
          <MarketConcentrationChart exchanges={data.enrichedExchanges} />
        </ErrorBoundary>
      </section>

      <section className="section-rule">
        <ErrorBoundary fallbackLabel="Open interest chart">
          <OpenInterestChart exchanges={data.enrichedExchanges} />
        </ErrorBoundary>
      </section>

      <section className="section-rule">
        <ErrorBoundary fallbackLabel="Volume growth chart">
          <VolumeGrowthChart exchanges={data.enrichedExchanges} />
        </ErrorBoundary>
      </section>

      <section className="section-rule">
        <ErrorBoundary fallbackLabel="Volume by chain">
          <VolumeByChainChart exchanges={data.enrichedExchanges} />
        </ErrorBoundary>
      </section>

    </>
  )
}

function FeesValuationTab({ data }: { data: any }) {
  return (
    <>
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ErrorBoundary fallbackLabel="OI vs Volume scatter">
            <TVLvsVolumeScatter exchanges={data.enrichedExchanges} />
          </ErrorBoundary>
          <ErrorBoundary fallbackLabel="Fee revenue chart">
            <FeeRevenueChart exchanges={data.enrichedExchanges} />
          </ErrorBoundary>
        </div>
      </section>

      <section className="section-rule">
        <ErrorBoundary fallbackLabel="Perp revenue breakdown">
          <PerpRevenueBreakdownChart data={data.perpFeeBreakdown} protocolNames={data.perpFeeBreakdownNames} />
        </ErrorBoundary>
      </section>

      <section className="section-rule">
        <ErrorBoundary fallbackLabel="Perps share of DeFi revenue">
          <PerpFeeShareHistoryChart data={data.perpFeeShareHistory} />
        </ErrorBoundary>
      </section>

      <section className="section-rule">
        <ErrorBoundary fallbackLabel="Capital efficiency">
          <CapitalEfficiencyChart exchanges={data.enrichedExchanges} />
        </ErrorBoundary>
      </section>

      <section className="section-rule">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ErrorBoundary fallbackLabel="Valuation multiples">
            <ValuationChart exchanges={data.enrichedExchanges} />
          </ErrorBoundary>
          <ErrorBoundary fallbackLabel="Growth momentum">
            <GrowthMomentumChart exchanges={data.enrichedExchanges} />
          </ErrorBoundary>
        </div>
      </section>

      <section className="section-rule">
        <ErrorBoundary fallbackLabel="Treasury overview">
          <TreasuryOverview treasuryData={data.treasuryData} />
        </ErrorBoundary>
      </section>

      <section className="section-rule">
        <ErrorBoundary fallbackLabel="Token unlock calendar">
          <TokenUnlockCalendar exchanges={data.enrichedExchanges} />
        </ErrorBoundary>
      </section>
    </>
  )
}

function RankingsTab({ data }: { data: any }) {
  return (
    <>
      <section>
        <ErrorBoundary fallbackLabel="Exchange rankings">
          <ExchangeRankingsTable exchanges={data.enrichedExchanges} />
        </ErrorBoundary>
      </section>

      <section className="section-rule">
        <ErrorBoundary fallbackLabel="Scatter plot explorer">
          <ScatterPlotGenerator exchanges={data.enrichedExchanges} />
        </ErrorBoundary>
      </section>

      <section className="section-rule">
        <DataMethodology />
      </section>
    </>
  )
}
