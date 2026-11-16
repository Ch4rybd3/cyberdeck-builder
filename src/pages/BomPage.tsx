/**
 * Shopping list. Lines come from the build and its generated case; your edits
 * (unit prices, "already have it") are stored in the build, keyed by line,
 * so they survive regeneration and travel with exports.
 */
import { useMemo } from 'react'

import { bomCsv, bomToBuy, bomTotal, buildBom, type BomCategory, type BomLine } from '../domain/bom'
import { download } from '../lib/download'
import { useBuild } from '../store/buildStore'
import { useGeometry } from '../store/geometryStore'
import { Download } from '../ui/icons'
import { Callout, NumberInput, Panel, PanelHeader, PageShell, StatTile } from '../ui/primitives'

const ORDER: BomCategory[] = ['Electronics', 'Hardware', 'Wiring', 'Filament']

export function BomPage() {
  const build = useBuild(s => s.build)
  const update = useBuild(s => s.update)
  const geo = useGeometry(s => s.result)
  const lines = useMemo(() => buildBom(build, geo), [build, geo])
  const total = bomTotal(lines)
  const toBuy = bomToBuy(lines)
  const edited = Object.keys(build.bom?.prices ?? {}).length + Object.values(build.bom?.owned ?? {}).filter(Boolean).length

  // Filament is priced per kg in the table but stored per gram.
  const perUnit = (l: BomLine) => (l.unit === 'g' ? 1000 : 1)
  const setPrice = (l: BomLine, shown: number) =>
    update(b => void (b.bom.prices[l.key] = shown / perUnit(l)), { coalesce: `bom.price.${l.key}` })
  const resetPrice = (l: BomLine) =>
    update(b => {
      delete b.bom.prices[l.key]
    })
  const setOwned = (l: BomLine, v: boolean) =>
    update(b => {
      if (v) b.bom.owned[l.key] = true
      else delete b.bom.owned[l.key]
    })

  return (
    <PageShell
      route="/bom"
      title="Shopping list"
      meta={build.name}
      actions={
        <>
          {edited > 0 && (
            <button className="btn-ghost" title="Back to catalog prices, nothing owned" onClick={() => update(b => void (b.bom = { prices: {}, owned: {} }))}>
              Reset edits
            </button>
          )}
          <button className="btn-primary flex items-center gap-1.5" onClick={() => download(bomCsv(lines), `${build.name}-shopping-list.csv`, 'text/csv')}>
            <Download size={14} /> Export CSV
          </button>
        </>
      }
    >
      <div className="space-y-4 max-w-6xl">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
          <StatTile label="To buy" value={`€${toBuy.toFixed(0)}`} tone="accent" hint={toBuy < total ? `of €${total.toFixed(0)}, the rest you have` : 'Tick what you already have'} />
          <StatTile label="Full build" value={`€${total.toFixed(0)}`} />
          {ORDER.map(cat => {
            const sub = lines.filter(l => l.category === cat)
            return <StatTile key={cat} label={cat} value={`€${bomToBuy(sub).toFixed(2)}`} hint={`${sub.length} line${sub.length === 1 ? '' : 's'}`} />
          })}
        </div>
        {ORDER.map((cat, idx) => {
          const sub = lines.filter(l => l.category === cat)
          if (!sub.length) return null
          return (
            <Panel key={cat}>
              <PanelHeader title={cat} numeral={String(idx + 1).padStart(2, '0')} meta={`€${bomToBuy(sub).toFixed(2)} to buy`} />
              <table className="w-full text-ui">
                <thead>
                  <tr className="text-left">
                    {['Have', 'Item', 'Qty', 'Unit price', 'Total', 'Supplier', 'Note'].map(h => <th key={h} className="th">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sub.map(l => {
                    const overridden = build.bom?.prices[l.key] !== undefined
                    return (
                      <tr key={l.key} className={`border-b border-hairline last:border-b-0 ${l.owned ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-1.5">
                          <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={Boolean(l.owned)} onChange={e => setOwned(l, e.target.checked)} aria-label={`Already have ${l.name}`} />
                        </td>
                        <td className={`px-4 py-1.5 text-fg ${l.owned ? 'line-through' : ''}`}>{l.url ? <a href={l.url} target="_blank" rel="noreferrer" className="hover:text-accent underline-offset-2 hover:underline">{l.name}</a> : l.name}</td>
                        <td className="px-4 py-1.5 font-mono tabular-nums whitespace-nowrap">{l.qty} {l.unit}</td>
                        <td className="px-2 py-1 w-36">
                          <div className="flex items-center gap-1">
                            <NumberInput className="w-24" step={0.01} min={0} value={Number((l.unitPrice * perUnit(l)).toFixed(3))} unit={l.unit === 'g' ? '€/kg' : '€'} onChange={v => setPrice(l, v)} />
                            {overridden && (
                              <button className="btn-ghost px-1 text-label" title={`Catalog price: €${((l.listPrice ?? 0) * perUnit(l)).toFixed(2)}`} onClick={() => resetPrice(l)}>
                                ↺
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-1.5 font-mono tabular-nums">€{(l.qty * l.unitPrice).toFixed(2)}</td>
                        <td className="px-4 py-1.5 text-fg-secondary">{l.supplier}</td>
                        <td className="px-4 py-1.5 text-fg-muted">{l.note}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Panel>
          )
        })}
        <Callout title="About these numbers">
          Inserts and screws are counted from the generated case, including split joints, so they change when you change the printer. Prices start from indicative street prices: type your supplier's price to replace one (↺ restores it), and tick what you already have. Your edits are saved in the build. Filament assumes a {build.print.material} spool and {build.print.infillPercent}% infill.
        </Callout>
      </div>
    </PageShell>
  )
}
