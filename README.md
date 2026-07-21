![Latest Release Download Count](https://img.shields.io/github/downloads/sobrandm/foundryvtt-wwn/latest/wwn.zip?color=2b82fc&label=DOWNLOADS&style=for-the-badge)

[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fwwn&colorB=4aa94a)](https://forge-vtt.com/bazaar#package=wwn)

# Worlds Without Number for Foundry VTT (Unofficial)

Everything you need to play Worlds Without Number in Foundry VTT.

## Features

- Calculated Readied/Stowed values, including dynamic tracking of currency weight
- Calculates total wealth from carried coin, bank, and treaure items
- Track weapon tags; hovering over the tag icon or name displays the full tag description
- Track Effort commitment by Art and have class-specific Effort updated automatically
  - Click Tweaks in the character title bar to activate spellcasting and enter caster class(es)
- Visual indicator of health/strain percentage
- Auto-calculate saves for PCs and NPCs alike
- Calculates movement rates based on Readied/Stowed values
  - Use standard WWN movement rates or B/X movement
  - Auto-calc can be disabled
- Adds attribute bonuses to hit chance, damage, and shock
  - A per-weapon checkbox enables adding skill value to damage and shock
- Shock and damage account for attribute bonuses, the Killing Blow warrior ability, and Foci that add skill levels to damage
  - Click Full Warrior in Tweaks menu to activate Killing Blow
  - Skill damage is activated on a per-item basis, due to the variable nature of Foci
- Support for Specialist and other Foci that allow rolling 3d6/4d6 on skill checks
- Distribute XP through the party sheet
  - Assign percentage shares to henchmen, to support silver-as-XP (and custom XP values) for B/X-style play
- Easily roll multiple saving throws from an Art, Spell, or weapon's chat card
- GM Tools: quickly generate things from the GM Tables in WWN
  - Currently supports Nation, Government, Society, and History Construction. More will be added in the future.
- Roll Morale and Instinct checks with two clicks
  - Link appropriate Instinct tables from Compendium to NPC sheet to auto-roll when Instinct check is failed
- Compendium includes weapons, armor, adventuring gear, arts, spells, and foci. Deluxe edition content is not included.
  - Thanks to Gavin over at Necrotic Gnome, the Compendium now includes OSE spells and (some) monsters.

## Development

This system's stylesheet is written in SCSS, compiled to `styles/main.css` with [Dart Sass](https://sass-lang.com/dart-sass/). Compendium packs are stored as JSON under `packs/source/` and compiled to LevelDB under `packs/`. Neither the compiled CSS nor the LevelDB packs are committed, so after cloning or pulling you'll need to build them:

```bash
npm install
npm run build:css     # compile styles/main.css
npm run build:packs   # compile packs/* from packs/source/*
npm run build         # both of the above
npm run watch:css     # recompile SCSS on change
```

To refresh JSON source from built LevelDB packs (after editing packs in Foundry):

```bash
npm run extract:packs
```

Pack folder depth is limited to **3** (Foundry's compendium limit). `npm run build:packs` runs a lint check first.

Compendium layout:

| Pack | Visibility | Contents |
|------|------------|----------|
| `gear` | Players | Adventuring Gear, Weapons, Armor (non-magical) |
| `magic-items` | GM only (`private`) | Magic Items, Magical Weapons, Magical Armor |
| `abilities` | Players | Skills / Arts / Spells (by class & level) / Foci |
| `assets` | Players | Faction assets by type (Cunning / Force / Wealth) |
| `tags`, `tables` | Players | Location tags; generation & magic-item tables |
| `creatures-of-a-far-age` | Players | WWN monsters |
| `ose-monsters`, `ose-spells` | Players | OSE content |

## Releases

Publishing a GitHub Release (tag + release notes) triggers CI to build the CSS and packs, rewrite `system.json` with the release version and download URL, zip the system, and attach `wwn.zip` and `system.json` to that release.

Bump `version` in `system.json` (and `package.json`) on the branch you intend to release before creating the tag. Tag names may include a leading `v` (e.g. `v2.0.0`); the workflow strips it when writing the manifest version.

## License

This Foundry VTT system requires the Worlds Without Number rules, available at DrivethruRPG.

This third party product is not affiliated with or approved by Sine Nomine Publishing.
Worlds Without Number is a trademark of Sine Nomine Publishing.

Old School Essentials spells and monsters used with permission under Open Game License, originally adapted from the greatest role playing game in the world.

## Artwork

Icons are from [Rexxard](https://assetstore.unity.com/packages/2d/gui/icons/flat-skills-icons-82713).
