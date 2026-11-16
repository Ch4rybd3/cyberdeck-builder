import { useMemo } from 'react'

import { INSERTS } from '../domain/hardware'
import { MATERIALS, PRINTERS, printerById } from '../domain/printers'
import type { InsertSize, PrintSettings } from '../domain/schema'
import { binaryStl, orientPiece, slug, stlZip, threeMf } from '../geometry/export'
import { stepFile } from '../geometry/step'
import { download } from '../lib/download'
import { useBuild } from '../store/buildStore'
import { Plates } from './print/Plates'
import { useGeometry } from '../store/geometryStore'
import { Download } from '../ui/icons'
import { Callout, NumberField, Panel, PanelHeader, PageShell, SelectField, StatTile, Tag, Toggle } from '../ui/primitives'

export function PrintPage() {
  const build = useBuild(s => s.build)
  const update = useBuild(s => s.update)
  const { result, busy } = useGeometry()
  const ps = build.print
  const printer = printerById(ps.printerId)
  const set = <K extends keyof PrintSettings>(k: K, v: PrintSettings[K]) => update(b => void (b.print[k] = v), { coalesce: `print.${k}` })

  const stats = useMemo(() => {
    if (!result) return null
    const mat = MATERIALS[ps.material]
    const colors = new Set(result.pieces.flatMap(p => p.bodies.map(b => b.color.toUpperCase())))
    const grams = result.pieces.reduce((a, p) => a + p.bodies.reduce((x, b) => x + (b.volume / 1000) * mat.density * (0.55 + 0.45 * (ps.infillPercent / 100)), 0), 0)
    const inserts = result.fasteners.length
    return { colors: [...colors], grams, inserts, failing: result.pieces.filter(p => !p.fitsBed).length }
  }, [result, ps.material, ps.infillPercent])

  const jointCount = result?.fasteners.filter(f => f.purpose === 'split-joint').length ?? 0

  return (
    <PageShell
      route="/print"
      title="Print"
      meta={printer.name}
      subtitle={busy ? 'Rebuilding…' : undefined}
      actions={
        <>
          <button
            className="btn-secondary flex items-center gap-1.5"
            disabled={!result}
            title="Faceted solids, assembled, for FreeCAD, Fusion 360, Onshape or SolidWorks"
            onClick={() => result && download(stepFile(build.name, result.pieces), `${slug(build.name)}.step`, 'model/step')}
          >
            <Download size={14} /> STEP (CAD)
          </button>
          <button className="btn-secondary flex items-center gap-1.5" disabled={!result} onClick={() => result && download(stlZip(build.name, result.pieces), `${slug(build.name)}-stl.zip`, 'application/zip')}>
            <Download size={14} /> STL (zip)
          </button>
          <button className="btn-primary flex items-center gap-1.5" disabled={!result} onClick={() => result && download(threeMf(build.name, result.pieces), `${slug(build.name)}.3mf`, 'model/3mf')}>
            <Download size={14} /> 3MF, multi-colour
          </button>
        </>
      }
    >
      <div className="grid lg:grid-cols-[320px,1fr] gap-4 max-w-7xl">
        <Panel>
          <PanelHeader title="Settings" numeral="01" />
          <div className="p-4 space-y-3">
            <SelectField label="Printer" value={ps.printerId} options={PRINTERS.map(p => ({ value: p.id, label: p.name }))} onChange={v => set('printerId', v)} hint={`${printer.bed.x} × ${printer.bed.y} × ${printer.bed.z} mm · ${printer.colorSystem}`} />
            <SelectField label="Material" value={ps.material} options={(Object.keys(MATERIALS) as (keyof typeof MATERIALS)[]).map(m => ({ value: m, label: m }))} onChange={v => set('material', v)} hint={MATERIALS[ps.material].note} />
            <NumberField label="Infill" unit="%" value={ps.infillPercent} min={0} max={100} onChange={v => set('infillPercent', v)} />
            <Toggle label="Split pieces that exceed the bed" checked={ps.autoSplit} onChange={v => set('autoSplit', v)} hint="Cuts are joined with heat-set inserts on one side and screws from the other." />
            <SelectField<InsertSize>
              label="Joint insert"
              value={ps.jointInsert}
              options={(['M2', 'M2.5', 'M3', 'M4'] as InsertSize[]).map(v => ({ value: v, label: `${v} — hole Ø${INSERTS[v].holeD} mm` }))}
              onChange={v => set('jointInsert', v)}
            />
          </div>
        </Panel>

        <div className="space-y-4 min-w-0">
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <StatTile label="Pieces" value={result!.pieces.length} hint={stats.failing ? `${stats.failing} do not fit` : 'All fit the bed'} tone={stats.failing ? 'critical' : undefined} />
              <StatTile label="Filament" value={Math.ceil(stats.grams)} unit="g" hint={`${ps.material}, ${ps.infillPercent}% infill`} />
              <StatTile label="Colours" value={stats.colors.length} hint={stats.colors.length > printer.colors ? `${printer.name}: ${printer.colors} per print` : printer.colorSystem} tone={stats.colors.length > printer.colors && printer.colors > 1 ? 'medium' : undefined} />
              <StatTile label="Inserts" value={stats.inserts} hint={jointCount ? `${jointCount} in split joints` : 'No split joints'} />
            </div>
          )}

          <Panel>
            <PanelHeader title="Pieces" numeral="02" meta={result ? `${result.pieces.length}` : '…'} />
            <table className="w-full text-ui">
              <thead>
                <tr className="text-left">
                  {['Piece', 'Size (print orientation)', 'Bed', 'Bodies', 'Volume', ''].map(h => <th key={h} className="th">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {result?.pieces.map(p => (
                  <tr key={p.id} className="border-b border-hairline last:border-b-0">
                    <td className="px-4 py-1.5 text-fg">{p.name}{p.printFlip && <span className="text-label text-fg-muted ml-2">prints upside down</span>}</td>
                    <td className="px-4 py-1.5 font-mono tabular-nums">{p.size.map(v => Math.round(v)).join(' × ')} mm</td>
                    <td className="px-4 py-1.5">{p.fitsBed ? <Tag tone="accent">fits</Tag> : <span className="text-label font-mono text-severity-critical">too large</span>}</td>
                    <td className="px-4 py-1.5">
                      <span className="flex gap-1">
                        {p.bodies.map((b, i) => <span key={i} title={b.color} className="inline-block w-3.5 h-3.5 border border-strong" style={{ background: b.color }} />)}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 font-mono tabular-nums">{(p.bodies.reduce((a, b) => a + b.volume, 0) / 1000).toFixed(1)} cm³</td>
                    <td className="px-2 py-1 text-right">
                      <button
                        className="btn-ghost"
                        title={p.bodies.length > 1 ? 'Download this piece as STL (all colours merged)' : 'Download this piece as STL'}
                        onClick={() => {
                          const parts = orientPiece(p)
                          const n = parts.reduce((a, m) => a + m.positions.length, 0)
                          const positions = new Float32Array(n)
                          const indices = new Uint32Array(parts.reduce((a, m) => a + m.indices.length, 0))
                          let vo = 0
                          let io = 0
                          for (const m of parts) {
                            positions.set(m.positions, vo)
                            for (let k = 0; k < m.indices.length; k++) indices[io + k] = m.indices[k] + vo / 3
                            vo += m.positions.length
                            io += m.indices.length
                          }
                          download(binaryStl({ positions, indices }, p.name), `${slug(build.name)}-${slug(p.name)}.stl`, 'model/stl')
                        }}
                      >
                        <Download size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {result && <Plates build={build} pieces={result.pieces} printer={printer} />}

          <Panel>
            <PanelHeader title="Assembly notes" numeral="04" />
            <ol className="list-decimal pl-9 pr-4 py-3 space-y-1.5 text-ui text-fg-secondary">
              <li>Print every piece in the orientation it is exported in: trays open side up, lids top surface down, accessories mounting face down.</li>
              <li>Set the soldering iron to about 220 °C for PLA, 240 °C for PETG, and press each insert in square to the hole with an insert tip. Let it cool before screwing into it.</li>
              {jointCount > 0 && <li>Join split pieces first: insert {ps.jointInsert} inserts into the blocks on one side of each cut, then drive the screws from the blocks on the other side. Tighten gently — the screws clamp, the inserts hold.</li>}
              <li>Mount standoff boards, route wires as shown on the Wiring page, then close the lid with the closure screws from the top.</li>
              {stats && stats.colors.length > 1 && printer.colors === 1 && <li>Single-extruder printer: inlays and stripes on the lid top print first because the lid prints upside down. Insert a filament change (M600) at the layer where the inlay ends.</li>}
            </ol>
          </Panel>
          <Callout title="Slicer tips">
            The 3MF keeps each colour as a separate part of the same object. In Bambu Studio or OrcaSlicer, answer “Yes” when asked to load it as a single object with multiple parts, then assign a filament per part.
          </Callout>
        </div>
      </div>
    </PageShell>
  )
}
