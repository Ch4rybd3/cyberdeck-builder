import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { componentById } from '../catalog/components'
import { decodeShared } from '../lib/share'
import { useBuild } from '../store/buildStore'
import { AlertTriangle } from '../ui/icons'
import { EmptyState, Panel, PanelHeader, PageShell, Tag } from '../ui/primitives'

export function ImportPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const saveAs = useBuild(s => s.saveAs)
  const { build, error } = useMemo(() => decodeShared(params.get('d') ?? ''), [params])

  return (
    <PageShell route="/import" title="Shared build" backTo="/library">
      {!build ? (
        <EmptyState icon={AlertTriangle} title="This link could not be opened" body={error} action={<button className="btn-secondary" onClick={() => navigate('/library')}>Go to the library</button>} />
      ) : (
        <Panel className="max-w-2xl">
          <PanelHeader title={build.name} meta={build.identity.codename} />
          <div className="p-4 space-y-3">
            {build.identity.description && <p className="text-prose text-fg">{build.identity.description}</p>}
            <div className="flex flex-wrap gap-1">
              <Tag tone="accent">{build.kind}</Tag>
              <Tag>{build.case.params.width} × {build.case.params.depth} × {build.case.params.trayHeight + build.case.params.lidHeight} mm</Tag>
              {build.identity.author && <Tag>by {build.identity.author}</Tag>}
              <Tag>{build.identity.license}</Tag>
            </div>
            <ul className="text-ui text-fg-secondary list-disc pl-5">
              {build.placements.map(p => <li key={p.id}>{p.label ?? componentById(p.componentId)?.name ?? p.componentId}</li>)}
            </ul>
            <div className="flex gap-2 pt-2">
              <button
                className="btn-primary"
                onClick={() => {
                  saveAs(build, { fork: true })
                  navigate('/')
                }}
              >
                Save a copy to my library
              </button>
              <button className="btn-secondary" onClick={() => navigate('/library')}>Cancel</button>
            </div>
          </div>
        </Panel>
      )}
    </PageShell>
  )
}
