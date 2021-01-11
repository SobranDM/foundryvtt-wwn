# Worlds Without Number for Foundry VTT (Unofficial)
All-- Most-- SOME the features you need to play Worlds Without Number in Foundry VTT. This was forked from v1.1.2 of the Old School Essentials project developed by U~man. I have managed to mangle his beautiful project into something that sort of works for Worlds Without Number. All praise should be directed toward him. Any bugs or mistakes are undoubtedly my own.

Find the original OSE project by U~man here: https://gitlab.com/mesfoliesludiques/foundryvtt-ose
## Features
* Calculated Readied/Stowed values
* Easy tracking of weapon tags
* Track which Arts have Effort committed
* Calculated Effort totals from up to three sources
    * Click Tweaks in the character title bar to activate spellcasting and enter caster class(es)
* Visual indicator of health/strain percentage
* Auto-populate monster saves
* Automatically calculates movement rates based on Readied/Stowed values
    * This mostly follows the values from the book, but uses a formula. As a result, you can do things that technically aren't allowed RAW, such as carrying 4 Readied items over your max and still moving at full speed so long as your Stowed value is 8 or more points under maximum.
    * This can be disabled in Tweaks. Currently this only enables manual entering of Exploration Movement Rate, from which the others will still be calculated. This will be changed later.
* Adds Attribute/Skill bonuses to hit rolls and Attribute bonus to damage rolls

## Recent Changes
### New in 0.7.2
* Fixed bugs with the Attribute Modifier tweaks
* Fixed a couple Initiative bugs
* Movement now correctly reflects the WWN system
### New in 0.7.1
* Added Adventuring Gear to Compendium
* Changed Armor Class Tweak to apply to Naked AC as opposed to final AC
    * This should better support certain Foci and effects
* Added Tweaks for Attribute Modifiers to support Developed Attribute and some Origin Foci
* Added Monster Skill to monster sheet, along with associated roll
### New in 0.7.0
* Fixed Group Initiative die type
    * Thanks to Discord user BWebby for pointing this out
* Separated Foci into their own tab
* Party sheet (small button in the actors pane, below Create Actor) now functions again
    * This now shows useful information but needs more formatting work
* Added support for Specialist and similar Foci in the Tweaks menu
    * Characters created before update will need to open and close the Tweaks menu once before Skill Rolls function correctly
* Compendium now includes all Arts and Spells from the Free Version
    * Thanks to reddit user Studbeastank for doing a lot of the legwork on this. I removed the Arts/Spells from the Deluxe edition but left the artwork edits he made to support those should users wish to manually add them in their games.
    * I have done my best to catch any changes/additions from the newest Beta version (0.19) of WWN but please point out anything I've missed.
## TODO
* Sorting Arts/Spells by source (class)
* Toggle to add Skill value to damage
* Manual entry of all movement modes
* Auto-add highest Dex mod when using Group Initiative
## Installation
To install, copy the following URL and paste it into the Install System dialog in Foundry VTT:
https://gitlab.com/sobran/foundryvtt-wwn/-/raw/master/system.json

It will be available through Foundry itself at a future date.

## License
This Foundry VTT system requires the Worlds Wihtout Number rules, available through the Kickstarter or through sale at some point in the future.

This third party product is not affiliated with or approved by Sine Nomine Publishing. \
Worlds Without Number is a trademark of Sine Nomine Publishing. \

## Artwork
Weapon quality icons, and the Treasure chest (and now some others) are from [Rexxard](https://assetstore.unity.com/packages/2d/gui/icons/flat-skills-icons-82713).