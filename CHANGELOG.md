# Changelog

## New in 1.4.5

### Changes

- Option to ignore level requirements for skills.
- Option for flat 1 point per level for skills.
- Option to manually set XP requirements on each character rather than relying on a global setting.
- Make encumbrance rounding (always up) on individual items optional. With this enabled (the default), encumbrance will most closely match the WWN standard. With this disabled, decimal places will be used for fractional weights for all items instead of only for coin.
- Option for medium range box on weapons.

### Fixes

- Restored option to have no save on Arts.
- Added warning if no skill set on weapon so it doesn't fail silently.

## New in 1.4.4

### Changes

- Added option for gold standard.

## New in 1.4.3

### Fixes

- Importing an item compendium was importing multiple copies of a single item rather than one copy of each item.

### Changes

- Added Base Save in Tweaks and config option to remove character level from saving throw calculations. This should make it easier to use a custom saving throw formula, albeit without much automation.
- Added config option to switch attribute modifier breakpoints to B/X standards instead of WWN.
- Added support for a house rule to replace System Strain with the Injuries/Wounds system from the Goblin Punch blog. If active, the strain entry on the sheet is replaced with a tracker for Injuries and Wounds. Injuries rolls are also automated if the option is active, though there is no automation of effects.

### Possible Issues

- The compendium fix required removing an item proxy that was supplying faction assets with information. My work to ensure assets still works was quick and dirty. My casual checking shows it working normally, but I wouldn't be surprised if I missed particular behaviors.

## New in 1.4.2

### Fixes

- HD modifier wasn't being used when rolling random HP for unlinked tokens.
- Mod tweaks were being counted twice when referencing attribute mods via @int, etc.

## New in 1.4.1

### Fixes

- Resolved attacks failing without visible error while a foe was targeted.
- Fixed group initiative.
- Fixed issue with individual initiative that would prevent initiative rolled automatically at the start of combat from being properly registered.

## New in 1.4.0

### Features

- Updated to v12. This is a first pass, so there may be some things that were broken in the process.

- Weapons now have a simple input field to denote an ammo type. If this field isn't blank, it will look for an item of the appropriate type and remove one charge.
  - Casing does not matter ("arrows" vs "Arrows" vs "aRRowS").
  - It looks for a partial match, so if it is looking for "arrows", it will also find "Arrows +1".
  - However, it simply uses the first matching ammo type it finds. So if you have "Arrows" and "Arrows +1", it won't intelligently prefer the magical arrows. Sorry.
  - It doesn't check for ammo on monsters because that sounds really tedious.
- Made a couple changes to skills to allow greater flexibility:
  - Now allow for 1d6 rolls.
  - You may now have a skill unassociated with any attribute. It will still ask if you'd like to add an attribute mod in the dialog, as usual.

### Fixes

- The skill selection on weapons is now a simple text input, rather than a dropdown.
  - This fixes the longstanding bug where weapons dragged from the compendium fail to function until opened and then closed.
  - The dropdown was barely a convenience feature anyway.
  - Casing does not matter ("Stab" vs "stab" vs "sTaB").

## New in 1.3.0

### Features

- Creating new items of certain types on an actor will now create a popup to enter certain basic details ahead of time.

### Fixes

- Faction sheet now works and is properly styled.

### Contributions

- All thanks for this update go to @wintersleepAI (unless you count me answering one minor CSS question as "helping")

## New in 1.2.2

### Features

- Active Effects
  - Exist on both actors and (most) items
  - I added a version of Developed Attribute for Strength that shows how it would work. I haven't updated all the other various foci, arts, and anything else to use AE as I haven't had that kind of time. I just remembered I had AE working in a branch somewhere and figured I'd throw it in so power users could use it at least.
- Charge checkbox on attacks
  - Applies active effect to alter AC and attack bonus
  - Requires Times Up module to automatically remove the AE after 1 round (otherwise you're stuck removing it yourself)

### Changes

- Unskilled skills (-1) are now darker grey to more easily differentiate from trained skills (wintersleep)
- Show weapon damage in inventory tab (wintersleep)

### Fixes

- Fixed item search on actors (wintersleep)

## New in 1.2.1

### Fixes

- Fixed adding skills to new actors. This now requires a manual button press rather than happening automatically.
- Removed reroll and reset options from initiative. These were hopelessly broken and I see no point in fixing them when this system will eventually be replaced.
- Fixed randomized HP on monsters.

## New in 1.2.0

### Feature

- Updated for Foundry v11. However, this did break the already barely functional faction sheet. See Known Issues.

### Changes

- Weapons now allow any skill to be selected. The previous method of selecting combat skills was causing issues. While it could have been fixed, it was also too fiddly.
  - Weapons should default to something sane but the first time you edit a weapon it will default to your first skill (usually Administer) and will have to be changed.
- Spellcaster sheet can now be enabled either through Tweaks (as before) or by dragging arts or spells onto the sheet. Using one method or the other always confused SOMEONE, so now you can do either.
- Added Wilderness Encounter tables to the GM Master Tables compendium. Shoutout to Nephthys for pointing this out and sending me the tables.
- Other stuff probably?

### Fixes

- Fixed instinct table roll on failed instinct check.

### Known Issues

- Something fundamental to the faction sheet was breaking all unlinked actors in v11. For the time being, I've simply disabled that something. You can still open faction sheets but don't expect them to work correctly.

### Important Notes

- As always, back up your data! This is ironically a bit less important with this release, as v11 creates whole new DB files, meaning you can roll back to v10 with very little (or no?) issues. You will lose any changes made while you were running v11 however.
- This will be the last notable release on this system, barring game-breaking bug fixes. I created this while first learning to program and it has a host of issues, both from my own ignorance while getting started, as well as leftover baggage from porting this from Old-School Essentials. I am working on a new system to replace this one, built from the ground up to be awesome. I have no ETA on this. It'll be done when it's done.

## New in 1.1.4

### Fixes

- Adding arts or spells to monster sheet resulted in blank item that could be neither interacted with nor deleted.
- Consumables could sometimes incorrectly calculate correct weight, counting each charge as 1 Encumbrance.

## New in 1.1.3

### Changes

- Enabled foci on monster sheets.

### Fixes

- New items could fail to roll following migration unless they were opened and then closed again.

## New in 1.1.2

### Changes

- Attack bonus and damage fields now support linking to character information. Shoutout to Stas for adding this valuable feature.
  - @atk = attack bonus, @level, @str, @con, @magic, @stab, etc.
- Compendium Spells and Arts have been updated to use these variables where appropriate.
- Added dynamic combat skills. Shoutout to CupofCoffee for getting the framework ready for this. A new checkbox in a skill's sheet allows a user to designate a particular skill as a combat skill.
  - Existing actors should have their Punch, Shoot, and Stab skills automatically set to combat skills. Additional skills may be designated as needed, to support using Magic to attack with certain arts or enabling custom combat skills.
- Made spell sheet dynamic. Rather than have to adjust casting classes in the Tweaks menu, simply drag a spell and/or art from one of the compendiums to get started. The spell sheet now dynamically shows only arts or only spells, so you only see the sections you need.

### Fixes

- Bugs with AC and Movement fields in the Tweaks menu.

## New in 1.1.1

### Fixes

- Item macros.

## New in 1.1.0

### Changes

- Right-clicking a roll while one or more tokens are selected now gives several options: apply damage or apply healing at half, full, or double increments. To instead apply shock damage, use the button to the right of the shock message.
  - To prevent any funny business, this now outputs a message to chat for all to see. Super secret DM damage or healing will have to be manually applied.
- Shock on weapon items is now correctly marked as a number, preventing a bug with calculating shock in v10. Existing weapons aren't automatically fixed, but if you see weird shock like "022", simply opening the item and then closing it again should fix it.
- Weapons and items now support charges. If an item possesses charges, it will automatically be set to a quantity of 1. If the current or maximum value have strange values, the system will attempt to guess what you mean to do.
  - If the maximum is 0 or missing, the system will assume each charge is a separate item and count encumbrance accordingly.
  - If the current charges exceed the maximum, the system will do some math to determine the number of items possessed. For example, an item with 10 / 7 charges will be counted as two items, due to rounding.
  - Charges do not affect weapon weight as weapons are not assumed to be consumable.
  - Torches, oil, rations, and arrows are all now items with charges instead of varying quantity.
- Items with fractional weight are now rounded up before adding to encumbrance.
  - Rounding is applied per item. One, two, or three torches will all count as 1 encumbrance. Two torches and one oil will count as two encumbrance as separate items are not be bundled together. This should correctly model the intended encumbrance value for bundled items according to the rules.
  - Currency still shows fractional encumbrance to better enable the user to judge the weight of mixed coin.
- Items of all types may now be weightless only when readied or only when stowed. This is to support items like backpacks, clothing, and elixirs that only cost encumbrance in one state or the other. I believe I've caught all the relevant items in the compendiums but if I missed something, please let me know.
- The Party Overview now shows how many rations, torches, and oil each character is carrying. I was finding it difficult to ensure my players were correctly tracking such things.
- Faction sheets, sort of, but see below. Shoutout to Wintersleep for porting the functionality over from SWN!
- Actors may now add items from compendiums by clicking a magnifying glass icon on the sheet, which will search compendiums for items of the appropriate type. For PCs, there in the weapons title bar, as well as one for armor and one for miscellaneous items. The monster item search is restricted to weapons for now, as well as arts and spells if the spellcasting sheet is active.
  - The monster sheet item search will eventually be expanded to include abilities once I get around to creating a compendium of monster abilities from the WWN samples.
- Probably other stuff I've forgotten? This has been a really long process.

### Fixes

- Duplicating an actor no longer doubles all skills.
- Title of Adjust Currency window.
- Changing dice pool during skill rolls.
- Format on skill checks now matches rules standard: "attribute-name/skill-name".

### Known Issues

- Faction sheets are a mess. I haven't gotten around to formatting this, as fixing everything broken in v10 took precedence.
- Dragging a weapon or other rollable item to the macro bar will still create a macro to directly roll this item (so long as a token with such an item is selected). However, this behavior has been overridden by a new v10 feature that creates a macro to display an item sheet. For now, you can delete the "Display Great Hammer" (for example) macro and find the "Great Hammer" macro WWN creates in the directory and drag that to your bar. This is just a workaround until I figure out how to override this new default Foundry behavior.

## New in 1.0.0

### Warning!

This update contains significant breaking changes. Please backup existing worlds before updating to avoid the nightmare of data loss or in case you wish to roll back to the previous version.

### Changes

- Skills are now built as items and as such, support custom skills. All WWN skills as well as psychic skills from SWN are contained in a new compendium. Existing worlds should migrate characters to the new system, importing skill levels and preferred attribute. Big shoutout to Wintersleep for their help on this one! I had started the process and laid out a basic framework but Wintersleep swooped in and completed the bulk of the work in no time at all. As always, any mistakes in implementation are my own.
- Skills may now be leveled, spending skill points automatically. Button visible when skills are in edit mode. Also courtesy of Wintersleep.
- Added a number of tables to the GM Master Tables compendium, including but not limited to: monster generation, room stocking, hex points of interest, and other features of ruin generation. Also...
- All location tags have been added to the new Tags compendium. If the Compendium Folders module is installed, tags will be sorted by tag type: community, court, ruin, or wilderness. Without Compendium Folders, the compendium will still function but the tags will be lumped together. Each tag category also has a relevant roll table.
- Shock damage now displays a button to apply damage to selected tokens.
- Monster weapon counters now reset at the top of each round.
- You can now buy me a coffee on Ko-Fi if you wanted to... for some reason? Link under settings, as someone requested.
- Added new weapon trait, CB, to denote a crossbow. This trait, if present, will eliminate the unskilled penalty for using it without at least a 0 in the relevant skill. The crossbows in the compendiums have been updated, while any existing crossbows in your game will not be touched. You may manually add the CB trait in the trait field of the weapon, thereby eliminating any futzing about with attack bonuses you may have been using to fudge this.
- Randomize HP on unlinked tokens by enabling the option in system settings. This is a per-client setting, so the GM enabling it doesn't cause player summons to have random HP and vice-versa.
- Button in Currency header allows adjusting coins without doing math because math is hard.
- Button in Party sheet distributes silver to everyone in the party, respecting the share setting in tweaks in the same manner as the deal XP function. Note that silver goes to the bank and not to inventory, as this is simply meant to ease the distribution of large amounts of coin at the end of an adventure.
- Attack and damage rolls now display a tooltip when hovered, showing you the source of any modifiers.
- Replaced splotchy black headers with solid black, as it was causing accessibility issues for some users.

### Fixes

- Changed the sort method on items to improve performance.
- Re-enabled direct editing of spell slots.
- Miscellaneous errors with creature compendiums.
- Exert and Sneak are now correctly penalized for armor type.
- Monster inventory should now correctly display a scroll bar when it overflows.
- Changed a couple tooltips on the spell sheet to correctly reflect their function: to reset Effort.
- Armors, foci, and items no longer display twice when rolled.
- Fixed the icons for reload and slow reload, as they were reversed. (Why should the bow be the one with the crossbow icon?). This may require clearing your cache to see.
- Small change to shock to better deal with low-level Vowed and the Unarmed Combatant focus: if the Shock field of a weapon is set to 0, shock will still be calculated. If the field is blank, shock will be omitted.
- Weapons now correctly have "traits", as per the rules. These were varyingly referred to as "tags" or "qualities", neither of which was correct.
- Character images are now contained within their area, better accomodating a variety of aspect ratios instead of stretching them.
- Fixed display error with unequipping shields.

## New in 0.9.9b

- Initiative fixes

## New in 0.9.9

### Changes

- Reorganized spell resource section to reduce confusion.
- Effort on all arts can now be reset using a button located both over the class effort section as well as the arts section.
- Casting a spell or using an art with an associated effort cost now checks that the character has slots or effort remaining and displays an error to the user if no slots/effort remain.
- Attempting to use an art for which there is no associated caster class now prompts the user to input the class in the Tweaks menu.

### Fixes

- Fixed display of Tweaks menu for players.
- Corrected Effort duration on Purge Ailment.

## New in 0.9.8

### Changes

- Changed the way attribute mods, saves, and AC are calculated to better support Foundry's export function.
  - This required some refactoring, so if you see any odd behavior, please report it on the WWN Github page: https://github.com/SobranDM/foundryvtt-wwn/issues
- Removed the book icon on PCs that previously displayed a few modifiers. Most of these are now exposed to the user elsewhere and the rest were wildly out of date.
- Tweaked the display size of the description and notes fields on the details tab. If both of these exceed 4 lines or so, you will get a scrollbar while on that tab.
- Removed references to 5e token art, as it has been pointed out that this is pretty bad practice and I am forced to agree. I encourage anyone who enjoys that art to go support Forgotten Adventures for their amazing library of token art, which is constantly growing: https://www.patreon.com/forgottenadventures/posts
- All inventory items and spells are now sorted alphabetically.
- All monster abilities and equipment are now divided by type and sorted alphabetically.
- All monster item types are now rollable.
- Various OSE monsters have been added to the compendium. Others have had their stats adjusted after some playtesting. Additions include but are not limited to:
  - Dragons, golems, gnolls, various oozes, assorted magical beasts, and some undead.
  - The full movement entry on some monsters with multiple movement modes cannot be read in their entirety; this will be resolved with an upcoming sheet redesign.

### Bug Fixes

- Group Initiative now assigns flag color correctly based on Token Disposition (Friendly, Neutral, Hostile). Manually set flags allow for more than these three sides in a battle.
- Individual Initiative will no longer reroll a combatant's initiative when combat begins if it was manually rolled in the setup phase.
- The player notes tab now correctly shows abilities as well as foci. Creating an item in this section will now prompt for type.
- Deluge of Hell has been corrected to be a 5th level spell (thanks to Steven on the WWN Discord).

## New in 0.9.6

- Padding change to tabs fixes a display error introduced in last Foundry update

## New in 0.9.5

### Bug Fixes

- Fixed draggable item macros
- Fixed possible issue with using Arts
- Fixed party sheet display
- Tweaked item description box to increase usability

## New in 0.9.4

### Bug Fixes

- Fixed Shock damage on monsters

## New in 0.9.3

### Features

- Alert Focus: if you possess this focus and...
  - your game is using individual initiative...
    - rolls your initiative twice and takes the higher result.
    - adds your initiative to 100 if you possess Alert at level 2, ensuring you always go first and that there is a tiebreaker if this is true of multiple characters.
  - your game is using group initiative...
    - adds one to your side's initiative.
    - adds 100 to your initiative if you possess Alert at level 2, ensuring you always go first and that there is a tiebreaker if this is true of both PCs and monsters.
- Rolling an Art now automatically spends Effort in addition to sending the Art to chat. If the "Time" field of the Art is blank, Effort will not be spent. As a result, Arts in the Compendium have been updated:
  - Passive Arts with no Effort expenditure have had their Time field cleared, to be compatible with the Effort spend feature.
  - Arts that function while Effort remains committed have had their Time field updated to "Active" to ensure consistency. Previously the terminology used here varied.
- Spellcasters now have a "spells prepared" value. The maximum is user-editable, while the current value is automatically calculated based on memorized spells (the brain icon in the spell inventory).
- All armor now possess separate base AC and magic bonus fields. This accomplishes a couple things:
  - Shields can now calculate whether your AC would be higher with only the shield plus its magic bonus (if any) or with your armor + 1 (the standard shield bonus) + magic bonus (if any). No more fiddling with shield AC! Yay! Note that standard WWN does not support shields with magical enhancements to AC but I wished to support it for the sake of unique items in old-school adventure modules.
  - The Armor section of the inventory now has a Magic heading, letting you see at a glance what items have a magic bonus without having to put "+1" in the name.
  - All shields and magic armor in the Compendium have been updated to support the new armor format.
- Exert and Sneak checks now automatically apply armor encumbrance as a penalty, dependent on armor type (light/medium/heavy).
- Experience to next level is now calculated displayed next to current experience in the PC header.
  - New System Setting: Set XP requirements. The slow and fast XP tracks from WWN core, as well as a custom track. The custom track defaults to the B/X Fighter progression but any progression may be entered as a comma-separated list.
- Weapon attacks now note in the chat card if the weapon is readied, stowed, or not carried at all. It won't stop the attack from happening but this should enable the GM to catch if a player is being sneaky or simply misunderstanding the encumbrance rules.
  - A future update may allow more granularity here, so that the system is aware of appropriate foci that support stowed drawing and only create this note in the card if something unusual happens.
- A failed Instinct check automatically rolls on a monster's linked Instinct table. This supports custom Instinct tables, provided those tables are linked from a Compendium.
  - New System Setting: If true, hides the results of automatic Instinct table rolls (but not the check itself) from players. If false, follows Public/GM/Blind/Self as normal. Defaults to false.

### Changes

- Overhauled the PC sheet. Now wider and (hopefully) makes better use of space:
  - Foci/Abilities tab has been moved to the Notes tab, which has been renamed "Details".
  - Skills now located on front page; each skill has its own attribute selection, making skill use much faster, particularly in games that typically use the same attribute for a given skill each time.
- Overhauled item sheets, giving them a sort of 'notecard' appearance, to quote Hawkin. They make a little better use of space now.
- Removed the placeholder text for mage classes in the tweaks menu, as it was confusing some users.
- The "Party Select" button has been renamed to "Remove Characters":
  - As the name suggests, this button now only allows you to remove characters from the party.
  - Paired with the drag-and-drop functionality Stas added a few versions ago, that should make adding and removing party members much more manageable. An instruction about drag and drop functionality, only visible to GMs, has been added to the party sheet.
- Casters now support up to four Effort sources, to better support Legates and Heroic classes.

### Bug Fixes

- Fixed saving throws not being rolled from the chat card for items and weapon attacks. (For real this time!)
- Fixed encounter movement rate not displaying on party sheet. This currently looks silly if you turn off per-turn movement rates, sorry. I'm too lazy to fix it just now.
- Monster movement fields have been folded into a single field.
- Style error that was preventing retainer morale from rolling correctly. This does mean the previous value was lost and will have to be re-entered. Apologies for the inconvenience.
- Monster attack counters.
- Some tooltip errors.
- A few V9 compatibility isues.

### Known Issues

- As a result of the armor changes, the shields in the compendium have been changed, as have all magical armors. Magical armor will continue to function without issue--though they will not display anything in the magic field, unless you change them--shields, magical or not, will have to be edited or replaced. Sorry for the inconvenience.
- Rewrote the individual initiative system to clear some bugs and support the Alert focus. This had the side effect of the PCs no longer being able to roll their initiative individually. Or rather, they can but it will simply be overwritten when combat begins. Sorry about that. If there is a great outcry, I will put in a workaround.
- Group Initiative still doesn't maintain flags based on disposition (Friendly/Neutral/Hostile). I'm still trying to fix this. There are currently two workarounds, though neither is ideal:
  - If you begin combat, it WILL correctly set sides, but AFTER initiative is rolled. You can then reroll initiative and it will sort itself out.
  - If you manually set colored flags for each combatant, it works correctly the first time.

## New in 0.9.2

### Bug Fixes

- The party select button now only shows actors that are currently in the party. The tooltip has been renamed to "Remove Characters" to reflect its new function. Paired with the drag-and-drop functionality Stas added a few versions ago, that should make adding and removing party members much more manageable. An instruction about drag and drop functionality, only visible to GMs, has been added to the party sheet.
- Total SP now correctly accounts for carried treasure items, such as gems, once again. This was missed when I updated the system to account for Foundry's new data structure.
- Range bands on missile weapons no longer show a mid-range band that doesn't exist in WWN.
- Spell saves can now be rolled from the item card displayed in chat. (Why did I even have this disabled...?)

## New in 0.9.1

### Bug Fixes

- Weight display in the treasure section no longer shows way too many decimal places.
- Monster Shock damage works correctly again.
- Fixed coin encumbrance calculations.

## New in 0.9.0

- Added quantity field to weapons on both the weapon sheet and on the inventory page, for all your throwing knife needs.
- Shock column on inventory page now uses a lightning symbol to save space.
- Item, Weapon, and Armor sheets have been slightly reformatted to more closely resemble one another.
- Generate Scores button now saves scores correctly. You may now return to quickly generating your attribute scores! Also eliminated an annoying bug with the way SP was being saved.
- Linking Instinct Tables fixed.
- Monster Tweaks dialog is _slightly_ less goofy looking.
- Fixed visual bug that caused dropdown menus in the Tweaks menu to not correctly display their values.
- Polymath automatically sets a minimum skill level when rolling non-combat skills.
- Monster Spells now sort correctly by level.

## New in 0.8.9 - Initial 0.8.x Release

- Updated system to function with version 0.8.6 of Foundry. While most things appear to be working correctly, this is an early release. Bugs may abound.

# Known Issues:

- Attribute roller does not save results correctly. The rolls happen and they appear to save but the attributes will reset to null upon next server reboot. Please set your attributes manually until I get this fixed.
- Linking Instinct tables to a monster sheet does not work when dragged from the Compendium. RollTables outside of a Compendium link correctly and pre-existing monsters with tables linked in the Compendium continue to function correctly.

## New in 0.8.8 - WWN Release Edition

- IMPORTANT: This release fixes a bug that prevented the system from correctly recognizing updates. You will have to uninstall the system and reinstall to get things working correctly but it should update properly in the future.
- Copper now shows up on the sheet, whether or not B/X currency is selected.
- Updated compendiums to final release version.
- Added drag and drop support to the party sheet.
  - This change comes courtesy of Stas, dev on the Burning Wheel sheet. Thanks for the help!

## New in 0.8.7

- Fixed bug that prevented Shock damage from displaying when token is targeted.
- Added generic "ability" to describe monster abilities that are not weapons or spells.
  - Like Arts, these are rollable which sends the description to chat.
  - Also like Arts, they are equipped with "save" and "roll" fields, which can be rolled from the chat card.
- Monsters now have a "Damage Bonus" (abbreviated "DB" on the sheet). This value is added to all damage rolls and shock values.
  - If you have monsters that have these values already figured into their weapon attacks, leaving the DB value at 0 will have everything function as before. This should simplify the creation of new monsters, however.
  - If this field is blank (such as with previously existing monsters), it will be set to 0 the first time you use a weapon attack.
- Monster Compendium revisions
  - Monsters now use abilities instead of "faking it" with Arts.
  - Many OSE monsters have had information moved from the notes section to abilities to reduce tab-flipping. In general, special abilities or skills have been transferred to abilities while purely behavior information is still in the notes tab.
  - Compendium monsters have been updated to use the Damage Bonus, so manually checking shock values should no longer be necessary. Particularly useful for the Creatures of a Far Age Compendium.
  - Various other revisions to OSE monsters were made as I caught errors or second-guessed a conversion.
  - Added a couple more OSE monsters.

## New in 0.8.6 - The One With All the Compendiums

- Updated Compendiums to Release Candidate 1.
  - This affects some Foci, Spells, and Arts. Also minor change to the description of shields and the Shock immunity of Grand Plate.
- Added various defensive Arts, such as Pavis of Elements and Cold Flesh to Armor Compendium. You will have to manually adjust these as you level or to account for Pavis taking you over its maximum AC of 18.
- Added Unarmed Might to Weapons Compendium.
- Added some Arts to the Compendium that I had previously missed:
  - Keeper of the Gate (Necromancer)
  - Mob Justice (Vowed)
  - If you see any others that are missing, please let me know!
- Added ALL creatures and summoned creatures into a new compendium, Creatures of a Far Age.
  - Thanks to Studbeastank for the help on this one!
  - Links to summoned creatures have been included in relevant spells and magic items like the Flask of Devils. If you see any I missed, please contact me so I can get it fixed.
  - This includes all creatures, from the generic table as well as animals all the way to undead.
- Gavin over at Necrotic Gnome has graciously allowed me to use the OSE SRD as a reference to convert over OD&D monsters and spells. This is covered under the OGL, of course, but I thought I should reach out to be sure. What does this mean for you? More monsters! Also, spells.
  - You'll find two new Compendiums: OSE Spells and OSE Monsters.
  - All Magic-User and Cleric spells have been converted. Note that conversion involved converting saves to something appropriate and converting conjured monsters and the like to be compatible with WWN. What I have NOT done is make these suitable for players. These are intended purely for use by B/X monsters. You can convert them to be suitable for players yourself by following the guidelines on page 89 of the Worlds Without Number book. Be careful about what spells you allow for your players.
  - I have begun converting over the monsters. Certain things, such as Instinct, require judgment calls. If you disagree with my choices on a particular monster, you can import a copy and change it to suit your campaign.
  - So far I have made it as far as Dragon, working alphabetically. Also, skeletons and zombies are in there because what level 1 adventure would be complete without skeletons and zombies? More will be added in future updates.
  - If you have the DND5e system installed, the monsters MIGHT use the Forgotten Adventures tokens from that system. I have no idea whether this will work. I guess we'll find out together. If not, I guess that'll save me time on the other monsters...

## New in 0.8.5

- Fixed bug affecting Shock damage on some Compendium weapons
- Fixed description of Connect
- Skill checks now show the attribute used in the roll
- Gave the tab labels a little breathing room

## New in 0.8.4

- Updated Compendium to v0.20 of the Beta PDF. Affects Compendium weapons, spells, and armor (added Grand Plate).
- Leaving the Shock AC field of a weapon blank will cause the weapon attack to simply note its Shock damage with no reference to AC. Useful for Foci like Shocking Assault that apply Shock irrespective of the opponent's AC.
- Added checkbox in weapon sheet to add skill level to weapon damage and Shock.
- Hovering over a weapon tag now displays the tag's full name and description. Spend less time looking up what Precisely Murderous does! This should function on both the inventory screen, by hovering over the tag icon, and in the item sheet itself, when hovering over the tag abbreviation.

## New in 0.8.3

- Fixed bug that prevented monsters' Shock damage from displaying
- Arts, Foci, Items, and Armor are now rollable and will display to chat
  - This required changing the Art template a bit. It didn't affect that many Arts so I didn't bother adding logic to fix existing Arts. I did update all the Arts in the Compendium though, so you can simply replace any existing Arts on your sheet if you want Arts like Rune of Destruction to display a damage forumla in the chat card.
- Extended input field focus implementation to item sheets.
- Fixed armor type for Plate Armor and its magic derivatives. Fixed weight and cost of Crossbows.
- Added a Bank field under currency for SP stored somewhere. Doesn't count against Encumbrance.
- Added a Treasure field that expresses the total value of any inventory items marked as "Treasure". This is intended to be gems or jewelry that can easily be exchanged at a given value but you could use it for just about any valuable commodity.
- Added a Total field that calculates your total SP value from coin and bank values, as well as the value of any inventory item marked as treasure.
- Added Renown field to character sheet header.
- Saving Throw dialogs now include the character making the saving throw, to better support the GM rolling saves for multiple tokens at once.
- Expanded the GM Tables to include History Construction and Historical Events.
- Fixed tooltips on the Inventory page because I'm a dummy dumb-dumb
- Changed the editor size on items to better reflect the size of the actual window. This should make editing descriptions for items, foci, arts, and spells much easier.
- Added Class Abilities to Focus Compendium. Renamed Compendium and Header in Foci Tab to "Foci and Abilities" (though not the tab because that would be a really long tab name).
  - I went back and forth about making a separate section for miscellaneous abilities. Eventually I settled on lumping them all together. You'll never have many Foci and even fewer miscellanous/class abilities, so I couldn't justify a separate section. Regular Foci, Origin Foci, and Class Abilities are all separate colors, so you can easily tell them apart.
  - Class Abilities don't note whether they are for Full or Partial Experts/Warriors. You'll have to use the book (which you should be doing anyway).
- Added "Full Warrior" toggle in Tweaks. If True, Killing Blow damage will be automatically added to both rolled damage and Shock.

## New in 0.8.2

- Rolling for silver on a new character now correctly assigns SP to the character when done.
  - Fixing this first required breaking the character generation dialog and then fixing it again. If something seems off, let me know.
- Fixed field input focus on tab--fields should remain highlighted, allowing for quick input of new characters and monsters. This was driving me nuts.
  - Shoutout to the magnificent Moo Man for helping me figure this one out!
- Monster saves now auto-calculate based on monster HD. This will function whether you put 3d6, 3D6, or simply 3.
- Implemented saving throw tweaks for all actors.

## New in 0.8.1

- Fix for monster Effort tracking

## New in 0.8.0

- Critical bugfix for player attacks

## New in 0.7.9

- Enabled Effort tracking for monsters
- Made default width of monster sheet slightly wider
- Removed "Retainer" from Tweaks dialog for monsters, as they already have morale and don't need it listed twice
- Monster Movement Details now correctly allows text again
- Fixed currency bug that was affecting new characters
- Replaced treasure table on monster sheet with instinct table
- Characters and monsters now have different default HD, as per the book
- Instinct and Morale checks now pause to ask about modifiers
- Styled the Tweaks dialog (monster tweaks looks funny for now)
- Fixed bug that sometimes interfered with monster weapon attacks
- PC saves now auto-calculate based on stat mods and level
  - This doesn't currently have a way to tweak it.
- Overhauled movement:
  - Both WWN and BX movement now use encounter movement as a base (30 and 40 feet per round, respectively)
  - WWN Overland movement now correctly reflects the 30 mile per day standard assumed for plains or savannah
  - There is now a Movement Bonus Tweak. This number is applied as a flat bonus or malus on top of the encounter movement rate, after encumbrance penalties have been figured.
  - When the Calculate Movement toggle (in character tweaks) is off, all three fields (if visible) are editable

## New in 0.7.8

- Fix for spell preparation blunder that broke sheet updates
- Some of the early GM tools intended for next update: generators for Nation, Soceity, and Government Construction

## New in 0.7.7

- Compendium additions
  - Complete list of magical armors, weapons, elixers, and devices.
  - Generators for the above. The Magic Item Masters contain the high level tables, while the Magic Item Tables contains the countless subtables required to make the whole thing work.
    - Generators should work regardless, but you will have better results (auto-rolls on subtables) if you have the Better RollTables module.
    - Magic Armors and Weapons will output the correct item to chat. Bonuses are already figured for AC, damage, and Shock. Special Abilities are output to chat but you will have to copy those into the item description yourself. Maybe take this opportunity to give it a cool name instead of Generic Magic Warhammer #47.
    - Magical devices have no suggested weight in the beta. I have taken the liberty of assigning values that made sense to me. If you disagree, feel free to duplicate the Compendium (or import specific items) and assign values you find more appropriate.
  - Added Greatclubs, as this was apparently missing before.
  - Finished fleshing out the Instinct tables.
- Spells now have a checkbox to denote whether they are prepared. This is purely cosmetic and for the player's benefit. The system does no checks to ensure you prepare the correct number of spells or prevent you from casting a spell that isn't prepared. Use your own brain.
  - The checkbox is currently a little buggy. Will fix later.
- Re-refixed monster movement allowing text input. For real this time.
- Attack Attribute is now automatically added to Shock damage.
- Inverted the logic on spell slots from slots left to slots used so as to match the logic of Effort tracking and the column header. The numbers going opposite directions, despite being next to each other, was counter-inuitive. Hitting reset will now reset the Committed column of spell slots to zero.

## New in 0.7.6

- Compendium fixes
- Items Cost -> Price

## New in 0.7.5

- Re-refixed Attribute Modifiers
- Monster movement now allows text input better handle multiple movement types
  - Monsters may now move 30 parsecs per turn, if you so wish
- Languages spoken now reflect the Know/Connect calculations from WWN
  - Literacy has been left as a holdover from OSE in case any DMs wish to use it; it has no direct corollary in WWN
- The list of languages now reflect those listed in Languages of the Gyre in WWN
  - Preterite is not included, as the text implies you cannot truly learn it as a language
  - Languages can be added or deleted at a system level in system settings
- Currency as a character attribute and reported at the top of the inventory page
  - System setting toggles between WWN standard (SP/GP only) and B/X standard (adds CP/EP/PP)
  - Coins are divided by 200 and added to Stowed inventory calculations, as per the book
  - Coins have been removed from the Compendium
- Items only store a current quantity now instead of current/max
  - I was too dumb to make a proper migration script, so you will lose current item quantities -- sorry!
- With the previous two changes, the system should now be compatible with Better RollTables, for loot table goodness
  - The Roll button will output your loot table to the chat window
  - The Generate Loot button will not function for WWN until I or someone else gets around to creating a WWN-specific version of the Loot Sheet NPC module
- Added support for Psychic Skills from Stars Without number
  - The skills may be enabled through system settings
  - I suppose I should also make them togglable on a per-character basis but I was feeling lazy
- Spellcasting now reflects WWN standards

## New in 0.7.2

- Fixed bugs with the Attribute Modifier tweaks
- Fixed a couple Initiative bugs
- Movement now correctly reflects the WWN system
- Fixed data type on most number fields (can now change value with mouse wheel)

## New in 0.7.1

- Added Adventuring Gear to Compendium
- Changed Armor Class Tweak to apply to Naked AC as opposed to final AC
  - This should better support certain Foci and effects
- Added Tweaks for Attribute Modifiers to support Developed Attribute and some Origin Foci
- Added Monster Skill to monster sheet, along with associated roll

## New in 0.7.0

- Fixed Group Initiative die type
  - Thanks to Discord user BWebby for pointing this out
- Separated Foci into their own tab
- Party sheet (small button in the actors pane, below Create Actor) now functions again
  - This now shows useful information but needs more formatting work
- Added support for Specialist and similar Foci in the Tweaks menu
  - Characters created before update will need to open and close the Tweaks menu once before Skill Rolls function correctly
- Compendium now includes all Arts and Spells from the Free Version
  - Thanks to reddit user Studbeastank for doing a lot of the legwork on this. I removed the Arts/Spells from the Deluxe edition but left the artwork edits he made to support those should users wish to manually add them in their games.
  - I have done my best to catch any changes/additions from the newest Beta version (0.19) of WWN but please point out anything I've missed.
