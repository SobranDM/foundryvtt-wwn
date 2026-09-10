# Contributing

Guide for developing and contributing to the Worlds Without Number Foundry VTT system.

## Tooling

### Misc

- [FVTT CLI](https://github.com/foundryvtt/foundryvtt-cli) — package document JSON under `packs/source/` into LevelDB packs (and extract the reverse)
- [Sass](https://sass-lang.com/) (via npm) — compiles `scss/` into `styles/main.css`

## Setting up a development environment

### 1. Clone the repository

```bash
git clone https://github.com/SobranDM/foundryvtt-wwn.git
cd foundryvtt-wwn
```

### 2. Install Node.js and dependencies

Install the [LTS version of Node.js](https://nodejs.org/en/download/), then:

```bash
npm install
```

### 3. Build CSS and packs

Compiled CSS (`styles/main.css`) and LevelDB packs under `packs/` are **not** committed. After clone or pull:

```bash
npm run build:css     # compile styles/main.css
npm run build:packs   # compile packs/* from packs/source/*
npm run build         # both of the above
npm run watch:css     # recompile SCSS on change (run in your own terminal)
```

To refresh JSON source from built LevelDB packs (after editing packs in Foundry):

```bash
npm run extract:packs
```

To migrate pack JSON after schema changes:

```bash
npm run migrate:packs
```

Pack folder depth is limited to **3** (Foundry's compendium limit). `npm run build:packs` runs a lint check first.

### 4. Local Foundry instance

Symlink (or copy) this repo into Foundry's `Data/systems/wwn` directory so Foundry loads your working tree. Prefer a separate Foundry userData for development so live worlds are not at risk.

## Testing

- **Node (`tests/`)** — pure helpers, pack JSON invariants, migration transforms. Run with `npm test`.
- **Quench (`wwn-system-tests/`)** — live-Document/hook integration tests (Actor/Item CRUD, sheets, rolls, combat). Not a separate package — no `module.json`, nothing to symlink or enable on its own. `module/wwn.mjs` registers these batches itself on `quenchReady`, dynamically importing this folder only when that fires. It's still never part of the shipped system: the release zip whitelist in `.github/workflows/release.yml` doesn't name it, so a release build simply doesn't have these files. Enable Quench in a dev world running this checkout and run the `wwn.*` batches from the Quench sidebar. See [wwn-system-tests/README.md](wwn-system-tests/README.md).

## Compendium layout

Abilities are split one pack per game line, each with its own Skills folder
plus that line's classes/edges and arts/foci/etc.:

| Pack | Visibility | Contents |
|------|------------|----------|
| `abilities-wwn` | Players | Skills, Classes, Arts, Spells, Foci |
| `abilities-swn` | Players | Skills, Classes, Psychic Techniques, Foci |
| `abilities-awn` | Players | Skills, Edges, Mutations, Foci |
| `abilities-cwn` | Players | Skills, Edges, Foci |
| `gear` | Players | Adventuring Gear, Weapons, Armor (non-magical) |
| `magic-items` | GM only (`private`) | Magic Items, Magical Weapons, Magical Armor |
| `assets` | Players | Faction assets by type (Cunning / Force / Wealth) |
| `starship-fittings` | Players | Starship fittings, weapons, and defenses |
| `armor-fittings` | Players | Power armor fittings |
| `tags`, `tables`, `tables-awn` | Players | Location tags; generation & magic-item tables; AWN mutation/stigma tables |
| `creatures-of-a-far-age` | Players | WWN monsters |
| `ose-monsters`, `ose-spells` | Players | OSE content |
| `example-starships`, `example-power-armor` | Players | Pre-built example Actors (Power Armor examples are for testing only — will be removed) |

## Module layout

See [module/MODULES.md](module/MODULES.md) for folder responsibilities and import conventions.

## Architecture notes

- **TypeDataModels** define Actor/Item schemas (`module/data/`). There is no `template.json`.
- **Active Effects** target curated bonus/mod fields (`module/config/ae-targets.mjs`); derived values are computed in `module/derivations/`.
- **Migration** lives in `module/migration/` only. Do not use `TypeDataModel.migrateData()` for iterative schema fixes.
- **Sheets** are Application V2 (`ActorSheetV2` / `ItemSheetV2` with Handlebars mixins).
- **PCs** use Active Effects for combat/stat bonuses (Effects tab). **NPCs** use the Config tab for direct values; AE is optional.

## Releases

Publishing a GitHub Release (tag + release notes) triggers CI to build CSS and packs, rewrite `system.json` with the release version and download URL, zip the system, and attach `wwn.zip` and `system.json` to that release.

Bump `version` in `system.json` (and `package.json`) on the branch you intend to release before creating the tag. Tag names may include a leading `v` (e.g. `v2.0.0`); the workflow strips it when writing the manifest version.
