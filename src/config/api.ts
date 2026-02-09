// In production, API calls go through the caching proxy server.
// In dev mode, Vite proxies /api/* to the server (see vite.config.ts).
// Falls back to direct API calls if VITE_DIRECT_API=true (for development without server).
const useDirectApi = import.meta.env.VITE_DIRECT_API === 'true'
const geckoKey = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined

export const LLAMA_BASE = useDirectApi
  ? 'https://api.llama.fi'
  : '/api/llama'

export const GECKO_BASE = useDirectApi
  ? (geckoKey ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3')
  : '/api/gecko'

export const YIELDS_BASE = useDirectApi
  ? 'https://yields.llama.fi'
  : '/api/yields'

export const EMISSIONS_BASE = useDirectApi
  ? 'https://api.llama.fi'
  : '/api/emissions'

export function geckoHeaders(): HeadersInit {
  // When using proxy, headers are added server-side
  if (!useDirectApi) return {}
  if (geckoKey) {
    return { 'x-cg-pro-api-key': geckoKey }
  }
  return {}
}
