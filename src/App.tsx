import { lazy, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'

import { Layout } from './layout/Layout'
import { WorkshopPage } from './pages/workshop/WorkshopPage'
import { useBuild } from './store/buildStore'
import { useGeometrySync } from './store/geometryStore'

// The Workshop is the landing page; everything else loads on first visit.
const PowerPage = lazy(() => import('./pages/PowerPage').then(m => ({ default: m.PowerPage })))
const WiringPage = lazy(() => import('./pages/WiringPage').then(m => ({ default: m.WiringPage })))
const BomPage = lazy(() => import('./pages/BomPage').then(m => ({ default: m.BomPage })))
const PrintPage = lazy(() => import('./pages/PrintPage').then(m => ({ default: m.PrintPage })))
const IdentityPage = lazy(() => import('./pages/IdentityPage').then(m => ({ default: m.IdentityPage })))
const LibraryPage = lazy(() => import('./pages/LibraryPage').then(m => ({ default: m.LibraryPage })))
const ImportPage = lazy(() => import('./pages/ImportPage').then(m => ({ default: m.ImportPage })))
const AssemblyPage = lazy(() => import('./pages/AssemblyPage').then(m => ({ default: m.AssemblyPage })))
const DocsPage = lazy(() => import('./pages/DocsPage').then(m => ({ default: m.DocsPage })))

function Pages() {
  return (
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<WorkshopPage />} />
            <Route path="/power" element={<PowerPage />} />
            <Route path="/wiring" element={<WiringPage />} />
            <Route path="/bom" element={<BomPage />} />
            <Route path="/print" element={<PrintPage />} />
            <Route path="/assembly" element={<AssemblyPage />} />
            <Route path="/identity" element={<IdentityPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/docs/:slug" element={<DocsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
  )
}

/**
 * HashRouter, not BrowserRouter: GitHub Pages serves static files and cannot
 * rewrite /power to index.html. Hash routes work on any static host.
 */
export function App() {
  const ready = useBuild(s => s.ready)
  const init = useBuild(s => s.init)
  useEffect(() => {
    init()
  }, [init])
  useGeometrySync()

  if (!ready) return <div className="h-full flex items-center justify-center text-ui text-fg-muted font-mono">Loading library…</div>

  return (
    <HashRouter>
      <Pages />
    </HashRouter>
  )
}
