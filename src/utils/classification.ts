/**
 * CeFi vs DeFi classification for perpetual exchange venues.
 *
 * The yields/perps endpoint returns both CeFi (Binance, OKX...) and DeFi (GMX, Hyperliquid...)
 * entries. This module provides a configurable mapping to classify them.
 *
 * Default: anything NOT in the DEFI_PROTOCOLS set is classified as CeFi.
 */

export type VenueType = 'defi' | 'cefi'

/**
 * Known DeFi perpetual protocols.
 * Lowercase names/slugs as they appear in the `marketplace` field of yields/perps
 * or in the DefiLlama derivatives overview.
 */
const DEFI_PROTOCOLS = new Set([
  // Major DeFi perp DEXs
  'gmx', 'gmx-v2', 'gmx v2',
  'hyperliquid',
  'dydx', 'dydx-v4', 'dydx v4', 'dydx v3',
  'vertex', 'vertex protocol',
  'kwenta',
  'perpetual-protocol', 'perpetual protocol', 'perp v2',
  'synthetix', 'synthetix-v3', 'synthetix v3',
  'gains-network', 'gains network', 'gains', 'gtrade',
  'level-finance', 'level finance',
  'apollox', 'apollox-dex',
  'mux-protocol', 'mux protocol', 'mux',
  'hmx',
  'aevo',
  'drift', 'drift-protocol', 'drift protocol',
  'jupiter-perps', 'jupiter perps', 'jupiter',
  'flash-trade', 'flash trade',
  'rabbitx', 'rabbit x',
  'vela-exchange', 'vela exchange', 'vela',
  'equation', 'equation-v2',
  'kiloex', 'kilo exchange',
  'ostium', 'ostium-labs',
  'bluefin',
  'orderly-network', 'orderly network', 'orderly',
  'paradex',
  'zeta', 'zeta-markets', 'zeta markets',
  'logx',
  'mango-markets', 'mango markets', 'mango',
  'basemax',
  'bsx',
  'morphex',
  'mycelium',
  'fulcrom', 'fulcrom-finance',
  'el-dorado-exchange',
  'holdstation',
  'tigris', 'tigris-trade',
  'pika-protocol', 'pika protocol',
  'cap-finance', 'cap finance',
  'rage-trade', 'rage trade',
  'polynomial', 'polynomial-trade',
  'cadence-protocol',
  'thena-perps', 'thena',
  'palmswap',
  'intent-x', 'intentx', 'intent x',
  'based-markets',
  'unidex',
  'lighter',
  'symmio',
  'contango',
  'hegic',
  'predy', 'predy-finance',
  'synfutures', 'synfutures-v3',
  'pancakeswap-perps',
  'apex-omni', 'apex protocol', 'apex',
  'adrena', 'adrena-protocol',
  'injective-perps', 'injective',
  'sei-perps',
  'sodex',
  'dymension',
  'rollup-finance', 'rollup.finance',
  'foxify',
  'grizzly-trade',
  'dpx', 'dopex',
  'lyra', 'lyra-finance',
  'opyn',
  'ribbon-finance', 'ribbon',
  'buffer-finance', 'buffer',
  'y2k-finance',
  'satori',
  'filament-finance', 'filament',
  'eddy-finance',
  'merkle-trade', 'merkle',
  'avantis',
  'perennial', 'perennial-v2',
  'stork',
  'nftperp',
  'hubble-exchange', 'hubble',
  'tribe3',
  'grizzly-fi',
  'lexer-markets',
  'sudofinance',
  'tlx-finance',
  'pinnako',
  'ktx-finance', 'ktx',
  'rollie-finance',
  'fenix-finance',
  'swapbased',
  'urdex',
  // Newer DeFi perp protocols
  'aster', 'aster-perps',
  'edgex', 'edgex-perps',
  'grvt', 'grvt-perps',
  'pacifica',
  'variational',
  'extended',
  'standx', 'standx-perps',
  'nado', 'nado-perps',
  'myx-finance', 'myx',
  'privex',
  'reya', 'reya-perps',
  'elfi-protocol', 'elfi',
  'dipcoin', 'dipcoin-perps',
  'aark-digital', 'aark',
  'rho-x',
  'sunx',
  'satori-perp',
  'gmtrade',
  'evedex',
  'speedtrading',
  'tread.fi-perps', 'tread.fi',
  'boros',
  'ethereal-dex', 'ethereal',
  'storm-trade', 'storm',
  'woofi-pro-perps', 'woofi',
  'raydium-perps',
  'helix-perp', 'helix',
  '01-exchange',
  'hibachi',
  'citrex-markets', 'citrex',
  'ln-exchange-perps',
  'gate-perp-dex',
])

/**
 * Known CeFi exchanges (for funding rate data classification).
 * These appear as `marketplace` values in the yields/perps endpoint.
 */
const CEFI_EXCHANGES = new Set([
  'binance', 'binance-futures',
  'okx', 'okex',
  'bybit',
  'bitmex', 'bitmex-futures',
  'bitget',
  'ftx',
  'mexc', 'mexc-futures',
  'kraken', 'kraken-futures',
  'kucoin', 'kucoin-futures',
  'huobi', 'htx', 'huobi-futures',
  'gate', 'gateio', 'gate.io', 'gate-futures',
  'coinbase', 'coinbase-international',
  'deribit',
  'phemex',
  'whitebit',
  'bitfinex',
  'bitstamp',
  'crypto.com', 'cryptocom',
  'poloniex',
  'xt', 'xt.com',
  'lbank',
  'btcex',
  'bingx',
  'coinex',
  'deepcoin',
  'toobit',
  'orangex',
  'woo', 'woo-x', 'woox',
  // Additional CeFi exchanges
  'backpack-exchange', 'backpack',
  'bitmart',
  'btse',
  'ascendex',
  'blofin',
  'hashkey',
  'coinw',
  'bitrue',
  'pionex',
])

/**
 * Classify a venue name as DeFi or CeFi.
 * DeFi is checked first (whitelist); if not found, CeFi list is checked;
 * if neither matches, defaults to CeFi (most unclassified venues are CeFi).
 */
export function classifyVenue(name: string): VenueType {
  const lower = name.toLowerCase().trim()

  // Check DeFi list first (including partial matches)
  if (DEFI_PROTOCOLS.has(lower)) return 'defi'

  // Check with common suffix removal
  const stripped = lower
    .replace(/[- ](v\d+|perps?|perpetuals?|protocol|finance|exchange|dex|swap|derivatives?|trade|pro|omni|markets?|labs|futures?)$/g, '')
    .trim()
  if (stripped && DEFI_PROTOCOLS.has(stripped)) return 'defi'

  // Explicit CeFi match
  if (CEFI_EXCHANGES.has(lower)) return 'cefi'
  const strippedCefi = lower.replace(/[- ](futures?|perps?|international)$/g, '').trim()
  if (strippedCefi && CEFI_EXCHANGES.has(strippedCefi)) return 'cefi'

  // Default: CeFi for unknown venues (most unclassified data is CeFi)
  return 'cefi'
}

/**
 * Classify a DefiLlama protocol as DeFi or CeFi.
 * DefiLlama's /overview/derivatives almost exclusively tracks DeFi protocols,
 * so we default to 'defi' for those, unlike funding rate data which mixes both.
 */
export function classifyProtocol(slug: string, name: string, chains: string[]): VenueType {
  const lower = (slug || name || '').toLowerCase().trim()

  // If explicitly in CeFi set, mark as CeFi
  if (CEFI_EXCHANGES.has(lower)) return 'cefi'
  const stripped = lower.replace(/[- ](futures?|perps?|international)$/g, '').trim()
  if (stripped && CEFI_EXCHANGES.has(stripped)) return 'cefi'

  // Check DeFi list explicitly (handles edge cases like Off Chain protocols we know are DeFi)
  if (DEFI_PROTOCOLS.has(lower)) return 'defi'
  const strippedDefi = lower
    .replace(/[- ](v\d+|perps?|perpetuals?|protocol|finance|exchange|dex|swap|derivatives?|trade|pro|omni|markets?|labs|futures?|interface|digital|terminal)$/g, '')
    .trim()
  if (strippedDefi && DEFI_PROTOCOLS.has(strippedDefi)) return 'defi'

  // If only chain is "Off Chain", treat as CeFi unless explicitly matched above
  const realChains = (chains || []).filter(c => c !== 'Off Chain')
  if (chains && chains.length > 0 && realChains.length === 0) return 'cefi'

  // DefiLlama derivatives protocols are on-chain — default to DeFi
  if (chains && chains.length > 0) return 'defi'

  return 'defi'
}
