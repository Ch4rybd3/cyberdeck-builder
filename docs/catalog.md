# Component catalog

The catalog lives in `src/catalog/components.ts`. The **Raspberry Pi 5** is the reference platform.

## Entry fields

| Field | Meaning |
|---|---|
| `dims` | Envelope in mm (x = width, y = depth, z = height), rounded up for clearance |
| `mass` | Grams |
| `price` | Indicative EUR street price |
| `mounting` | Insert size, hole centres relative to the component centre, and standoff height |
| `windows` | Openings the case needs (screen active area, keyboard, port), per face of the component |
| `power` | `load` (rail, typical/peak W), `battery` (Wh, V, max W), `converter` (in → out, max W, efficiency) or `charger` (W) |
| `ports` | Ports it provides (SBC, hub) and consumes (display, keyboard, dongle) |

## Your own parts

Anything missing from the catalog can be described as a **custom component**, stored in your build. See [Custom components](./custom-components.md).

## Accuracy

Envelope sizes and prices are approximate. **Check a part's datasheet before cutting a window for it.** Corrections and new parts are welcome as pull requests. Add a `url` to the product page and a note for anything unusual.
