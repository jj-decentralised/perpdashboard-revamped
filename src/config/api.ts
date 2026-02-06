const geckoKey = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined

// DefiLlama overview/summary/fees endpoints are free and only available on api.llama.fi
// The pro-api.llama.fi domain does NOT serve /overview/* or /summary/* routes (returns 404)
export const LLAMA_BASE = 'https://api.llama.fi'

export const GECKO_BASE = geckoKey
  ? 'https://pro-api.coingecko.com/api/v3'
  : 'https://api.coingecko.com/api/v3'

export function geckoHeaders(): HeadersInit {
  if (geckoKey) {
    return { 'x-cg-pro-api-key': geckoKey }
  }
  return {}
}
