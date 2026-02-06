import React from 'react'

export function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-paper px-6 py-12 max-w-7xl mx-auto">
      <div className="loading-pulse h-10 w-96 mb-4" />
      <div className="loading-pulse h-5 w-64 mb-12" />
      <div className="grid grid-cols-4 gap-4 mb-12">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="loading-pulse h-28" />
        ))}
      </div>
      <div className="loading-pulse h-80 mb-12" />
      <div className="grid grid-cols-2 gap-6 mb-12">
        <div className="loading-pulse h-72" />
        <div className="loading-pulse h-72" />
      </div>
      <div className="loading-pulse h-96 mb-12" />
      <div className="grid grid-cols-2 gap-6">
        <div className="loading-pulse h-72" />
        <div className="loading-pulse h-72" />
      </div>
    </div>
  )
}

export function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="text-center max-w-md">
        <h2 className="font-serif text-2xl font-bold mb-4">
          Data Unavailable
        </h2>
        <p className="text-ink-muted mb-6">{message}</p>
        <button
          onClick={() => window.location.reload()}
          className="border-2 border-ink px-6 py-2 font-sans text-sm font-semibold hover:bg-ink hover:text-paper transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
