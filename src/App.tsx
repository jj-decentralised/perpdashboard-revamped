import { Routes, Route, Link } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { LoadingSkeleton } from './components/LoadingSkeleton'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ExchangeProfilePage = lazy(() => import('./pages/ExchangeProfilePage'))
const ChainBreakdownPage = lazy(() => import('./pages/ChainBreakdownPage'))

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="text-center max-w-md">
        <h2 className="font-serif text-4xl font-bold mb-2">404</h2>
        <p className="font-serif text-xl text-ink-light mb-4">Page Not Found</p>
        <p className="text-ink-muted mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="border-2 border-ink px-6 py-2 font-sans text-sm font-semibold hover:bg-ink hover:text-paper transition-colors inline-block">
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/exchange/:slug" element={<ExchangeProfilePage />} />
        <Route path="/chains" element={<ChainBreakdownPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
