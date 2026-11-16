# Modules

A module is a small enclosure that plugs into a Core through a DeckPort socket: an SDR, a LoRa radio, a GPS, a second battery, a macro pad.

## Designing a module

1. **Library → DeckPort module (2U × 2U)** creates a module build. It starts with a DeckPort plug on its back face.
2. Place its electronics in the Workshop as usual.
3. Module loads on 5 V are powered from the Core through **VBUS**, so no converter is needed. USB and I²C devices take their port from the plug.
4. The Checks list warns when the module draws more than 15 W, or when the plug is missing.
5. Fill in its **DeckID**. Optionally note which Core it was designed for.

## Adding a socket to a Core

Add a **DeckPort** accessory to any face of the Core (Outline → Accessories → +). The Core gets the alignment recess, the connector window and four M3 inserts. Each socket:

- needs one free USB port on the Core (port check),
- gets a VBUS wire from the Core's 5 V converter on the Wiring page,
- adds a DeckPort connector to the Shopping list.

## Workflow: build the Core now, modules later

Print and assemble your Core with one or two sockets. Months later, design a module against DeckPort 1.0: it fits without touching the Core. Keep each module as its own build in the library, and link it to its Core in the DeckID.
