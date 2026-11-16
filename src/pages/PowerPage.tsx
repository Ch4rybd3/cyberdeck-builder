import { useMemo } from 'react'

import { CATEGORY_DATA_SLOT } from '../catalog/types'
import { analysePower, fmt, USABLE_FRACTION } from '../domain/power'
import { useBuild } from '../store/buildStore'
import { Zap } from '../ui/icons'
import { Callout, DataDot, EmptyState, Panel, PanelHeader, PageShell, SeverityBadge, StatTile } from '../ui/primitives'

function hours(h: number | null): string {
  if (h === null) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  return `${fmt(h, 1)} h`
}

export function PowerPage() {
  const build = useBuild(s => s.build)
  const r = useMemo(() => analysePower(build), [build])
  const empty = !r.loads.length && !r.converters.length && !r.battery.count

  return (
    <PageShell route="/power" title="Power budget" meta={build.name}>
      {empty ? (
        <EmptyState icon={Zap} title="Nothing to power yet" body="Add an SBC, a display, a battery and a converter in the Workshop and the budget appears here." />
      ) : (
        <div className="space-y-4 max-w-6xl">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <StatTile label="Battery" value={fmt(r.battery.wh)} unit="Wh" hint={`${r.battery.count} pack${r.battery.count === 1 ? '' : 's'} · ${fmt(r.battery.wh * USABLE_FRACTION)} Wh usable`} />
            <StatTile label="Draw, typical" value={fmt(r.drawTypW)} unit="W" hint="From the battery, after converter losses" />
            <StatTile label="Draw, peak" value={fmt(r.drawPeakW)} unit="W" tone={r.battery.count && r.drawPeakW > r.battery.maxW ? 'high' : undefined} hint={r.battery.count ? `Cells deliver ${fmt(r.battery.maxW)} W max` : 'External supply'} />
            <StatTile label="Autonomy" value={hours(r.autonomyTypH)} tone="accent" hint={`${hours(r.autonomyPeakH)} at constant peak load`} />
            <StatTile label="Charge time" value={hours(r.chargeHours)} hint={r.chargeW ? `${fmt(r.chargeW)} W charger` : 'No charger'} />
          </div>

          {r.issues.length > 0 && (
            <Panel>
              <PanelHeader title="Findings" numeral="01" meta={`${r.issues.length}`} />
              <ul>
                {r.issues.map((i, k) => (
                  <li key={k} className="flex gap-2 items-start px-4 py-2 border-b border-hairline last:border-b-0">
                    <SeverityBadge severity={i.severity} />
                    <span className="text-ui text-fg">{i.message}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel>
            <PanelHeader title="Rails" numeral="02" />
            <table className="w-full text-ui">
              <thead>
                <tr className="text-left">
                  {['Rail', 'Typical', 'Peak', 'Capacity', 'Headroom', 'Fed by'].map(h => <th key={h} className="th">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {r.rails.filter(l => l.typW > 0 || l.capacityW).map(l => {
                  const head = l.capacityW !== null ? l.capacityW - l.peakW : null
                  return (
                    <tr key={l.rail} className="border-b border-hairline last:border-b-0">
                      <td className="px-4 py-2 font-mono text-fg">{l.rail}</td>
                      <td className="px-4 py-2 font-mono tabular-nums">{fmt(l.typW)} W</td>
                      <td className="px-4 py-2 font-mono tabular-nums">{fmt(l.peakW)} W</td>
                      <td className="px-4 py-2 font-mono tabular-nums">{l.capacityW !== null ? `${fmt(l.capacityW)} W` : '—'}</td>
                      <td className={`px-4 py-2 font-mono tabular-nums ${head !== null && head < 0 ? 'text-severity-high' : 'text-fg-secondary'}`}>{head !== null ? `${fmt(head)} W` : '—'}</td>
                      <td className="px-4 py-2 text-fg-secondary">{l.feeders.join(', ') || (l.rail === '3V3' ? 'SBC regulator' : '—')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <MeterRow rails={r.rails} />
          </Panel>

          <div className="grid lg:grid-cols-2 gap-4">
            <Panel>
              <PanelHeader title="Loads" numeral="03" meta={`${r.loads.length}`} />
              <table className="w-full text-ui">
                <thead>
                  <tr className="text-left">
                    {['Component', 'Rail', 'Typical', 'Peak'].map(h => <th key={h} className="th">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {r.loads.map(l => (
                    <tr key={l.placement.id} className="border-b border-hairline last:border-b-0">
                      <td className="px-4 py-1.5"><span className="flex items-center gap-2"><DataDot slot={CATEGORY_DATA_SLOT[l.component.category]} />{l.placement.label ?? l.component.name}</span></td>
                      <td className="px-4 py-1.5 font-mono">{l.rail}</td>
                      <td className="px-4 py-1.5 font-mono tabular-nums">{fmt(l.typW)} W</td>
                      <td className="px-4 py-1.5 font-mono tabular-nums">{fmt(l.peakW)} W</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel>
              <PanelHeader title="Converters" numeral="04" meta={`${r.converters.length}`} />
              <table className="w-full text-ui">
                <thead>
                  <tr className="text-left">
                    {['Converter', 'Path', 'Out peak', 'Rating', 'Loss'].map(h => <th key={h} className="th">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {r.converters.map(c => (
                    <tr key={c.placement.id} className="border-b border-hairline last:border-b-0">
                      <td className="px-4 py-1.5">{c.placement.label ?? c.component.name}</td>
                      <td className="px-4 py-1.5 font-mono">{c.in} → {c.out}</td>
                      <td className={`px-4 py-1.5 font-mono tabular-nums ${c.outPeakW > c.maxW ? 'text-severity-high' : ''}`}>{fmt(c.outPeakW)} W</td>
                      <td className="px-4 py-1.5 font-mono tabular-nums">{c.maxW} W</td>
                      <td className="px-4 py-1.5 font-mono tabular-nums text-fg-secondary">{fmt(c.inTypW - c.outTypW)} W</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
          <Callout title="How this is computed">
            Every battery is treated as 1S and in parallel. Loads are summed per rail; each converter takes a share of its output rail proportional to its rating and draws that share divided by its efficiency from its input rail. Autonomy uses {Math.round(USABLE_FRACTION * 100)}% of rated capacity. See Documentation → Power for details.
          </Callout>
        </div>
      )}
    </PageShell>
  )
}

function MeterRow({ rails }: { rails: ReturnType<typeof analysePower>['rails'] }) {
  const shown = rails.filter(r => r.capacityW)
  if (!shown.length) return null
  return (
    <div className="px-4 py-3 border-t border-hairline grid gap-2">
      {shown.map(r => {
        const typ = Math.min(1, r.typW / (r.capacityW || 1))
        const peak = Math.min(1, r.peakW / (r.capacityW || 1))
        const over = r.peakW > (r.capacityW || 0)
        return (
          <div key={r.rail} className="flex items-center gap-3">
            <span className="font-mono text-label text-fg-muted w-10">{r.rail}</span>
            <div className="flex-1 h-2 bg-fg/5 relative">
              <div className="absolute inset-y-0 left-0 bg-accent/30" style={{ width: `${peak * 100}%` }} />
              <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${typ * 100}%` }} />
              {over && <div className="absolute inset-y-0 right-0 w-1 bg-severity-high" />}
            </div>
            <span className="font-mono text-label text-fg-secondary w-24 text-right tabular-nums">{Math.round((r.peakW / (r.capacityW || 1)) * 100)}% at peak</span>
          </div>
        )
      })}
    </div>
  )
}
