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
    <nav className="sticky top-0 z-30 bg-paper border-b-2 border-ink -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
      <div className="flex gap-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`
              relative px-5 py-3 font-sans text-sm font-medium whitespace-nowrap transition-colors duration-100
              ${activeTab === tab.id
                ? 'text-ink'
                : 'text-ink-muted hover:text-ink-light'
              }
            `}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-ink" />
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}
