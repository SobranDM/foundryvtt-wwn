# WWN Data Models

This folder contains **TypeDataModel** classes per actor and item type, as part of the v13 modernization.

## template.json vs TypeDataModel (Foundry behavior)

Foundry uses **one** of these per document type for defaults and validation (see `common/data/fields.mjs` TypeDataField):

- **If** `CONFIG.Actor.dataModels[type]` (or Item, etc.) is set: the **TypeDataModel** is used. Its schema and `initial` values define structure and defaults. **template.json is not used** for that type.
- **Else**: Foundry falls back to **template.json** via `game.model[documentName][type]` to merge defaults when cleaning/initializing system data.

So:

- **Character**: We register `WwnCharacterDataModel` for `"character"`, so at runtime character actors use the TypeDataModel only; the character section in `template.json` is redundant for behavior (but Foundry may still load it into `game.model` until we remove it).
- **Monster, faction, ship, vehicle, and all item types**: No data model is registered yet, so they **still rely on template.json** for structure and defaults.

Once every actor and item type has a registered TypeDataModel, the system could reduce or remove corresponding sections from `template.json`; until then, template.json remains the source of truth for all types that don’t have a registered model.

## Status

- **Actors**: All five types implemented and registered in `wwn.js`: character, monster, faction, ship, vehicle. Shared common and spellcaster schemas live in `actor/schemas.mjs`.
- **Items**: All 13 types implemented and registered: item, weapon, armor, spell, art, focus, skill, ability, asset, crewmember, fitting, shipweapon, cargo.

## Goal

- Replace reliance on `template.json` for runtime data shape by defining TypeDataModel classes using `foundry.data.fields`.
- Register in `init` as `CONFIG.Actor.dataModels["character"]`, etc., and `CONFIG.Item.dataModels["weapon"]`, etc.
- Use `prepareBaseData()` and `prepareDerivedData()` on each model for computed values currently in type-delegate modules.
- Existing world and compendium documents remain valid (schema uses `initial` and optional fields).

## Reference

- Foundry docs: `docs/registration/types-and-models.md`
- Draw-steel: `systems/draw-steel/src/module/data/actor/`, `data/item/`
- Plan: Phase 7 in the WWN Foundry Modernization Plan

## Structure

- `actor/` – schemas.mjs (common, spellcaster), character.mjs, monster.mjs, faction.mjs, ship.mjs, vehicle.mjs
- `item/` – item.mjs, weapon.mjs, armor.mjs, spell.mjs, art.mjs, focus.mjs, skill.mjs, ability.mjs, asset.mjs, crewmember.mjs, fitting.mjs, shipweapon.mjs, cargo.mjs

Type-specific logic remains in `module/actor/types/*.mjs` and `module/item/`; models own schema and derived data only.
