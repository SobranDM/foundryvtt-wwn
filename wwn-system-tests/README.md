# WWN System Tests

Quench integration tests for the [Worlds Without Number](..) system on Foundry VTT v14. This is **not a separate Foundry package** — there's no `module.json`, nothing to install or enable on its own. `module/wwn.mjs` (the system's own entry point) registers these batches itself, directly, via a `Hooks.once("quenchReady", ...)` listener that dynamically imports `wwn-tests.mjs` from this folder. That listener costs nothing when Quench isn't active (the event just never fires) and is wrapped in a try/catch for the same reason this folder is safe to keep out of the release build: it **never ships** — `.github/workflows/release.yml`'s zip step is a path whitelist that doesn't name this folder, so a normal end-user install doesn't have these files on disk at all.

These cover **Foundry-bound** behavior (Actor/Item CRUD, derived prepare, sheets, rolls, combat, packs). Pure helper math stays in the system's Node suite (`../tests`, i.e. `foundryvtt-wwn/tests`).

## Setup

1. Foundry **v14** with the **WWN** system installed as this repo checkout (symlinked/copied into `Data/systems/wwn`, per `CONTRIBUTING.md`) — packs built (`npm run build:packs`).
2. Install and enable [Quench](https://foundryvtt.com/packages/quench) in that world. That's it — no second module to enable; `wwn.mjs` picks the batches up on its own the moment Quench signals ready.
3. Open the Quench sidebar (flask) and run the `wwn.*` batches.

No build step — plain ESM, dynamically imported at runtime.

## Scope rule

| Layer | Responsibility |
|-------|----------------|
| Node (`foundryvtt-wwn/tests`) | Pure helpers, pack JSON invariants, migration transforms |
| Quench (this folder) | Live documents, sheets, combat, rolls, settings, packs |

## Batches

| Batch ID | Topic |
|----------|--------|
| `wwn.api` | `game.wwn` surface and document classes |
| `wwn.actors.smoke` | Actor type create/delete |
| `wwn.items.smoke` | Item type create/delete |
| `wwn.actors.derived` | AC, saves, mods, innate AC mirror |
| `wwn.rolls` | Skill / save / attack (pinned dice) |
| `wwn.ammo` | Magazine spend, reload, empty mag, expend-on-use |
| `wwn.combat` | Group Roll NPC safety; linked NPC weapon counter reset |
| `wwn.activeEffects` | AE → derived combat/ability changes |
| `wwn.powers` | Pool commitment reclaim via scene refresh |
| `wwn.focus` | Focus bonus skill rank vs points path; idempotent re-edit; no revoke on delete |
| `wwn.foci.combat` | WWN pack foci combat AEs (Armsmaster, Close Combatant, Deadeye, …) |
| `wwn.foci.sheet` | WWN origin/Developed sheet AEs, sample grants, no-combat-AE foci |
| `wwn.arts.innate` | Unarmored Defense / Cold Flesh innate AC and art negatives |
| `wwn.sheets.persistence` | Sheet render / update / reopen |
| `wwn.compendiums` | Pack document load + embed |
| `wwn.starship` | Hull preset + station assignment |
| `wwn.powerArmor` | Pilot link + plating derive |
| `wwn.regressions` | Recent bug fixes (targets, Godbound parens, skill dice, focus bonus-skill collision/re-entrancy) |
| `wwn.damage.apply` | Soak, heal, multiplier, preApply cancel, autoStabilize |
| `wwn.attack.pipeline` | Hit/miss shock, TL gate, AP armor ignore, applyRows |
| `wwn.chat.apply` | Chat card applyRow / multiplier / heal / no-target |
| `wwn.encumbrance` | Readied/stowed/currency weight, movement rates, sheet |
| `wwn.powers.lifecycle` | usePower spend/reclaim, prepared gate, activate/deactivate |
| `wwn.classEdge` | Attribute/HD/bonus skill grants without dialogs |
| `wwn.combat.encounters` | Personal/starship/faction combatant segregation |
| `wwn.starship.combat` | Combat bonus HP, hull damage, combatant state, station sheet |
| `wwn.powerArmor.combat` | Soak overflow to pilot, empty-suit path, sheet persist |
| `wwn.bonusSkillsBackfill` | 2.0.0-beta4 legacy-grant backfill, no re-grant after, compendium-swap flag preservation |

## Notes

- Tests create temporary `Quench …` actors/items and delete them in `finally`.
- Compendium batch skips if `wwn.abilities-wwn` is missing.
- No Cypress driver in v1 — run from the Quench UI.
- Prefer selective runs for gap suites: `wwn.attack.pipeline`, `wwn.chat.apply`, `wwn.foci.combat`, `wwn.foci.sheet`, `wwn.arts.innate`, `wwn.starship.combat`, `wwn.powerArmor.combat`.
