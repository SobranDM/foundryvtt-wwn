# Migration Plan: DocumentSheetV2 and DialogV2

**Target:** Foundry v13 only. No backward support for v12.

**Goal:** Finish migrating actor sheets to DocumentSheetV2 and ensure all dialogs use DialogV2 (via `WwnDialog` or direct `DialogV2`).

---

## Current State

### DocumentSheetV2 (Actor Sheets) — Phase 2 complete

| Sheet     | Status   | Implementation |
|----------|----------|-----------------|
| Vehicle  | **Done** | `vehicle-sheet-v2.js` extends `WwnDocumentSheetV2` |
| Character| **Done** | `character-sheet-v2.js` extends `WwnDocumentSheetV2` |
| Monster  | **Done** | `monster-sheet-v2.js` extends `WwnDocumentSheetV2` |
| Faction  | **Done** | `faction-sheet-v2.js` extends `WwnDocumentSheetV2` |
| Ship     | **Done** | `ship-sheet-v2.js` extends `WwnDocumentSheetV2` |
| Item     | **Done** | `item-sheet-v2.js` uses HandlebarsApplicationMixin(ItemSheetV2) |

### DialogV2 — Phase 1 complete

- **WwnDialog** (`module/dialog/wwn-dialog.js`) wraps DialogV2; all user-facing dialogs use `WwnDialog.confirm/wait/prompt` (no legacy `new Dialog()`).
- Character creation uses a DialogV2-based flow via `openCharacterCreator()` and `WwnDialog.wait()` with a `renderDialogV2` hook for binding.

---

## Remaining work (post-migration polish)

See the WWN AppV2 Audit and Migration Plan for full detail. Summary:

- **Dialog class:** Add a `WwnDialog` class extending `foundry.applications.api.Dialog` with `static DEFAULT_OPTIONS` (classes, position) so defaults live in one place; keep existing `WwnDialog.confirm/wait/prompt` as facades.
- **Preload:** Remove unused character tab templates (`tab-attributes`, `tab-spells`, `tab-inventory`) from preload; add `faction-sheet.hbs`, `ship-sheet.hbs`, `vehicle-sheet-content.hbs`.
- **Context:** Ensure every sheet provides `cssClass`, `owner`, `editable` in `_prepareContext` where templates expect them (per Foundry docs).
- **Deprecated WwnCharacterCreator:** Call `openCharacterCreator()` directly from the character sheet; remove or keep a one-line deprecated wrapper.

---

## Phase 1: DialogV2 Cleanup (v13-only) — DONE

**Scope:** Remove legacy Dialog fallbacks and replace remaining `new Dialog()` with `WwnDialog.wait()`.

1. **WwnDialog (v13-only)**  
   - In `module/dialog/wwn-dialog.js`: remove the legacy fallback in `confirm()` and `wait()`. Use `DialogV2` only; throw or log clearly if `DialogV2` is missing (v13 guarantees it).

2. **Faction sheet**  
   - In `module/actor/faction-sheet.js`: replace every `if (DialogV2) { await DialogV2.wait(...) } else { this.popUpDialog = new Dialog(...) }` (and the single `new Dialog` for “Add New Base”) with `await WwnDialog.wait(...)` only. Remove `DialogV2` checks and legacy `new Dialog()` branches.

3. **dice.js**  
   - Replace the two `new Dialog(...)` usages (around lines 736 and 806) with `WwnDialog.wait(...)` with equivalent `title`, `content`, and `buttons` (using the same action/callback pattern as WwnDialog.wait).

4. **party-sheet.js**  
   - Replace the “Select Party Characters” `new Dialog(...)` with `WwnDialog.wait(...)`.

5. **combat-tracker.js**  
   - Replace the “Set Combatant Groups” `new Dialog(...)` with `WwnDialog.wait(...)`.

**Deliverable:** No remaining `new Dialog()` in the system (except inside `wwn-dialog.js` if you keep a minimal internal fallback for tests). All user-facing dialogs go through DialogV2 via `WwnDialog` or direct `DialogV2`.

---

## Phase 2: DocumentSheetV2 – Ship Sheet — DONE

**Why ship next:** Simpler than character/monster (fewer tabs and less data than character; no RollTable drop like monster). Good template for the rest.

1. Add **ship-sheet-v2.js** (extend `WwnDocumentSheetV2`), mirroring the structure of `vehicle-sheet-v2.js`:
   - Static `PARTS` with a main part pointing at the ship template (e.g. existing ship-sheet .hbs).
   - `DEFAULT_OPTIONS` (classes, position, actions, form).
   - `_prepareContext()` merging ship-specific data (equivalent of current `getData()` for ship).
   - `_preparePartContext()` if needed for part-specific data.
   - `_getHeaderControls()` if you need to deduplicate or customize header buttons.
   - `_onRender()` for any one-time setup (e.g. tab binding if ship keeps tabs, or other listeners).
   - `_onChangeForm()` for quantity/field changes that currently live in ship listeners.
   - Drag-and-drop: same pattern as vehicle (DragDrop with `dropSelector: ".sheet-body"`, `_onDrop`, `_onDropItem`, `_onDropFolder`).
   - Reuse or adapt ship-specific actions (e.g. crew, ammo, weapon rolls) as `DEFAULT_OPTIONS.actions`.

2. Ensure **templates**: Ship sheet and partials are .hbs and referenced in PARTS (already the case if you use existing ship .hbs).

3. **Registration:** In `wwn.js`, register `WwnActorSheetShipV2` for type `"ship"` when `DocumentSheetV2Available`, and optionally stop registering the legacy ship sheet (or keep both and default to v2).

4. **Tests / manual checks:** Create a ship, open sheet, edit fields, add/remove items, drag items and folders, use ship-specific buttons.

**Deliverable:** Ship actor sheet runs on DocumentSheetV2; legacy ship sheet can be removed or kept as fallback.

---

## Phase 3: DocumentSheetV2 – Monster Sheet

1. Add **monster-sheet-v2.js** extending `WwnDocumentSheetV2`:
   - PARTS: one or more parts for the monster template (attributes, biography, etc.).
   - Prepare context from monster `getData()` / `_prepareItems()` (attack patterns, owned items, slots, etc.).
   - Actions: item controls, RollTable drop (instinct table) – implement as an action or in `_onDrop` (parse `data.type === "RollTable"` and update `system.details.instinctTable`).
   - Tabs: if the monster sheet has tabs, either bind them in `_onRender` (like the old vehicle tabs) or use a single part and no tab bar.
   - Drag-drop: same as vehicle/ship for Item/Folder; add RollTable handling in `_onDrop`.

2. **Registration:** Register monster v2 when DocumentSheetV2 is available; optionally remove legacy monster sheet registration.

3. **Tests:** Create a monster, open sheet, drag items and RollTables, edit stats and biography.

**Deliverable:** Monster sheet on DocumentSheetV2 with RollTable drop and item drag-drop.

---

## Phase 4: DocumentSheetV2 – Faction Sheet

1. Add **faction-sheet-v2.js** extending `WwnDocumentSheetV2`:
   - Faction sheet is large (assets, goals, tags, log, etc.). Split into multiple PARTS (e.g. main, assets, goals, log) or one main part with partials, depending on template structure.
   - Prepare context: replicate faction `getData()` and asset/goal/tag preparation.
   - Actions: all current faction button handlers (add log, add tag, take action, set goal, add base, delete confirmations via `WwnDialog.confirm`).
   - Dialogs: use only `WwnDialog.wait()` / `WwnDialog.confirm()` (no `new Dialog()`).
   - Drag-drop: if faction accepts item/actor drops, implement same pattern as vehicle/ship.

2. **Registration:** Register faction v2 when DocumentSheetV2 is available.

3. **Tests:** Create a faction, run through assets, goals, log, tags, and actions.

**Deliverable:** Faction sheet on DocumentSheetV2 with all dialogs on DialogV2.

---

## Phase 5: DocumentSheetV2 – Character Sheet

1. Add **character-sheet-v2.js** extending `WwnDocumentSheetV2`:
   - Character is the most complex (attributes, skills, inventory, spells, arts, notes, etc.). Use multiple PARTS (e.g. attributes tab, skills tab, inventory tab, spells tab, notes tab) or a single main part that includes all tabs.
   - Prepare context: replicate character `getData()` and all item/skill/spell/art preparation.
   - Tab binding in `_onRender` if the template uses tabs.
   - Actions: item controls, skill rolls, spell/art usage, save rolls, etc. (delegate to existing item/actor logic where possible).
   - Drag-drop: Item and Folder (and any container logic if character sheet has it); same pattern as vehicle/ship, plus any character-specific sort behavior if needed.

2. **Registration:** Register character v2 when DocumentSheetV2 is available.

3. **Tests:** Full character workflow: edit stats, skills, inventory, spells, arts; drag items and folders; use rolls and dialogs.

**Deliverable:** Character sheet on DocumentSheetV2.

---

## Phase 6: Cleanup and Optional Items

1. **Remove legacy vehicle sheet**  
   - In `wwn.js`, register only `WwnActorSheetVehicleV2` for vehicles (no fallback to `WwnActorSheetVehicle`). Optionally delete `vehicle-sheet.js` or keep it for reference.

2. **Item sheet**  
   - If Foundry provides an ItemSheetV2 (or equivalent) in v13, add `item-sheet-v2.js` and register it; otherwise leave item sheet on legacy `ItemSheet`.

3. **Character creation**  
   - Optional: replace `WwnCharacterCreator` (FormApplication) with a DialogV2-based flow and register it where the creator is opened. Lower priority than sheets and other dialogs.

4. **Docs**  
   - Update any system docs or README to state that the system targets v13 and uses DocumentSheetV2 and DialogV2.

---

## Order Summary

| Order | Phase | Description |
|-------|--------|-------------|
| 1 | DialogV2 cleanup | WwnDialog v13-only; faction, dice, party-sheet, combat-tracker to WwnDialog.wait() |
| 2 | Ship v2 | Add ship-sheet-v2.js, register, test |
| 3 | Monster v2 | Add monster-sheet-v2.js, register, test |
| 4 | Faction v2 | Add faction-sheet-v2.js, register, test |
| 5 | Character v2 | Add character-sheet-v2.js, register, test |
| 6 | Cleanup | Vehicle-only registration; optional item/character-creation |

---

## Reference: Vehicle v2 Pattern

- **Base:** `WwnDocumentSheetV2` (DocumentSheet + HandlebarsApplicationMixin).
- **PARTS:** One part with `template` and `root: true`.
- **Context:** `_prepareContext()` merges `prepareVehicleContext(this.document)` (owned items, system, config, etc.).
- **Actions:** `DEFAULT_OPTIONS.actions` for item-edit, item-delete, item-caret, item-search, item-create, currency-adjust; each receives `(event, target)` and calls `event?.preventDefault?.()`.
- **Form:** `_onChangeForm()` for quantity and other field updates.
- **Drag-drop:** In `_onRender`, `new foundry.applications.ux.DragDrop({ dropSelector, permissions, callbacks }).bind(this.element)`; implement `_onDrop`, `_onDropItem`, `_onDropFolder`.
- **Header:** `_getHeaderControls()` to deduplicate if needed.
- **Rendering:** No tab binding if there’s only one content area (vehicle has no tab bar).

Use this as the template for ship, monster, faction, and character v2 sheets, scaling up parts and context as needed.
