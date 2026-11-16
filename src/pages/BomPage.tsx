import { useMemo } from 'react'

import { bomCsv, bomTotal, buildBom, type BomCategory } from '../domain/bom'
import { download } from '../lib/download'
import { useBuild } from '../store/buildStore'
import { useGeometry } from '../store/geometryStore'
import { Download } from '../ui/icons'
import { Callout, Panel, PanelHeader, PageShell, StatTile } from '../ui/primitives'

const ORDER: BomCategory[] = ['Electronics', 'Hardware', 'Wiring', 'Filament']

export function BomPage() {
  const build = useBuild(s => s.build)
  const geo = useGeometry(s => s.result)
  const lines = useMemo(() => buildBom(build, geo), [build, geo])
  const total = bomTotal(lines)

  return (
    <PageShell
      route="/bom"
      title="Shopping list"
      meta={build.name}
      actions={
        <button className="btn-primary flex items-center gap-1.5" onClick={() => download(bomCsv(lines), `${build.name}-shopping-list.csv`, 'text/csv')}>
          <Download size={14} /> Export CSV
        </button>
      }
    >
      <div className="space-y-4 max-w-6xl">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <StatTile label="Estimated total" value={`€${total.toFixed(0)}`} tone="accent" />
          {ORDER.map(cat => {
            const sub = lines.filter(l => l.category === cat)
            return <StatTile key={cat} label={cat} value={`€${bomTotal(sub).toFixed(2)}`} hint={`${sub.length} line${sub.length === 1 ? '' : 's'}`} />
          })}
        </div>
        {ORDER.map((cat, idx) => {
          const sub = lines.filter(l => l.category === cat)
          if (!sub.length) return null
          return (
            <Panel key={cat}>
              <PanelHeader title={cat} numeral={String(idx + 1).padStart(2, '0')} meta={`€${bomTotal(sub).toFixed(2)}`} />
              <table className="w-full text-ui">
                <thead>
                  <tr className="text-left">
                    {['Item', 'Qty', 'Unit price', 'Total', 'Supplier', 'Note'].map(h => <th key={h} className="th">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sub.map(l => (
                    <tr key={l.key} className="border-b border-hairline last:border-b-0">
                      <td className="px-4 py-1.5 text-fg">{l.url ? <a href={l.url} target="_blank" rel="noreferrer" className="hover:text-accent underline-offset-2 hover:underline">{l.name}</a> : l.name}</td>
                      <td className="px-4 py-1.5 font-mono tabular-nums whitespace-nowrap">{l.qty} {l.unit}</td>
                      <td className="px-4 py-1.5 font-mono tabular-nums">€{l.unit === 'g' ? (l.unitPrice * 1000).toFixed(0) + '/kg' : l.unitPrice.toFixed(2)}</td>
                      <td className="px-4 py-1.5 font-mono tabular-nums">€{(l.qty * l.unitPrice).toFixed(2)}</td>
                      <td className="px-4 py-1.5 text-fg-secondary">{l.supplier}</td>
                      <td className="px-4 py-1.5 text-fg-muted">{l.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )
        })}
        <Callout title="About these numbers">
          Inserts and screws are counted from the generated case, including split joints, so they change when you change the printer. Prices are indicative street prices; filament assumes a {build.print.material} spool and {build.print.infillPercent}% infill.
        </Callout>
      </div>
    </PageShell>
  )
}
