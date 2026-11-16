/**
 * Sharing without a server.
 *
 * A share link carries the whole build in the URL fragment, compressed with
 * lz-string. The fragment never reaches a web server, so a link works the
 * same on GitHub Pages, a custom domain or a local file. Photos are dropped
 * from links to keep them short; full builds travel as .cyberdeck.json files.
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

import { migrate } from '../domain/migrate'
import type { Build } from '../domain/schema'

export function shareUrl(build: Build): string {
  const slim: Build = { ...build, identity: { ...build.identity, photo: undefined } }
  const data = compressToEncodedURIComponent(JSON.stringify(slim))
  const base = `${location.origin}${location.pathname}`
  return `${base}#/import?d=${data}`
}

export function decodeShared(data: string): { build: Build | null; error?: string } {
  try {
    const json = decompressFromEncodedURIComponent(data)
    if (!json) return { build: null, error: 'The link is incomplete or damaged.' }
    return parseBuildJson(json)
  } catch (e) {
    return { build: null, error: e instanceof Error ? e.message : 'Unreadable link.' }
  }
}

export function parseBuildJson(json: string): { build: Build | null; error?: string } {
  try {
    const raw = JSON.parse(json)
    return migrate(raw)
  } catch (e) {
    return { build: null, error: e instanceof Error ? e.message : 'Not a valid build file.' }
  }
}

export function buildFileName(build: Build): string {
  return `${build.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck'}.cyberdeck.json`
}
