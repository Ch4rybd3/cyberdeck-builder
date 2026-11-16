# Changelog

## 1.0.0 (2026-11-16)

First complete version.

- **STEP export** (Print page): every piece as a named faceted solid, assembled, for FreeCAD, Fusion 360, Onshape or SolidWorks. Coplanar triangles are merged into flat faces with holes.
- **Editable shopping list**: your own unit prices (↺ restores the catalog price) and an **owned** tick per line; the **To buy** total counts only what is left. Edits are saved in the build and exported in the CSV.
- **Snapshots**: download the 3D view as a PNG, or set it as the DeckID photo, from the Workshop.
- Build schema 10 (older builds migrate automatically).

## 0.10.0 (2026-11-16)

- **Print plates**: the Print page packs the pieces onto the printer's bed, draws each plate from above with the real outlines, gives a rough time and filament weight per plate, and exports each plate as a laid-out 3MF.
- **Kickstand**: a hinge bolted under the case and a leg that folds flat and swings down on an M3 bolt; **Kickstand** in the toolbar opens it. Wayfarer has one.
- Printer profiles carry an average flow rate for the time estimate.
- Build schema 9 (older builds migrate automatically).

## 0.9.0 (2026-11-16)

- **Cable management**: **cable glands** (PG7, PG9, M12, M16, M20), printed **TPU grommets** with a slit membrane, and **tie points** for zip ties inside the case. Glands, zip ties and TPU are on the Shopping list and in the Assembly guide. Courier gets a PG9 gland for an external antenna and tie points; Wayfarer gets tie points.
- **Fixed, important**: everything added *inside* the case (board standoffs, the inner half of the closure bosses, accessory insert bosses, split-joint blocks, internal bosses) was erased by the interior cavity, which was subtracted after them. The cavity is now carved out of the shell first. Re-export your STL / 3MF files: earlier exports lack these parts.
- **Fixed**: split-joint blocks hanging from a lid's ceiling stopped 1.4 mm short of it on shallow lids. They now touch it, and joint spots under windows and slots are skipped.
- The loose-bits check now gives the position of each loose bit.

## 0.8.0 (2026-11-16)

- **Assembly simulation**: a 3D view beside the checklist plays each step: parts drop in, slide on, join or close, highlighted, with everything installed so far in place. **Done, next** ticks the step and moves on.
- The slider's assembly is split into three steps (rails; display, carriage and bezel; carriage on, end stops).
- Fixed: printing a page only gave its first screen. Pages now print in full across as many sheets as needed, in the light palette, without the sidebar, toolbars or 3D views.

## 0.7.0 (2026-11-16)

- **Tube handle**: two posts and a cylindrical grip on an M5 bolt, with a smooth, **ribbed** or **knurled** grip printed standing up. The Tactical format and the Suitcase use the knurled grip, the Briefcase the ribbed one.
- **Assembly guide**: a new page that lists the build's assembly steps in order, from printing to closing the case, with boxes to tick.
- Fixed: closure bosses on **chamfered** cases poked through the corner chamfer. They now slide in along the diagonal until they clear it.
- Fixed: the Tactical front ribs ran onto the chamfered corners. Extrude features are now trimmed to the flat part of their face, and the checks report it.
- Fixed: the Tactical template's slider put its end-stop bosses in the lid corners. Slider screws too close to an edge or corner are now flagged.
- New checks: **loose bits** (a printed piece in several disconnected solids), and rails or handles that run past the flat part of their face.
- Build schema 7 (older builds migrate automatically).

## 0.6.0 (2026-11-16)

- **DeckPort 1.1**: adds a **USB-C** connector option for sockets and plugs, and a **rail mount**: a printed Picatinny clamp with an M4 cross bolt, and a USB-C cable to a port beside the rail or past its end. Every 1.0 module still fits.
- **Modules panel** in the sidebar: on a Core, every socket and rail with a menu to pick its module and a shortcut to open it; on a module, how it mounts and the Cores it is on.
- Rail modules snap to the slot pitch, count on the Core's 5 V budget, reserve a USB port, and are checked for socket/rail and connector compatibility.
- New format **Rail module (Picatinny)**. The examples now show all three connections: Wayfarer + SDR (pogo socket), Courier + GPS (USB-C socket), Vanguard + LoRa (rail).
- Shopping list: USB-C receptacles, plugs and cables, and the rail clamp bolt.
- Build schema 6 (older builds migrate automatically).

## 0.5.1 (2026-11-16)

- **Restore examples** in the Library puts back any example build that was deleted, without touching the others.
- Deleting a build now takes a confirmation click.
- New example modules: **LoRa module** (mounted on Vanguard's back socket) and **GPS module** (mounted on Courier's right socket). The SDR module gets an inlaid label, and Courier a USB hub so every port is covered.
- A test now checks that every example builds without blocking issues, with its modules attached.

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
