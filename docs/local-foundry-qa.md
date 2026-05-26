# Local Foundry QA

Use this checklist after running `scripts/install-foundry-local.sh`.

## Setup

- Foundry setup lists the local `wwn` system as version `1.6.1`.
- The Azeroth world launches with the installed local `wwn` system.
- Character and NPC sheets look like the upstream 1.6.1 layout when `enableWoundPoints`, `replaceStrainWithWounds`, and `thresholdInjuries` are disabled.

## Settings

- `enableWoundPoints` reveals WP fields on character and monster sheets.
- `replaceStrainWithWounds` reveals injury/wound counters and CR fields.
- `thresholdInjuries` reveals injury counters and IR fields.

## Mechanics

- Normal HP damage below current HP only reduces HP.
- Excess HP damage with WP enabled reduces WP by only the excess amount.
- Excess HP damage with below-zero wounds enabled rolls wounds and does not also reduce WP.
- CR reduces below-zero wound severity and appears in the wound chat formula.
- Eligible normal attack-card damage can roll one threshold injury check per selected target.
- Half and double damage buttons share the same threshold attempt family and do not reroll the same source/target.
- Shock, healing, trauma damage, and manual context-menu damage do not trigger threshold injuries.
- Duplicate attack-card clicks do not create duplicate threshold injury attempts.
