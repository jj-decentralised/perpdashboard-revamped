export interface DexProtocol {
  defillamaId: string
  name: string
  displayName: string
  slug: string
  category: string
  logo: string
  chains: string[]
  total24h: number | null
  total48hto24h: number | null
  total7d: number | null
  total30d: number | null
  total1y: number | null
  totalAllTime: number | null
  change_1d: number | null
  change_7d: number | null
  change_1m: number | null
  change_7dover7d: number | null
  change_30dover30d: number | null
  methodology?: Record<string, string>
  parentProtocol?: string
  breakdown24h?: Record<string, Record<string, number>>
}

export interface ProtocolInfo {
  id: string
  name: string
  slug: string
  symbol: string
  gecko_id: string | null
  category: string
  chains: string[]
  tvl: number
  change_1d: number | null
  change_7d: number | null
  mcap: number | null
  address: string | null
  url: string
  description: string
  parentProtocol?: string
}

export interface EnrichedExchange extends DexProtocol {
  hasToken: boolean
  tokenSymbol: string | null
  geckoId: string | null
  tvl: number
  mcap: number | null
  chainCount: number
  volumeToTvl: number | null
  feeData?: FeeProtocol
}

export interface FeeProtocol {
  name: string
  slug: string
  total24h: number | null
  total7d: number | null
  total30d: number | null
  total1y: number | null
  totalAllTime: number | null
  change_1d: number | null
  change_7d: number | null
  change_1m: number | null
}

export interface HistoricalDataPoint {
  date: number
  value: number
}

export interface DexOverview {
  totalDataChart: [number, number][]
  total24h: number
  total48hto24h: number
  total7d: number
  total30d: number
  total1y: number
  totalAllTime: number
  change_1d: number
  change_7d: number
  change_1m: number
  protocols: DexProtocol[]
  allChains: string[]
}

export interface FeeOverview {
  protocols: FeeProtocol[]
  total24h: number
  total7d: number
  total30d: number
}

export interface TokenGroupStats {
  label: string
  count: number
  totalVolume24h: number
  totalVolume30d: number
  totalTvl: number
  totalMcap: number
  avgChange1d: number
  avgChange7d: number
  avgChange1m: number
  avgChainCount: number
  medianVolume24h: number
  totalFees24h: number
  avgVolumeToTvl: number
  exchanges: EnrichedExchange[]
}

export interface CoinGeckoMarketData {
  id: string
  symbol: string
  name: string
  current_price: number
  market_cap: number
  total_volume: number
  price_change_percentage_24h: number
  price_change_percentage_7d_in_currency: number
  price_change_percentage_30d_in_currency: number
  sparkline_in_7d?: { price: number[] }
}

export interface DashboardData {
  dexOverview: DexOverview
  protocols: ProtocolInfo[]
  feeOverview: FeeOverview
  enrichedExchanges: EnrichedExchange[]
  tokenGroup: TokenGroupStats
  noTokenGroup: TokenGroupStats
  historicalVolume: HistoricalDataPoint[]
  topTokenPrices: CoinGeckoMarketData[]
}
