![Latest Release Download Count](https://img.shields.io/github/downloads/sobrandm/foundryvtt-wwn/latest/wwn.zip?color=2b82fc&label=DOWNLOADS&style=for-the-badge)

[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fwwn&colorB=4aa94a)](https://forge-vtt.com/bazaar#package=wwn)

# Worlds Without Number for Foundry VTT (Unofficial)

Everything you need to play Worlds Without Number in Foundry VTT.

## Features

- **Classes and Edges** as items you add to a character (Full/Partial classes for WWN and SWN; Edges for AWN and CWN) drive attack bonus, hit dice, Effort/spell capacity, and class features automatically.
- **Powers** (Arts, Spells, Psychic Techniques, Mutations, and related abilities) commit Effort or another shared pool automatically, with class-specific pools kept in sync as you level.
- **Active Effects** drive PC combat/stat bonuses from Foci, class features, and Arts — no more manual math or a separate "Tweaks" menu.
- **Modern character sheet** with tabs (Main / Powers / Inventory / Details / Effects), selectable UI themes (WWN / SWN / AWN / CWN), and a Favorites dock. Clicking an item's icon rolls or activates it (or posts its description if it has no roll behavior); clicking its name opens an inline description drawer; a dedicated eye icon on every item row posts its description to chat without triggering any roll side effects.
- **NPCs** keep editable combat numbers on a Config tab, with optional Active Effects.
- **Starships** for Stars Without Number: hull presets, fittings/weapons/defenses that scale cost/power/mass with hull class, crew stations linked to world actors or NPC roll formulas, and full starship combat (Command Points, department actions, Armor/AP, Target Systems, Escape/Pursue, Crises).
- **Modular power armor** for Ashes Without Number: frame presets, mass/power budgets, Soak, power cells/runtime, maintenance, and a linked pilot overlay.
- Calculated Readied/Stowed values, including dynamic tracking of currency weight
- Calculates total wealth from carried coin, bank, and treasure items
- Track weapon tags; hovering over the tag icon or name displays the full tag description
- Visual indicator of health/strain percentage
- Auto-calculate saves for PCs and NPCs alike
- Calculates movement rates based on Readied/Stowed values
  - Use standard WWN movement rates or B/X movement
  - Auto-calc can be disabled
- Adds attribute bonuses to hit chance, damage, and shock
  - A per-weapon checkbox enables adding skill value to damage and shock
- Shock and damage account for attribute bonuses, the Killing Blow warrior ability, and Foci that add skill levels to damage
  - Skill damage is activated on a per-item basis, due to the variable nature of Foci
- Weapons and ammo support linked ammo and magazine-style reload, with a dedicated ammo item type for arrows, bolts, energy cells, and spare magazines
- Support for Specialist and other Foci that allow rolling 3d6/4d6 on skill checks
- Distribute XP through the party sheet
  - Assign percentage shares to henchmen, to support silver-as-XP (and custom XP values) for B/X-style play
- Easily roll multiple saving throws from an Art, Spell, or weapon's chat card
- GM Tools: quickly generate things from the GM Tables in WWN
  - Currently supports Nation, Government, Society, and History Construction. More will be added in the future.
- Roll Morale and Instinct checks with two clicks
  - Link appropriate Instinct tables from Compendium to NPC sheet to auto-roll when Instinct check is failed
- Compendiums by game line (WWN / SWN / AWN / CWN Abilities) plus shared gear, magic items, faction assets, starship fittings, power armor fittings, and generation tables. Deluxe edition content is not included.
  - Thanks to Gavin over at Necrotic Gnome, the Compendium also includes OSE spells and (some) monsters.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for clone/build setup, pack workflow, module layout, and release notes.

## License

This Foundry VTT system requires the Worlds Without Number rules, available at DrivethruRPG.

This third party product is not affiliated with or approved by Sine Nomine Publishing.
Worlds Without Number is a trademark of Sine Nomine Publishing.

Old School Essentials spells and monsters used with permission under Open Game License, originally adapted from the greatest role playing game in the world.

## Artwork

Icons are from [Rexxard](https://assetstore.unity.com/packages/2d/gui/icons/flat-skills-icons-82713).
