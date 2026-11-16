import { strFromU8, unzipSync } from 'fflate'
import Module from 'manifold-3d'
import { expect, it } from 'vitest'

import { exampleBuilds } from '../catalog/templates'
import { packPlates } from '../domain/plates'
import { BED_MARGIN, printerById } from '../domain/printers'
import { generateCase } from '../geometry/caseBuilder'
import { threeMf } from '../geometry/export'

it('packs Vanguard onto Ender 3 plates without overlaps', async () => {
  const wasm = await Module()
  wasm.setup()
  const v = exampleBuilds().find(b => b.id === 'example-vanguard')!
  const printer = printerById('ender-3')
  const pieces = generateCase(wasm, v).pieces
  const { plates, oversize } = packPlates(pieces, printer, 20)
  expect(oversize).toEqual([])
  expect(plates.reduce((a, p) => a + p.items.length, 0)).toBe(pieces.length)
  for (const plate of plates) {
    for (const a of plate.items) {
      expect(a.x - a.w / 2).toBeGreaterThanOrEqual(BED_MARGIN - 0.01)
      expect(a.x + a.w / 2).toBeLessThanOrEqual(printer.bed.x - BED_MARGIN + 0.01)
      expect(a.y + a.d / 2).toBeLessThanOrEqual(printer.bed.y - BED_MARGIN + 0.01)
      for (const b of plate.items)
        if (a !== b) {
          const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 - 0.01 || Math.abs(a.y - b.y) >= (a.d + b.d) / 2 - 0.01
          expect(apart).toBe(true)
        }
    }
    expect(plate.minutes).toBeGreaterThan(0)
  }
  const first = plates[0]
  const model = strFromU8(unzipSync(threeMf('t', first.items.map(i => i.piece), first.items.map(i => ({ x: i.x, y: i.y, rotated: i.rotated }))))['3D/3dmodel.model'])
  expect((model.match(/<item /g) ?? []).length).toBe(first.items.length)
})
