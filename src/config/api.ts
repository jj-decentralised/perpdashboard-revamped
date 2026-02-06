const llamaKey = import.meta.env.VITE_DEFILLAMA_API_KEY as string | undefined
const geckoKey = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined

export const LLAMA_BASE = llamaKey
  ? `https://pro-api.llama.fi/${llamaKey}`
  : 'https://api.llama.fi'

export const GECKO_BASE = geckoKey
  ? 'https://pro-api.coingecko.com/api/v3'
  : 'https://api.coingecko.com/api/v3'

export function geckoHeaders(): HeadersInit {
  if (geckoKey) {
    return { 'x-cg-pro-api-key': geckoKey }
  }
  return {}
}
