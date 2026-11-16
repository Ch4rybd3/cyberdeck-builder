/**
 * Text labels: glyph outlines from the Remora fonts, flattened to polygons
 * the case generator can extrude, cut or inlay.
 *
 * Fonts load once (asynchronously) before the first generation; after that
 * `textContours` is synchronous, which keeps `generateCase` synchronous.
 */
import opentype from 'opentype.js'
import monoUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff?url'
import sansUrl from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff?url'

export type TextFont = 'mono' | 'sans'

const fonts: Partial<Record<TextFont, opentype.Font>> = {}
let loading: Promise<void> | null = null

/** Register a font from raw bytes (used by tests, where there is no fetch of Vite URLs). */
export function registerFont(name: TextFont, data: ArrayBuffer): void {
  fonts[name] = opentype.parse(data)
}

export function loadFonts(): Promise<void> {
  if (!loading) {
    loading = Promise.all(
      (Object.entries({ mono: monoUrl, sans: sansUrl }) as [TextFont, string][]).map(async ([name, url]) => {
        if (fonts[name]) return
        try {
          const res = await fetch(url)
          registerFont(name, await res.arrayBuffer())
        } catch {
          // Text features report "font not loaded" instead of failing the whole case.
        }
      }),
    ).then(() => undefined)
  }
  return loading
}

export function fontsReady(font: TextFont): boolean {
  return Boolean(fonts[font])
}

type Pt = [number, number]

/**
 * Closed contours for `text`, centred on the origin, y up, with a cap height
 * of `size` mm. Holes (the inside of an O) come out with the opposite winding,
 * so they are filled with the NonZero rule.
 */
export function textContours(text: string, size: number, font: TextFont): Pt[][] | null {
  const f = fonts[font]
  if (!f) return null
  const os2 = (f.tables as { os2?: { sCapHeight?: number } }).os2
  const cap = os2?.sCapHeight || f.unitsPerEm * 0.7
  const fontSize = (size * f.unitsPerEm) / cap
  const path = f.getPath(text, 0, 0, fontSize)
  const contours: Pt[][] = []
  let cur: Pt[] = []
  let last: Pt = [0, 0]
  const steps = 8
  // getPath is in screen space (y down); flip to y up.
  const P = (x: number, y: number): Pt => [x, -y]
  for (const c of path.commands as Array<{ type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }>) {
    switch (c.type) {
      case 'M':
        if (cur.length > 2) contours.push(cur)
        last = P(c.x!, c.y!)
        cur = [last]
        break
      case 'L':
        last = P(c.x!, c.y!)
        cur.push(last)
        break
      case 'Q': {
        const [x0, y0] = last
        const [x1, y1] = P(c.x1!, c.y1!)
        const [x2, y2] = P(c.x!, c.y!)
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t
          cur.push([a * x0 + b * x1 + d * x2, a * y0 + b * y1 + d * y2])
        }
        last = [x2, y2]
        break
      }
      case 'C': {
        const [x0, y0] = last
        const [x1, y1] = P(c.x1!, c.y1!)
        const [x2, y2] = P(c.x2!, c.y2!)
        const [x3, y3] = P(c.x!, c.y!)
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          const a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, d = 3 * (1 - t) * t * t, e = t ** 3
          cur.push([a * x0 + b * x1 + d * x2 + e * x3, a * y0 + b * y1 + d * y2 + e * y3])
        }
        last = [x3, y3]
        break
      }
      case 'Z':
        if (cur.length > 2) contours.push(cur)
        cur = []
        break
    }
  }
  if (cur.length > 2) contours.push(cur)
  if (!contours.length) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const ct of contours) for (const [x, y] of ct) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return contours.map(ct => ct.map(([x, y]) => [x - cx, y - cy] as Pt))
}
