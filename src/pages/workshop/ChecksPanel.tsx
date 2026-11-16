import { useMemo } from 'react'

import { checkBuild, SEVERITY_ORDER, type Issue } from '../../domain/constraints'
import { useBuild } from '../../store/buildStore'
import { useAttachedModules, useGeometry } from '../../store/geometryStore'
import { Check } from '../../ui/icons'
import { EmptyState, SeverityBadge } from '../../ui/primitives'

export function useChecks(): Issue[] {
  const build = useBuild(s => s.build)
  const geo = useGeometry(s => s.result)
  const modules = useAttachedModules()
  return useMemo(() => checkBuild(build, geo, modules), [build, geo, modules])
}

const CATEGORY_LABEL: Record<Issue['category'], string> = {
  fit: 'Fit',
  power: 'Power',
  ports: 'Ports',
  thermal: 'Thermal',
  print: 'Print',
  module: 'DeckPort',
}

export function ChecksPanel({ issues }: { issues: Issue[] }) {
  const select = useBuild(s => s.select)
  const blocking = issues.filter(i => i.severity === 'critical' || i.severity === 'high')
  if (!issues.length) return <EmptyState icon={Check} title="No issues" body="Everything fits, the power budget holds and every piece fits the bed." />
  return (
    <div>
      <div className="px-3 py-2 border-b border-hairline flex flex-wrap gap-1.5">
        {SEVERITY_ORDER.map(s => {
          const n = issues.filter(i => i.severity === s).length
          return n ? (
            <span key={s} className="flex items-center gap-1">
              <SeverityBadge severity={s} />
              <span className="font-mono text-label text-fg-secondary">{n}</span>
            </span>
          ) : null
        })}
      </div>
      {blocking.length === 0 && <p className="px-3 py-2 text-ui text-fg-secondary border-b border-hairline">Nothing blocking. Remaining items are advice.</p>}
      <ul>
        {issues.map(i => (
          <li key={i.id} className="border-b border-hairline">
            <button
              className="w-full text-left px-3 py-2 hover:bg-hover flex gap-2 items-start"
              onClick={() => i.placementId && select({ kind: 'placement', id: i.placementId })}
              disabled={!i.placementId}
            >
              <SeverityBadge severity={i.severity} />
              <span className="min-w-0">
                <span className="block label mb-0">{CATEGORY_LABEL[i.category]}</span>
                <span className="block text-ui text-fg">{i.message}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
