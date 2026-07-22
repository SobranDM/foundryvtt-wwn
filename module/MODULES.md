# WWN system — `module/` layout

Entry point: [`wwn.mjs`](wwn.mjs) (registered in `system.json`).

## Folder responsibilities

| Path | Purpose |
|------|---------|
| [`config/`](config/) | System constants (`WWN`), power subtypes, AE target registries, faction catalogs |
| [`data/`](data/) | TypeDataModels (`actor/`, `item/`) |
| [`derivations/`](derivations/) | Pure post-AE derived math (AC, initiative, saves, pools, …) |
| [`documents/`](documents/) | Document subclasses (Actor, Item, ActiveEffect, Combat) |
| [`actor/`](actor/) | Application V1 actor sheets (`character-sheet.js`, `monster-sheet.js`, …) |
| [`item/`](item/) | Application V1 item sheet and item action helpers |
| [`dialog/`](dialog/) | FormApplication dialogs (party, character creation, modifiers, …) |
| [`applications/`](applications/) | AppV2 menus / AE config and standalone dialogs |
| [`migration/`](migration/) | Versioned world/compendium transforms |
| [`helpers/`](helpers/) | Power/focus AE sync, ammo, sheet legacy bridge, effects UI helpers |
| [`combat/`](combat/) | Combat, combatant, tracker, group initiative |
| [`dice/`](dice/) | Roll pipeline and chat roll helpers |
| [`chat/`](chat/) | Chat listeners / card actions |
| [`settings/`](settings/) | Settings registration and menus |

Sheets remain Application V1 under `actor/` and `item/` until a future AppV2 migration. Do not add empty `sheets/` placeholders.

## Import conventions

- **Derived math:** import from `derivations/*.mjs`, not from sheets.
- **AE targets:** import registries from `config/ae-targets.mjs` / `config/ae-item-targets.mjs`.
- **Migration:** import transforms from `migration/`; do not add runtime `migrateData` hacks on TypeDataModels.
- **Powers / pools:** power use and pool refresh live in `documents/item.mjs` and `helpers/power-*.mjs`; pool maxes come from `classEdge` via `derivations/resource-pools.mjs`.
- **Ammo / charges:** use `helpers/ammo.mjs` for attack spend, magazine reload, and gear expend-on-use.
- **PCs vs NPCs:** PC bonuses go through Active Effects. NPC combat numbers are edited on the monster sheet Config tab (direct schema fields); AE remains optional.

## Document types

| Kind | Types |
|------|--------|
| Actor | `pc`, `npc`, `faction` |
| Item | `power`, `classEdge`, `focus`, `skill`, `weapon`, `armor`, `item` (gear), `currency`, `asset` |
