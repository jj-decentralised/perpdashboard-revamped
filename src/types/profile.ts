import type { HistoricalDataPoint } from './index'
import type { CGDerivativeTicker, CGExchangeDetail } from './coingecko'

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

export interface ExchangeProfileData {
  summary: DerivativesSummary | null
  historicalVolume: HistoricalDataPoint[]
  tickers: CGDerivativeTicker[]
  exchange: CGExchangeDetail | null
}
