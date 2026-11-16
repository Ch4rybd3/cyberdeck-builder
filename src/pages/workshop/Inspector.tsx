/**
 * Right rail: edits whatever is selected — the case, a placement, a geometry
 * feature or an accessory. Every field writes through `update` with a
 * coalesce key so a burst of keystrokes is one undo step.
 */
import type { ReactNode } from 'react'

import { componentById, isCustomComponent } from '../../catalog/components'
import { ComponentEditor } from './ComponentEditor'
import { useState } from 'react'
import { CATEGORY_DATA_SLOT, PORT_LABEL, type PortType } from '../../catalog/types'
import { TEMPLATES } from '../../catalog/templates'
import { SOCKET } from '../../domain/deckport'
import { sliderGeometry } from '../../geometry/caseBuilder'
import { faceSize } from '../../domain/layout'
import { FACES, type Accessory, type Build, type Feature, type Shape } from '../../domain/schema'
import { uid } from '../../lib/id'
import { useBuild } from '../../store/buildStore'
import { Copy, RotateCw, Trash2 } from '../../ui/icons'
import { ColorField, DataDot, NumberField, Section, Segmented, SelectField, Tag, TextField, Toggle } from '../../ui/primitives'

const FACE_OPTS = FACES.map(f => ({ value: f, label: f[0].toUpperCase() + f.slice(1) }))
const PART_OPTS = [
  { value: 'tray' as const, label: 'Tray' },
  { value: 'lid' as const, label: 'Lid' },
]
const INSERT_OPTS = ['M2', 'M2.5', 'M3', 'M4'].map(v => ({ value: v as 'M2' | 'M2.5' | 'M3' | 'M4', label: v }))

function useEdit() {
  const update = useBuild(s => s.update)
  return (key: string, fn: (b: Build) => void) => update(fn, { coalesce: key })
}

export function Inspector() {
  const sel = useBuild(s => s.selection)
  const build = useBuild(s => s.build)
  if (sel?.kind === 'placement') {
    const pl = build.placements.find(p => p.id === sel.id)
    if (pl) return <PlacementInspector id={pl.id} />
  }
  if (sel?.kind === 'feature') {
    const f = build.features.find(p => p.id === sel.id)
    if (f) return <FeatureInspector feature={f} />
  }
  if (sel?.kind === 'accessory') {
    const a = build.accessories.find(p => p.id === sel.id)
    if (a) return <AccessoryInspector acc={a} />
  }
  return <CaseInspector />
}

function Grid2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

// ── Case ─────────────────────────────────────────────────────────────────────

function CaseInspector() {
  const build = useBuild(s => s.build)
  const edit = useEdit()
  const p = build.case.params
  const set = (k: keyof typeof p) => (v: number) => edit(`case.${k}`, b => void ((b.case.params as Record<string, unknown>)[k] = v))
  const tpl = TEMPLATES.find(t => t.id === build.case.template)
  return (
    <>
      <Section title="Build" numeral="01">
        <div className="space-y-2">
          <TextField label="Name" value={build.name} onChange={v => edit('name', b => void (b.name = v))} />
          <SelectField
            label="Kind"
            value={build.kind}
            options={[
              { value: 'core', label: 'Core deck' },
              { value: 'module', label: 'DeckPort module' },
            ]}
            onChange={v => edit('kind', b => void (b.kind = v))}
            hint={build.kind === 'module' ? 'Modules carry a DeckPort plug and draw power from the Core.' : 'A Core exposes DeckPort sockets for modules.'}
          />
          <div className="text-label text-fg-muted">
            Template <span className="font-mono text-fg-secondary">{tpl?.name ?? build.case.template}</span>
          </div>
        </div>
      </Section>
      <Section title="Case dimensions" numeral="02">
        <Grid2>
          <NumberField label="Width" unit="mm" value={p.width} min={40} max={600} onChange={set('width')} />
          <NumberField label="Depth" unit="mm" value={p.depth} min={40} max={600} onChange={set('depth')} />
          <NumberField label="Tray height" unit="mm" value={p.trayHeight} min={10} max={200} onChange={set('trayHeight')} />
          <NumberField label="Lid height" unit="mm" value={p.lidHeight} min={4} max={120} onChange={set('lidHeight')} />
          <NumberField label="Wall" unit="mm" step={0.1} value={p.wall} min={1.2} max={8} onChange={set('wall')} />
          <NumberField label="Floor / top" unit="mm" step={0.1} value={p.floor} min={1.2} max={8} onChange={set('floor')} />
          <NumberField label="Corner radius" unit="mm" value={p.cornerRadius} min={0} max={40} onChange={set('cornerRadius')} />
        </Grid2>
      </Section>
      <Section title="Shape" numeral="03">
        <div className="space-y-2">
          <Field2 label="Corners">
            <Segmented value={p.cornerStyle} onChange={v => edit('case.cornerStyle', b => void (b.case.params.cornerStyle = v))} options={[{ value: 'round', label: 'Rounded' }, { value: 'chamfer', label: 'Chamfered' }]} />
          </Field2>
          <NumberField label="Edge bevel" unit="mm" step={0.5} value={p.bevel} min={0} max={12} onChange={set('bevel')} hint="45° bevel on the tray's bottom edge and the lid's top edge." />
          <Toggle label="Hinged lid" checked={p.hinge} onChange={v => edit('case.hinge', b => void (b.case.params.hinge = v))} hint="Knuckle hinge along the back edge on a Ø3 mm steel pin. Use “Open lid” in the toolbar to check it." />
        </div>
      </Section>
      <Section title="Closure" numeral="04">
        <div className="space-y-2">
          <Field2 label="Held shut by">
            <Segmented value={p.closure} onChange={v => edit('case.closure', b => void (b.case.params.closure = v))} options={[{ value: 'screws', label: 'Screws' }, { value: 'magnets', label: 'Magnets' }]} />
          </Field2>
          <Grid2>
            {p.closure === 'screws' && <SelectField label="Insert" value={p.closureInsert} options={INSERT_OPTS} onChange={v => edit('case.closureInsert', b => void (b.case.params.closureInsert = v))} />}
            <NumberField label={p.closure === 'screws' ? 'Screws' : 'Positions'} value={p.closureScrews} min={4} max={16} step={2} onChange={v => edit('case.closureScrews', b => void (b.case.params.closureScrews = Math.round(v)))} />
          </Grid2>
          <p className="text-label text-fg-muted">
            {p.closure === 'screws' ? 'Inserts are melted into the tray rim; screws go through the lid from the top.' : 'Ø6 × 3 mm disc magnets press into pockets in the tray rim and the lid.'}
            {p.hinge ? ' With a hinge, only the front positions are used.' : ''}
          </p>
        </div>
      </Section>
      <Section title="Colours" numeral="05">
        <div className="space-y-2">
          <ColorField label="Tray" value={build.case.colors.tray} onChange={v => edit('col.tray', b => void (b.case.colors.tray = v))} />
          <ColorField label="Lid" value={build.case.colors.lid} onChange={v => edit('col.lid', b => void (b.case.colors.lid = v))} />
          <ColorField label="Accessories & inlays" value={build.case.colors.accessories} onChange={v => edit('col.acc', b => void (b.case.colors.accessories = v))} />
        </div>
      </Section>
    </>
  )
}

// ── Placement ────────────────────────────────────────────────────────────────

function PlacementInspector({ id }: { id: string }) {
  const build = useBuild(s => s.build)
  const update = useBuild(s => s.update)
  const select = useBuild(s => s.select)
  const edit = useEdit()
  const pl = build.placements.find(p => p.id === id)!
  const c = componentById(pl.componentId)
  const set = (fn: (t: typeof pl) => void, key: string) =>
    edit(`pl.${id}.${key}`, b => {
      const t = b.placements.find(q => q.id === id)
      if (t) fn(t)
    })

  const [editing, setEditing] = useState(false)
  if (!c) return <Section title="Unknown component">The catalog has no component “{pl.componentId}”.</Section>
  const pw = c.power
  const custom = isCustomComponent(c.id)
  const makeCopy = () => {
    const copy = { ...structuredClone(c), id: uid('custom'), name: `${c.name} (custom)`, supplier: c.supplier, basedOn: c.id }
    update(b => {
      b.customComponents.push(copy)
      const t = b.placements.find(q => q.id === id)
      if (t) t.componentId = copy.id
    })
    setEditing(true)
  }
  return (
    <>
      {editing && custom && <ComponentEditor initial={build.customComponents.find(x => x.id === c.id)!} onClose={() => setEditing(false)} />}
      <Section
        title="Component"
        numeral="01"
        actions={
          <>
            <button
              className="btn-ghost"
              title="Duplicate"
              onClick={() => {
                const copy = { ...pl, id: uid('pl'), x: pl.x + 10, y: pl.y + 10, label: pl.label ? `${pl.label} copy` : undefined }
                update(b => void b.placements.push(copy))
                select({ kind: 'placement', id: copy.id })
              }}
            >
              <Copy size={14} />
            </button>
            <button
              className="btn-ghost text-severity-critical"
              title="Remove"
              onClick={() => {
                update(b => void (b.placements = b.placements.filter(q => q.id !== id)))
                select({ kind: 'case' })
              }}
            >
              <Trash2 size={14} />
            </button>
          </>
        }
      >
        <div className="flex items-center gap-2 mb-2">
          <DataDot slot={CATEGORY_DATA_SLOT[c.category]} />
          <span className="text-ui text-fg">{c.name}</span>
        </div>
        <TextField label="Label" value={pl.label ?? ''} placeholder={c.name} onChange={v => set(t => void (t.label = v || undefined), 'label')} />
      </Section>
      <Section title="Position" numeral="02">
        <div className="space-y-2">
          <SelectField label="Mounted in" value={pl.part} options={PART_OPTS} onChange={v => set(t => void (t.part = v), 'part')} />
          <Grid2>
            <NumberField label="X" unit="mm" value={pl.x} onChange={v => set(t => void (t.x = v), 'x')} />
            <NumberField label="Y" unit="mm" value={pl.y} onChange={v => set(t => void (t.y = v), 'y')} />
            <NumberField label={pl.part === 'tray' ? 'Lift above floor' : 'Drop below top'} unit="mm" value={pl.z} min={0} onChange={v => set(t => void (t.z = v), 'z')} />
            <Field2 label="Rotation">
              <div className="flex items-center gap-1">
                <span className="font-mono text-ui text-fg w-10">{pl.rotation}°</span>
                <button className="btn-secondary" onClick={() => set(t => void (t.rotation = (((t.rotation + 90) % 360) as 0 | 90 | 180 | 270)), 'rot')}>
                  <RotateCw size={13} />
                </button>
              </div>
            </Field2>
          </Grid2>
          <p className="text-label text-fg-muted">Drag in the viewport (Shift snaps to 5 mm) or nudge with the arrow keys.</p>
        </div>
      </Section>
      <Section title="Mounting" numeral="03">
        <Toggle
          label="Standoffs with heat-set inserts"
          checked={pl.standoffs}
          onChange={v => set(t => void (t.standoffs = v), 'standoffs')}
          hint={c.mounting ? `${c.mounting.holes.length} × ${c.mounting.insert}, ${c.mounting.standoff} mm high` : 'This component has no mounting holes.'}
        />
        <Toggle
          label="Cut its window in the case"
          checked={pl.window}
          onChange={v => set(t => void (t.window = v), 'window')}
          hint={c.windows ? c.windows.map(w => `${w.w} × ${w.h} mm on ${w.face}`).join(', ') : 'No window defined.'}
        />
      </Section>
      <Section title="Specifications" numeral="04">
        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-ui">
          <dt className="text-fg-muted">Envelope</dt>
          <dd className="font-mono text-fg">{c.dims.x} × {c.dims.y} × {c.dims.z} mm</dd>
          <dt className="text-fg-muted">Mass</dt>
          <dd className="font-mono text-fg">{c.mass} g</dd>
          <dt className="text-fg-muted">Price</dt>
          <dd className="font-mono text-fg">€{c.price}</dd>
          {pw?.role === 'load' && (
            <>
              <dt className="text-fg-muted">Power</dt>
              <dd className="font-mono text-fg">{pw.typW} W typ · {pw.peakW} W peak on {pw.rail}</dd>
            </>
          )}
          {pw?.role === 'battery' && (
            <>
              <dt className="text-fg-muted">Battery</dt>
              <dd className="font-mono text-fg">{pw.capacityWh} Wh · {pw.nominalV} V · {pw.maxW} W max</dd>
            </>
          )}
          {pw?.role === 'converter' && (
            <>
              <dt className="text-fg-muted">Converter</dt>
              <dd className="font-mono text-fg">{pw.in} → {pw.out} · {pw.maxW} W · {Math.round(pw.efficiency * 100)}%</dd>
            </>
          )}
        </dl>
        {c.ports && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(c.ports.provides ?? {}).map(([k, n]) => <Tag key={`p${k}`} tone="accent">{n}× {PORT_LABEL[k as PortType]}</Tag>)}
            {Object.entries(c.ports.consumes ?? {}).map(([k, n]) => <Tag key={`c${k}`}>uses {n}× {PORT_LABEL[k as PortType]}</Tag>)}
          </div>
        )}
        {c.notes && <p className="text-ui text-fg-secondary mt-2">{c.notes}</p>}
        {c.url && <a className="text-ui text-accent underline underline-offset-2 mt-1 inline-block" href={c.url} target="_blank" rel="noreferrer">Product page</a>}
        <div className="mt-3">
          {custom ? (
            <button className="btn-secondary w-full" onClick={() => setEditing(true)}>Edit this custom component</button>
          ) : (
            <button className="btn-secondary w-full" onClick={makeCopy} title="Copies this catalog part into the build so you can change its size, holes, power or ports">
              Make an editable copy
            </button>
          )}
        </div>
      </Section>
    </>
  )
}

function Field2({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
    </div>
  )
}

// ── Feature ──────────────────────────────────────────────────────────────────

const SHAPE_DEFAULTS: Record<Shape['kind'], Shape> = {
  rect: { kind: 'rect', w: 20, h: 10, r: 1 },
  circle: { kind: 'circle', d: 10 },
  slot: { kind: 'slot', w: 30, h: 4 },
  polygon: { kind: 'polygon', points: [[-10, -8], [10, -8], [0, 10]] },
}

function FeatureInspector({ feature }: { feature: Feature }) {
  const build = useBuild(s => s.build)
  const update = useBuild(s => s.update)
  const select = useBuild(s => s.select)
  const edit = useEdit()
  const id = feature.id
  const set = (key: string, fn: (t: Feature) => void) =>
    edit(`ft.${id}.${key}`, b => {
      const t = b.features.find(q => q.id === id)
      if (t) fn(t)
    })
  const size = faceSize(build.case.params, feature.part, feature.face)
  const sh = feature.shape
  const pat = feature.pattern ?? { nu: 1, nv: 1, du: 0, dv: 0 }
  const colored = feature.op === 'extrude' || feature.op === 'inlay'

  return (
    <>
      <Section
        title="Feature"
        numeral="01"
        actions={
          <>
            <button
              className="btn-ghost"
              title="Duplicate"
              onClick={() => {
                const copy = { ...structuredClone(feature), id: uid('ft'), name: `${feature.name} copy`, u: feature.u + 10 }
                update(b => void b.features.push(copy))
                select({ kind: 'feature', id: copy.id })
              }}
            >
              <Copy size={14} />
            </button>
            <button
              className="btn-ghost text-severity-critical"
              title="Remove"
              onClick={() => {
                update(b => void (b.features = b.features.filter(q => q.id !== id)))
                select({ kind: 'case' })
              }}
            >
              <Trash2 size={14} />
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <TextField label="Name" value={feature.name} onChange={v => set('name', t => void (t.name = v))} />
          <Field2 label="Operation">
            <Segmented
              value={feature.op}
              onChange={v => set('op', t => void (t.op = v))}
              options={[
                { value: 'cut', label: 'Cut', title: 'Remove material inward from the face' },
                { value: 'extrude', label: 'Extrude', title: 'Add material outward from the face' },
                { value: 'inlay', label: 'Inlay', title: 'Shallow pocket filled with a second colour' },
                { value: 'boss', label: 'Boss', title: 'Add material inward, behind the wall' },
              ]}
            />
          </Field2>
          <Grid2>
            <SelectField label="Part" value={feature.part} options={PART_OPTS} onChange={v => set('part', t => void (t.part = v))} />
            <SelectField label="Face" value={feature.face} options={FACE_OPTS} onChange={v => set('face', t => void (t.face = v))} />
          </Grid2>
          <Toggle label="Enabled" checked={feature.enabled} onChange={v => set('enabled', t => void (t.enabled = v))} />
        </div>
      </Section>
      <Section title="Sketch" numeral="02">
        <div className="space-y-2">
          <Segmented
            value={sh.kind}
            onChange={k => set('shape', t => void (t.shape = structuredClone(SHAPE_DEFAULTS[k])))}
            options={[
              { value: 'rect', label: 'Rect' },
              { value: 'circle', label: 'Circle' },
              { value: 'slot', label: 'Slot' },
              { value: 'polygon', label: 'Polygon' },
            ]}
          />
          {sh.kind === 'rect' && (
            <Grid2>
              <NumberField label="Width" unit="mm" value={sh.w} min={0.2} onChange={v => set('w', t => void (t.shape.kind === 'rect' && (t.shape.w = v)))} />
              <NumberField label="Height" unit="mm" value={sh.h} min={0.2} onChange={v => set('h', t => void (t.shape.kind === 'rect' && (t.shape.h = v)))} />
              <NumberField label="Corner radius" unit="mm" value={sh.r ?? 0} min={0} onChange={v => set('r', t => void (t.shape.kind === 'rect' && (t.shape.r = v)))} />
            </Grid2>
          )}
          {sh.kind === 'circle' && <NumberField label="Diameter" unit="mm" value={sh.d} min={0.2} onChange={v => set('d', t => void (t.shape.kind === 'circle' && (t.shape.d = v)))} />}
          {sh.kind === 'slot' && (
            <Grid2>
              <NumberField label="Length" unit="mm" value={sh.w} min={0.2} onChange={v => set('w', t => void (t.shape.kind === 'slot' && (t.shape.w = v)))} />
              <NumberField label="Width" unit="mm" value={sh.h} min={0.2} onChange={v => set('h', t => void (t.shape.kind === 'slot' && (t.shape.h = v)))} />
            </Grid2>
          )}
          {sh.kind === 'polygon' && (
            <TextField
              label="Points (u,v; u,v; …)"
              multiline
              value={sh.points.map(p => p.join(',')).join('; ')}
              onChange={v => {
                const pts = v.split(';').map(s => s.split(',').map(Number)).filter(p => p.length === 2 && p.every(Number.isFinite)) as [number, number][]
                if (pts.length >= 3) set('pts', t => void (t.shape.kind === 'polygon' && (t.shape.points = pts)))
              }}
            />
          )}
          <Grid2>
            <NumberField label="Offset u" unit="mm" value={feature.u} min={-size.u / 2} max={size.u / 2} onChange={v => set('u', t => void (t.u = v))} />
            <NumberField label="Offset v" unit="mm" value={feature.v} min={-size.v / 2} max={size.v / 2} onChange={v => set('v', t => void (t.v = v))} />
            <NumberField label={feature.op === 'cut' ? 'Depth (0 = through)' : 'Depth'} unit="mm" step={0.1} value={feature.depth} min={0} onChange={v => set('depth', t => void (t.depth = v))} />
            <NumberField label="Rotation" unit="°" value={feature.rotation} onChange={v => set('rotation', t => void (t.rotation = v))} />
          </Grid2>
          <p className="text-label text-fg-muted">
            Face is {Math.round(size.u)} × {Math.round(size.v)} mm. u runs left→right and v bottom→top when you face it.
          </p>
        </div>
      </Section>
      <Section title="Pattern" numeral="03">
        <Grid2>
          <NumberField label="Count u" value={pat.nu} min={1} max={50} onChange={v => set('nu', t => void (t.pattern = { ...pat, nu: Math.round(v) }))} />
          <NumberField label="Count v" value={pat.nv} min={1} max={50} onChange={v => set('nv', t => void (t.pattern = { ...pat, nv: Math.round(v) }))} />
          <NumberField label="Pitch u" unit="mm" value={pat.du} onChange={v => set('du', t => void (t.pattern = { ...pat, du: v }))} />
          <NumberField label="Pitch v" unit="mm" value={pat.dv} onChange={v => set('dv', t => void (t.pattern = { ...pat, dv: v }))} />
        </Grid2>
      </Section>
      {colored && (
        <Section title="Colour" numeral="04">
          <ColorField label="Filament" value={feature.color ?? (feature.op === 'inlay' ? build.case.colors.accessories : build.case.colors[feature.part])} onChange={v => set('color', t => void (t.color = v))} />
          <p className="text-label text-fg-muted mt-1">A colour different from the part becomes its own body in the 3MF, for AMS or MMU printing.</p>
        </Section>
      )}
    </>
  )
}

// ── Accessory ────────────────────────────────────────────────────────────────

const ACC_LABEL: Record<Accessory['kind'], string> = {
  slider: 'Screen slider',
  picatinny: 'Picatinny rail',
  handle: 'Handle',
  foot: 'Foot',
  deckport: 'DeckPort',
}

function SliderInspector({ acc }: { acc: Accessory }) {
  const build = useBuild(s => s.build)
  const update = useBuild(s => s.update)
  const select = useBuild(s => s.select)
  const edit = useEdit()
  const id = acc.id
  const set = (key: string, fn: (t: Accessory) => void) =>
    edit(`acc.${id}.${key}`, b => {
      const t = b.accessories.find(q => q.id === id)
      if (t) fn(t)
    })
  const displays = build.placements.filter(pl => componentById(pl.componentId)?.category === 'display')
  const g = sliderGeometry(build, acc)
  const p = build.case.params
  return (
    <>
      <Section
        title="Screen slider"
        numeral="01"
        actions={
          <button
            className="btn-ghost text-severity-critical"
            title="Remove"
            onClick={() => {
              update(b => void (b.accessories = b.accessories.filter(q => q.id !== id)))
              select({ kind: 'case' })
            }}
          >
            <Trash2 size={14} />
          </button>
        }
      >
        <div className="space-y-2">
          <SelectField
            label="Display on the carriage"
            value={acc.targetId ?? ''}
            options={[{ value: '', label: 'None — size it by hand' }, ...displays.map(d => ({ value: d.id, label: d.label ?? componentById(d.componentId)!.name }))]}
            onChange={v => set('target', t => void (t.targetId = v || undefined))}
            hint="The carriage pocket, bezel window and cable slot are sized from this display."
          />
          <Grid2>
            <NumberField label="Closed position u" unit="mm" value={acc.u} onChange={v => set('u', t => void (t.u = v))} />
            <NumberField label="Closed position v" unit="mm" value={acc.v} onChange={v => set('v', t => void (t.v = v))} />
            <NumberField label="Travel" unit="mm" value={acc.travel ?? 80} min={0} onChange={v => set('travel', t => void (t.travel = v))} />
            <NumberField label="Carriage width" unit="mm" value={acc.width ?? 0} min={0} onChange={v => set('width', t => void (t.width = v || undefined))} hint="0 = fit the display" />
            {!acc.targetId && <NumberField label="Carriage length" unit="mm" value={acc.length} min={30} onChange={v => set('length', t => void (t.length = v))} />}
          </Grid2>
          <Field2 label="Slides along">
            <Segmented value={acc.rotation} onChange={v => set('rot', t => void (t.rotation = v))} options={[{ value: 0, label: 'Front → back' }, { value: 90, label: 'Right → left' }]} />
          </Field2>
          <ColorField label="Colour" value={acc.color ?? build.case.colors.accessories} onChange={v => set('color', t => void (t.color = v))} />
        </div>
      </Section>
      <Section title="Result" numeral="02">
        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-ui">
          <dt className="text-fg-muted">Carriage</dt>
          <dd className="font-mono text-fg">{Math.round(g.CW)} × {Math.round(g.CL)} × {Math.round(g.CH)} mm</dd>
          <dt className="text-fg-muted">Rails</dt>
          <dd className="font-mono text-fg">2 × {Math.round(g.CL + g.travel)} mm, {Math.round(g.railX * 2)} mm apart</dd>
          <dt className="text-fg-muted">Footprint</dt>
          <dd className="font-mono text-fg">{Math.round(g.span)} mm with stops, on a {acc.rotation === 90 ? p.width : p.depth} mm lid</dd>
        </dl>
        <p className="text-label text-fg-muted mt-2">Use “Slide screen” in the toolbar to check the travel. See Documentation → Screen slider for assembly.</p>
      </Section>
    </>
  )
}

function AccessoryInspector({ acc }: { acc: Accessory }) {
  if (acc.kind === 'slider') return <SliderInspector acc={acc} />
  return <AccessoryInspectorBody acc={acc} />
}

function AccessoryInspectorBody({ acc }: { acc: Accessory }) {
  const build = useBuild(s => s.build)
  const update = useBuild(s => s.update)
  const select = useBuild(s => s.select)
  const edit = useEdit()
  const id = acc.id
  const set = (key: string, fn: (t: Accessory) => void) =>
    edit(`acc.${id}.${key}`, b => {
      const t = b.accessories.find(q => q.id === id)
      if (t) fn(t)
    })
  const size = faceSize(build.case.params, acc.part, acc.face)
  const isPort = acc.kind === 'deckport'
  return (
    <>
      <Section
        title={ACC_LABEL[acc.kind]}
        numeral="01"
        actions={
          <button
            className="btn-ghost text-severity-critical"
            title="Remove"
            onClick={() => {
              update(b => void (b.accessories = b.accessories.filter(q => q.id !== id)))
              select({ kind: 'case' })
            }}
          >
            <Trash2 size={14} />
          </button>
        }
      >
        <div className="space-y-2">
          <Grid2>
            <SelectField label="Part" value={acc.part} options={PART_OPTS} onChange={v => set('part', t => void (t.part = v))} />
            <SelectField label="Face" value={acc.face} options={FACE_OPTS} onChange={v => set('face', t => void (t.face = v))} />
            <NumberField label="Offset u" unit="mm" value={acc.u} min={-size.u / 2} max={size.u / 2} onChange={v => set('u', t => void (t.u = v))} />
            <NumberField label="Offset v" unit="mm" value={acc.v} min={-size.v / 2} max={size.v / 2} onChange={v => set('v', t => void (t.v = v))} />
            {!isPort && acc.kind !== 'foot' && <NumberField label="Length" unit="mm" value={acc.length} min={acc.kind === 'handle' ? 80 : 30} onChange={v => set('length', t => void (t.length = v))} />}
          </Grid2>
          <Field2 label="Orientation">
            <Segmented value={acc.rotation} onChange={v => set('rot', t => void (t.rotation = v))} options={[{ value: 0, label: 'Along u' }, { value: 90, label: 'Along v' }]} />
          </Field2>
          {!isPort && <ColorField label="Colour" value={acc.color ?? build.case.colors.accessories} onChange={v => set('color', t => void (t.color = v))} />}
        </div>
      </Section>
      <Section title="How it attaches" numeral="02">
        <p className="text-ui text-fg-secondary">
          {isPort
            ? build.kind === 'module'
              ? `Module plug: a ${SOCKET.recess.w - 0.4} × ${SOCKET.recess.h - 0.4} mm key that seats in the Core recess, a connector window and four M3 clearance holes. Screws go from inside the module into the Core's inserts.`
              : `Core socket: ${SOCKET.width} × ${SOCKET.height} mm footprint, ${SOCKET.recess.depth} mm alignment recess, ${SOCKET.connectorWindow.w} × ${SOCKET.connectorWindow.h} mm connector window and four M3 heat-set inserts.`
            : 'Printed as a separate piece. M3 heat-set inserts go into bosses behind the case wall; the screws go through counterbored holes in the accessory.'}
        </p>
      </Section>
    </>
  )
}
