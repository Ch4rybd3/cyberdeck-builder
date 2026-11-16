import { useEffect, useMemo, useState } from 'react'

import { componentById } from '../../catalog/components'
import { carriedPlacementIds } from '../../geometry/caseBuilder'
import { intersects, placementBox } from '../../domain/layout'
import { useBuild } from '../../store/buildStore'
import { useGeometry } from '../../store/geometryStore'
import { Box, Layers, Redo2, Undo2 } from '../../ui/icons'
import { Aside, PageShell, Segmented, Toggle } from '../../ui/primitives'
import { ChecksPanel, useChecks } from './ChecksPanel'
import { Inspector } from './Inspector'
import { LeftRail } from './LeftRail'
import { useView } from '../../store/viewStore'
import { Viewport } from './Viewport'

export function WorkshopPage() {
  const build = useBuild(s => s.build)
  const undo = useBuild(s => s.undo)
  const redo = useBuild(s => s.redo)
  const canUndo = useBuild(s => s.past.length > 0)
  const canRedo = useBuild(s => s.future.length > 0)
  const geo = useGeometry()
  const issues = useChecks()
  const [rightTab, setRightTab] = useState<'inspect' | 'checks'>('inspect')
  const view = useView()
  const setView = (fn: (v: typeof view) => Partial<typeof view>) => view.set(fn(view))
  const hasSlider = build.accessories.some(a => a.kind === 'slider')

  useWorkshopKeys()

  const collisions = useMemo(() => {
    const ids = new Set<string>()
    const carried = carriedPlacementIds(build)
    const boxes = build.placements.filter(pl => !carried.has(pl.id)).map(pl => ({ pl, c: componentById(pl.componentId) })).filter(x => x.c).map(x => ({ id: x.pl.id, b: placementBox(build, x.c!, x.pl) }))
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++)
        if (intersects(boxes[i].b, boxes[j].b)) {
          ids.add(boxes[i].id)
          ids.add(boxes[j].id)
        }
    for (const i of issues) if (i.category === 'fit' && i.placementId && i.severity === 'critical') ids.add(i.placementId)
    return ids
  }, [build, issues])

  const blocking = issues.filter(i => i.severity === 'critical' || i.severity === 'high').length
  const p = build.case.params

  return (
    <PageShell
      route="/"
      title={build.name}
      meta={`${p.width} × ${p.depth} × ${p.trayHeight + p.lidHeight} mm`}
      subtitle={geo.busy ? 'Rebuilding geometry…' : geo.result ? `${geo.result.pieces.length} pieces · ${geo.result.durationMs.toFixed(0)} ms` : geo.error ?? 'Loading geometry kernel…'}
      actions={
        <div className="toolbar">
          <div className="toolbar-group">
            <button className="btn-ghost" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)"><Undo2 size={15} /></button>
            <button className="btn-ghost" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Shift+Z)"><Redo2 size={15} /></button>
          </div>
        </div>
      }
      toolbar={
        <>
          <span className="label mb-0">Lid</span>
          <Segmented value={view.lid} onChange={lid => setView(v => ({ ...v, lid }))} options={[{ value: 'solid', label: 'Solid' }, { value: 'ghost', label: 'Ghost' }, { value: 'hidden', label: 'Hidden' }]} />
          <span className="label mb-0 ml-3">Explode</span>
          <input type="range" min={0} max={1} step={0.01} value={view.explode} onChange={e => setView(v => ({ ...v, explode: Number(e.target.value) }))} className="w-32 accent-[rgb(var(--accent))]" />
          {build.case.params.hinge && (
            <>
              <span className="label mb-0 ml-3">Open lid</span>
              <input type="range" min={0} max={120} step={1} value={view.lidOpen} onChange={e => setView(() => ({ lidOpen: Number(e.target.value) }))} className="w-28 accent-[rgb(var(--accent))]" />
              <span className="font-mono text-label text-fg-muted w-8">{view.lidOpen}°</span>
            </>
          )}
          {hasSlider && (
            <>
              <span className="label mb-0 ml-3">Slide screen</span>
              <input type="range" min={0} max={1} step={0.01} value={view.slide} onChange={e => setView(() => ({ slide: Number(e.target.value) }))} className="w-28 accent-[rgb(var(--accent))]" />
            </>
          )}
          <div className="ml-3 flex items-center gap-3">
            <Toggle label="Components" checked={view.components} onChange={components => setView(v => ({ ...v, components }))} />
            <Toggle label="Accessories" checked={view.accessories} onChange={accessories => setView(v => ({ ...v, accessories }))} />
          </div>
        </>
      }
      asideLeft={<Aside side="left" width="w-72"><LeftRail /></Aside>}
      asideRight={
        <Aside side="right" width="w-80">
          <div className="flex border-b border-hairline sticky top-0 bg-panel z-10">
            <button onClick={() => setRightTab('inspect')} className={`flex-1 px-3 py-2 text-ui flex items-center justify-center gap-1.5 ${rightTab === 'inspect' ? 'tab-active' : 'tab-inactive'}`}>
              <Box size={13} /> Inspector
            </button>
            <button onClick={() => setRightTab('checks')} className={`flex-1 px-3 py-2 text-ui flex items-center justify-center gap-1.5 ${rightTab === 'checks' ? 'tab-active' : 'tab-inactive'}`}>
              <Layers size={13} /> Checks
              {issues.length > 0 && (
                <span className={`font-mono text-label px-1 rounded-control ${blocking ? 'bg-severity-critical/15 text-severity-critical' : 'bg-fg/10 text-fg-secondary'}`}>{blocking || issues.length}</span>
              )}
            </button>
          </div>
          {rightTab === 'inspect' ? <Inspector /> : <ChecksPanel issues={issues} />}
        </Aside>
      }
      fullHeight
    >
      <Viewport collisions={collisions} />
      <ViewportOverlay />
    </PageShell>
  )
}

/** Undo/redo, delete, and arrow-key nudging of the selected component. */
function useWorkshopKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select')) return
      const s = useBuild.getState()
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
        return
      }
      const sel = s.selection
      if (!sel?.id) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        s.update(b => {
          b.placements = b.placements.filter(x => x.id !== sel.id)
          b.features = b.features.filter(x => x.id !== sel.id)
          b.accessories = b.accessories.filter(x => x.id !== sel.id)
        })
        s.select({ kind: 'case' })
        return
      }
      if (sel.kind !== 'placement') return
      const step = e.shiftKey ? 10 : 1
      const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
      const mv = d[e.key]
      if (!mv) return
      e.preventDefault()
      s.update(
        b => {
          const pl = b.placements.find(x => x.id === sel.id)
          if (pl) {
            pl.x += mv[0]
            pl.y += mv[1]
          }
        },
        { coalesce: `nudge.${sel.id}` },
      )
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Camera presets, the hovered component's name, and a hint for an empty build. */
function ViewportOverlay() {
  const view = useView()
  const build = useBuild(s => s.build)
  const pl = view.hovered ? build.placements.find(p => p.id === view.hovered) : undefined
  const c = pl && componentById(pl.componentId)
  return (
    <>
      <div className="absolute top-3 left-3 flex items-center gap-1">
        <Segmented
          value={view.camera}
          onChange={camera => view.set({ camera, cameraRev: view.cameraRev + 1 })}
          options={[
            { value: 'iso', label: 'Iso', title: 'Three-quarter view' },
            { value: 'top', label: 'Top', title: 'From above' },
            { value: 'front', label: 'Front', title: 'From the front' },
            { value: 'side', label: 'Side', title: 'From the right' },
          ]}
        />
      </div>
      {pl && c && (
        <div className="absolute bottom-3 left-3 overlay-surface px-3 py-1.5 pointer-events-none">
          <div className="text-ui text-fg">{pl.label ?? c.name}</div>
          <div className="text-label font-mono text-fg-muted">
            {c.dims.x} × {c.dims.y} × {c.dims.z} mm · {pl.part} · x {pl.x} y {pl.y}
          </div>
        </div>
      )}
      {build.placements.length === 0 && (
        <div className="absolute inset-x-0 top-16 flex justify-center pointer-events-none">
          <div className="overlay-surface px-4 py-3 text-center max-w-sm">
            <div className="text-ui font-medium text-fg">An empty case</div>
            <div className="text-ui text-fg-secondary">Click a component in the left rail to place it, then drag it in the viewport.</div>
          </div>
        </div>
      )}
    </>
  )
}
