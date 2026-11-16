import React from 'react'
import ReactDOM from 'react-dom/client'

import { App } from './App'
import { useBuild } from './store/buildStore'
import { useGeometry } from './store/geometryStore'
import { useView } from './store/viewStore'
import './index.css'

// Development hook for scripts/screenshots.mjs. Not present in production builds.
if (import.meta.env.DEV) Object.assign(window, { __cdb: { build: useBuild, view: useView, geometry: useGeometry } })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
