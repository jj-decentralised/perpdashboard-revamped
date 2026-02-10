import type { HistoricalDataPoint, EnrichedExchange } from './index'
import type { CGExchangeTicker, CGExchangeDetail } from './coingecko'

export interface DerivativesSummary {
  id: string
  name: string
  url: string
  description: string
  logo: string
  gecko_id: string | null
  cmcId: string | null
  chains: string[]
  category: string
  twitter: string | null
  github: string[] | null
  forkedFrom: string[] | null
  methodology: Record<string, string>
  tokenRights?: string
  totalDataChart: [number, number][]
  totalDataChartBreakdown?: Record<string, Record<string, number>>[]
  childProtocols?: string[]
}

export interface TokenInfo {
  symbol: string
  name: string
  currentPrice: number
  marketCap: number
  fdv: number
  circulatingSupply: number
  totalSupply: number
  maxSupply: number | null
  priceChange24h: number
  priceChange7d: number
  priceChange30d: number
  ath: number
  athDate: string
  atl: number
  atlDate: string
}

export interface HistoricalPEPoint {
  date: number
  pe: number | null
  ps: number | null
  price: number
  mcap: number
}

export interface QuarterlyData {
  quarter: string
  totalVolume: number
  avgDailyVolume: number
  totalFees: number
  estimatedRevenue: number
  peakDailyVolume: number
  growthVsLast: number | null
}

export interface TreasuryInfo {
  totalUsd: number
  ownTokenUsd: number
  stablecoinsUsd: number
  majorsUsd: number
  othersUsd: number
}

export interface ComparableExchange {
  name: string
  slug: string
  volume24h: number
  openInterest: number
  chains: string[]
  hasToken: boolean
  tokenSymbol: string | null
  mcap: number | null
  peRatio: number | null
  psRatio: number | null
  change1d: number | null
  matchReason: string
}

export interface HoldersRevenueData {
  daily: number | null
  total30d: number | null
  history: HistoricalDataPoint[]
}

export interface MarketSharePoint {
  date: number
  marketPct: number
  hlPct: number | null
}

export interface BuilderVolumeData {
  data: Array<{ date: number; [builder: string]: number }>
  builders: string[]
}

export interface ExchangeProfileData {
  summary: DerivativesSummary | null
  historicalVolume: HistoricalDataPoint[]
  tickers: CGExchangeTicker[]
  exchange: CGExchangeDetail | null
  // Enriched fields
  tokenInfo: TokenInfo | null
  priceHistory: [number, number][]
  mcapHistory: [number, number][]
  historicalPE: HistoricalPEPoint[]
  quarterlyData: QuarterlyData[]
  treasury: TreasuryInfo | null
  comparables: ComparableExchange[]
  feeHistory: HistoricalDataPoint[]
  revenueHistory: HistoricalDataPoint[]
  btcPrice: number
  holdersRevenue: HoldersRevenueData | null
  marketShareHistory: MarketSharePoint[]
  builderVolume: BuilderVolumeData | null
}
