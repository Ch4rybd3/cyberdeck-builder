import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { ErrorBoundary } from '../ui/ErrorBoundary'
import { ModulesPanel } from './ModulesPanel'

import { useBuild } from '../store/buildStore'
import { Moon, NAV_ICON, Sun } from '../ui/icons'

const NAV: { heading: string; items: { to: string; label: string }[] }[] = [
  {
    heading: 'Design',
    items: [
      { to: '/', label: 'Workshop' },
      { to: '/power', label: 'Power' },
      { to: '/wiring', label: 'Wiring' },
    ],
  },
  {
    heading: 'Build',
    items: [
      { to: '/bom', label: 'Shopping list' },
      { to: '/print', label: 'Print' },
      { to: '/identity', label: 'DeckID' },
    ],
  },
  {
    heading: 'Share',
    items: [
      { to: '/library', label: 'Library' },
      { to: '/docs', label: 'Documentation' },
    ],
  },
]

export const THEMES = [
  { id: 'system', label: 'Follow the system' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'github-dark', label: 'GitHub dark' },
  { id: 'github-light', label: 'GitHub light' },
] as const

const THEME_KEY = 'cdb.theme'

export function useTheme(): [string, (t: string) => void] {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) ?? 'system'
    } catch {
      return 'system'
    }
  })
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'light' : 'dark') : theme
      window.dispatchEvent(new Event('cdb-theme'))
    }
    apply()
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Not persisted in private mode.
    }
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  return [theme, setTheme]
}

/** The resolved theme actually applied to the page (never "system"). */
export function useAppliedTheme(): string {
  const [t, setT] = useState(() => document.documentElement.dataset.theme ?? 'dark')
  useEffect(() => {
    const h = () => setT(document.documentElement.dataset.theme ?? 'dark')
    window.addEventListener('cdb-theme', h)
    return () => window.removeEventListener('cdb-theme', h)
  }, [])
  return t
}

export function Layout() {
  const [theme, setTheme] = useTheme()
  const applied = useAppliedTheme()
  const location = useLocation()
  const isLight = applied.includes('light')
  const build = useBuild(s => s.build)
  return (
    <div className="h-full flex">
      <nav className="w-52 shrink-0 bg-panel border-r border-hairline flex flex-col">
        <div className="px-3 py-3 border-b border-hairline flex items-center gap-2">
          <Logo />
          <div className="min-w-0 flex-1">
            <div className="text-ui font-semibold text-fg leading-tight">Cyberdeck Builder</div>
            <div className="text-label font-mono text-fg-muted">v{__APP_VERSION__}</div>
          </div>
          <button
            className="btn-ghost"
            title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
            aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
            onClick={() => setTheme(applied.startsWith('github') ? (isLight ? 'github-dark' : 'github-light') : isLight ? 'dark' : 'light')}
          >
            {isLight ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>
        <div className="px-3 py-2 border-b border-hairline">
          <div className="label mb-0.5">Open build</div>
          <div className="text-ui text-fg truncate" title={build.name}>{build.name}</div>
          <div className="text-label font-mono text-fg-muted uppercase">{build.kind} · DeckPort {build.deckport}</div>
        </div>
        <ModulesPanel />
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {NAV.map(section => (
            <div key={section.heading}>
              <p className="px-2 pt-4 pb-1 text-label font-semibold tracking-widest uppercase text-fg-secondary/40 select-none">{section.heading}</p>
              {section.items.map(item => {
                const Icon = NAV_ICON[item.to]
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2 py-1.5 rounded-control text-ui transition-colors ${isActive ? 'bg-accent/10 text-accent' : 'text-fg-secondary hover:text-fg hover:bg-fg/5'}`
                    }
                  >
                    {Icon && <Icon size={15} />}
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </div>
        <div className="px-3 py-2 border-t border-hairline">
          <label className="label">Theme</label>
          <select className="input" value={theme} onChange={e => setTheme(e.target.value)}>
            {THEMES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <p className="text-label text-fg-muted mt-2">Local-first: your builds stay in this browser.</p>
        </div>
      </nav>
      <main className="flex-1 min-w-0 min-h-0 bg-canvas">
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<div className="h-full flex items-center justify-center text-ui text-fg-muted font-mono">Loading…</div>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="2" fill="rgb(var(--surface-canvas))" stroke="rgb(var(--border-strong))" />
      <rect x="6" y="9" width="20" height="13" fill="none" stroke="rgb(var(--accent))" strokeWidth="2" />
      <path d="M10 26h12M16 22v4" stroke="rgb(var(--accent))" strokeWidth="2" />
      <circle cx="16" cy="15.5" r="2.2" fill="rgb(var(--accent))" />
    </svg>
  )
}
