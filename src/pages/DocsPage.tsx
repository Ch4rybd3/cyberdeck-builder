/**
 * Documentation, rendered from the Markdown files in /docs. The same files
 * are readable on GitHub, so the in-app docs and the repository never drift.
 * Order and titles come from each file's first heading and the ORDER list.
 */
import ReactMarkdown from 'react-markdown'
import { Link, useParams } from 'react-router-dom'
import remarkGfm from 'remark-gfm'

import { Aside, PageShell } from '../ui/primitives'

const files = import.meta.glob('../../docs/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
// Images are written as ./images/name.png so they also render on GitHub; Vite fingerprints them here.
const images = import.meta.glob('../../docs/images/*.{png,jpg,webp}', { query: '?url', import: 'default', eager: true }) as Record<string, string>
const imageUrl = (src?: string) => {
  const name = src?.replace(/^\.\/images\//, '')
  const hit = Object.entries(images).find(([path]) => path.endsWith(`/images/${name}`))
  return hit ? hit[1] : src
}

const ORDER = ['index', 'getting-started', 'workshop', 'custom-components', 'formats', 'case-geometry', 'accessories', 'slider', 'printing', 'assembly', 'power', 'wiring', 'deckport', 'modules', 'sharing', 'catalog', 'architecture', 'changelog']

const pages = Object.entries(files)
  .map(([path, body]) => {
    const slug = path.split('/').pop()!.replace(/\.md$/, '')
    const title = /^#\s+(.+)$/m.exec(body)?.[1] ?? slug
    return { slug, title, body }
  })
  .sort((a, b) => (ORDER.indexOf(a.slug) + 1 || 99) - (ORDER.indexOf(b.slug) + 1 || 99))

export function DocsPage() {
  const { slug = 'index' } = useParams()
  const page = pages.find(p => p.slug === slug) ?? pages[0]
  return (
    <PageShell
      route="/docs"
      title="Documentation"
      meta={page?.title}
      asideLeft={
        <Aside side="left" width="w-60">
          <nav className="p-2">
            {pages.map((p, i) => (
              <Link
                key={p.slug}
                to={`/docs/${p.slug}`}
                className={`flex items-baseline gap-2 px-2 py-1.5 rounded-control text-ui ${p.slug === page?.slug ? 'bg-accent/10 text-accent' : 'text-fg-secondary hover:text-fg hover:bg-hover'}`}
              >
                <span className="numeral w-5">{String(i).padStart(2, '0')}</span>
                {p.title}
              </Link>
            ))}
          </nav>
        </Aside>
      }
    >
      <article className="md-preview max-w-3xl">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ src, alt }) => (
              // Markdown wraps images in <p>, so the figure is built from spans.
              <span className="block my-4">
                <img src={imageUrl(src)} alt={alt ?? ''} loading="lazy" className="block max-w-full h-auto border border-hairline" />
                {alt && <span className="block text-label font-mono text-fg-muted mt-1.5">{alt}</span>}
              </span>
            ),
            a: ({ href, children }) => {
              // Links between docs pages are written as ./page.md so they also work on GitHub.
              const m = href && /^\.\/([\w-]+)\.md(#.*)?$/.exec(href)
              if (m) return <Link to={`/docs/${m[1]}`}>{children}</Link>
              return <a href={href} target="_blank" rel="noreferrer">{children}</a>
            },
          }}
        >
          {page?.body ?? 'No documentation found.'}
        </ReactMarkdown>
      </article>
    </PageShell>
  )
}
