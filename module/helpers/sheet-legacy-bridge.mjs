/**
 * Bridge remaining legacy sheet/template field paths onto the current system
 * schema so older dialogs and form submits keep working.
 *
 * Still aliased:
 * - scores ↔ abilities (modifiers dialog / skill score selects)
 * - initiative.mod / thac0.bba / damageBonus / hp.hd (legacy submits)
 *
 * `remapLegacySubmitData` is applied from `WwnBaseActorSheet._processFormData`.
 * AC display uses system.combat.ac.* and system.ac.naked (derived here).
 */

/**
 * @param {object} system  Actor system data (mutable clone for sheet context)
 * @param {{ separateRangedAC?: boolean }} [options]
 */
export function applyLegacySheetAliases(system, options = {}) {
  if (!system) return system;

  if (system.abilities && !system.scores) {
    system.scores = system.abilities;
  }

  const ac = system.combat?.ac;
  if (ac) {
    const separate = !!options.separateRangedAC;
    const dexMod = system.abilities?.dex?.mod ?? 0;
    const naked = (Number(ac.base) || 10) + dexMod + (Number(ac.mod) || 0);
    // Preferred display paths for templates
    system.ac = {
      value: ac.melee?.value ?? 10,
      melee: ac.melee?.value ?? 10,
      ranged: separate ? (ac.ranged?.value ?? ac.melee?.value ?? 10) : ac.melee?.value ?? 10,
      mod: ac.mod ?? 0,
      naked,
      showRanged: separate,
    };
  }

  // Monster header / party sheet legacy paths (submit remaps below)
  if (system.hd != null) {
    system.hp ??= {};
    system.hp.hd = system.hd;
  }
  if (system.combat) {
    system.initiative ??= {};
    system.initiative.mod = system.combat.initMod ?? system.combat.initiative?.individual?.mod ?? 0;
    system.thac0 ??= {};
    system.thac0.bba = system.combat.ab ?? 0;
    if (system.damageBonus == null) system.damageBonus = system.combat.damageBonus ?? 0;
  }

  return system;
}

/**
 * Remap flat form submit keys from legacy paths to schema paths.
 * Collapses duplicate-name form arrays (FormDataExtended RadioNodeList) to the
 * last defined scalar, and drops nulls so empty number inputs do not fail
 * non-nullable NumberField validation.
 * @param {object} flat  flattened FormDataExtended.object
 * @returns {object}
 */
export function remapLegacySubmitData(flat) {
  const out = { ...flat };
  for (const [key, value] of Object.entries(flat)) {
    let next = key;
    if (next.startsWith("system.scores.")) {
      next = next.replace("system.scores.", "system.abilities.");
    }
    // Legacy aac submits (if any remain) → combat AC sinks
    if (next === "system.aac.value" || next === "system.aac.mod") {
      if (next === "system.aac.mod") next = "system.combat.ac.mod";
      else next = "system.combat.acManual.melee";
    }
    if (next === "system.aac.ranged") {
      next = "system.combat.acManual.ranged";
    }
    if (next === "system.details.strain.value") {
      next = "system.strain.value";
    }
    if (next === "system.initiative.mod") {
      next = "system.combat.initMod";
    }
    if (next === "system.thac0.bba") {
      next = "system.combat.ab";
    }
    if (next === "system.damageBonus") {
      next = "system.combat.damageBonus";
    }
    if (next === "system.hp.hd") {
      next = "system.hd";
    }
    if (next !== key) {
      out[next] = value;
      delete out[key];
    }
  }

  for (const [key, value] of Object.entries(out)) {
    let v = value;
    if (Array.isArray(v)) {
      // Duplicate inputs with the same name → array; prefer last non-null.
      let picked = v[v.length - 1];
      for (let i = v.length - 1; i >= 0; i--) {
        if (v[i] !== null && v[i] !== undefined) {
          picked = v[i];
          break;
        }
      }
      v = picked;
    }
    // Empty cleared number fields become null; omit so required integers keep
    // their previous document values instead of failing validation.
    if (v === null) {
      delete out[key];
      continue;
    }
    out[key] = v;
  }
  return out;
}
