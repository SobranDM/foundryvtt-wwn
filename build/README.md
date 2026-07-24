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

## One-shot generators

Content import/generator scripts live in the gitignored `import-scripts/` folder (local only). When present, run them via the `npm run generate:*` scripts in `package.json`.

Shared focus seed tables used by migration live in `module/helpers/focus-automation-seeds.mjs`.
