/**
 * 3D assembly simulation. Everything installed before the focused checklist
 * item is in place; the focused item's parts loop through their motion
 * (drop in, slide on, join, close); later parts are not there yet.
 */
import { Edges, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import { componentById } from '../../catalog/components'
import { CATEGORY_DATA_SLOT } from '../../catalog/types'
import { placementBox } from '../../domain/layout'
import type { Build } from '../../domain/schema'
import type { CarriedDisplay, GeneratedPiece } from '../../geometry/caseBuilder'
import { phase, stateAt, targetsPiece, installIndex, type FlatItem, type ObjectState } from './simulation'

THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

const LID_LIFT = 110
const LID_OPEN_DEG = 100

function tokens() {
  const css = getComputedStyle(document.documentElement)
  const get = (n: string) => new THREE.Color(`rgb(${css.getPropertyValue(n).trim().split(/\s+/).join(',')})`)
  return { canvas: get('--surface-canvas'), accent: get('--accent'), grid: get('--border-hairline'), data: [1, 2, 3, 4, 5, 6].map(i => get(`--data-${i}`)) }
}

export function AssemblyViewer({ build, pieces, carried, items, focus }: { build: Build; pieces: GeneratedPiece[]; carried: CarriedDisplay[]; items: FlatItem[]; focus: number }) {
  const [colors, setColors] = useState(tokens)
  useEffect(() => {
    const h = () => setColors(tokens())
    window.addEventListener('cdb-theme', h)
    return () => window.removeEventListener('cdb-theme', h)
  }, [])
  const p = build.case.params
  const span = Math.max(p.width, p.depth)
  const grid = useMemo(() => splitGrid(pieces), [pieces])
  const lidInstall = installIndex(items, it => Boolean(it.parts?.includes('lid') && it.motion === 'close'))
  const lidWaits = !p.hinge && lidInstall !== -1
  return (
    <Canvas key={build.id} camera={{ position: [span * 1.3, -span * 1.9, span * 1.5], fov: 40, near: 1, far: 10000 }} style={{ background: `#${colors.canvas.getHexString()}` }}>
      <hemisphereLight args={[new THREE.Color(1, 1, 1), colors.canvas, 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[300, -400, 600]} intensity={1.6} />
      <gridHelper args={[2000, 80, colors.grid, colors.grid]} rotation={[Math.PI / 2, 0, 0]} />
      <Scene build={build} pieces={pieces} carried={carried} items={items} focus={focus} grid={grid} lidInstall={lidInstall} colors={colors} />
      <OrbitControls makeDefault enableDamping target={[lidWaits ? p.width / 2 : 0, 0, p.trayHeight / 2]} />
    </Canvas>
  )
}

/** Grid cell of each split piece ("tray-1-0" → column 1, row 0), for the join motion. */
function splitGrid(pieces: GeneratedPiece[]) {
  const cells = new Map<string, { i: number; j: number; nx: number; ny: number }>()
  for (const part of ['tray', 'lid']) {
    const list = pieces.filter(pc => pc.group === part && /-\d+-\d+$/.test(pc.id))
    const ij = list.map(pc => pc.id.split('-').slice(-2).map(Number) as [number, number])
    const nx = Math.max(1, ...ij.map(c => c[0] + 1))
    const ny = Math.max(1, ...ij.map(c => c[1] + 1))
    list.forEach((pc, k) => cells.set(pc.id, { i: ij[k][0], j: ij[k][1], nx, ny }))
  }
  return cells
}

function Scene({ build, pieces, carried, items, focus, grid, lidInstall, colors }: { build: Build; pieces: GeneratedPiece[]; carried: CarriedDisplay[]; items: FlatItem[]; focus: number; grid: ReturnType<typeof splitGrid>; lidInstall: number; colors: ReturnType<typeof tokens> }) {
  const p = build.case.params
  const item = items[focus]
  const t = useRef(0)
  const [, force] = useState(0)
  const start = useRef(performance.now())
  useEffect(() => {
    start.current = performance.now()
  }, [focus])
  useFrame(() => {
    t.current = phase((performance.now() - start.current) / 1000)
    force(n => (n + 1) % 1000000)
  })
  const e = t.current

  // The lid (and everything on it) waits above the tray until the closing step.
  const lidMatrix = () => {
    const closed = lidInstall === -1 || lidInstall < focus
    const amount = closed ? 0 : lidInstall === focus ? 1 - e : 1
    if (amount === 0) return new THREE.Matrix4()
    if (p.hinge) {
      const yh = p.depth / 2 + 0.5
      return new THREE.Matrix4().makeTranslation(0, yh, p.trayHeight).multiply(new THREE.Matrix4().makeRotationX(-THREE.MathUtils.degToRad(LID_OPEN_DEG * amount))).multiply(new THREE.Matrix4().makeTranslation(0, -yh, -p.trayHeight))
    }
    // Without a hinge the lid waits beside the tray, out of the way, and comes back on an arc.
    return new THREE.Matrix4().makeTranslation((p.width + 60) * amount, 0, LID_LIFT * Math.sin(Math.PI * amount) - p.trayHeight * amount)
  }

  const motionOffset = (state: ObjectState, dir: [number, number, number], joinOffset: [number, number, number]) => {
    const k = 1 - e
    switch (state.motion) {
      case 'drop': return new THREE.Matrix4().makeTranslation(0, 0, 90 * k)
      case 'slide': return new THREE.Matrix4().makeTranslation(dir[0] * 70 * k, dir[1] * 70 * k, dir[2] * 70 * k)
      case 'join': return new THREE.Matrix4().makeTranslation(joinOffset[0] * k, joinOffset[1] * k, 0)
      default: return new THREE.Matrix4()
    }
  }

  return (
    <>
      {pieces.map(piece => {
        const targeted = item ? targetsPiece(item, piece) : false
        const install = installIndex(items, it => targetsPiece(it, piece))
        const state = stateAt(items, focus, install, targeted)
        if (!state.visible) return null
        // Split pieces wait apart until their join step.
        const cell = grid.get(piece.id)
        const joinOffset: [number, number, number] = cell ? [(cell.i - (cell.nx - 1) / 2) * 45, (cell.j - (cell.ny - 1) / 2) * 45, 0] : [0, 0, 0]
        const beforeJoin = cell && install > focus
        const offset = beforeJoin ? new THREE.Matrix4().makeTranslation(joinOffset[0], joinOffset[1], 0) : motionOffset(state, piece.explode, joinOffset)
        const lid = piece.attachedTo === 'lid' || piece.group === 'lid' ? lidMatrix() : new THREE.Matrix4()
        const matrix = lid.multiply(offset).multiply(new THREE.Matrix4().fromArray(piece.assembly))
        return <PieceMesh key={piece.id} piece={piece} matrix={matrix} highlight={state.highlight} accent={colors.accent} />
      })}
      {build.placements.map(pl => {
        const c = componentById(pl.componentId)
        if (!c) return null
        const targeted = Boolean(item?.placements?.includes(pl.id))
        const install = installIndex(items, it => Boolean(it.placements?.includes(pl.id)))
        const state = stateAt(items, focus, install, targeted)
        if (!state.visible) return null
        // A display on a slider rides on its carriage, not in the case.
        const ride = carried.find(x => x.placementId === pl.id)
        const box = placementBox(build, c, pl)
        const centre: [number, number, number] = ride ? ride.centre : [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2]
        const lid = pl.part === 'lid' ? lidMatrix() : new THREE.Matrix4()
        const matrix = lid.multiply(motionOffset(state, [0, 0, 1], [0, 0, 0])).multiply(new THREE.Matrix4().makeTranslation(centre[0], centre[1], centre[2]))
        const base = colors.data[CATEGORY_DATA_SLOT[c.category] - 1]
        return (
          <group key={pl.id} matrix={matrix} matrixAutoUpdate={false}>
            <mesh rotation={new THREE.Euler((pl.rotX ?? 0) * Math.PI / 180, (pl.rotY ?? 0) * Math.PI / 180, pl.rotation * Math.PI / 180, 'ZYX')}>
              <boxGeometry args={[c.dims.x, c.dims.y, c.dims.z]} />
              <meshStandardMaterial color={base} transparent opacity={state.highlight ? 0.85 : 0.45} emissive={state.highlight ? colors.accent : new THREE.Color(0, 0, 0)} emissiveIntensity={state.highlight ? 0.35 : 0} />
              <Edges color={state.highlight ? colors.accent : base} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

function PieceMesh({ piece, matrix, highlight, accent }: { piece: GeneratedPiece; matrix: THREE.Matrix4; highlight: boolean; accent: THREE.Color }) {
  const geoms = useMemo(
    () =>
      piece.bodies.map(b => {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(b.mesh.positions, 3))
        g.setIndex(new THREE.BufferAttribute(b.mesh.indices, 1))
        const flat = g.toNonIndexed()
        flat.computeVertexNormals()
        g.dispose()
        return flat
      }),
    [piece],
  )
  useEffect(() => () => geoms.forEach(g => g.dispose()), [geoms])
  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      {geoms.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial
            color={piece.bodies[i].color}
            roughness={0.75}
            emissive={highlight ? accent : new THREE.Color(0, 0, 0)}
            emissiveIntensity={highlight ? 0.28 : 0}
          />
        </mesh>
      ))}
    </group>
  )
}
