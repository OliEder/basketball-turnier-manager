import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import TeamsPage from '@/pages/TeamsPage'
import ConfigPage from '@/pages/ConfigPage'
import SchedulePage from '@/pages/SchedulePage'
import ExportPage from '@/pages/ExportPage'
import SwissResultsPage from '@/pages/SwissResultsPage'
import SwissOverviewPage from '@/pages/SwissOverviewPage'
import GroupOverviewPage from '@/pages/GroupOverviewPage'
import GroupResultsPage from '@/pages/GroupResultsPage'
import FinalsResultsPage from '@/pages/FinalsResultsPage'
import FinalStandingsPage from '@/pages/FinalStandingsPage'
import ManualPage from '@/pages/ManualPage'

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
          <Route path="group-overview" element={<GroupOverviewPage />} />
          <Route path="group-results" element={<GroupResultsPage />} />
          <Route path="finals-results" element={<FinalsResultsPage />} />
          <Route path="final-standings" element={<FinalStandingsPage />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="anleitung" element={<ManualPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
