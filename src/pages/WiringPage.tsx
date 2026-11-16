/**
 * Wiring diagram. Derived wires come from the power and port analyses;
 * the user can drag nodes, delete derived wires and draw their own.
 */
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useMemo, useState } from 'react'

import { componentById } from '../catalog/components'
import { CATEGORY_DATA_SLOT, CATEGORY_LABEL, type CatalogComponent } from '../catalog/types'
import type { WireKind } from '../domain/schema'
import { effectiveWires, virtualNodes } from '../domain/wiring'
import { uid } from '../lib/id'
import { useBuild } from '../store/buildStore'
import { Cpu } from '../ui/icons'
import { useAppliedTheme } from '../layout/Layout'
import { EmptyState, PageShell, Segmented } from '../ui/primitives'

const KIND_SLOT: Record<WireKind, number> = { power: 4, data: 1, signal: 2 }

type DeckNodeData = { title: string; component?: CatalogComponent; subtitle?: string }

function DeckNode({ data, selected }: NodeProps<Node<DeckNodeData>>) {
  const c = data.component
  const slot = c ? CATEGORY_DATA_SLOT[c.category] : 3
  const pw = c?.power
  const line = !c
    ? data.subtitle
    : pw?.role === 'load' ? `${pw.rail} · ${pw.peakW} W peak` : pw?.role === 'battery' ? `${pw.capacityWh} Wh · ${pw.nominalV} V` : pw?.role === 'converter' ? `${pw.in} → ${pw.out} · ${pw.maxW} W` : pw?.role === 'charger' ? `Charger · ${pw.chargeW} W` : CATEGORY_LABEL[c.category]
  return (
    <div className={`bg-panel border ${selected ? 'border-accent' : 'border-hairline'} min-w-[180px]`} style={{ borderLeft: `3px solid rgb(var(--data-${slot}))` }}>
      {/* Separate handles for power and data, so parallel wires between two nodes do not overlap. */}
      <Handle id="p-in" type="target" position={Position.Left} style={{ top: '35%', background: 'rgb(var(--data-4))' }} className="!w-2 !h-2 !border-0" />
      <Handle id="d-in" type="target" position={Position.Left} style={{ top: '70%', background: 'rgb(var(--data-1))' }} className="!w-2 !h-2 !border-0" />
      <div className="px-3 py-2">
        <div className="text-ui text-fg font-medium truncate max-w-[220px]">{data.title}</div>
        <div className="text-label font-mono text-fg-muted">{line}</div>
      </div>
      <Handle id="p-out" type="source" position={Position.Right} style={{ top: '35%', background: 'rgb(var(--data-4))' }} className="!w-2 !h-2 !border-0" />
      <Handle id="d-out" type="source" position={Position.Right} style={{ top: '70%', background: 'rgb(var(--data-1))' }} className="!w-2 !h-2 !border-0" />
    </div>
  )
}

const nodeTypes = { deck: DeckNode }

/** Columns: sources → converters → SBC/hubs → everything else. */
function autoColumn(c: CatalogComponent): number {
  if (c.power?.role === 'charger') return 0
  if (c.power?.role === 'battery') return 0
  if (c.power?.role === 'converter') return 1
  if (c.category === 'sbc' || c.category === 'io') return 2
  return 3
}

export function WiringPage() {
  const build = useBuild(s => s.build)
  const update = useBuild(s => s.update)
  const [newKind, setNewKind] = useState<WireKind>('data')
  const theme = useAppliedTheme()
  const wires = useMemo(() => effectiveWires(build), [build])

  const nodes: Node<DeckNodeData>[] = useMemo(() => {
    const rows = [0, 0, 0, 0]
    const placed = build.placements.flatMap(pl => {
      const c = componentById(pl.componentId)
      if (!c) return []
      const col = autoColumn(c)
      const pos = build.wiring.positions[pl.id] ?? { x: col * 380, y: rows[col] * 110 }
      rows[col]++
      return [{ id: pl.id, type: 'deck', position: pos, data: { title: pl.label ?? c.name, component: c } }]
    })
    const virtual = virtualNodes(build).map((v, i) => ({
      id: v.id,
      type: 'deck',
      position: build.wiring.positions[v.id] ?? { x: (build.kind === 'module' ? 0 : 4) * 380, y: i * 110 },
      data: { title: v.title, subtitle: v.subtitle },
    }))
    return [...placed, ...virtual]
  }, [build])

  const edges: Edge[] = useMemo(
    () =>
      wires.map(w => {
        const color = `rgb(var(--data-${KIND_SLOT[w.kind]}))`
        return {
          id: w.id,
          source: w.from,
          target: w.to,
          sourceHandle: w.kind === 'power' ? 'p-out' : 'd-out',
          targetHandle: w.kind === 'power' ? 'p-in' : 'd-in',
          label: w.label,
          animated: w.kind === 'power',
          style: { stroke: color, strokeWidth: w.kind === 'power' ? 2 : 1.5, strokeDasharray: w.kind === 'signal' ? '4 3' : undefined },
          markerEnd: { type: MarkerType.ArrowClosed, color },
          labelStyle: { fill: 'rgb(var(--text-secondary))', fontFamily: 'var(--font-mono)', fontSize: 10 },
          labelBgStyle: { fill: 'rgb(var(--surface-panel))' },
          labelBgPadding: [4, 2] as [number, number],
        }
      }),
    [wires],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const moves = changes.filter((c): c is Extract<NodeChange, { type: 'position' }> => c.type === 'position' && Boolean(c.position))
      if (!moves.length) return
      update(
        b => {
          for (const m of moves) b.wiring.positions[m.id] = { x: Math.round(m.position!.x), y: Math.round(m.position!.y) }
        },
        { coalesce: 'wiring.move' },
      )
    },
    [update],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removed = changes.filter(c => c.type === 'remove').map(c => c.id)
      if (!removed.length) return
      update(b => {
        for (const id of removed) {
          if (id.startsWith('auto:')) {
            if (!b.wiring.suppressed.includes(id)) b.wiring.suppressed.push(id)
          } else b.wiring.wires = b.wiring.wires.filter(w => w.id !== id)
        }
      })
    },
    [update],
  )

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return
      update(b => void b.wiring.wires.push({ id: uid('wire'), from: c.source!, to: c.target!, kind: newKind, label: newKind, auto: false }))
    },
    [update, newKind],
  )

  return (
    <PageShell
      route="/wiring"
      title="Wiring"
      meta={`${wires.length} wires`}
      subtitle="Power, data and signal paths, derived from the build"
      toolbar={
        <>
          <span className="label mb-0">New wire</span>
          <Segmented value={newKind} onChange={setNewKind} options={[{ value: 'power', label: 'Power' }, { value: 'data', label: 'Data' }, { value: 'signal', label: 'Signal' }]} />
          <span className="text-label text-fg-muted ml-2">Drag from a node's right handle (upper: power, lower: data) to another node. Select a wire and press Delete to remove it.</span>
          <div className="flex-1" />
          <Legend />
          <button
            className="btn-secondary"
            onClick={() => update(b => { b.wiring.positions = {}; b.wiring.suppressed = [] })}
            title="Restore every derived wire and the automatic layout"
          >
            Reset layout
          </button>
        </>
      }
      fullHeight
    >
      {nodes.length === 0 ? (
        <EmptyState icon={Cpu} title="No components" body="Place components in the Workshop; their power and data connections are drawn here." />
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          proOptions={{ hideAttribution: true }}
          colorMode={theme.includes('light') ? 'light' : 'dark'}
          style={{ background: 'rgb(var(--surface-canvas))' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgb(var(--border-strong))" />
          <Controls showInteractive={false} />
        </ReactFlow>
      )}
    </PageShell>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-label font-mono text-fg-secondary mr-2">
      {(['power', 'data', 'signal'] as WireKind[]).map(k => (
        <span key={k} className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5" style={{ background: `rgb(var(--data-${KIND_SLOT[k]}))` }} />
          {k}
        </span>
      ))}
    </div>
  )
}
