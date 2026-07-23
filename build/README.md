# Build scripts

## Pipeline (used by `npm run build`)

| Script | npm | Purpose |
|--------|-----|---------|
| `build-packs.mjs` | `build:packs` | Compile LevelDB packs from `packs/source` |
| `lint-pack-folders.mjs` | `lint:packs` | Validate pack folder paths |
| `extract-packs.mjs` | `extract:packs` | Extract packs back to source JSON |
| `migrate-packs.mjs` | `migrate:packs` | Run pack migrations |
| `foundry-shim.mjs` | (tests) | Minimal Foundry globals for Node tests |
| `pack-folder-paths.mjs` | (lib) | Shared path helpers for pack tooling |

## One-shot generators (not part of normal build)

These rewrite or seed pack source JSON. Run intentionally after changing authoring data:

```bash
npm run generate:skills          # SWN/AWN skill packs
npm run generate:starship-fittings
npm run generate:example-starships
npm run generate:armor-fittings
npm run generate:example-power-armor
npm run generate:wire-foci       # apply focus automation seeds to pack JSON
```

Shared focus seed tables live in `module/helpers/focus-automation-seeds.mjs` (imported by migration and `wire-foci-automation.mjs`).
