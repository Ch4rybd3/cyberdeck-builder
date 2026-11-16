/**
 * The 3D workshop view. Z is up, millimetres throughout.
 *
 * Case pieces come from the geometry store. Components are drawn as their
 * envelope boxes in their category colour and can be dragged across the XY
 * plane; the drag commits through the build store so it is undoable.
 */
import { Edges, GizmoHelper, GizmoViewport, Grid, OrbitControls, TransformControls } from '@react-three/drei'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import { componentById } from '../../catalog/components'
import { CATEGORY_DATA_SLOT } from '../../catalog/types'
import { placementBox, zFieldForBottom } from '../../domain/layout'
import type { Build, Quarter } from '../../domain/schema'
import type { CarriedDisplay, GeneratedPiece } from '../../geometry/caseBuilder'
import { useBuild } from '../../store/buildStore'
import { useGeometry } from '../../store/geometryStore'
import { useView, type ViewOptions } from '../../store/viewStore'

THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

export type { ViewOptions }

/** Rotation of everything attached to the lid about the hinge axis (back edge, at the seam). */
function hingeMatrix(build: Build, angle: number): THREE.Matrix4 {
  const p = build.case.params
  if (!p.hinge || angle <= 0) return new THREE.Matrix4()
  const yh = p.depth / 2 + 0.5
  const to = new THREE.Matrix4().makeTranslation(0, yh, p.trayHeight)
  const rot = new THREE.Matrix4().makeRotationX(-THREE.MathUtils.degToRad(angle))
  const back = new THREE.Matrix4().makeTranslation(0, -yh, -p.trayHeight)
  return to.multiply(rot).multiply(back)
}

/** Read a Remora token as a THREE colour; re-read when the theme changes. */
function useTokenColors() {
  const [rev, setRev] = useState(0)
  useEffect(() => {
    const h = () => setRev(r => r + 1)
    window.addEventListener('cdb-theme', h)
    return () => window.removeEventListener('cdb-theme', h)
  }, [])
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement)
    const get = (name: string) => new THREE.Color(`rgb(${css.getPropertyValue(name).trim().split(/\s+/).join(',')})`)
    return {
      canvas: get('--surface-canvas'),
      // Light colour for the sky term of the hemisphere light.
      white: new THREE.Color(1, 1, 1),
      grid: get('--border-strong'),
      gridMinor: get('--border-hairline'),
      accent: get('--accent'),
      axes: [get('--severity-critical'), get('--data-6'), get('--data-1')],
      critical: get('--severity-critical'),
      data: [1, 2, 3, 4, 5, 6].map(i => get(`--data-${i}`)),
      rev,
    }
     
  }, [rev])
}

export function Viewport({ collisions }: { collisions: Set<string> }) {
  const result = useGeometry(s => s.result)
  const attached = useGeometry(s => s.attached)
  const build = useBuild(s => s.build)
  const view = useView()
  const hinge = useMemo(() => hingeMatrix(build, view.lidOpen), [build, view.lidOpen])
  const carried = new Map((result?.carried ?? []).map(c => [c.placementId, c]))
  const colors = useTokenColors()
  const controls = useRef<OrbitControlsImpl>(null)
  const p = build.case.params
  const span = Math.max(p.width, p.depth)
  const h = p.trayHeight + p.lidHeight
  const presets: Record<typeof view.camera, [number, number, number]> = {
    iso: [span * 0.8, -span * 1.6, span * 1.25],
    top: [0, -0.001, span * 2.2],
    front: [0, -span * 2.1, h / 2 + 10],
    side: [span * 2.1, 0, h / 2 + 10],
  }

  return (
    <Canvas
      key={`${build.id}:${view.camera}:${view.cameraRev}`}
      camera={{ position: presets[view.camera], fov: 40, near: 1, far: 10000 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onPointerMissed={() => {
        // A press on a gizmo handle hits no scene object; it must not deselect (and unmount) the gizmo.
        if (gizmoBusy()) return
        useBuild.getState().select({ kind: 'case' })
      }}
      style={{ background: `#${colors.canvas.getHexString()}` }}
    >
      <hemisphereLight args={[colors.white, colors.canvas, 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[300, -400, 600]} intensity={1.6} />
      <directionalLight position={[-400, 300, 200]} intensity={0.5} />
      <Grid
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.05]}
        args={[2000, 2000]}
        cellSize={10}
        sectionSize={50}
        cellColor={colors.gridMinor}
        sectionColor={colors.grid}
        fadeDistance={span * 4}
        infiniteGrid
      />
      {result?.pieces.map(piece => <Piece key={piece.id} piece={piece} view={view} hinge={hinge} />)}
      {view.modules && attached.flatMap(a => a.pieces.map(piece => <Piece key={piece.id} piece={piece} view={view} hinge={hinge} />))}
      {view.components &&
        build.placements.map(pl =>
          carried.has(pl.id) ? (
            <CarriedBox key={pl.id} id={pl.id} info={carried.get(pl.id)!} view={view} hinge={hinge} colors={colors} />
          ) : (
            <group key={pl.id} matrix={pl.part === 'lid' ? hinge : new THREE.Matrix4()} matrixAutoUpdate={false}>
              <ComponentBox id={pl.id} collision={collisions.has(pl.id)} colors={colors} controls={controls} draggable={pl.part === 'tray' || view.lidOpen === 0} />
            </group>
          ),
        )}
      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} target={[0, 0, p.trayHeight / 2]} />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport axisColors={colors.axes.map(c => `#${c.getHexString()}`) as [string, string, string]} labelColor={`#${colors.canvas.getHexString()}`} />
      </GizmoHelper>
    </Canvas>
  )
}

function Piece({ piece, view, hinge }: { piece: GeneratedPiece; view: ViewOptions; hinge: THREE.Matrix4 }) {
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

  if (piece.group === 'lid' && view.lid === 'hidden') return null
  if (piece.group === 'accessory' && !view.accessories) return null
  const ghost = piece.group === 'lid' && view.lid === 'ghost'
  const lift = piece.group === 'lid' ? 80 : 30
  const e = view.explode * lift
  const m = new THREE.Matrix4().fromArray(piece.assembly)
  const offset = new THREE.Matrix4().makeTranslation(piece.explode[0] * e, piece.explode[1] * e, piece.explode[2] * e)
  const t = piece.slide ? piece.slide.travel * view.slide : 0
  const slide = new THREE.Matrix4().makeTranslation(...((piece.slide?.axis ?? [0, 0, 0]).map(a => a * t) as [number, number, number]))
  // Swinging pieces turn about their pivot (assembled coordinates), before the hinge and explode.
  const swing = new THREE.Matrix4()
  if (piece.pivot && view.stand > 0) {
    const o = new THREE.Vector3(...piece.pivot.origin)
    swing
      .makeTranslation(o.x, o.y, o.z)
      .multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...piece.pivot.axis).normalize(), THREE.MathUtils.degToRad(piece.pivot.maxDeg * view.stand)))
      .multiply(new THREE.Matrix4().makeTranslation(-o.x, -o.y, -o.z))
  }
  const matrix = (piece.attachedTo === 'lid' ? hinge.clone() : new THREE.Matrix4()).multiply(offset).multiply(slide).multiply(swing).multiply(m)

  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      {geoms.map((g, i) => (
        <mesh key={i} geometry={g} castShadow receiveShadow>
          <meshStandardMaterial
            color={piece.bodies[i].color}
            roughness={0.75}
            metalness={0.05}
            transparent={ghost}
            opacity={ghost ? 0.22 : 1}
            depthWrite={!ghost}
            side={ghost ? THREE.DoubleSide : THREE.FrontSide}
          />
        </mesh>
      ))}
    </group>
  )
}

/** A display riding on a slider carriage: follows the slide and the hinge, not draggable. */
function CarriedBox({ id, info, view, hinge, colors }: { id: string; info: CarriedDisplay; view: ViewOptions; hinge: THREE.Matrix4; colors: ReturnType<typeof useTokenColors> }) {
  const selected = useBuild(s => s.selection?.kind === 'placement' && s.selection.id === id)
  const t = info.travel * view.slide
  const pos: [number, number, number] = [info.centre[0] + info.axis[0] * t, info.centre[1] + info.axis[1] * t, info.centre[2] + info.axis[2] * t]
  return (
    <group matrix={hinge} matrixAutoUpdate={false}>
      <mesh
        position={pos}
        onPointerDown={e => {
          e.stopPropagation()
          if (gizmoBusy()) return
          useBuild.getState().select({ kind: 'placement', id })
        }}
      >
        <boxGeometry args={info.size} />
        <meshStandardMaterial color={colors.data[1]} transparent opacity={selected ? 0.6 : 0.4} depthWrite={false} />
        <Edges color={selected ? colors.accent : colors.data[1]} />
      </mesh>
    </group>
  )
}

const DEG = Math.PI / 180

/** The transform gizmo, once it has reported in through its first 'change'. */
let activeGizmo: { dragging: boolean; axis: string | null } | null = null
const draggingGizmo = () => Boolean(activeGizmo?.dragging)
/** True while the pointer is on a gizmo handle or dragging one. */
const gizmoBusy = () => Boolean(activeGizmo && (activeGizmo.dragging || activeGizmo.axis))

/** Nearest multiple of 90°, normalised to 0–270. */
function quarter(rad: number): Quarter {
  const q = ((Math.round(rad / DEG / 90) % 4) + 4) % 4
  return (q * 90) as Quarter
}

function ComponentBox({ id, collision, colors, controls, draggable }: { id: string; collision: boolean; colors: ReturnType<typeof useTokenColors>; controls: React.RefObject<OrbitControlsImpl>; draggable: boolean }) {
  const build = useBuild(s => s.build)
  const selected = useBuild(s => s.selection?.kind === 'placement' && s.selection.id === id)
  const tool = useView(s => s.tool)
  const pl = build.placements.find(x => x.id === id)
  const c = pl && componentById(pl.componentId)
  const drag = useRef<{ plane: THREE.Plane; offset: THREE.Vector3 } | null>(null)
  const [hover, setHover] = useState(false)
  const [mesh, setMesh] = useState<THREE.Mesh | null>(null)
  const gizmo = useRef<{ axis: string | null; dragging: boolean } | null>(null)
  if (!pl || !c) return null

  const box = placementBox(build, c, pl)
  const centre: [number, number, number] = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2]
  // The mesh keeps the catalog dimensions and carries the orientation, so the
  // rotate gizmo turns the real box; with 90° steps it fills the same envelope.
  const rotation: [number, number, number, 'ZYX'] = [pl.rotX * DEG, pl.rotY * DEG, pl.rotation * DEG, 'ZYX']
  const base = colors.data[CATEGORY_DATA_SLOT[c.category] - 1]
  const edge = collision ? colors.critical : selected ? colors.accent : base
  const canDrag = draggable && tool === 'move'

  const commit = (fn: (t: NonNullable<typeof pl>) => void, key: string) =>
    useBuild.getState().update(b => {
      const t = b.placements.find(q => q.id === id)
      if (t) fn(t)
    }, { coalesce: key })

  // Free drag of the box body on its horizontal plane (Move tool).
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    // A press on a gizmo handle belongs to the gizmo, even when another box sits behind it.
    if (gizmoBusy()) return
    useBuild.getState().select({ kind: 'placement', id })
    if (!canDrag || !selected) return
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -centre[2])
    const hit = new THREE.Vector3()
    e.ray.intersectPlane(plane, hit)
    drag.current = { plane, offset: new THREE.Vector3(centre[0] - hit.x, centre[1] - hit.y, 0) }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (controls.current) controls.current.enabled = false
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    e.stopPropagation()
    const hit = new THREE.Vector3()
    if (!e.ray.intersectPlane(drag.current.plane, hit)) return
    const snap = e.shiftKey ? 5 : 1
    const x = Math.round((hit.x + drag.current.offset.x) / snap) * snap
    const y = Math.round((hit.y + drag.current.offset.y) / snap) * snap
    if (x === pl.x && y === pl.y) return
    commit(t => {
      t.x = x
      t.y = y
    }, `drag.${id}`)
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    drag.current = null
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    if (controls.current) controls.current.enabled = true
  }

  // Gizmo: arrows along X, Y and Z for Move; rings about X, Y and Z for Rotate.
  // The gizmo moves the mesh itself while dragging; the build is written once,
  // on release, so the drag is one undo step and is never interrupted by a re-render.
  const onGizmoEnd = () => {
    if (!mesh) return
    if (tool === 'move') {
      const x = Math.round(mesh.position.x)
      const y = Math.round(mesh.position.y)
      // Only touch z when the box was actually moved vertically.
      const movedZ = Math.abs(mesh.position.z - centre[2]) > 0.25
      const z = movedZ ? Math.round(zFieldForBottom(build, c, pl, mesh.position.z - (box.max[2] - box.min[2]) / 2)) : pl.z
      if (x === pl.x && y === pl.y && z === pl.z) return
      commit(t => {
        t.x = x
        t.y = y
        t.z = z
      }, `move.${id}.${Date.now()}`)
    } else if (tool === 'rotate') {
      const e = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'ZYX')
      const next = { rotX: quarter(e.x), rotY: quarter(e.y), rotation: quarter(e.z) }
      if (next.rotX === pl.rotX && next.rotY === pl.rotY && next.rotation === pl.rotation) return
      commit(t => Object.assign(t, next), `rotate.${id}.${Date.now()}`)
    }
  }

  return (
    <>
      <mesh
        ref={setMesh}
        position={centre}
        rotation={rotation}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerOver={e => {
          e.stopPropagation()
          // No re-render while a gizmo drag is running: it would reset the mesh under the gizmo.
          if (draggingGizmo()) return
          setHover(true)
          useView.getState().set({ hovered: id })
        }}
        onPointerOut={() => {
          if (draggingGizmo()) return
          setHover(false)
          if (useView.getState().hovered === id) useView.getState().set({ hovered: null })
        }}
      >
        <boxGeometry args={[c.dims.x, c.dims.y, c.dims.z]} />
        <meshStandardMaterial color={base} transparent opacity={selected ? 0.6 : hover ? 0.5 : 0.38} depthWrite={false} />
        <Edges color={edge} lineWidth={selected || collision ? 2 : 1} />
      </mesh>
      {selected && draggable && mesh && tool !== 'select' && (
        <TransformControls
          object={mesh}
          // The instance arrives with its first 'change' (the hovered axis); keep it to tell gizmo presses from box presses.
          onChange={(e?: { target?: unknown }) => {
            if (e?.target) {
              gizmo.current = e.target as { axis: string | null; dragging: boolean }
              activeGizmo = gizmo.current
            }
          }}
          mode={tool === 'move' ? 'translate' : 'rotate'}
          translationSnap={1}
          rotationSnap={Math.PI / 2}
          size={0.9}
          onMouseUp={onGizmoEnd}
        />
      )}
    </>
  )
}
