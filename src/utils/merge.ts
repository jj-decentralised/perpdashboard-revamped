import type { CGDerivativesExchange } from '../types/coingecko'

const MANUAL_OVERRIDES: Record<string, string> = {
  'hyperliquid': 'hyperliquid_derivatives',
  'dydx': 'dydx_perpetual',
  'dydx-v4': 'dydx_perpetual',
  'gmx': 'gmx_perpetual',
  'gmx-v2': 'gmx_perpetual',
  'vertex-protocol': 'vertex_protocol_derivatives',
  'aevo': 'aevo',
  'drift-protocol': 'drift_protocol',
  'jupiter-perps': 'jupiter_perpetual',
  'kwenta': 'kwenta',
  'gains-network': 'gains_network_perpetual',
  'synthetix': 'synthetix_futures',
  'rabbitx': 'rabbitx',
  'bluefin': 'bluefin_derivatives',
  'paradex': 'paradex_derivatives',
  'mux-protocol': 'mux_protocol_perpetual',
  'kiloex': 'kiloex',
  'apollox': 'apollox_finance',
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(futures|derivatives|perps|perpetual|protocol|exchange|finance|dex)/g, '')
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
