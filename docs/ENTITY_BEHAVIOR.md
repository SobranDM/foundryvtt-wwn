# Entity behavior

This document describes what each major method block in `module/actor/entity.js` and `module/item/entity.js` is responsible for, by actor/item type where relevant.

## Current layout (post-chunking)

- **Actor**: Single `WwnActor` in `module/actor/entity.js`. Type-specific logic lives in `module/actor/types/*.mjs` (character, creature, faction, monster, ship, vehicle). `prepareData()` dispatches by type; compute and roll methods delegate to these modules.
- **Item**: Single `WwnItem` in `module/item/entity.js`. Chat card handling is in `module/item/chat-cards.mjs`. Roll/use methods are in `module/item/rolls.mjs` (rollSkill, rollWeapon, rollShipWeapon, rollFormula, spendSpell, spendArt, roll, show). Faction asset methods are in `module/item/assets.mjs` (getAssetAttackRolls, assetAttack, assetSearch, assetLogAction, rollAsset).

## module/actor/entity.js (WwnActor)

### Lifecycle and creation

- **prepareData()** – Dispatches by type: faction (assets, health), vehicle (encumbrance, treasure), ship (encumbrance, movement, resources, treasure, SP, cargo, init, crew), else character/monster (modifiers, AC, encumbrance, movement, resources, treasure, spellcasting, effort, slots, saves, SP, XP, prepared, init).
- **createEmbeddedDocuments()** – Sets default img from WwnItem.defaultIcons when creating items on this actor.
- **\_preCreate()** – Token defaults (displayName, displayBars, bar1=hp); per-type: faction/ship/vehicle/character get actorLink and default img.

### Character-only

- **getExperience()**, **getBank()** – Character-only; update system and post chat.
- **isNew()** – Character: all score values 0; Monster: all save values 0.
- **rollSave()** – Character uses WwnDice.RollSave and wis.mod for magic; monster uses WwnDice.Roll.
- **applyDamage()** / **applyWounds()** – Character strain/wounds and HP; others just HP.
- **computeModifiers()**, **computeAC()**, **computeEncumbrance()**, **\_calculateMovement()**, **computeResources()**, **computeTreasure()**, **computePersonalTreasure()**, **enableSpellcasting()**, **computeEffort()**, **computeSlots()**, **computeSaves()**, **setXP()**, **computePrepared()**, **computeInit()** – Used in prepareData for character (and monster for some: modifiers, saves, init, etc.).

### Monster-only / shared character+monster

- **rollSave()** – Monster branch uses WwnDice.Roll (no save dialog).
- **rollMorale()**, **rollInstinct()**, **rollLoyalty()**, **rollReaction()** – Monster/NPC-style rolls (2d6 below target, 1d10 instinct, etc.).
- **rollCheck()**, **rollHitDice()**, **rollAppearing()**, **rollMonsterSkill()** – Checks and monster-specific rolls.
- **computeSaves()** – Character vs monster base save (15 vs 16) and logic.

### Faction-only

- **prepareData()** faction block – cunningAssets, forceAssets, wealthAssets (sorted), health.max from getHealth(ratings).
- **getHealth()** – Used by faction (and elsewhere) for health from level/rating.

### Vehicle-only

- **computeEncumbranceVehicle()**, **computeTreasure()** – Called from prepareData for vehicle.

### Ship-only

- **computeEncumbranceShip()**, **computeTotalCargoValue()**, **computeCrewStrength()**, **computeCrewCost()**, **rollShipAttack()** – Ship encumbrance, cargo, crew, and ship attack rolls.
- **computeResources()**, **computePersonalTreasure()**, **computeTotalSP()**, **computeInit()** – Shared with character for ship in prepareData.

### Shared (multiple types or generic)

- **rollHP()** – Updates hp.max/value from hd roll (no type check).
- **rollDamage()**, **targetAttack()**, **rollAttack()** – Attack/damage flow; character vs monster branches inside.
- **\_getRollData()** – Roll data for sheet/rolls.
- **createSkillsManually()** – Skill creation (character).

---

## module/item/entity.js (WwnItem)

### Lifecycle

- **prepareData()** – super only.
- **prepareDerivedData()** – Enriches description (TextEditor.enrichHTML).

### Chat card handling (static, used by hooks)

- **chatListeners(html)** – Attaches document-level click listeners for chat cards (jQuery or string/html element).
- **\_handleChatCardClick()** – Apply damage/shock, or delegate to \_onChatCardAction (damage, formula, save, etc.).
- **\_handleChatCardToggle()**, **\_onChatCardToggleContent()** – Toggle card content visibility.
- **\_onChatCardAction()** – Resolves actor, item, targets; handles damage, formula, save (includes new Dialog for save dialog), roll flows.
- **\_getChatCardActor()**, **\_getChatCardTargets()** – Resolve actor and targets from card DOM.

### Roll and use (by item type)

- **getChatData()** – Builds itemData for chat; weapon tags, spell class/lvl/range/duration, equipped/stowed/prepared.
- **rollSkill()** – Skill item; dialog then roll (score, dice pool, armor penalty, polymath).
- **rollWeapon()**, **rollShipWeapon()** – Weapon/shipweapon attack and damage.
- **rollFormula()** – Formula roll (e.g. items with roll formula).
- **spendSpell()**, **spendArt()** – Spell/art effort or slot use.
- **roll()** – Generic roll entry (e.g. from sheet).
- **show()** – Display item to chat.

### Asset-specific

- **getAssetAttackRolls()**, **\_assetAttack()**, **\_assetSearch()**, **\_assetLogAction()**, **rollAsset()**, **rollMultipleAssets()** – Faction asset offense/defense, search, log, roll.

### Tags and helpers

- **getTags()**, **pushTag()**, **popTag()** – Tag list management.
- **\_handleTokenSelection()** – Token selection for chat card targeting.

### Static / defaults

- **defaultIcons** (static getter), **create()** (static) – Default images per item type; create() sets img when undefined.

---

## Type → method mapping (actor)

| Type      | prepareData branch | Key methods                                                                                                                                                                                                                                                                                                |
| --------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| character | else (default)     | computeModifiers, computeAC, computeEncumbrance, \_calculateMovement, computeResources, computeTreasure, computePersonalTreasure, enableSpellcasting, computeEffort, computeSlots, computeSaves, setXP, computePrepared, computeInit; getExperience, getBank; rollSave (RollSave), applyDamage/applyWounds |
| monster   | else               | computeModifiers, computeSaves, computeInit; rollSave (Roll); rollMorale, rollInstinct, rollLoyalty, rollReaction, rollCheck, rollHitDice, rollAppearing, rollMonsterSkill                                                                                                                                 |
| faction   | if (faction)       | cunningAssets, forceAssets, wealthAssets, health.max (getHealth)                                                                                                                                                                                                                                           |
| vehicle   | else if (vehicle)  | computeEncumbranceVehicle, computeTreasure                                                                                                                                                                                                                                                                 |
| ship      | else if (ship)     | computeEncumbranceShip, \_calculateMovement, computeResources, computeTreasure, computePersonalTreasure, computeTotalSP, computeTotalCargoValue, computeInit, computeCrewStrength, computeCrewCost; rollShipAttack                                                                                         |

---

## Type → method mapping (item)

| Concern     | Methods                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat cards  | chatListeners, \_handleChatCardClick, \_handleChatCardToggle, \_onChatCardAction, \_getChatCardActor, \_getChatCardTargets, \_handleTokenSelection |
| Rolls / use | getChatData, rollSkill, rollWeapon, rollShipWeapon, rollFormula, spendSpell, spendArt, roll, show                                                  |
| Assets      | getAssetAttackRolls, \_assetAttack, \_assetSearch, \_assetLogAction, rollAsset, rollMultipleAssets                                                 |
| Tags        | getTags, pushTag, popTag                                                                                                                           |
| Defaults    | defaultIcons, create (static)                                                                                                                      |
