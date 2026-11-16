# Changelog

## 0.5.0 (2026-11-16)

- **Modules on the Core**: a DeckPort socket can hold a module from the library. The module is drawn mounted on the socket (and follows a hinged lid), its draw is a load on the Core's 5 V rail, and the checks cover the 15 W socket limit and DeckPort version compatibility. The DeckID lists attached modules. The Wayfarer example now carries the SDR module.
- **Text labels**: a *Text* sketch for any feature, so letters can be inlaid in a second colour, engraved or embossed, in the Remora fonts. The Wayfarer and Vanguard examples have codename labels.
- Build schema 5 (older builds migrate automatically).

## 0.4.0 (2026-11-16)

- **Workshop tools**: **Select** (V), **Move** (M) with arrows along X, Y and Z, and **Rotate** (R) with rings about X, Y and Z in 90° steps. Each drag is one undo step.
- **3D orientation**: components can be tilted about X and Y as well as turned about Z, e.g. a board standing on its edge. Envelopes, collisions and fit follow, and windows are cut in whichever face they end up pointing at, including the tray floor. Tilted boards get no standoffs.
- Inspector: one 90° step button per axis.
- Build schema 4 (older builds migrate automatically).

## 0.3.0 (2026-11-16)

- **Custom components**: describe your own parts (envelope, mounting holes, windows, power role, ports), or make an editable copy of any catalog part. They are stored in the build, so share links and files carry them.
- **Smoother editing**: the case generator runs in a Web Worker and only the newest change is rebuilt.
- **Viewport**: Iso / Top / Front / Side camera presets, the name of the component under the pointer, a hint on an empty build, and the camera resets when you open another build.
- **Print**: download any single piece as an STL.
- **Robustness**: pages load on demand, and a page that crashes shows a recovery panel instead of a blank screen.
- **Repository**: ESLint (including the one-icon-per-concept rule), a CI workflow (lint, typecheck, tests, build), a manual-only Pages workflow, contribution guide and issue templates.
- Build schema 3 (older builds migrate automatically).

## 0.2.0 (2026-11-16)

- **New formats**: **Tactical** (faceted, bevelled, side grip, rail, screen slider), **Briefcase** (hinged laptop-style clamshell) and **Suitcase** (deep rugged hard case).
- **Case shape**: chamfered corners and a 45° edge bevel on the tray bottom and the lid top.
- **Knuckle hinge** along the back edge on a Ø3 mm pin, with an **Open lid** control in the Workshop that swings everything attached to the lid.
- **Magnet closure** as an alternative to screws (Ø6 × 3 mm discs).
- **Screen slider**: dovetail rails, separate end stops, a carriage sized from its display, a bezel and a lid cable slot. Carriages wider than the bed split with staggered bezel seams. **Slide screen** control in the Workshop.
- **Light mode**: a quick light/dark button, plus a theme that follows the operating system.
- **Documentation**: screenshots throughout, and new pages for Formats, Accessories (with a step-by-step for placing Picatinny rails) and Screen slider. `npm run screenshots` regenerates the images.
- New examples: **Vanguard** (tactical) and **Courier** (briefcase). They are added to existing libraries too.
- Shopping list: magnets and hinge pin.
- Build schema 2 (older builds migrate automatically).

## 0.1.0 (2026-11-16)

First version.

- **Workshop**: 3D viewport with drag-to-place, a component catalog centred on the Raspberry Pi 5, an outline, an inspector, undo/redo and keyboard nudging.
- **Case generator** (Manifold WASM): rounded tray and lid; corner closure bosses with heat-set inserts and counterbored lid screws; standoffs with inserts under boards; automatic windows for screens, keyboards and ports.
- **Geometry features**: cut, extrude, inlay and boss on any face, with rect, circle, slot and polygon sketches, rotation and grid patterns.
- **Accessories**: Picatinny rail, handle, foot and DeckPort, all bolted on with M3 heat-set inserts.
- **Printing**: printer profiles (Ender 3, Bambu A1 / A1 mini / P1S / X1C, Prusa MK4 / CORE One); automatic bed-fit splitting with insert and screw joint blocks that avoid components; multi-colour 3MF and per-body STL export.
- **Power**: per-rail budget, converter sharing and efficiency, battery draw, autonomy, charge time, Pi 5 5 A check.
- **Wiring**: diagram derived from power and ports, with editable nodes and wires and a suggested wire gauge.
- **Shopping list**: electronics, inserts and screws counted from the geometry, wire and filament estimates, CSV export.
- **DeckID**: identity card with computed specs and a photo.
- **Library**: local-first storage, formats, examples, JSON import/export, share links, forks.
- **DeckPort 1.0**: mechanical, electrical (8-pin: 5 V, USB 2.0, I²C, ID, VBAT) and logical spec; module builds.
- **Design system**: Remora tokens and primitives, four themes.
