export interface CGDerivativesExchange {
  name: string
  id: string
  open_interest_btc: number
  trade_volume_24h_btc: string
  number_of_perpetual_pairs: number
  number_of_futures_pairs: number
  image: string
  year_established: number | null
  country: string | null
  description: string
  url: string
}

export interface CGDerivativeTicker {
  symbol: string
  base: string
  target: string
  trade_url: string
  contract_type: string
  last: number
  h24_percentage_change: number
  index: number | null
  index_basis_percentage: number
  bid_ask_spread: number
  funding_rate: number
  open_interest_usd: number
  h24_volume: number
  converted_volume: { usd: number }
  converted_last: { usd: number }
  last_traded_at: string
  expired_at: string | null
  market: string
}

export interface CGExchangeDetail extends CGDerivativesExchange {
  tickers: CGDerivativeTicker[]
}
