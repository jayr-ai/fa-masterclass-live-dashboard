import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { NavShell } from './components/NavShell'
import { MasterclassPage } from './pages/MasterclassPage'
import { MarketingPage } from './pages/MarketingPage'
import { GranularViewPage } from './pages/GranularViewPage'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<NavShell />}>
          <Route index element={<Navigate to="/masterclass" replace />} />
          <Route path="/masterclass" element={<MasterclassPage />} />
          <Route path="/marketing" element={<MarketingPage />} />
          <Route path="/granular-view" element={<GranularViewPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
