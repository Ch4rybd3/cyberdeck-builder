# Cyberdeck Builder

Design modular cyberdecks in the browser, from the electronics to a printable case.

![The Workshop](docs/images/workshop.png)

- **Place real components** in 3D. The catalog is built around the Raspberry Pi 5, and you can describe your own parts.
- **Formats**: slab, tactical, briefcase, suitcase, field case, handheld and DeckPort module, with chamfered or rounded outlines, bevels and a knuckle hinge.
- **Shape the case** with basic operations: cut, extrude, colour inlay and boss on any face, with patterns.
- **Sliding screen**: a display carriage on dovetail rails that covers the keyboard for transport.
- **Bolt-on accessories**: Picatinny rails, handles, feet, all held with heat-set inserts.
- **Live checks**: fit, collisions, power budget, ports, heat and printability.
- **Print it**: automatic splitting for small beds (an Ender 3 works), joined with inserts and screws, multi-colour 3MF and STL export.
- **Shopping list**: electronics, every insert and screw, wire and filament.
- **Wiring diagram** derived from the build.
- **DeckPort**: an open interface, so modules designed later fit the Core you print now.
- **Local-first**: builds stay in your browser; share them as files or self-contained links.

The UI uses the design system of [Remora](https://github.com/Ch4rybd3/Remora).

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # static site in dist/
```

## Documentation

Everything is in [`docs/`](docs/index.md), and the same pages are rendered under **Documentation** in the app.

## Checks

`npm run check` runs lint, typecheck and tests, the same as CI (`.github/workflows/ci.yml`) on every push and pull request.

## Deploy

`.github/workflows/pages.yml` builds and publishes to GitHub Pages. It is **manual for now**: run it from the Actions tab. Before the first run, set **Settings → Pages → Source** to *GitHub Actions*. The build uses relative paths and hash routing, so it also works unchanged on a custom domain.

## Licence

The code is under the MIT licence (see `LICENSE`). Each deck design carries its own licence, chosen on its DeckID card; the default is CERN-OHL-S-2.0.
