/**
 * Assembly guide generated from the build. Ticks are a per-viewer
 * convenience kept in this browser (they are not part of the build).
 */
import { useEffect, useMemo, useState } from 'react'

import { assemblySteps } from '../domain/assembly'
import { useBuild } from '../store/buildStore'
import { useAttachedModules, useGeometry } from '../store/geometryStore'
import { Callout, Panel, PanelHeader, PageShell } from '../ui/primitives'

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
  const toggle = (id: string) =>
    setTicks(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Not persisted in private mode.
      }
      return next
    })
  return [ticks, toggle, () => setTicks({})] as const
}

export function AssemblyPage() {
  const build = useBuild(s => s.build)
  const geo = useGeometry(s => s.result)
  const modules = useAttachedModules()
  const steps = useMemo(() => assemblySteps(build, geo, modules), [build, geo, modules])
  const [ticks, toggle, reset] = useTicks(build.id)
  const total = steps.reduce((a, s) => a + s.items.length, 0)
  const done = steps.reduce((a, s) => a + s.items.filter((_, i) => ticks[`${s.id}:${i}`]).length, 0)

  return (
    <PageShell
      route="/assembly"
      title="Assembly"
      meta={`${done} / ${total}`}
      subtitle={build.name}
      actions={
        <>
          <button className="btn-ghost" onClick={reset}>Clear ticks</button>
          <button className="btn-secondary" onClick={() => window.print()}>Print</button>
        </>
      }
    >
      <div className="max-w-4xl space-y-4">
        <div className="h-1.5 bg-fg/5">
          <div className="h-full bg-accent transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        {steps.map((s, k) => (
          <Panel key={s.id}>
            <PanelHeader title={s.title} numeral={String(k + 1).padStart(2, '0')} meta={`${s.items.filter((_, i) => ticks[`${s.id}:${i}`]).length} / ${s.items.length}`} />
            <ul className="px-4 py-2">
              {s.items.map((item, i) => {
                const id = `${s.id}:${i}`
                return (
                  <li key={id}>
                    <label className="flex items-start gap-2.5 py-1 cursor-pointer">
                      <input type="checkbox" className="mt-1 accent-[rgb(var(--accent))]" checked={Boolean(ticks[id])} onChange={() => toggle(id)} />
                      <span className={`text-prose ${ticks[id] ? 'text-fg-muted line-through' : 'text-fg'}`}>{item}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
            {s.note && <div className="px-4 pb-3"><Callout>{s.note}</Callout></div>}
          </Panel>
        ))}
      </div>
    </PageShell>
  )
}
