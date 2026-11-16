/**
 * Design-system primitives, ported from Remora (frontend/src/ui and
 * frontend/src/components/ui): square hairline panels, mono labels, one 2 px
 * control radius, severity badges read as data.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { Severity } from '../domain/constraints'
import type { LucideIcon } from './icons'
import { ArrowLeft, NAV_ICON } from './icons'

// ── PageShell ────────────────────────────────────────────────────────────────

interface PageShellProps {
  route: string
  title: ReactNode
  backTo?: string
  subtitle?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  toolbar?: ReactNode
  asideLeft?: ReactNode
  asideRight?: ReactNode
  fullHeight?: boolean
  children: ReactNode
}

export function PageShell({ route, title, backTo, subtitle, meta, actions, toolbar, asideLeft, asideRight, fullHeight = false, children }: PageShellProps) {
  const Icon = NAV_ICON[route]
  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <header className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 border-b border-hairline">
        {backTo && (
          <Link to={backTo} aria-label="Back" className="shrink-0 text-fg-muted hover:text-fg transition-colors">
            <ArrowLeft size={15} />
          </Link>
        )}
        {Icon && <Icon size={15} className="shrink-0 text-accent" />}
        <h1 className="text-title font-semibold text-fg min-w-0 truncate">{title}</h1>
        {meta && <span className="text-label font-mono text-fg-muted shrink-0">{meta}</span>}
        {subtitle && <span className="text-ui text-fg-muted truncate min-w-0">{subtitle}</span>}
        <div className="flex-1 min-w-0" />
        {actions && <div data-print="hide" className="flex items-center gap-1 shrink-0">{actions}</div>}
      </header>
      {toolbar && <div data-print="hide" className="shrink-0 flex items-center gap-2 px-4 py-1.5 border-b border-hairline flex-wrap">{toolbar}</div>}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {asideLeft}
        {fullHeight ? (
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden relative">{children}</div>
        ) : (
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4">{children}</div>
        )}
        {asideRight}
      </div>
    </div>
  )
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function Panel({ children, className = '', bare = false }: { children: ReactNode; className?: string; bare?: boolean }) {
  return <div className={`bg-panel ${bare ? '' : 'border border-hairline'} ${className}`}>{children}</div>
}

export function PanelHeader({ title, numeral, meta, actions }: { title: ReactNode; numeral?: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2.5 px-4 py-2.5 border-b border-hairline">
      {numeral && <span className="numeral shrink-0">{numeral}</span>}
      <h2 className="text-title font-semibold text-fg truncate">{title}</h2>
      {meta && <span className="text-label font-mono text-fg-muted shrink-0">{meta}</span>}
      {actions && <div className="ml-auto shrink-0">{actions}</div>}
    </div>
  )
}

/** A side rail: fixed width, hairline on the inner edge, scrolls on its own. */
export function Aside({ side, children, width = 'w-80' }: { side: 'left' | 'right'; children: ReactNode; width?: string }) {
  return (
    <aside className={`${width} shrink-0 min-h-0 overflow-y-auto bg-panel ${side === 'left' ? 'border-r' : 'border-l'} border-hairline`}>
      {children}
    </aside>
  )
}

/** A titled block inside a rail, separated by a rule rather than a nested box. */
export function Section({ title, numeral, actions, children, className = '' }: { title: ReactNode; numeral?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rule first:border-t-0 px-3 py-3 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        {numeral && <span className="numeral">{numeral}</span>}
        <h3 className="label mb-0">{title}</h3>
        {actions && <div className="ml-auto flex items-center gap-0.5">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

// ── Badges ───────────────────────────────────────────────────────────────────

const severityColors: Record<Severity, string> = {
  critical: 'bg-severity-critical/15 text-severity-critical border-severity-critical/30',
  high: 'bg-severity-high/15 text-severity-high border-severity-high/30',
  medium: 'bg-severity-medium/15 text-severity-medium border-severity-medium/30',
  low: 'bg-severity-low/15 text-severity-low border-severity-low/30',
  info: 'bg-fg-secondary/10 text-fg-secondary border-fg-secondary/20',
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`text-label px-1.5 py-0.5 rounded-control border font-mono uppercase tracking-wider shrink-0 ${severityColors[severity]}`}>{severity}</span>
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' }) {
  const cls = tone === 'accent' ? 'bg-accent/15 text-accent border-accent/30' : 'bg-fg/5 text-fg-secondary border-hairline'
  return <span className={`text-label px-2 py-0.5 rounded-control border font-mono ${cls}`}>{children}</span>
}

export function DataDot({ slot }: { slot: number }) {
  return <span className="inline-block w-2 h-2 rounded-pill shrink-0" style={{ background: `rgb(var(--data-${slot}))` }} />
}

// ── Stat tile ────────────────────────────────────────────────────────────────

export function StatTile({ label, value, unit, hint, tone }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; tone?: Severity | 'accent' }) {
  const color = tone === 'accent' ? 'text-accent' : tone ? `text-severity-${tone}` : 'text-fg'
  return (
    <div className="panel px-3 py-2.5 min-w-0">
      <div className="label">{label}</div>
      <div className={`font-mono text-title tabular-nums ${color}`}>
        {value}
        {unit && <span className="text-ui text-fg-muted ml-1">{unit}</span>}
      </div>
      {hint && <div className="text-label text-fg-muted mt-0.5">{hint}</div>}
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, title, body, action }: { icon?: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-6">
      {Icon && <Icon size={22} className="text-fg-muted" />}
      <p className="text-ui font-medium text-fg">{title}</p>
      {body && <p className="text-ui text-fg-muted max-w-sm">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ── Form fields ──────────────────────────────────────────────────────────────

export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-label text-fg-muted mt-0.5">{hint}</span>}
    </label>
  )
}

/**
 * Numeric input that keeps the user's text while typing ("1." or "-") and
 * commits a number only when it parses.
 */
export function NumberInput({ value, onChange, step = 1, min, max, unit, className = '' }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string; className?: string }) {
  const [text, setText] = useState(String(round(value)))
  useEffect(() => {
    if (Number(text) !== value) setText(String(round(value)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className={`relative ${className}`}>
      <input
        type="number"
        className="input font-mono tabular-nums pr-8"
        value={text}
        step={step}
        min={min}
        max={max}
        onChange={e => {
          setText(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value !== '' && Number.isFinite(n)) onChange(clamp(n, min, max))
        }}
        onBlur={() => setText(String(round(value)))}
      />
      {unit && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-label font-mono text-fg-muted pointer-events-none">{unit}</span>}
    </div>
  )
}

export function NumberField(props: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string; hint?: ReactNode }) {
  const { label, hint, ...rest } = props
  return (
    <Field label={label} hint={hint}>
      <NumberInput {...rest} />
    </Field>
  )
}

export function SelectField<T extends string>({ label, value, options, onChange, hint }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; hint?: ReactNode }) {
  return (
    <Field label={label} hint={hint}>
      <select className="input" value={value} onChange={e => onChange(e.target.value as T)}>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function TextField({ label, value, onChange, placeholder, hint, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: ReactNode; multiline?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      {multiline ? (
        <textarea className="input min-h-[84px] resize-y" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      ) : (
        <input className="input" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      )}
    </Field>
  )
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" className="h-[30px] w-9 bg-canvas border border-hairline rounded-control cursor-pointer p-0.5" value={value} onChange={e => onChange(e.target.value)} />
        <input className="input font-mono uppercase" value={value} onChange={e => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && onChange(e.target.value)} />
      </div>
    </Field>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer select-none py-0.5">
      <input type="checkbox" className="mt-0.5 accent-[rgb(var(--accent))]" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="text-ui text-fg">{label}</span>
        {hint && <span className="block text-label text-fg-muted">{hint}</span>}
      </span>
    </label>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex border border-hairline rounded-control overflow-hidden">
      {options.map(o => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`px-2 py-1 text-ui font-mono border-r border-hairline last:border-r-0 transition-colors ${o.value === value ? 'bg-accent/15 text-accent' : 'text-fg-secondary hover:text-fg hover:bg-hover'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warn'; title?: string; children: ReactNode }) {
  const cls = tone === 'warn' ? 'border-severity-medium/40 bg-severity-medium/5' : 'border-accent/30 bg-accent/5'
  return (
    <div className={`border-l-2 ${cls} px-3 py-2 text-ui text-fg-secondary`}>
      {title && <div className="font-medium text-fg mb-0.5">{title}</div>}
      {children}
    </div>
  )
}

function round(v: number) {
  return Math.round(v * 100) / 100
}

function clamp(v: number, min?: number, max?: number) {
  if (min !== undefined && v < min) return min
  if (max !== undefined && v > max) return max
  return v
}

// ── Modal ────────────────────────────────────────────────────────────────────

/** A floating dialog: the only surface besides popovers that carries a shadow. */
export function Modal({ title, onClose, children, footer, width = 'max-w-2xl' }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-canvas/70" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={`overlay-surface w-full ${width} max-h-full flex flex-col`}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-hairline shrink-0">
          <h2 className="text-title font-semibold text-fg">{title}</h2>
          <button className="btn-ghost ml-auto" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center gap-2 px-4 py-2.5 border-t border-hairline shrink-0">{footer}</div>}
      </div>
    </div>
  )
}
