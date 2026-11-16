/**
 * DeckID — the identity card of a build: who made it, what it is, and its key
 * numbers, computed from the build itself so the card never goes stale.
 */
import { useMemo, useRef } from 'react'

import { componentById } from '../catalog/components'
import { analysePower, fmt } from '../domain/power'
import type { Identity } from '../domain/schema'
import { useBuild } from '../store/buildStore'
import { useGeometry } from '../store/geometryStore'
import { Camera, Trash2 } from '../ui/icons'
import { Panel, PanelHeader, PageShell, SelectField, Tag, TextField } from '../ui/primitives'

const LICENSES = ['CERN-OHL-S-2.0', 'CERN-OHL-W-2.0', 'CERN-OHL-P-2.0', 'CC-BY-SA-4.0', 'CC-BY-4.0', 'CC-BY-NC-SA-4.0', 'MIT', 'All rights reserved']

export function IdentityPage() {
  const build = useBuild(s => s.build)
  const update = useBuild(s => s.update)
  const geo = useGeometry(s => s.result)
  const fileRef = useRef<HTMLInputElement>(null)
  const id = build.identity
  const set = <K extends keyof Identity>(k: K, v: Identity[K]) => update(b => void (b.identity[k] = v), { coalesce: `id.${k}` })

  const facts = useMemo(() => {
    const power = analysePower(build)
    const comps = build.placements.map(p => componentById(p.componentId)).filter(Boolean)
    const sbc = comps.find(c => c!.category === 'sbc')
    const display = comps.find(c => c!.category === 'display')
    const input = comps.filter(c => c!.category === 'input').map(c => c!.name)
    const radios = comps.filter(c => c!.category === 'radio').map(c => c!.name)
    const p = build.case.params
    const mass = comps.reduce((a, c) => a + c!.mass, 0) + (geo ? geo.pieces.reduce((a, pc) => a + pc.bodies.reduce((x, b) => x + (b.volume / 1000) * 1.25 * 0.7, 0), 0) : 0)
    return {
      sbc: sbc?.name ?? '—',
      display: display?.name ?? '—',
      input: input.join(', ') || '—',
      radios: radios.join(', ') || '—',
      size: `${p.width} × ${p.depth} × ${p.trayHeight + p.lidHeight} mm`,
      mass: `${(mass / 1000).toFixed(2)} kg`,
      battery: power.battery.count ? `${fmt(power.battery.wh)} Wh` : 'External',
      runtime: power.autonomyTypH ? `${fmt(power.autonomyTypH)} h typical` : '—',
      sockets: build.accessories.filter(a => a.kind === 'deckport').length,
    }
  }, [build, geo])

  const onPhoto = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      // Downscale so the build stays small in IndexedDB and exports.
      const img = new Image()
      img.onload = () => {
        const max = 1200
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        set('photo', canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <PageShell route="/identity" title="DeckID" meta={build.name} actions={<button className="btn-secondary" onClick={() => window.print()}>Print card</button>}>
      <div className="grid xl:grid-cols-[360px,1fr] gap-4 max-w-7xl">
        <Panel>
          <PanelHeader title="Identity" numeral="01" />
          <div className="p-4 space-y-3">
            <TextField label="Name" value={build.name} onChange={v => update(b => void (b.name = v), { coalesce: 'name' })} />
            <TextField label="Codename" value={id.codename} placeholder="WFR-01" onChange={v => set('codename', v)} />
            <TextField label="Author" value={id.author} onChange={v => set('author', v)} />
            <SelectField label="Status" value={id.status} options={[{ value: 'concept', label: 'Concept' }, { value: 'building', label: 'Building' }, { value: 'built', label: 'Built' }, { value: 'retired', label: 'Retired' }]} onChange={v => set('status', v)} />
            <SelectField label="Licence" value={id.license} options={LICENSES.map(l => ({ value: l, label: l }))} onChange={v => set('license', v)} hint="CERN-OHL-S is a common choice for open hardware." />
            <TextField label="Description" multiline value={id.description} onChange={v => set('description', v)} />
            <TextField label="Tags (comma separated)" value={id.tags.join(', ')} onChange={v => set('tags', v.split(',').map(t => t.trim()).filter(Boolean))} />
            <TextField label="Links (one per line)" multiline value={id.links.join('\n')} onChange={v => set('links', v.split('\n').map(t => t.trim()).filter(Boolean))} />
            <div>
              <span className="label">Photo</span>
              <div className="flex gap-1">
                <button className="btn-secondary flex items-center gap-1.5" onClick={() => fileRef.current?.click()}><Camera size={14} /> {id.photo ? 'Replace' : 'Add photo'}</button>
                {id.photo && <button className="btn-ghost text-severity-critical" onClick={() => set('photo', undefined)}><Trash2 size={14} /></button>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && onPhoto(e.target.files[0])} />
            </div>
          </div>
        </Panel>

        <div>
          <span className="label">Card preview</span>
          <article className="panel max-w-3xl print:border-0">
            <div className="grid md:grid-cols-[1fr,260px]">
              <div className="p-5 border-b md:border-b-0 md:border-r border-hairline">
                <div className="flex items-baseline gap-2">
                  <span className="numeral">{id.codename || 'NO-CODENAME'}</span>
                  <Tag tone={id.status === 'built' ? 'accent' : 'neutral'}>{id.status}</Tag>
                  <span className="ml-auto text-label font-mono text-fg-muted uppercase">{build.kind} · DeckPort {build.deckport}</span>
                </div>
                <h2 className="text-brand font-semibold text-fg mt-1">{build.name}</h2>
                {id.author && <p className="text-ui text-fg-secondary">by {id.author}</p>}
                {id.description && <p className="text-prose text-fg mt-3">{id.description}</p>}
                {id.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-3">{id.tags.map(t => <Tag key={t}>#{t}</Tag>)}</div>}
                <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 mt-4 text-ui">
                  {[
                    ['Compute', facts.sbc],
                    ['Display', facts.display],
                    ['Input', facts.input],
                    ['Radios', facts.radios],
                    ['Size', facts.size],
                    ['Mass', facts.mass],
                    ['Battery', facts.battery],
                    ['Runtime', facts.runtime],
                    ['DeckPort sockets', String(facts.sockets)],
                  ].map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="label mb-0 pt-0.5">{k}</dt>
                      <dd className="font-mono text-fg">{v}</dd>
                    </div>
                  ))}
                </dl>
                {build.forkedFrom && <p className="text-label text-fg-muted mt-4">Forked from {build.forkedFrom.name}</p>}
                {build.targetCore && <p className="text-label text-fg-muted mt-1">Module for {build.targetCore.name}</p>}
              </div>
              <div className="flex flex-col">
                <div className="aspect-[4/3] md:aspect-auto md:flex-1 bg-canvas flex items-center justify-center min-h-[180px]">
                  {id.photo ? <img src={id.photo} alt={build.name} className="w-full h-full object-cover" /> : <span className="text-label font-mono text-fg-muted">No photo</span>}
                </div>
                <div className="p-3 border-t border-hairline text-label font-mono text-fg-muted">
                  <div>{id.license}</div>
                  <div>Updated {new Date(build.updatedAt).toISOString().slice(0, 10)}</div>
                  <div className="truncate">ID {build.id}</div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </PageShell>
  )
}
