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

## Compendium layout

| Pack | Visibility | Contents |
|------|------------|----------|
| `gear` | Players | Adventuring Gear, Weapons, Armor (non-magical) |
| `magic-items` | GM only (`private`) | Magic Items, Magical Weapons, Magical Armor |
| `abilities` | Players | Skills / Arts / Spells (by class & level) / Foci |
| `assets` | Players | Faction assets by type (Cunning / Force / Wealth) |
| `tags`, `tables` | Players | Location tags; generation & magic-item tables |
| `creatures-of-a-far-age` | Players | WWN monsters |
| `ose-monsters`, `ose-spells` | Players | OSE content |

## Module layout

See [module/MODULES.md](module/MODULES.md) for folder responsibilities and import conventions.

## Architecture notes

- **TypeDataModels** define Actor/Item schemas (`module/data/`). There is no `template.json`.
- **Active Effects** target curated bonus/mod fields (`module/config/ae-targets.mjs`); derived values are computed in `module/derivations/`.
- **Migration** lives in `module/migration/` only. Do not use `TypeDataModel.migrateData()` for iterative schema fixes.
- **Sheets** are the existing WWN Application V1 sheets (adapted to new data paths).
- **PCs** use Active Effects for combat/stat bonuses (Effects tab). **NPCs** use the Config tab for direct values; AE is optional.

## Releases

Publishing a GitHub Release (tag + release notes) triggers CI to build CSS and packs, rewrite `system.json` with the release version and download URL, zip the system, and attach `wwn.zip` and `system.json` to that release.

Bump `version` in `system.json` (and `package.json`) on the branch you intend to release before creating the tag. Tag names may include a leading `v` (e.g. `v2.0.0`); the workflow strips it when writing the manifest version.
