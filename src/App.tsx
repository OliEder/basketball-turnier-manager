import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import TeamsPage from '@/pages/TeamsPage'
import ConfigPage from '@/pages/ConfigPage'
import SchedulePage from '@/pages/SchedulePage'
import ExportPage from '@/pages/ExportPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/teams" replace />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="config" element={<ConfigPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="export" element={<ExportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
