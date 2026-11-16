import { readFileSync } from 'node:fs'
import Module from 'manifold-3d'
import { expect, it } from 'vitest'

import { newBuild } from '../catalog/templates'
import { generateCase } from '../geometry/caseBuilder'
import { registerFont, textContours } from '../geometry/text'

const bytes = (p: string) => {
  const b = readFileSync(p)
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
}

it('turns text into centred contours and inlays it', async () => {
  registerFont('mono', bytes('node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff'))
  const c = textContours('GPIO', 6, 'mono')!
  // G, P (outer + hole), I, O (outer + hole)
  expect(c.length).toBeGreaterThanOrEqual(6)
  const ys = c.flat().map(p => p[1])
  expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(5.5)

  const wasm = await Module()
  wasm.setup()
  const b = newBuild('slab')
  b.print.printerId = 'bambu-p1s'
  b.case.params.width = 200
  b.case.params.depth = 150
  b.accessories = []
  b.features.push({ id: 't', name: 'Label', part: 'lid', face: 'top', op: 'inlay', shape: { kind: 'text', text: 'COM', size: 8, font: 'mono' }, u: 0, v: 0, depth: 0.6, rotation: 0, color: '#FF0000', enabled: true })
  const lid = generateCase(wasm, b).pieces.find(p => p.id === 'lid')!
  const inlay = lid.bodies.find(x => x.color === '#FF0000')!
  expect(inlay.volume).toBeGreaterThan(5)
})
