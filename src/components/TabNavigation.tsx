import { useState, useEffect, useCallback } from 'react'

export interface Tab {
  id: string
  label: string
}

export function useTabNavigation(tabs: Tab[], defaultTab?: string) {
  const getTabFromHash = useCallback(() => {
    const hash = window.location.hash.replace('#', '')
    return tabs.find(t => t.id === hash)?.id || defaultTab || tabs[0]?.id || ''
  }, [tabs, defaultTab])

  const [activeTab, setActiveTab] = useState(getTabFromHash)

  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [getTabFromHash])

  const selectTab = useCallback((id: string) => {
    setActiveTab(id)
    window.location.hash = id
    window.scrollTo({ top: 0 })
  }, [])

  return { activeTab, selectTab }
}

interface TabNavigationProps {
  tabs: Tab[]
  activeTab: string
  onSelect: (id: string) => void
}

export function TabNavigation({ tabs, activeTab, onSelect }: TabNavigationProps) {
  return (
    <nav className="sticky top-0 z-30 bg-paper -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-rule">
      <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className={`
                px-5 py-2 font-sans text-sm font-semibold whitespace-nowrap transition-all duration-150 border
                ${isActive
                  ? 'bg-ink text-paper border-ink shadow-sm'
                  : 'bg-paper-alt text-ink-muted border-rule hover:text-ink hover:border-ink-muted hover:bg-paper-warm'
                }
              `}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
