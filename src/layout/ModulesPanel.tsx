/**
 * Sidebar panel linking a Core and its modules.
 *
 * On a Core: every mounting point (DeckPort socket or Picatinny rail) with a
 * picker for the module on it, and a button to open that module.
 * On a module: how it mounts, and the Cores it is mounted on, to jump back.
 */
import { useNavigate } from 'react-router-dom'

import { incompatibility, moduleMount, mountPoints, pointLabel } from '../domain/modules'
import { useBuild } from '../store/buildStore'
import { ArrowLeft, ChevronRight } from '../ui/icons'

export function ModulesPanel() {
  const build = useBuild(s => s.build)
  const library = useBuild(s => s.library)
  const update = useBuild(s => s.update)
  const open = useBuild(s => s.open)
  const select = useBuild(s => s.select)
  const navigate = useNavigate()
  const go = (id: string) => {
    open(id)
    navigate('/')
  }

  if (build.kind === 'module') {
    const mount = moduleMount(build)
    const hosts = library.filter(b => b.kind === 'core' && mountPoints(b).some(p => p.moduleId === build.id))
    const target = build.targetCore && !hosts.some(h => h.id === build.targetCore!.id) ? library.find(b => b.id === build.targetCore!.id) : undefined
    return (
      <div className="px-3 py-2 border-b border-hairline">
        <div className="label mb-1">Module</div>
        <div className="text-label font-mono text-fg-muted mb-1.5">{mount === 'rail' ? 'Clamps onto a Picatinny rail' : mount === 'direct' ? 'Plugs into a DeckPort socket' : 'No plug yet'}</div>
        {[...hosts, ...(target ? [target] : [])].map(core => (
          <button key={core.id} className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-control text-ui text-fg-secondary hover:text-fg hover:bg-fg/5" onClick={() => go(core.id)} title={`Open ${core.name}`}>
            <ArrowLeft size={13} />
            <span className="truncate">{core.name}</span>
            {!hosts.includes(core) && <span className="ml-auto text-label text-fg-muted">designed for</span>}
          </button>
        ))}
        {!hosts.length && !target && <p className="text-label text-fg-muted">Not mounted on any Core yet. Pick it from a Core's socket or rail.</p>}
      </div>
    )
  }

  const points = mountPoints(build)
  if (!points.length) return null
  const modules = library.filter(b => b.kind === 'module')
  return (
    <div className="px-3 py-2 border-b border-hairline">
      <div className="label mb-1">Modules</div>
      <ul className="space-y-1.5">
        {points.map(point => {
          const fits = modules.filter(m => !incompatibility(point, m))
          const current = modules.find(m => m.id === point.moduleId)
          return (
            <li key={point.id}>
              <button className="text-label font-mono text-fg-muted hover:text-fg truncate block w-full text-left" onClick={() => select({ kind: 'accessory', id: point.id })} title="Select this mounting point">
                {pointLabel(point)}
              </button>
              <div className="flex items-center gap-1">
                <select
                  className="input py-1"
                  value={point.moduleId ?? ''}
                  onChange={e =>
                    update(b => {
                      const t = b.accessories.find(a => a.id === point.id)
                      if (t) t.moduleId = e.target.value || undefined
                    })
                  }
                >
                  <option value="">Empty</option>
                  {fits.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {current && (
                  <button className="btn-ghost shrink-0" title={`Open ${current.name}`} onClick={() => go(current.id)}>
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
