/**
 * Left rail: the component catalog and the build outline (placements,
 * geometry features, accessories). Adding anything selects it, so the
 * inspector opens on what was just added.
 */
import { useMemo, useState } from 'react'

import { COMPONENTS, componentById } from '../../catalog/components'
import type { CustomComponent } from '../../domain/schema'
import { CATEGORY_DATA_SLOT, CATEGORY_LABEL, type Category } from '../../catalog/types'
import type { Accessory, AccessoryKind, Build, Feature } from '../../domain/schema'
import { uid } from '../../lib/id'
import { useBuild } from '../../store/buildStore'
import { Pencil, Plus, Search } from '../../ui/icons'
import { blankComponent, ComponentEditor } from './ComponentEditor'
import { DataDot, Section } from '../../ui/primitives'

export function LeftRail() {
  const [tab, setTab] = useState<'catalog' | 'outline'>('catalog')
  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-hairline shrink-0">
        {(['catalog', 'outline'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 px-3 py-2 text-ui capitalize ${tab === t ? 'tab-active' : 'tab-inactive'}`}>
            {t === 'catalog' ? 'Components' : 'Outline'}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">{tab === 'catalog' ? <Catalog /> : <Outline />}</div>
    </div>
  )
}

function Catalog() {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<CustomComponent | null>(null)
  const update = useBuild(s => s.update)
  const select = useBuild(s => s.select)
  const custom = useBuild(s => s.build.customComponents)
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = COMPONENTS.filter(c => !needle || c.name.toLowerCase().includes(needle) || c.category.includes(needle))
    const map = new Map<Category, typeof list>()
    for (const c of list) map.set(c.category, [...(map.get(c.category) ?? []), c])
    return [...map]
  }, [q])

  const add = (componentId: string) => {
    const c = componentById(componentId)!
    const id = uid('pl')
    update(b => {
      // Displays go into the lid by default; everything else into the tray.
      b.placements.push({ id, componentId, part: c.category === 'display' ? 'lid' : 'tray', x: 0, y: 0, z: 0, rotation: 0, standoffs: true, window: true })
    })
    select({ kind: 'placement', id })
  }

  const needle = q.trim().toLowerCase()
  const mine = custom.filter(c => !needle || c.name.toLowerCase().includes(needle))

  return (
    <div>
      {editing && <ComponentEditor initial={editing} onClose={() => setEditing(null)} />}
      <div className="p-2 border-b border-hairline sticky top-0 bg-panel z-10">
        <div className="relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input className="input pl-7" placeholder="Search components…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>
      <Section title={`My components · ${custom.length}`} actions={<button className="btn-ghost" title="New custom component" onClick={() => setEditing(blankComponent(uid('custom')))}><Plus size={14} /></button>}>
        {custom.length === 0 && <p className="text-ui text-fg-muted">Your own parts, saved in this build. Click + to describe one, or use “Make an editable copy” on a placed catalog part.</p>}
        <ul className="-mx-1">
          {mine.map(c => (
            <li key={c.id} className="flex items-start gap-1 group">
              <button onClick={() => add(c.id)} className="flex-1 min-w-0 text-left flex items-start gap-2 px-1 py-1.5 rounded-control hover:bg-hover">
                <span className="mt-1.5"><DataDot slot={CATEGORY_DATA_SLOT[c.category]} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-ui text-fg truncate">{c.name}</span>
                  <span className="block text-label font-mono text-fg-muted">{c.dims.x}×{c.dims.y}×{c.dims.z} · custom</span>
                </span>
              </button>
              <button className="btn-ghost mt-1 opacity-60 group-hover:opacity-100" title="Edit" onClick={() => setEditing(c)}>
                <Pencil size={13} />
              </button>
            </li>
          ))}
        </ul>
      </Section>
      {groups.map(([cat, items]) => (
        <Section key={cat} title={CATEGORY_LABEL[cat]}>
          <ul className="-mx-1">
            {items.map(c => (
              <li key={c.id}>
                <button onClick={() => add(c.id)} className="w-full text-left flex items-start gap-2 px-1 py-1.5 rounded-control hover:bg-hover group" title={c.notes}>
                  <span className="mt-1.5"><DataDot slot={CATEGORY_DATA_SLOT[c.category]} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-ui text-fg truncate">{c.name}</span>
                    <span className="block text-label font-mono text-fg-muted">
                      {c.dims.x}×{c.dims.y}×{c.dims.z} · €{c.price}
                    </span>
                  </span>
                  <Plus size={13} className="mt-1 text-fg-muted opacity-0 group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </div>
  )
}

// ── Outline ──────────────────────────────────────────────────────────────────

type FeaturePreset = { label: string; make: (b: Build) => Omit<Feature, 'id'> }

const FEATURE_PRESETS: FeaturePreset[] = [
  { label: 'Vent slots', make: () => ({ name: 'Vent slots', part: 'tray', face: 'bottom', op: 'cut', shape: { kind: 'slot', w: 40, h: 4 }, u: 0, v: 0, depth: 0, rotation: 0, pattern: { nu: 1, nv: 6, du: 0, dv: 8 }, enabled: true }) },
  { label: 'Round hole', make: () => ({ name: 'Hole', part: 'tray', face: 'front', op: 'cut', shape: { kind: 'circle', d: 8 }, u: 0, v: 0, depth: 0, rotation: 0, enabled: true }) },
  { label: 'Rectangular cut-out', make: () => ({ name: 'Cut-out', part: 'tray', face: 'front', op: 'cut', shape: { kind: 'rect', w: 20, h: 8, r: 1 }, u: 0, v: 0, depth: 0, rotation: 0, enabled: true }) },
  { label: 'Extruded pad', make: () => ({ name: 'Pad', part: 'lid', face: 'top', op: 'extrude', shape: { kind: 'rect', w: 40, h: 20, r: 3 }, u: 0, v: 0, depth: 2, rotation: 0, enabled: true }) },
  { label: 'Colour inlay', make: b => ({ name: 'Inlay', part: 'lid', face: 'top', op: 'inlay', shape: { kind: 'rect', w: 60, h: 6, r: 3 }, u: 0, v: 0, depth: 0.6, rotation: 0, color: b.case.colors.accessories, enabled: true }) },
  { label: 'Internal boss', make: () => ({ name: 'Boss', part: 'tray', face: 'bottom', op: 'boss', shape: { kind: 'circle', d: 8 }, u: 0, v: 0, depth: 6, rotation: 0, enabled: true }) },
]

const ACCESSORY_PRESETS: { kind: AccessoryKind; label: string; make: () => Omit<Accessory, 'id'> }[] = [
  { kind: 'picatinny', label: 'Picatinny rail', make: () => ({ kind: 'picatinny', part: 'tray', face: 'left', u: 0, v: 0, length: 100, rotation: 0 }) },
  { kind: 'handle', label: 'Handle', make: () => ({ kind: 'handle', part: 'tray', face: 'back', u: 0, v: 0, length: 120, rotation: 0 }) },
  { kind: 'foot', label: 'Foot', make: () => ({ kind: 'foot', part: 'tray', face: 'bottom', u: 0, v: 0, length: 18, rotation: 0 }) },
  { kind: 'deckport', label: 'DeckPort', make: () => ({ kind: 'deckport', part: 'tray', face: 'right', u: 0, v: 0, length: 40, rotation: 0 }) },
  { kind: 'slider', label: 'Screen slider', make: () => ({ kind: 'slider', part: 'lid', face: 'top', u: 0, v: -30, length: 120, rotation: 0, travel: 60 }) },
]

function Outline() {
  const build = useBuild(s => s.build)
  const sel = useBuild(s => s.selection)
  const update = useBuild(s => s.update)
  const select = useBuild(s => s.select)
  const [menu, setMenu] = useState<'feature' | 'accessory' | null>(null)

  const row = (active: boolean) => `w-full text-left flex items-center gap-2 px-2 py-1 rounded-control text-ui ${active ? 'bg-accent/10 text-accent' : 'text-fg-secondary hover:text-fg hover:bg-hover'}`

  return (
    <div>
      <Section title="Case">
        <button className={row(!sel || sel.kind === 'case')} onClick={() => select({ kind: 'case' })}>
          <span className="flex-1 truncate">Case & build settings</span>
          <span className="text-label font-mono text-fg-muted">{build.case.params.width}×{build.case.params.depth}</span>
        </button>
      </Section>
      <Section title={`Components · ${build.placements.length}`}>
        {build.placements.length === 0 && <p className="text-ui text-fg-muted">Add components from the Components tab.</p>}
        {build.placements.map(pl => {
          const c = componentById(pl.componentId)
          return (
            <button key={pl.id} className={row(sel?.kind === 'placement' && sel.id === pl.id)} onClick={() => select({ kind: 'placement', id: pl.id })}>
              {c && <DataDot slot={CATEGORY_DATA_SLOT[c.category]} />}
              <span className="flex-1 truncate">{pl.label ?? c?.name ?? pl.componentId}</span>
              <span className="text-label font-mono text-fg-muted uppercase">{pl.part}</span>
            </button>
          )
        })}
      </Section>
      <Section
        title={`Geometry · ${build.features.length}`}
        actions={<button className="btn-ghost" title="Add a feature" onClick={() => setMenu(menu === 'feature' ? null : 'feature')}><Plus size={14} /></button>}
      >
        {menu === 'feature' && (
          <div className="grid grid-cols-2 gap-1 mb-2">
            {FEATURE_PRESETS.map(p => (
              <button
                key={p.label}
                className="btn-secondary text-left"
                onClick={() => {
                  const id = uid('ft')
                  update(b => void b.features.push({ id, ...p.make(b) }))
                  select({ kind: 'feature', id })
                  setMenu(null)
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        {build.features.length === 0 && menu !== 'feature' && <p className="text-ui text-fg-muted">Cut, extrude, inlay or add bosses on any face.</p>}
        {build.features.map(f => (
          <button key={f.id} className={row(sel?.kind === 'feature' && sel.id === f.id)} onClick={() => select({ kind: 'feature', id: f.id })}>
            <span className={`flex-1 truncate ${f.enabled ? '' : 'line-through opacity-60'}`}>{f.name}</span>
            <span className="text-label font-mono text-fg-muted uppercase">{f.op} · {f.part}/{f.face}</span>
          </button>
        ))}
      </Section>
      <Section
        title={`Accessories · ${build.accessories.length}`}
        actions={<button className="btn-ghost" title="Add an accessory" onClick={() => setMenu(menu === 'accessory' ? null : 'accessory')}><Plus size={14} /></button>}
      >
        {menu === 'accessory' && (
          <div className="grid grid-cols-2 gap-1 mb-2">
            {ACCESSORY_PRESETS.map(p => (
              <button
                key={p.kind}
                className="btn-secondary text-left"
                onClick={() => {
                  const id = uid('acc')
                  update(b => {
                    const acc = { id, ...p.make() }
                    if (acc.kind === 'slider') acc.targetId = b.placements.find(pl => componentById(pl.componentId)?.category === 'display')?.id
                    b.accessories.push(acc)
                  })
                  select({ kind: 'accessory', id })
                  setMenu(null)
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        {build.accessories.map(a => (
          <button key={a.id} className={row(sel?.kind === 'accessory' && sel.id === a.id)} onClick={() => select({ kind: 'accessory', id: a.id })}>
            <span className="flex-1 truncate">{ACCESSORY_PRESETS.find(x => x.kind === a.kind)?.label ?? a.kind}</span>
            <span className="text-label font-mono text-fg-muted uppercase">{a.part}/{a.face}</span>
          </button>
        ))}
      </Section>
    </div>
  )
}
