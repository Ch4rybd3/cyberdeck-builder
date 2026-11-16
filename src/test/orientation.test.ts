import { describe, expect, it } from 'vitest'

import { componentById } from '../catalog/components'
import { newBuild } from '../catalog/templates'
import { orient, orientedDims, placedWindows, placementBox, zFieldForBottom } from '../domain/layout'
import type { Placement } from '../domain/schema'

const place = (componentId: string, extra: Partial<Placement> = {}): Placement =>
  ({ id: 'p', componentId, part: 'tray', x: 0, y: 0, z: 0, rotation: 0, rotX: 0, rotY: 0, standoffs: true, window: true, ...extra }) as Placement

describe('orientation', () => {
  it('rotates in X, then Y, then Z', () => {
    expect(orient([0, 0, 1], { rotX: 90, rotY: 0, rotation: 0 })).toEqual([0, -1, 0])
    expect(orient([1, 0, 0], { rotX: 0, rotY: 0, rotation: 90 })).toEqual([0, 1, 0])
    expect(orient([0, 0, 1], { rotX: 0, rotY: 90, rotation: 0 })).toEqual([1, 0, 0])
  })

  it('permutes the envelope for a board on its edge', () => {
    const pi = componentById('rpi5-8gb')!
    expect(orientedDims(pi, { rotX: 90, rotY: 0, rotation: 0 })).toEqual([85, 20, 56])
    expect(orientedDims(pi, { rotX: 0, rotY: 0, rotation: 90 })).toEqual([56, 85, 20])
  })

  it('sends windows to the face they point at', () => {
    const b = newBuild('slab')
    const usb = componentById('panel-usb-c')!
    expect(placedWindows(b, usb, place('panel-usb-c'))[0].face).toBe('front')
    expect(placedWindows(b, usb, place('panel-usb-c', { rotation: 180 }))[0].face).toBe('back')
    expect(placedWindows(b, usb, place('panel-usb-c', { rotation: 90 }))[0].face).toBe('right')
    const screen = componentById('waveshare-5-dsi')!
    const up = placedWindows(b, screen, place('waveshare-5-dsi'))[0]
    expect([up.face, up.part, up.w, up.h]).toEqual(['top', 'lid', 109, 66])
    // Stood up facing forward: the active area is now cut in the front wall, width along u.
    const front = placedWindows(b, screen, place('waveshare-5-dsi', { rotX: 90 }))[0]
    expect([front.face, front.w, front.h]).toEqual(['front', 109, 66])
  })

  it('maps a dragged box bottom back to the z field', () => {
    const b = newBuild('slab')
    const pi = componentById('rpi5-8gb')!
    const pl = place('rpi5-8gb', { standoffs: false, z: 7 })
    const box = placementBox(b, pi, pl)
    expect(zFieldForBottom(b, pi, pl, box.min[2])).toBeCloseTo(7)
    const lid = { ...pl, part: 'lid' as const, z: 3 }
    expect(zFieldForBottom(b, pi, lid, placementBox(b, pi, lid).min[2])).toBeCloseTo(3)
  })
})
