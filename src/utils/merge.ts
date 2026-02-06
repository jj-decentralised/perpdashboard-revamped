import type { CGDerivativesExchange } from '../types/coingecko'

const MANUAL_OVERRIDES: Record<string, string> = {
  // Major exchanges
  'hyperliquid': 'hyperliquid',
  'dydx': 'dydx_chain',
  'dydx-v4': 'dydx_chain',
  'dydx-v3': 'dydx_chain',
  'gmx': 'gmx_perpetual',
  'gmx-v2': 'gmx-perpetuals-v2-solana',
  'gmx-v2-swap': 'gmx_perpetual',
  'vertex-protocol': 'vertex_protocol_derivatives',
  'aevo': 'aevo',
  'drift-protocol': 'drift_protocol',
  'jupiter-perps': 'jupiter_perpetual',
  'kwenta': 'kwenta',
  'gains-network': 'gtrade-arbitrum',
  'synthetix': 'synthetix_futures',
  'rabbitx': 'rabbitx',
  'bluefin': 'bluefin_derivatives',
  'paradex': 'paradex',
  'mux-protocol': 'mux_protocol_perpetual',
  'kiloex': 'kiloex-bsc',
  'apollox': 'apollox_finance',
  // Additional exchanges
  'myx-finance': 'myx-bsc',
  'flash-trade': 'flash-trade',
  'flashtrade': 'flash-trade',
  'merkle-trade': 'merkle_trade',
  'polynomial-trade': 'polynomial-trade',
  'polynomial': 'polynomial-trade',
  'apex-protocol': 'apex-omni',
  'apex': 'apex-omni',
  'orderly-network': 'orderly_network_derivatives_evm',
  'orderly': 'orderly_network_derivatives_evm',
  'vest-exchange': 'vest-exchange-futures',
  'demex': 'demex_derivatives',
  'levana-perps': 'levana-perps-osmosis',
  'levana': 'levana-perps-osmosis',
  'injective-perps': 'injective_futures',
  'd8x': 'd8x-futures',
  'navigator': 'navigator',
  'backpack': 'backpack-futures',
  'ostium': 'ostium',
  'edgex': 'edgex',
  'lighter': 'lighter',
  'derive': 'derive-futures',
  'coinbase-international': 'coinbase_international_derivatives',
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(futures|derivatives|perps?|perpetuals?|protocol|exchange|finance|dex|swap|trade|network|bridge)/g, '')
    .trim()
}

export interface CGExchangeMap {
  byId: Map<string, CGDerivativesExchange>
  byNormalizedName: Map<string, CGDerivativesExchange>
}

export function buildCGExchangeMap(exchanges: CGDerivativesExchange[]): CGExchangeMap {
  const byId = new Map<string, CGDerivativesExchange>()
  const byNormalizedName = new Map<string, CGDerivativesExchange>()

  for (const ex of exchanges) {
    byId.set(ex.id.toLowerCase(), ex)
    byNormalizedName.set(normalize(ex.name), ex)
    byNormalizedName.set(normalize(ex.id), ex)
  }

  return { byId, byNormalizedName }
}

export function matchCGExchange(
  llamaSlug: string,
  llamaName: string,
  cgMap: CGExchangeMap
): CGDerivativesExchange | null {
  const slugLower = llamaSlug?.toLowerCase() || ''
  const override = MANUAL_OVERRIDES[slugLower]
  if (override) {
    const matched = cgMap.byId.get(override)
    if (matched) return matched
  }

  const bySlug = cgMap.byId.get(slugLower)
  if (bySlug) return bySlug

  const normalizedName = normalize(llamaName)
  const byName = cgMap.byNormalizedName.get(normalizedName)
  if (byName) return byName

  const normalizedSlug = normalize(llamaSlug)
  const byNormSlug = cgMap.byNormalizedName.get(normalizedSlug)
  if (byNormSlug) return byNormSlug

  return null
}
