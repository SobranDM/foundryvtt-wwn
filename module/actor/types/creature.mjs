/**
 * Shared logic for character and monster actors (compute modifiers, saves, init).
 * Used by character.mjs and monster.mjs prepare().
 */

function valueFromTable(table, val) {
  let output;
  for (let i = 0; i <= val; i++) {
    if (table[i] !== undefined) output = table[i];
  }
  return output;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeModifiers(actor) {
  if (actor.type !== "character" && actor.type !== "monster") return;
  const data = actor.system;
  const scores = data?.scores ?? {};
  if (typeof scores !== "object" || Array.isArray(scores)) return;
  const standard = { 0: -2, 3: -2, 4: -1, 8: 0, 14: 1, 18: 2 };
  const bx = { 0: -3, 4: -2, 6: -1, 9: 0, 13: 1, 16: 2, 18: 3 };
  const table = game.settings.get("wwn", "attributeModType") === "bx" ? bx : standard;
  Object.keys(scores).forEach((score) => {
    const entry = scores[score];
    if (entry == null || typeof entry !== "object") return;
    const newMod =
      (entry.tweak ?? 0) +
      (entry.bonus ?? 0) +
      valueFromTable(table, entry.value ?? 0);
    entry.mod = newMod;
  });
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeSaves(actor) {
  if (actor.type === "faction" || actor.type === "ship") return;
  const data = actor.system;
  const saves = data?.saves ?? {};
  if (typeof saves !== "object" || Array.isArray(saves)) return;
  const baseSave = actor.type === "monster" ? 15 : 16;

  Object.keys(saves).forEach((s) => {
    const saveEntry = saves[s];
    if (saveEntry != null && typeof saveEntry === "object" && saveEntry.mod == null) saveEntry.mod = 0;
  });

  if (actor.type === "monster" && data.saves?.baseSave) {
    const hdStr = data.hp?.hd ?? "1d8";
    const monsterHD = String(hdStr).toLowerCase().split("d");
    ["evasion", "physical", "mental", "luck"].forEach((save) => {
      const saveObj = data.saves[save];
      if (!saveObj) return;
      saveObj.value =
        Math.max(baseSave - Math.floor(monsterHD[0] / 2), 2) +
        (saveObj.mod ?? 0) +
        (data.saves.baseSave?.mod ?? 0);
    });
  }
  if (actor.type === "character") {
    const charLevel = data.details.level;
    const newSaves = {
      evasionVal: baseSave + data.saves.baseSave.mod + data.saves.evasion.mod,
      physicalVal: baseSave + data.saves.baseSave.mod + data.saves.physical.mod,
      mentalVal: baseSave + data.saves.baseSave.mod + data.saves.mental.mod,
      luckVal: baseSave + data.saves.baseSave.mod + data.saves.luck.mod,
    };
    newSaves.evasionVal -= Math.max(data.scores.int.mod, data.scores.dex.mod);
    newSaves.physicalVal -= Math.max(data.scores.con.mod, data.scores.str.mod);
    newSaves.mentalVal -= Math.max(data.scores.wis.mod, data.scores.cha.mod);

    const removeLevelSave = game.settings.get("wwn", "removeLevelSave");
    Object.keys(newSaves).forEach((save) => {
      if (!removeLevelSave) newSaves[save] -= charLevel;
    });

    actor.system.saves.evasion.value = newSaves.evasionVal;
    actor.system.saves.physical.value = newSaves.physicalVal;
    actor.system.saves.mental.value = newSaves.mentalVal;
    actor.system.saves.luck.value = newSaves.luckVal;
  }
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeInit(actor) {
  let initRoll = "1d8";
  let initValue = actor.system?.initiative?.mod ?? 0;
  if (actor.type === "character") {
    initValue += actor.system?.scores?.dex?.mod ?? 0;
  }

  const isGroupInit = game.settings.get("wwn", "initiative") === "group";
  if (!isGroupInit) {
    const alert = actor.items.find((i) => i.name === "Alert")?.system?.ownedLevel ?? 0;
    if (alert >= 1) initRoll = "2d8kh";
    const hasVigilant = actor.items.some((i) => i.name === "Vigilant");
    if (alert === 2 || hasVigilant) initValue += 100;
  }

  const init = actor.system?.initiative;
  if (init != null && typeof init === "object") {
    init.roll = initRoll;
    init.value = initValue;
  }
}

/**
 * Run prepareData for monster (modifiers, saves, init only).
 * @param {import("../../entity.js").WwnActor} actor
 */
export function prepare(actor) {
  if (actor.type !== "monster") return;
  computeModifiers(actor);
  computeSaves(actor);
  computeInit(actor);
}
