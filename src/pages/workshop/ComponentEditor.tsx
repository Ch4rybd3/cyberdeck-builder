/**
 * Editor for custom components: the user's own parts, stored in the build so
 * they travel with it. Everything a catalog entry has can be set here —
 * envelope, mounting holes, windows, power role and ports.
 */
import { useState, type ReactNode } from 'react'

import { CATEGORY_LABEL, PORT_LABEL, type Category, type PortType } from '../../catalog/types'
import type { CustomComponent, InsertSize } from '../../domain/schema'
import { useBuild } from '../../store/buildStore'
import { Plus, Trash2 } from '../../ui/icons'
import { Callout, Field, Modal, NumberInput, Section, SelectField, TextField, Toggle } from '../../ui/primitives'

const PORTS = Object.keys(PORT_LABEL) as PortType[]
const RAILS = ['5V', '3V3', '12V', 'VBAT'] as const
type Role = 'none' | 'load' | 'battery' | 'converter' | 'charger'

export function blankComponent(id: string): CustomComponent {
  return { id, name: 'New part', category: 'io', dims: { x: 40, y: 30, z: 10 }, mass: 10, price: 0, supplier: '' }
}

export function ComponentEditor({ initial, onClose }: { initial: CustomComponent; onClose: () => void }) {
  const build = useBuild(s => s.build)
  const update = useBuild(s => s.update)
  const [c, setC] = useState<CustomComponent>(() => structuredClone(initial))
  const isNew = !build.customComponents.some(x => x.id === initial.id)
  const usedBy = build.placements.filter(p => p.componentId === c.id).length
  const patch = (p: Partial<CustomComponent>) => setC(prev => ({ ...prev, ...p }))
  const role: Role = c.power?.role ?? 'none'

  const save = () => {
    update(b => {
      const i = b.customComponents.findIndex(x => x.id === c.id)
      if (i === -1) b.customComponents.push(c)
      else b.customComponents[i] = c
    })
    onClose()
  }
  const remove = () => {
    update(b => void (b.customComponents = b.customComponents.filter(x => x.id !== c.id)))
    onClose()
  }

  const setRole = (r: Role) => {
    const defaults: Record<Role, CustomComponent['power']> = {
      none: undefined,
      load: { role: 'load', rail: '5V', typW: 1, peakW: 2 },
      battery: { role: 'battery', nominalV: 3.7, capacityWh: 10, maxW: 20, chemistry: 'Li-ion' },
      converter: { role: 'converter', in: 'VBAT', out: '5V', maxW: 15, efficiency: 0.9 },
      charger: { role: 'charger', chargeW: 10 },
    }
    patch({ power: defaults[r] })
  }
  const pw = <K extends string>(k: K, v: number | string) => setC(prev => ({ ...prev, power: { ...(prev.power as object), [k]: v } as CustomComponent['power'] }))

  const holes = c.mounting?.holes ?? []

  return (
    <Modal
      title={isNew ? 'New custom component' : `Edit ${initial.name}`}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button className="btn-danger flex items-center gap-1.5" disabled={usedBy > 0} title={usedBy ? 'Remove its placements first' : undefined} onClick={remove}>
              <Trash2 size={13} /> Delete
            </button>
          )}
          {usedBy > 0 && <span className="text-label text-fg-muted">Used by {usedBy} placement{usedBy > 1 ? 's' : ''}.</span>}
          <div className="flex-1" />
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={!c.name.trim()}>Save</button>
        </>
      }
    >
      <Section title="Identity" numeral="01">
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Name" value={c.name} onChange={v => patch({ name: v })} />
          <SelectField<Category> label="Category" value={c.category} options={(Object.keys(CATEGORY_LABEL) as Category[]).map(k => ({ value: k, label: CATEGORY_LABEL[k] }))} onChange={v => patch({ category: v })} />
          <TextField label="Supplier" value={c.supplier} onChange={v => patch({ supplier: v })} />
          <TextField label="Product URL" value={c.url ?? ''} onChange={v => patch({ url: v || undefined })} />
          <Num label="Price" unit="€" value={c.price} onChange={v => patch({ price: v })} />
          <Num label="Mass" unit="g" value={c.mass} onChange={v => patch({ mass: v })} />
        </div>
        <div className="mt-2">
          <TextField label="Notes" multiline value={c.notes ?? ''} onChange={v => patch({ notes: v || undefined })} />
        </div>
      </Section>

      <Section title="Envelope" numeral="02">
        <div className="grid grid-cols-3 gap-2">
          <Num label="Width (x)" unit="mm" value={c.dims.x} min={0.5} onChange={v => patch({ dims: { ...c.dims, x: v } })} />
          <Num label="Depth (y)" unit="mm" value={c.dims.y} min={0.5} onChange={v => patch({ dims: { ...c.dims, y: v } })} />
          <Num label="Height (z)" unit="mm" value={c.dims.z} min={0.5} onChange={v => patch({ dims: { ...c.dims, z: v } })} />
        </div>
        <p className="text-label text-fg-muted mt-1">Round up: the box is used for collisions and fit, so include connectors and cable bends.</p>
      </Section>

      <Section title="Mounting holes" numeral="03">
        <Toggle label="Has mounting holes" checked={Boolean(c.mounting)} onChange={v => patch({ mounting: v ? { insert: 'M2.5', holes: rectHoles(c.dims.x - 7, c.dims.y - 7), standoff: 5 } : undefined })} />
        {c.mounting && (
          <div className="space-y-2 mt-2">
            <div className="grid grid-cols-3 gap-2">
              <SelectField<InsertSize> label="Insert" value={c.mounting.insert} options={(['M2', 'M2.5', 'M3', 'M4'] as InsertSize[]).map(v => ({ value: v, label: v }))} onChange={v => patch({ mounting: { ...c.mounting!, insert: v } })} />
              <Num label="Standoff height" unit="mm" value={c.mounting.standoff} min={0} onChange={v => patch({ mounting: { ...c.mounting!, standoff: v } })} />
            </div>
            <RectPattern onApply={(w, h, ox, oy) => patch({ mounting: { ...c.mounting!, holes: rectHoles(w, h, ox, oy) } })} />
            <TextField
              label="Hole centres (x,y; x,y; …) from the component centre"
              value={holes.map(h => h.join(',')).join('; ')}
              onChange={v => {
                const pts = v.split(';').map(s => s.split(',').map(Number)).filter(p => p.length === 2 && p.every(Number.isFinite)) as [number, number][]
                patch({ mounting: { ...c.mounting!, holes: pts } })
              }}
            />
          </div>
        )}
      </Section>

      <Section title="Windows" numeral="04" actions={<button className="btn-ghost" title="Add a window" onClick={() => patch({ windows: [...(c.windows ?? []), { face: 'top', w: 20, h: 10 }] })}><Plus size={14} /></button>}>
        {!c.windows?.length && <p className="text-ui text-fg-muted">Openings the case needs: a screen's active area, a keyboard, a port, a switch.</p>}
        {c.windows?.map((w, i) => (
          <Row key={i} onRemove={() => patch({ windows: c.windows!.filter((_, k) => k !== i) })}>
            <SelectField
              label="Face"
              value={w.face}
              options={(['top', 'front', 'back', 'left', 'right'] as const).map(f => ({ value: f, label: f }))}
              onChange={v => patch({ windows: c.windows!.map((x, k) => (k === i ? { ...x, face: v } : x)) })}
            />
            <Num label="Width" unit="mm" value={w.w} min={0.5} onChange={v => patch({ windows: c.windows!.map((x, k) => (k === i ? { ...x, w: v } : x)) })} />
            <Num label="Height" unit="mm" value={w.h} min={0.5} onChange={v => patch({ windows: c.windows!.map((x, k) => (k === i ? { ...x, h: v } : x)) })} />
            <Num label="Offset u" unit="mm" value={w.u ?? 0} onChange={v => patch({ windows: c.windows!.map((x, k) => (k === i ? { ...x, u: v } : x)) })} />
            <Num label="Offset v" unit="mm" value={w.v ?? 0} onChange={v => patch({ windows: c.windows!.map((x, k) => (k === i ? { ...x, v: v } : x)) })} />
          </Row>
        ))}
      </Section>

      <Section title="Power" numeral="05">
        <SelectField<Role>
          label="Role"
          value={role}
          options={[
            { value: 'none', label: 'Not powered' },
            { value: 'load', label: 'Load (draws power)' },
            { value: 'battery', label: 'Battery' },
            { value: 'converter', label: 'Converter (rail to rail)' },
            { value: 'charger', label: 'Charger' },
          ]}
          onChange={setRole}
        />
        <div className="grid grid-cols-3 gap-2 mt-2">
          {c.power?.role === 'load' && (
            <>
              <SelectField label="Rail" value={c.power.rail} options={RAILS.map(r => ({ value: r, label: r }))} onChange={v => pw('rail', v)} />
              <Num label="Typical" unit="W" step={0.1} value={c.power.typW} onChange={v => pw('typW', v)} />
              <Num label="Peak" unit="W" step={0.1} value={c.power.peakW} onChange={v => pw('peakW', v)} />
            </>
          )}
          {c.power?.role === 'battery' && (
            <>
              <Num label="Capacity" unit="Wh" step={0.1} value={c.power.capacityWh} onChange={v => pw('capacityWh', v)} />
              <Num label="Nominal" unit="V" step={0.1} value={c.power.nominalV} onChange={v => pw('nominalV', v)} />
              <Num label="Max discharge" unit="W" value={c.power.maxW} onChange={v => pw('maxW', v)} />
              <TextField label="Chemistry" value={c.power.chemistry} onChange={v => pw('chemistry', v)} />
            </>
          )}
          {c.power?.role === 'converter' && (
            <>
              <SelectField label="Input rail" value={c.power.in} options={RAILS.map(r => ({ value: r, label: r }))} onChange={v => pw('in', v)} />
              <SelectField label="Output rail" value={c.power.out} options={RAILS.map(r => ({ value: r, label: r }))} onChange={v => pw('out', v)} />
              <Num label="Rating" unit="W" value={c.power.maxW} onChange={v => pw('maxW', v)} />
              <Num label="Efficiency" unit="%" value={Math.round(c.power.efficiency * 100)} min={5} max={100} onChange={v => pw('efficiency', v / 100)} />
              <Num label="Charger" unit="W" value={c.power.chargeW ?? 0} onChange={v => pw('chargeW', v)} />
            </>
          )}
          {c.power?.role === 'charger' && <Num label="Charge power" unit="W" value={c.power.chargeW} onChange={v => pw('chargeW', v)} />}
        </div>
      </Section>

      <Section title="Ports" numeral="06">
        <div className="grid grid-cols-2 gap-4">
          {(['provides', 'consumes'] as const).map(kind => {
            const map = c.ports?.[kind] ?? {}
            const setMap = (m: Partial<Record<PortType, number>>) => patch({ ports: { ...c.ports, [kind]: m } })
            return (
              <div key={kind}>
                <div className="label">{kind === 'provides' ? 'Provides (host, hub)' : 'Uses (plugs into)'}</div>
                {Object.entries(map).map(([port, n]) => (
                  <div key={port} className="flex items-center gap-1.5 mb-1">
                    <span className="text-ui text-fg flex-1">{PORT_LABEL[port as PortType]}</span>
                    <NumberInput className="w-20" value={n ?? 0} min={0} onChange={v => setMap({ ...map, [port]: Math.round(v) })} />
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        const m = { ...map }
                        delete m[port as PortType]
                        setMap(m)
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <select className="input" value="" onChange={e => e.target.value && setMap({ ...map, [e.target.value]: 1 })}>
                  <option value="">Add a port…</option>
                  {PORTS.filter(p => !(p in map)).map(p => (
                    <option key={p} value={p}>{PORT_LABEL[p]}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </Section>
      <div className="px-3 pb-3">
        <Callout>Custom components are saved inside this build, so they go along with share links and exported files.</Callout>
      </div>
    </Modal>
  )
}

function Num(props: { label: string; value: number; onChange: (v: number) => void; unit?: string; min?: number; max?: number; step?: number }) {
  const { label, ...rest } = props
  return (
    <Field label={label}>
      <NumberInput {...rest} />
    </Field>
  )
}

function Row({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_auto] gap-2 items-end mb-2">
      {children}
      <button className="btn-ghost mb-0.5" onClick={onRemove} title="Remove">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

function RectPattern({ onApply }: { onApply: (w: number, h: number, ox: number, oy: number) => void }) {
  const [w, setW] = useState(58)
  const [h, setH] = useState(49)
  const [ox, setOx] = useState(0)
  const [oy, setOy] = useState(0)
  return (
    <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-2 items-end">
      <Num label="Pattern X" unit="mm" value={w} onChange={setW} />
      <Num label="Pattern Y" unit="mm" value={h} onChange={setH} />
      <Num label="Offset X" unit="mm" value={ox} onChange={setOx} />
      <Num label="Offset Y" unit="mm" value={oy} onChange={setOy} />
      <button className="btn-secondary mb-0.5" onClick={() => onApply(w, h, ox, oy)}>Apply</button>
    </div>
  )
}

/** Four holes on a W × H rectangle centred at (ox, oy). */
export function rectHoles(w: number, h: number, ox = 0, oy = 0): [number, number][] {
  return [[-w / 2 + ox, -h / 2 + oy], [w / 2 + ox, -h / 2 + oy], [-w / 2 + ox, h / 2 + oy], [w / 2 + ox, h / 2 + oy]]
}
