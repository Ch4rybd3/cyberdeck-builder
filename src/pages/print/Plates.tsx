/**
 * Print plates: the pieces packed onto the printer's bed, drawn from above
 * with their real outlines, with a rough time and filament per plate and a
 * 3MF export of each plate as laid out.
 */
import { useMemo } from 'react'

import { filamentGrams, formatDuration, packPlates } from '../../domain/plates'
import { BED_MARGIN, type PrinterProfile } from '../../domain/printers'
import type { Build } from '../../domain/schema'
import type { GeneratedPiece } from '../../geometry/caseBuilder'
import { footprint, slug, threeMf } from '../../geometry/export'
import { download } from '../../lib/download'
import { Download } from '../../ui/icons'
import { Callout, Panel, PanelHeader, StatTile } from '../../ui/primitives'

export function Plates({ build, pieces, printer }: { build: Build; pieces: GeneratedPiece[]; printer: PrinterProfile }) {
  const { plates, oversize } = useMemo(() => packPlates(pieces, printer, build.print.infillPercent), [pieces, printer, build.print.infillPercent])
  const outlines = useMemo(() => new Map(pieces.map(p => [p.id, footprint(p)])), [pieces])
  const total = plates.reduce((a, p) => a + p.minutes, 0)
  const grams = plates.reduce((a, p) => a + filamentGrams(p, build.print.material, build.print.infillPercent), 0)

  return (
    <Panel>
      <PanelHeader title="Plates" numeral="03" meta={`${plates.length} plate${plates.length === 1 ? '' : 's'}`} />
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          <StatTile label="Plates" value={plates.length} hint={`${printer.name}, ${printer.bed.x} × ${printer.bed.y} mm`} />
          <StatTile label="Print time, rough" value={formatDuration(total)} hint={`At about ${printer.flow} mm³/s on average`} />
          <StatTile label="Filament" value={Math.ceil(grams)} unit="g" hint={build.print.material} />
        </div>
        {oversize.length > 0 && <Callout tone="warn">{oversize.map(p => p.name).join(', ')} {oversize.length > 1 ? 'do' : 'does'} not fit the bed and {oversize.length > 1 ? 'are' : 'is'} left out. Turn on splitting or pick a larger printer.</Callout>}
        <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {plates.map((plate, k) => (
            <div key={k} className="border border-hairline">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-hairline">
                <span className="numeral">P{k + 1}</span>
                <span className="text-ui text-fg">{plate.items.length} piece{plate.items.length > 1 ? 's' : ''}</span>
                <span className="text-label font-mono text-fg-muted">≈ {formatDuration(plate.minutes)} · {Math.ceil(filamentGrams(plate, build.print.material, build.print.infillPercent))} g</span>
                <span className="flex gap-0.5 ml-1">
                  {plate.colors.map(c => <span key={c} className="inline-block w-3 h-3 border border-strong" style={{ background: c }} title={c} />)}
                </span>
                <button
                  className="btn-ghost ml-auto"
                  title="Download this plate as a 3MF, laid out as shown"
                  onClick={() => {
                    const ps = plate.items.map(i => i.piece)
                    download(threeMf(`${build.name} — plate ${k + 1}`, ps, plate.items.map(i => ({ x: i.x, y: i.y, rotated: i.rotated }))), `${slug(build.name)}-plate-${k + 1}.3mf`, 'model/3mf')
                  }}
                >
                  <Download size={13} />
                </button>
              </div>
              <svg viewBox={`0 0 ${printer.bed.x} ${printer.bed.y}`} className="w-full block bg-canvas" role="img" aria-label={`Plate ${k + 1}`}>
                <rect x={0} y={0} width={printer.bed.x} height={printer.bed.y} fill="none" stroke="rgb(var(--border-strong))" strokeWidth={1} />
                <rect x={BED_MARGIN} y={BED_MARGIN} width={printer.bed.x - 2 * BED_MARGIN} height={printer.bed.y - 2 * BED_MARGIN} fill="none" stroke="rgb(var(--border-hairline))" strokeDasharray="4 3" strokeWidth={0.8} />
                {plate.items.map(it => {
                  const hull = outlines.get(it.piece.id) ?? []
                  // Bed y runs away from you; SVG y runs down, so flip it.
                  const pts = hull.map(([x, y]) => (it.rotated ? [-y, x] : [x, y])).map(([x, y]) => `${(it.x + x).toFixed(1)},${(printer.bed.y - (it.y + y)).toFixed(1)}`).join(' ')
                  return (
                    <g key={it.piece.id}>
                      <polygon points={pts} fill={it.piece.bodies[0].color} fillOpacity={0.55} stroke="rgb(var(--accent))" strokeWidth={0.8}>
                        <title>{`${it.piece.name} — ${Math.round(it.w)} × ${Math.round(it.d)} mm`}</title>
                      </polygon>
                      {/* Only label pieces large enough to hold their name; the rest show it on hover. */}
                      {it.w >= 45 && it.d >= 14 && <text x={it.x} y={printer.bed.y - it.y} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(5, Math.min(9, it.w / 12))} fill="rgb(var(--text-primary))" style={{ fontFamily: 'var(--font-mono)' }}>
                        {it.piece.name.length > 22 ? `${it.piece.name.slice(0, 21)}…` : it.piece.name}
                      </text>}
                    </g>
                  )
                })}
              </svg>
            </div>
          ))}
        </div>
        <p className="text-label text-fg-muted">Times are a rough estimate from volume and the printer's average flow; your slicer gives the real figure. Lids are shown as they print, top surface down.</p>
      </div>
    </Panel>
  )
}
