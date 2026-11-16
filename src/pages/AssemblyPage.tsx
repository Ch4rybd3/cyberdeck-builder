/**
 * Assembly guide generated from the build, with a 3D simulation beside it.
 *
 * The simulation follows the focused item: everything before it is in place,
 * its parts loop through their motion, later parts are not there yet. Ticking
 * the focused item moves on to the next one. Ticks are a per-viewer
 * convenience kept in this browser, not part of the build.
 */
import { useEffect, useMemo, useState } from 'react'

import { assemblySteps } from '../domain/assembly'
import { useBuild } from '../store/buildStore'
import { useAttachedModules, useGeometry } from '../store/geometryStore'
import { ChevronRight } from '../ui/icons'
import { Callout, Panel, PanelHeader, PageShell } from '../ui/primitives'
import { AssemblyViewer } from './assembly/AssemblyViewer'
import { flatten } from './assembly/simulation'

function useTicks(buildId: string) {
  const key = `cdb.assembly.${buildId}`
  const [ticks, setTicks] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      setTicks(JSON.parse(localStorage.getItem(key) ?? '{}'))
    } catch {
      setTicks({})
    }
  }, [key])
  const write = (next: Record<string, boolean>) => {
    setTicks(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Not persisted in private mode.
    }
  }
  return [ticks, write] as const
}

export function AssemblyPage() {
  const build = useBuild(s => s.build)
  const geo = useGeometry(s => s.result)
  const attached = useGeometry(s => s.attached)
  const modules = useAttachedModules()
  const steps = useMemo(() => assemblySteps(build, geo, modules), [build, geo, modules])
  const items = useMemo(() => flatten(steps), [steps])
  const pieces = useMemo(() => [...(geo?.pieces ?? []), ...attached.flatMap(a => a.pieces)], [geo, attached])
  const [ticks, setTicks] = useTicks(build.id)
  const firstOpen = Math.max(0, items.findIndex(it => !ticks[it.key]))
  const [focus, setFocus] = useState<number | null>(null)
  const current = Math.min(focus ?? firstOpen, Math.max(0, items.length - 1))
  const done = items.filter(it => ticks[it.key]).length

  const toggle = (index: number) => {
    const it = items[index]
    const next = { ...ticks, [it.key]: !ticks[it.key] }
    setTicks(next)
    // Ticking the focused item moves the simulation on to the next open one.
    if (next[it.key] && index === current) {
      const after = items.findIndex((x, k) => k > index && !next[x.key])
      setFocus(after === -1 ? index : after)
    }
  }

  const item = items[current]
  const step = item ? steps[item.stepIndex] : undefined

  return (
    <PageShell
      route="/assembly"
      title="Assembly"
      meta={`${done} / ${items.length}`}
      subtitle={build.name}
      actions={
        <>
          <button className="btn-ghost" onClick={() => { setTicks({}); setFocus(0) }}>Start over</button>
          <button className="btn-secondary" onClick={() => window.print()}>Print</button>
        </>
      }
    >
      <div className="grid xl:grid-cols-[minmax(0,1fr),minmax(0,1.1fr)] gap-4 max-w-[1500px]">
        <div className="space-y-4 min-w-0">
          <div className="h-1.5 bg-fg/5" data-print="hide">
            <div className="h-full bg-accent transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
          </div>
          {steps.map((s, k) => (
            <Panel key={s.id}>
              <PanelHeader title={s.title} numeral={String(k + 1).padStart(2, '0')} meta={`${s.items.filter((_, i) => ticks[`${s.id}:${i}`]).length} / ${s.items.length}`} />
              <ul className="px-2 py-2">
                {s.items.map((it, i) => {
                  const flat = items.findIndex(x => x.stepIndex === k && x.index === i)
                  const key = `${s.id}:${i}`
                  const focused = flat === current
                  return (
                    <li key={key} className={`flex items-start gap-2.5 px-2 py-1 rounded-control ${focused ? 'bg-accent/10' : ''}`}>
                      <input type="checkbox" className="mt-1.5 accent-[rgb(var(--accent))]" checked={Boolean(ticks[key])} onChange={() => toggle(flat)} aria-label="Done" />
                      <button className={`text-left text-prose flex-1 ${ticks[key] ? 'text-fg-muted line-through' : 'text-fg'}`} onClick={() => setFocus(flat)} title="Show this step in the simulation">
                        {it.text}
                      </button>
                    </li>
                  )
                })}
              </ul>
              {s.note && <div className="px-4 pb-3"><Callout>{s.note}</Callout></div>}
            </Panel>
          ))}
        </div>

        <div className="xl:sticky xl:top-0 self-start" data-print="hide">
          <Panel>
            <div className="h-[56vh] min-h-[360px] relative">
              {geo ? <AssemblyViewer build={build} pieces={pieces} carried={geo.carried} items={items} focus={current} /> : <div className="h-full flex items-center justify-center text-ui text-fg-muted font-mono">Building the case…</div>}
            </div>
            {item && step && (
              <div className="border-t border-hairline px-4 py-3 space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="numeral">{String(item.stepIndex + 1).padStart(2, '0')}.{item.index + 1}</span>
                  <span className="label mb-0">{step.title}</span>
                  <span className="ml-auto text-label font-mono text-fg-muted">{current + 1} / {items.length}</span>
                </div>
                <p className="text-prose text-fg">{item.text}</p>
                <div className="flex gap-2">
                  <button className="btn-secondary" disabled={current === 0} onClick={() => setFocus(current - 1)}>Previous</button>
                  <button className="btn-secondary" disabled={current >= items.length - 1} onClick={() => setFocus(current + 1)}>Skip</button>
                  <div className="flex-1" />
                  <button className="btn-primary flex items-center gap-1" onClick={() => (ticks[item.key] ? setFocus(Math.min(items.length - 1, current + 1)) : toggle(current))}>
                    {ticks[item.key] ? 'Next' : 'Done, next'} <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </PageShell>
  )
}
