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

// From /derivatives endpoint (dashboard-level tickers)
export interface CGDerivativeTicker {
  market: string             // e.g. "Binance (Futures)"
  symbol: string             // e.g. "BTCUSDT"
  index_id: string           // e.g. "BTC"
  price: string | number
  price_percentage_change_24h: number
  contract_type: string      // "perpetual" | "futures"
  index: number | null
  basis: number
  spread: number
  funding_rate: number       // already a percentage: 0.01 means 0.01%
  open_interest: number      // USD value
  volume_24h: number
  last_traded_at: number
  expired_at: string | null
}

// From /derivatives/exchanges/{id}?include_tickers=all (profile-level tickers)
export interface CGExchangeTicker {
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
}

export interface CGExchangeDetail extends CGDerivativesExchange {
  tickers: CGExchangeTicker[]
}
