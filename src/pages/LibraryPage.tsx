import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { TEMPLATES } from '../catalog/templates'
import type { Build } from '../domain/schema'
import { download } from '../lib/download'
import { buildFileName, parseBuildJson, shareUrl } from '../lib/share'
import { useBuild } from '../store/buildStore'
import { Check, FileJson, GitFork, Link2, Plus, RotateCcw, Trash2, Upload } from '../ui/icons'
import { Callout, Panel, PanelHeader, PageShell, Tag } from '../ui/primitives'

export function LibraryPage() {
  const library = useBuild(s => s.library)
  const current = useBuild(s => s.build)
  const { open, create, saveAs, remove, restoreExamples } = useBuild.getState()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  // Deleting takes two clicks: a build lives only in this browser.
  const [confirming, setConfirming] = useState<string | null>(null)

  const importFile = async (file: File) => {
    const { build, error } = parseBuildJson(await file.text())
    if (!build) return setMessage({ tone: 'warn', text: error ?? 'Could not import that file.' })
    saveAs(build)
    setMessage({ tone: 'info', text: `Imported “${build.name}”.` })
    navigate('/')
  }

  const copyLink = async (b: Build) => {
    const url = shareUrl(b)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(b.id)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      setMessage({ tone: 'warn', text: 'Clipboard unavailable. Export the file instead.' })
    }
  }

  const cores = library.filter(b => b.kind === 'core')
  const modules = library.filter(b => b.kind === 'module')

  return (
    <PageShell
      route="/library"
      title="Library"
      meta={`${library.length} builds`}
      subtitle="Stored in this browser"
      actions={
        <>
          <button
            className="btn-secondary flex items-center gap-1.5"
            title="Add back the example builds that are no longer in this library. Examples you kept are not touched."
            onClick={async () => {
              const names = await restoreExamples()
              setMessage({ tone: 'info', text: names.length ? `Restored ${names.join(', ')}.` : 'Every example is already in the library.' })
            }}
          >
            <RotateCcw size={14} /> Restore examples
          </button>
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => fileRef.current?.click()}><Upload size={14} /> Import file</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => e.target.files?.[0] && importFile(e.target.files[0])} />
        </>
      }
    >
      <div className="space-y-4 max-w-7xl">
        {message && <Callout tone={message.tone}>{message.text}</Callout>}

        <Panel>
          <PanelHeader title="Start from a format" numeral="01" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                className="text-left p-4 border-b sm:border-r border-hairline hover:bg-hover group"
                onClick={() => {
                  create(t.id)
                  navigate('/')
                }}
              >
                <div className="flex items-center gap-2">
                  <Plus size={14} className="text-accent" />
                  <span className="text-ui font-medium text-fg">{t.name}</span>
                  <span className="ml-auto text-label font-mono text-fg-muted uppercase">{t.kind}</span>
                </div>
                <p className="text-ui text-fg-secondary mt-1">{t.description}</p>
                <p className="text-label font-mono text-fg-muted mt-2">{t.params.width} × {t.params.depth} × {t.params.trayHeight + t.params.lidHeight} mm</p>
              </button>
            ))}
          </div>
        </Panel>

        {[
          { title: 'Core decks', items: cores, n: '02' },
          { title: 'Modules', items: modules, n: '03' },
        ].map(group => (
          <Panel key={group.title}>
            <PanelHeader title={group.title} numeral={group.n} meta={`${group.items.length}`} />
            {group.items.length === 0 ? (
              <p className="px-4 py-3 text-ui text-fg-muted">None yet.</p>
            ) : (
              <ul>
                {group.items.map(b => (
                  <li key={b.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-hairline last:border-b-0 ${b.id === current.id ? 'bg-accent/5' : ''}`}>
                    {b.identity.photo ? <img src={b.identity.photo} alt="" className="w-12 h-9 object-cover border border-hairline" /> : <div className="w-12 h-9 bg-canvas border border-hairline" />}
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        open(b.id)
                        navigate('/')
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-ui font-medium text-fg truncate">{b.name}</span>
                        {b.identity.codename && <span className="numeral">{b.identity.codename}</span>}
                        {b.id === current.id && <Tag tone="accent">open</Tag>}
                        {b.id.startsWith('example-') && <Tag>example</Tag>}
                      </div>
                      <div className="text-label font-mono text-fg-muted truncate">
                        {b.case.params.width} × {b.case.params.depth} mm · {b.placements.length} components · updated {b.updatedAt.slice(0, 10)}
                        {b.targetCore && ` · for ${b.targetCore.name}`}
                        {b.forkedFrom && ` · fork of ${b.forkedFrom.name}`}
                      </div>
                    </button>
                    <div className="toolbar shrink-0">
                      <button className="btn-ghost" title="Copy share link" onClick={() => copyLink(b)}>{copied === b.id ? <Check size={14} className="text-accent" /> : <Link2 size={14} />}</button>
                      <button className="btn-ghost" title="Export .cyberdeck.json" onClick={() => download(JSON.stringify(b, null, 2), buildFileName(b), 'application/json')}><FileJson size={14} /></button>
                      <button
                        className="btn-ghost"
                        title="Fork"
                        onClick={() => {
                          saveAs(b, { fork: true })
                          navigate('/')
                        }}
                      >
                        <GitFork size={14} />
                      </button>
                      {confirming === b.id ? (
                        <>
                          <button className="btn-danger" onClick={() => { remove(b.id); setConfirming(null) }}>Delete</button>
                          <button className="btn-ghost" onClick={() => setConfirming(null)}>Keep</button>
                        </>
                      ) : (
                        <button className="btn-ghost text-severity-critical" title="Delete from this browser" onClick={() => setConfirming(b.id)}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ))}
        <Callout title="Sharing">
          A share link contains the whole build (without its photo) in the part of the URL after “#”, which never reaches a server. Anyone who opens it can preview the build and save a fork into their own library. For a build with its photo, export the .cyberdeck.json file.
        </Callout>
      </div>
    </PageShell>
  )
}
