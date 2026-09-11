import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import TeamsPage from '@/pages/TeamsPage'
import ConfigPage from '@/pages/ConfigPage'
import SchedulePage from '@/pages/SchedulePage'
import ExportPage from '@/pages/ExportPage'
import SwissResultsPage from '@/pages/SwissResultsPage'
import SwissOverviewPage from '@/pages/SwissOverviewPage'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/teams" replace />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="config" element={<ConfigPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="swiss-results" element={<SwissResultsPage />} />
          <Route path="swiss-overview" element={<SwissOverviewPage />} />
          <Route path="export" element={<ExportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
