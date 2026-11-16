# Contributing

Thanks for helping. Rules that keep the project consistent (also in `CLAUDE.md`):

1. **English only** in code, comments, UI strings, docs and commit messages.
2. **No literal colour** outside `src/styles/tokens.css`. Use the semantic tokens (Tailwind classes such as `text-fg`, `bg-panel`, `text-accent`). Filament colours are user data and are exempt.
3. **Icons** come from `src/ui/icons.ts`, one icon per concept. ESLint enforces it.
4. **Schema changes** bump `SCHEMA_VERSION` and add a step in `src/domain/migrate.ts`, in the same pull request.
5. **Docs are part of the feature.** Update `docs/` and add a line to `docs/changelog.md`. If the interface changed, regenerate the screenshots with `npm run screenshots`.
6. **DeckPort** numbers live in `src/domain/deckport.ts` and are quoted in `docs/deckport.md`. Change both together and follow its versioning rules.

## Workflow

```sh
npm install
npm run dev
npm run check     # lint + typecheck + tests, as in CI
```

## Commits

Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

## Catalog parts

Add parts to `src/catalog/components.ts` with a product `url`, envelope sizes rounded up, and a note for anything unusual. Prices are indicative EUR street prices.
