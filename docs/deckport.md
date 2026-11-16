# DeckPort specification

**Version 1.0**

DeckPort is the interface between a **Core** deck and its **modules**. Any module that implements DeckPort 1.x fits any Core with a DeckPort 1.x socket. The numbers below are the source of truth in `src/domain/deckport.ts`.

## Mechanical

| Item | Value |
|---|---|
| Module grid unit | **20 mm**. Module footprints are whole multiples (2U × 2U = 40 × 40 mm). |
| Socket footprint | 2U × 1U = **40 × 20 mm** on any face of the Core |
| Fixing | Four **M3 heat-set inserts** in the Core at (±15, ±5) mm from the socket centre |
| Screws | From the inside of the module, through Ø3.4 clearance holes, into the Core inserts |
| Alignment | **36 × 14 × 1.0 mm** recess in the Core; the module has a 35.6 × 13.6 × 0.8 mm key |
| Connector window | **22 × 5.5 mm** through the wall, centred |

The key-and-recess pair locates the module to within ±0.2 mm before the screws go in, so the pogo pins land on their pads.

## Electrical

8-pin connector, 2.54 mm pitch. A magnetic pogo pair is recommended: female pads on the Core, spring pins on the module.

| Pin | Name | Function |
|---|---|---|
| 1 | VBUS | 5 V regulated, **3 A max** per socket (15 W) |
| 2 | GND | Ground |
| 3 | D+ | USB 2.0 data +, from a Core USB port or hub |
| 4 | D− | USB 2.0 data − |
| 5 | SDA | I²C data, 3.3 V logic |
| 6 | SCL | I²C clock, 3.3 V logic |
| 7 | ID | Module identification: 1-Wire EEPROM, or an ID resistor to GND |
| 8 | VBAT | Raw battery rail, optional, fused at 3 A on the Core side |

Rules:

- The Core must route **one USB 2.0 port** to each socket. The port check counts it.
- The Core should place a **polyfuse or load switch** on VBUS for each socket.
- A module must draw no more than **15 W** from VBUS. The module checks enforce it.
- VBAT is optional. A module must not back-feed VBAT.
- USB 2.0 over short pogo contacts works reliably at full speed and usually at high speed. Keep the traces or wires short and twisted.

## Logical

A module is a build with `kind: "module"`. It records the DeckPort version it implements (`deckport: "1.0"`) and may name the Core it was designed against (`targetCore`).

### Versioning

- **Minor** versions (1.1, 1.2) only add things, such as optional pins or optional features, and stay compatible.
- A **major** version (2.0) may change the footprint or the pinout. Cores and modules record the version they implement, so the app can warn about a mismatch.
