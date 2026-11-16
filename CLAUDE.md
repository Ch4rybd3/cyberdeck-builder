# Cyberdeck Builder — development rules

Local-first React + TypeScript + Vite app. Geometry runs on Manifold (WASM).
Architecture: docs/architecture.md.

1. **English only**: code, comments, UI strings, docs, commits.
2. **No literal colour outside `src/styles/tokens.css`** (shared with Remora). Filament colours are user data and are exempt.
3. **One icon per concept**, imported from `src/ui/icons.ts`, never from `lucide-react` directly.
4. **A schema change ships with its migration** in `src/domain/migrate.ts` and a `SCHEMA_VERSION` bump.
5. **Docs are part of the feature.** Update the relevant page in `docs/` and add an entry to `docs/changelog.md` with every user-visible change.
6. DeckPort numbers live only in `src/domain/deckport.ts`; `docs/deckport.md` quotes them. Change both together.
