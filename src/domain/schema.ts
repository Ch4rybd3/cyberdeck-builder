/**
 * The Build schema — the single JSON document that describes a cyberdeck.
 *
 * Everything the app shows is derived from a Build: the 3D case, the power
 * budget, the wiring diagram, the shopping list and the DeckID card. Keeping it
 * one plain, versioned document is what makes local-first storage, file
 * export, share links and forks all the same operation.
 *
 * Units: millimetres, grams, watts, volts, watt-hours. Angles in degrees.
 * Frame: origin at the centre of the case footprint, on the floor.
 * +X right, +Y back, +Z up. "Front" is the face the user looks at (-Y).
 *
 * Bump SCHEMA_VERSION on any breaking change and add a migration in
 * migrate.ts.
 */
import { z } from 'zod'

export const SCHEMA_VERSION = 5

export const FACES = ['top', 'bottom', 'front', 'back', 'left', 'right'] as const
export const Face = z.enum(FACES)
export type Face = z.infer<typeof Face>

export const PART_IDS = ['tray', 'lid'] as const
export const PartId = z.enum(PART_IDS)
export type PartId = z.infer<typeof PartId>

export const InsertSize = z.enum(['M2', 'M2.5', 'M3', 'M4'])
export type InsertSize = z.infer<typeof InsertSize>

// ── Sketch shapes used by geometry features ──────────────────────────────────
export const Shape = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rect'), w: z.number().positive(), h: z.number().positive(), r: z.number().min(0).default(0) }),
  z.object({ kind: z.literal('circle'), d: z.number().positive() }),
  z.object({ kind: z.literal('slot'), w: z.number().positive(), h: z.number().positive() }),
  z.object({ kind: z.literal('polygon'), points: z.array(z.tuple([z.number(), z.number()])).min(3) }),
  /** Text label. `size` is the cap height in mm. */
  z.object({ kind: z.literal('text'), text: z.string().min(1).max(64), size: z.number().positive(), font: z.enum(['mono', 'sans']).default('mono') }),
])
export type Shape = z.infer<typeof Shape>

export const Pattern = z.object({
  nu: z.number().int().min(1).default(1),
  nv: z.number().int().min(1).default(1),
  du: z.number().default(0),
  dv: z.number().default(0),
})
export type Pattern = z.infer<typeof Pattern>

/**
 * A basic modelling operation applied to one face of one part.
 *   extrude  adds material outward from the face
 *   cut      removes material inward from the face
 *   inlay    cuts a shallow pocket and fills it with a separately coloured body
 *   boss     adds a solid inward from the face (behind the wall)
 */
export const FeatureOp = z.enum(['extrude', 'cut', 'inlay', 'boss'])
export type FeatureOp = z.infer<typeof FeatureOp>

export const Feature = z.object({
  id: z.string(),
  name: z.string(),
  part: PartId,
  face: Face,
  op: FeatureOp,
  shape: Shape,
  /** Offset from the face centre, along the face's u (horizontal) and v (vertical) axes. */
  u: z.number().default(0),
  v: z.number().default(0),
  /** Extrusion length. For a cut, `0` means "through the wall". */
  depth: z.number().min(0).default(0),
  rotation: z.number().default(0),
  pattern: Pattern.optional(),
  /** Filament slot for extrude and inlay bodies. Defaults to the part's colour. */
  color: z.string().optional(),
  enabled: z.boolean().default(true),
})
export type Feature = z.infer<typeof Feature>

// ── Accessories: separately printed parts bolted on with heat-set inserts ────
export const AccessoryKind = z.enum(['picatinny', 'handle', 'foot', 'deckport', 'slider'])
export type AccessoryKind = z.infer<typeof AccessoryKind>

export const Accessory = z.object({
  id: z.string(),
  kind: AccessoryKind,
  part: PartId,
  face: Face,
  u: z.number().default(0),
  v: z.number().default(0),
  /** Length along the face's u axis (rails, handles). */
  length: z.number().positive().default(80),
  /** 0 = along u, 90 = along v. */
  rotation: z.union([z.literal(0), z.literal(90)]).default(0),
  color: z.string().optional(),
  /** Slider: carriage width when it carries no display. */
  width: z.number().positive().optional(),
  /** Slider: how far the carriage travels towards the back (+v). */
  travel: z.number().min(0).optional(),
  /** Slider: the display placement the carriage holds. */
  targetId: z.string().optional(),
  /** DeckPort socket on a Core: the module build (from the library) shown attached to it. */
  moduleId: z.string().optional(),
})
export type Accessory = z.infer<typeof Accessory>

// ── Component placements ─────────────────────────────────────────────────────
const Quarter = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
export type Quarter = z.infer<typeof Quarter>
export const Placement = z.object({
  id: z.string(),
  componentId: z.string(),
  label: z.string().optional(),
  part: PartId.default('tray'),
  x: z.number().default(0),
  y: z.number().default(0),
  /** Height above the part's inner floor (tray) or below its inner ceiling (lid). */
  z: z.number().default(0),
  /** Turn about Z (vertical), in 90° steps. Applied last. */
  rotation: Quarter.default(0),
  /** Tilt about X, then Y, in 90° steps — e.g. a board standing on its edge. Applied before `rotation`. */
  rotX: Quarter.default(0),
  rotY: Quarter.default(0),
  /** Generate standoffs with heat-set inserts under the component's mounting holes. */
  standoffs: z.boolean().default(true),
  /** Cut the component's window (screen, keyboard, port) through the nearest face. */
  window: z.boolean().default(true),
})
export type Placement = z.infer<typeof Placement>

// ── Wiring ───────────────────────────────────────────────────────────────────
export const WireKind = z.enum(['power', 'data', 'signal'])
export type WireKind = z.infer<typeof WireKind>

export const Wire = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  kind: WireKind,
  label: z.string().default(''),
  /** True when derived from the build and not edited by the user. */
  auto: z.boolean().default(false),
})
export type Wire = z.infer<typeof Wire>

export const Wiring = z.object({
  wires: z.array(Wire).default([]),
  /** Wire ids the user removed from the derived set, so they stay removed. */
  suppressed: z.array(z.string()).default([]),
  positions: z.record(z.object({ x: z.number(), y: z.number() })).default({}),
})
export type Wiring = z.infer<typeof Wiring>

// ── Case ─────────────────────────────────────────────────────────────────────
export const CaseParams = z.object({
  width: z.number().min(40).max(600),
  depth: z.number().min(40).max(600),
  trayHeight: z.number().min(10).max(200),
  lidHeight: z.number().min(4).max(120),
  wall: z.number().min(1.2).max(8),
  floor: z.number().min(1.2).max(8),
  cornerRadius: z.number().min(0).max(40),
  /** Inserts that join the lid to the tray. */
  closureInsert: InsertSize.default('M3'),
  closureScrews: z.number().int().min(4).max(16).default(4),
  /** Outline corners: rounded, or chamfered for a faceted look. */
  cornerStyle: z.enum(['round', 'chamfer']).default('round'),
  /** 45° bevel on the tray's bottom edge and the lid's top edge. */
  bevel: z.number().min(0).max(12).default(0),
  /** Knuckle hinge along the back edge, on a Ø3 mm pin. */
  hinge: z.boolean().default(false),
  /** How the lid stays shut: screws into inserts, or press-fit magnets. */
  closure: z.enum(['screws', 'magnets']).default('screws'),
})
export type CaseParams = z.infer<typeof CaseParams>

export const CaseColors = z.object({
  tray: z.string(),
  lid: z.string(),
  accessories: z.string(),
})

export const Case = z.object({
  template: z.string(),
  params: CaseParams,
  colors: CaseColors,
})
export type Case = z.infer<typeof Case>

// ── Print settings ───────────────────────────────────────────────────────────
export const PrintSettings = z.object({
  printerId: z.string().default('ender-3'),
  material: z.enum(['PLA', 'PETG', 'ASA', 'ABS']).default('PETG'),
  /** Split parts that exceed the bed, joined with inserts and screws. */
  autoSplit: z.boolean().default(true),
  jointInsert: InsertSize.default('M3'),
  infillPercent: z.number().min(0).max(100).default(20),
})
export type PrintSettings = z.infer<typeof PrintSettings>

// ── Identity (DeckID) ────────────────────────────────────────────────────────
export const Identity = z.object({
  codename: z.string().default(''),
  author: z.string().default(''),
  license: z.string().default('CERN-OHL-S-2.0'),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  status: z.enum(['concept', 'building', 'built', 'retired']).default('concept'),
  photo: z.string().optional(),
  links: z.array(z.string()).default([]),
})
export type Identity = z.infer<typeof Identity>

// ── Custom components ────────────────────────────────────────────────────────
// Same shape as a catalog entry (src/catalog/types.ts). They travel inside the
// build, so a shared build carries the parts it needs.
const Rail = z.enum(['VBAT', '5V', '3V3', '12V'])
const PortType = z.enum(['usb-a', 'usb-c', 'micro-hdmi', 'mipi', 'gpio', 'i2c', 'pcie', 'm2', 'ethernet', 'audio', 'fan'])
export const CustomComponent = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['sbc', 'display', 'input', 'power', 'storage', 'radio', 'audio', 'cooling', 'io', 'connector']),
  dims: z.object({ x: z.number().positive(), y: z.number().positive(), z: z.number().positive() }),
  mass: z.number().min(0).default(0),
  price: z.number().min(0).default(0),
  supplier: z.string().default(''),
  url: z.string().optional(),
  mounting: z.object({ insert: InsertSize, holes: z.array(z.tuple([z.number(), z.number()])), standoff: z.number().min(0) }).optional(),
  windows: z.array(z.object({ face: z.enum(['top', 'front', 'back', 'left', 'right']), w: z.number().positive(), h: z.number().positive(), u: z.number().optional(), v: z.number().optional(), r: z.number().optional() })).optional(),
  power: z
    .discriminatedUnion('role', [
      z.object({ role: z.literal('load'), rail: Rail, typW: z.number().min(0), peakW: z.number().min(0) }),
      z.object({ role: z.literal('battery'), nominalV: z.number().positive(), capacityWh: z.number().min(0), maxW: z.number().min(0), chemistry: z.string() }),
      z.object({ role: z.literal('converter'), in: Rail, out: Rail, maxW: z.number().min(0), efficiency: z.number().min(0.05).max(1), chargeW: z.number().optional(), quiescentW: z.number().optional() }),
      z.object({ role: z.literal('charger'), chargeW: z.number().min(0) }),
    ])
    .optional(),
  ports: z.object({ provides: z.record(PortType, z.number().int().min(0)).optional(), consumes: z.record(PortType, z.number().int().min(0)).optional() }).optional(),
  notes: z.string().optional(),
  /** Catalog entry this part was copied from, if any. */
  basedOn: z.string().optional(),
})
export type CustomComponent = z.infer<typeof CustomComponent>

// ── Build ────────────────────────────────────────────────────────────────────
export const BuildKind = z.enum(['core', 'module'])
export type BuildKind = z.infer<typeof BuildKind>

export const Build = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  name: z.string(),
  kind: BuildKind.default('core'),
  /** DeckPort revision this build implements, e.g. "1.0". */
  deckport: z.string().default('1.0'),
  /** For a module: the core it was designed against (id and name, informative). */
  targetCore: z.object({ id: z.string(), name: z.string() }).optional(),
  /** Set when this build was forked from another. */
  forkedFrom: z.object({ id: z.string(), name: z.string() }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  case: Case,
  customComponents: z.array(CustomComponent).default([]),
  placements: z.array(Placement).default([]),
  features: z.array(Feature).default([]),
  accessories: z.array(Accessory).default([]),
  wiring: Wiring.default({}),
  print: PrintSettings.default({}),
  identity: Identity.default({}),
})
export type Build = z.infer<typeof Build>
