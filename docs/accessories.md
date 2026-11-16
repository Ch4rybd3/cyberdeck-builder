# Accessories

Accessories are **separately printed parts** that bolt onto the case. The case gets M3 heat-set inserts in bosses behind its wall; the accessory gets counterbored clearance holes. The accessory comes off with a hex key, without touching the case.

| Accessory | Size | Fixing |
|---|---|---|
| **Picatinny rail** | 21.2 mm wide, your length | M3 screws on the lands between slots, at both ends (plus the middle from 120 mm) |
| **Handle, block** | 20 × 32 mm section, your length (min. 80 mm) | 4 × M3, two in each foot |
| **Handle, tube** | Two posts and a Ø24 mm grip, your length (min. 100 mm) | 4 × M3 for the posts, one M5 bolt through posts and grip |
| **Foot** | Ø18 × 5 mm | 1 × M3, add a rubber bumper |
| **DeckPort** | 40 × 20 mm socket or plug | 4 × M3, see [DeckPort](./deckport.md) |
| **Screen slider** | Sized from its display | See [Screen slider](./slider.md) |

## Placing a Picatinny rail, step by step

![Outline tab with the accessory menu open](./images/accessory-menu.png)

1. In the **Workshop**, open the **Outline** tab in the left rail.
2. Next to **Accessories**, click **+** and choose **Picatinny rail**. The rail appears on the tray's left face and the Inspector opens on it.
3. In the Inspector, set:
   - **Part**: *Tray* or *Lid*.
   - **Face**: the side it goes on. *Left*, *Right*, *Front* and *Back* are the usual choices; *Top* on the lid makes a rail for a light or a camera.
   - **Offset u / v**: where the centre of the rail sits on that face, from the face centre. u runs left to right and v bottom to top, as seen from outside that face (see [Case geometry](./case-geometry.md#placement-on-the-face)).
   - **Length**: in mm. Slots are cut every 10.01 mm, so a length that is a multiple of 10 plus 4 gives clean ends (54, 104, 144…).
   - **Orientation**: *Along u* lays the rail horizontally on the face, *Along v* vertically. A vertical rail needs a face at least as tall as the rail is long.
   - **Colour**: the rail is its own body, so it can be another filament.
4. Pull the **Explode** slider in the toolbar to see the rail lift off the case with its screw holes.

![A Picatinny rail on the right face, selected and exploded](./images/picatinny.png)

Check the face height: the tray's side faces are only *Tray height* tall, so a rail along v on a 34 mm tray is limited to about 30 mm. The rail's base is 21.2 mm wide, and the M3 bosses behind the wall need about 8 mm of clear space inside the case. The **Checks** tab reports a component that collides with them.

### Printing a rail

Print it **base down**. The 45° dovetail flanks print without supports. Test-fit a short rail (54 mm) with your accessory first: the profile is a simplified MIL-STD-1913 and every printer's tolerances differ. If the fit is tight, scale the rail by 101% across its width in the slicer.

### Attaching it

1. Press one M3 heat-set insert into each boss on the case (220 °C for PLA, 240 °C for PETG).
2. Hold the rail on the face and drive M3 × 6 screws (see the Shopping list for the exact length) through its counterbored holes.

## Kickstand

A **kickstand** tilts the deck towards you. Put it on the **bottom** face, near the back edge.

- **Hinge**: a base plate with two cheeks, held under the case by two M3 screws into inserts in the floor.
- **Leg**: folds flat under the case towards the front, and swings down on an **M3 bolt with a nyloc nut**. Tighten the nut until the leg holds its angle by friction.
- In the Inspector: **Leg length** (how far the back lifts) and **Leg width**.
- **Kickstand** in the Workshop toolbar swings the leg open to check it clears the feet and the edge.

![Wayfarer from the side with its kickstand open](./images/kickstand.png)

Print the hinge base down and the leg flat. The Wayfarer example has one.

## Cables

Three accessories deal with cables. Add them from Outline → Accessories → +.

| Accessory | What it makes | Use it for |
|---|---|---|
| **Cable gland** | A hole sized for a **PG7, PG9, M12, M16 or M20** threaded gland. The gland itself is on the Shopping list. | A sealed, strain-relieved exit: an antenna coax, a power lead, a sensor cable |
| **Grommet** | A rounded slot through the wall, and a flexible **grommet to print in TPU**: flange outside, a lip that snaps behind the wall, and a slit membrane the cable pushes through | A neat pass-through for one or several cables, or a ribbon |
| **Tie point** | A small bridge inside a wall or the floor; a 2.5 mm zip tie goes under it | Holding cable bundles in place inside the case |

![A PG9 gland hole, a grommet and two tie points](./images/cables.png)

- A gland needs flat wall around it for its locknut on the inside; the Checks tab warns when it is too close to an edge.
- Print grommets in **TPU 95A**, flange down. The membrane is 0.8 mm thick so a cable can push through its slit.
- Place tie points along the cable routes on the Wiring page, in the gaps between components. Orientation sets which way the zip tie runs.

## Handles and grips

Select a handle and choose its **Style** in the Inspector.

- **Block**: a one-piece U shape bolted on with four screws.
- **Tube**: two rounded posts, each held by two M3 screws into inserts in the case, and a cylindrical **grip** on an **M5 bolt** between them. The bolt head sits in a counterbore on one post, its nut in a hex trap on the other. The grip prints **standing up**, so its texture comes out clean with no supports. Choose its surface under **Grip**:
  - **Smooth**,
  - **Ribbed**: a ring every 5 mm,
  - **Knurled**: a diamond knurl from two opposite 30° helices.

![Knurled grip](./images/handle-knurled.png)

![Ribbed grip](./images/handle-ribbed.png)

To assemble a tube handle: screw both posts on, hold the grip between them, push the M5 bolt through post, grip and post, and tighten the nut. The Shopping list gives the bolt length.

A handle or rail must stay on the **flat part of its face**: on a rounded or chamfered case the last *corner radius* millimetres of each side curve away. The Checks tab warns when one runs past it.

On the **Tactical** format it sits on the left face as a side grip; on the **Briefcase** and **Suitcase** formats it is on the front face of the tray, so the case hangs hinge-up when carried.

## Feet

Four feet on the bottom face are added by most formats. Each takes one M3 insert in a boss above the floor. Stick a rubber bumper on top of each foot.
