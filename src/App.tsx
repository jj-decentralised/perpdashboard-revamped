import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { LoadingSkeleton } from './components/LoadingSkeleton'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ExchangeProfilePage = lazy(() => import('./pages/ExchangeProfilePage'))

export default function App() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/exchange/:slug" element={<ExchangeProfilePage />} />
      </Routes>
    </Suspense>
  )
}
