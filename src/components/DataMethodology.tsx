import { useState } from 'react'
import { COLORS } from '../utils/chartTheme'

export function DataMethodology() {
  const [expanded, setExpanded] = useState(false)

  return (
    <section
      className="border-t border-rule mt-8 pt-4"
      style={{ color: COLORS.ink }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 font-serif text-sm text-ink-muted hover:text-ink transition-colors duration-150 cursor-pointer bg-transparent border-none p-0"
        type="button"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="M4.5 2.5L8 6L4.5 9.5" />
        </svg>
        Data Methodology {!expanded && (
          <span className="font-sans text-xs text-ink-muted">&mdash; Click to expand</span>
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-5 max-w-3xl">
          {/* Data Sources */}
          <div>
            <h4
              className="font-serif text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: COLORS.ink }}
            >
              Data Sources
            </h4>
            <ul className="font-sans text-xs text-ink-light leading-relaxed space-y-1 pl-4 list-disc">
              <li>
                <span className="font-medium">Volume, OI, fees:</span>{' '}
                DefiLlama API (
                <code className="text-[11px] px-1 py-0.5 rounded" style={{ backgroundColor: COLORS.paperAlt, color: COLORS.inkLight }}>
                  /overview/derivatives
                </code>,{' '}
                <code className="text-[11px] px-1 py-0.5 rounded" style={{ backgroundColor: COLORS.paperAlt, color: COLORS.inkLight }}>
                  /overview/open-interest
                </code>,{' '}
                <code className="text-[11px] px-1 py-0.5 rounded" style={{ backgroundColor: COLORS.paperAlt, color: COLORS.inkLight }}>
                  /summary/fees/&#123;protocol&#125;
                </code>)
              </li>
              <li>
                <span className="font-medium">Market data:</span>{' '}
                CoinGecko API (exchange details, token prices, market cap)
              </li>
              <li>
                <span className="font-medium">Funding rates:</span>{' '}
                DeFiLlama Yields (
                <code className="text-[11px] px-1 py-0.5 rounded" style={{ backgroundColor: COLORS.paperAlt, color: COLORS.inkLight }}>
                  yields.llama.fi/perps
                </code>)
              </li>
              <li>
                <span className="font-medium">Bridge flows:</span>{' '}
                DeFiLlama Bridges (
                <code className="text-[11px] px-1 py-0.5 rounded" style={{ backgroundColor: COLORS.paperAlt, color: COLORS.inkLight }}>
                  bridges.llama.fi/bridgevolume/&#123;chain&#125;
                </code>)
              </li>
              <li>
                <span className="font-medium">Token emissions:</span>{' '}
                DeFiLlama (
                <code className="text-[11px] px-1 py-0.5 rounded" style={{ backgroundColor: COLORS.paperAlt, color: COLORS.inkLight }}>
                  api.llama.fi/emissions
                </code>)
              </li>
              <li>
                <span className="font-medium">Stablecoins:</span>{' '}
                DeFiLlama (
                <code className="text-[11px] px-1 py-0.5 rounded" style={{ backgroundColor: COLORS.paperAlt, color: COLORS.inkLight }}>
                  stablecoins.llama.fi
                </code>)
              </li>
            </ul>
          </div>

          {/* Calculation Methodology */}
          <div>
            <h4
              className="font-serif text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: COLORS.ink }}
            >
              Calculation Methodology
            </h4>
            <dl className="font-sans text-xs text-ink-light leading-relaxed space-y-1.5">
              <div>
                <dt className="inline font-medium" style={{ color: COLORS.inkLight }}>P/E Ratio:</dt>{' '}
                <dd className="inline">
                  Circulating Market Cap / Annualised Revenue (24h revenue &times; 365).
                  Revenue estimated as fees &times; 0.3 assumed take rate when not provided.
                </dd>
              </div>
              <div>
                <dt className="inline font-medium" style={{ color: COLORS.inkLight }}>P/S Ratio:</dt>{' '}
                <dd className="inline">
                  Circulating Market Cap / Annualised Fees (24h fees &times; 365).
                </dd>
              </div>
              <div>
                <dt className="inline font-medium" style={{ color: COLORS.inkLight }}>OI Turnover:</dt>{' '}
                <dd className="inline">
                  Daily Volume / Open Interest &mdash; measures position churn rate.
                </dd>
              </div>
              <div>
                <dt className="inline font-medium" style={{ color: COLORS.inkLight }}>Fee Yield:</dt>{' '}
                <dd className="inline">
                  Daily Fees / Open Interest &mdash; measures fee capture efficiency.
                </dd>
              </div>
              <div>
                <dt className="inline font-medium" style={{ color: COLORS.inkLight }}>Unlock Pressure:</dt>{' '}
                <dd className="inline">
                  (Daily token unlocks &times; 30) / Circulating supply &mdash; 30-day dilution proxy.
                </dd>
              </div>
              <div>
                <dt className="inline font-medium" style={{ color: COLORS.inkLight }}>Winsorized Mean:</dt>{' '}
                <dd className="inline">
                  Outlier-resistant average capping values at 1st/99th percentile.
                </dd>
              </div>
              <div>
                <dt className="inline font-medium" style={{ color: COLORS.inkLight }}>Funding Rate Dispersion:</dt>{' '}
                <dd className="inline">
                  Interquartile range (IQR) of all funding rates across exchanges.
                </dd>
              </div>
            </dl>
          </div>

          {/* Data Quality */}
          <div>
            <h4
              className="font-serif text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: COLORS.ink }}
            >
              Data Quality
            </h4>
            <ul className="font-sans text-xs text-ink-light leading-relaxed space-y-1 pl-4 list-disc">
              <li>
                <span className="font-medium">Volume threshold:</span>{' '}
                Growth metrics exclude exchanges with &lt; $10M daily volume.
              </li>
              <li>
                <span className="font-medium">Emerging exchanges:</span>{' '}
                $1M&ndash;$10M daily volume shown separately.
              </li>
              <li>
                Medians used instead of means for growth comparisons to reduce outlier impact.
              </li>
              <li>
                7-day rolling averages applied to fee/revenue history for smoothing.
              </li>
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
