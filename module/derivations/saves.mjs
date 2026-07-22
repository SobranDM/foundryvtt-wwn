import { isNpc } from "../helpers/actor-types.mjs";
/**
 * Saving throw derivation, driven by the active save set
 * (CONFIG.WWN.saveSets + wwn.saveSet world setting).
 */

/**
 * Derive save values for an actor. Reads per-save `mod` and `base.mod`
 * already adjusted by initial-phase AEs.
 * @param {Actor} actor
 */
export function deriveSaves(actor) {
  const system = actor.system;
  const setKey = game.settings.get("wwn", "saveSet") ?? "wwn";
  const saveSet = CONFIG.WWN.saveSets[setKey] ?? CONFIG.WWN.saveSets.wwn;
  const removeLevelSave = game.settings.get("wwn", "removeLevelSave");

  system.saves ??= {};
  system.saves.base ??= { mod: 0 };
  const baseMod = system.saves.base.mod ?? 0;

  // NPC: HD-based saves
  let npcPenalty = 0;
    if (isNpc(actor)) {
      const hdMatch = String(system.hd ?? "1").match(/(\d+)/);
      const hd = hdMatch ? parseInt(hdMatch[1]) : 1;
      npcPenalty = Math.floor(hd / 2);
    }

  for (const [id, def] of Object.entries(saveSet.saves)) {
    system.saves[id] ??= { mod: 0 };
    const save = system.saves[id];
    save.mod ??= 0;
    save.label = def.label;

    if (isNpc(actor)) {
      const npcBase = system.saveMods?.base ?? 0;
      const npcSave = system.saveMods?.[id] ?? 0;
      save.value = Math.max(saveSet.npcBase - npcPenalty, 2) + save.mod + baseMod + npcBase + npcSave;
      continue;
    }

    const mods = def.pair.map((a) => system.abilities?.[a]?.mod ?? 0);
    const best = mods.length ? Math.max(...mods) : 0;
    let value = saveSet.base + baseMod + save.mod - best;
    if (saveSet.derivation === "wwn" && !removeLevelSave) {
      value -= system.details?.level ?? 1;
    }
    save.value = value;
  }
}
