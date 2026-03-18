/**
 * Character-specific actor logic (prepareData and compute methods).
 */
import * as creature from "./creature.mjs";

/**
 * Run full prepareData for character (all compute steps in order).
 * @param {import("../../entity.js").WwnActor} actor
 */
export function prepare(actor) {
  if (actor.type !== "character") return;
  creature.computeModifiers(actor);
  computeAC(actor);
  computeEncumbrance(actor);
  _calculateMovement(actor);
  computeResources(actor);
  computeTreasure(actor);
  computePersonalTreasure(actor);
  enableSpellcasting(actor);
  computeEffort(actor);
  if (actor.system.spells?.leveledSlots) computeSlots(actor);
  creature.computeSaves(actor);
  computeTotalSP(actor);
  setXP(actor);
  computePrepared(actor);
  creature.computeInit(actor);
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function setXP(actor) {
  if (actor.type !== "character") return;
  const data = actor.system;
  let xpRate = [];
  const level = data.details.level - 1;
  switch (game.settings.get("wwn", "xpConfig")) {
    case "xpSlow":
      xpRate = [6, 15, 24, 36, 51, 69, 87, 105, 139];
      break;
    case "xpFast":
      xpRate = [3, 6, 12, 18, 27, 39, 54, 72, 93];
      break;
    case "xpCustom":
      xpRate = game.settings.get("wwn", "xpCustomList").split(",");
      break;
  }
  if (!game.settings.get("wwn", "xpPerChar")) {
    actor.system.details.xp.next = xpRate[level];
  }
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computePrepared(actor) {
  const spells = actor.items.filter((i) => i.type === "spell");
  if (spells.length === 0) return;
  let spellsPrepared = 0;
  spells.forEach((s) => {
    if (s.system.prepared) spellsPrepared++;
  });
  actor.system.spells.prepared.value = spellsPrepared;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeResources(actor) {
  if (actor.type !== "character") return;
  let totalOil = 0, totalTorches = 0, totalRations = 0;
  const oilArray = actor.items.filter(
    (i) => i.name.toLowerCase() === "oil, one pint" || i.name.toLowerCase() === "oil"
  );
  const torchArray = actor.items.filter((i) => i.name.toLowerCase() === "torch");
  const rationsArray = actor.items.filter((i) => i.name.toLowerCase().includes("rations"));
  oilArray.forEach((i) => (totalOil += i.system.charges.value));
  torchArray.forEach((i) => (totalTorches += i.system.charges.value));
  rationsArray.forEach((i) => (totalRations += i.system.charges.value));
  actor.system.details.resources = { oil: totalOil, torches: totalTorches, rations: totalRations };
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function enableSpellcasting(actor) {
  if (actor.type === "faction" || actor.type === "ship") return;
  const arts = actor.items.filter((i) => i.type === "art");
  const spells = actor.items.filter((i) => i.type === "spell");
  actor.system.spells.enabled = arts.length > 0 || spells.length > 0;
  actor.system.spells.artsEnabled = arts.length > 0;
  actor.system.spells.spellsEnabled = spells.length > 0;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeTotalSP(actor) {
  const data = actor.system;
  if (actor.type !== "character" && actor.type !== "ship") return;
  let newTotal = 0;
  if (game.settings.get("wwn", "useGoldStandard")) {
    newTotal =
      data.currency.cp * 0.01 + data.currency.sp * 0.1 + data.currency.gp * 1 +
      data.currency.pp * 5 + data.currency.ep * 0.5 + data.currency.bank + data.personalTreasure;
  } else {
    newTotal =
      data.currency.cp * 0.1 + data.currency.sp + data.currency.gp * 10 +
      data.currency.pp * 50 + data.currency.ep * 5 + data.currency.bank + data.personalTreasure;
  }
  actor.system.currency.total = newTotal;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeEffort(actor) {
  const arts = actor.items.filter((a) => a.type === "art");
  if (arts.length === 0) {
    actor.system.classes = {};
    return;
  }
  const data = actor.system;
  const classPools = {};
  arts.forEach((a) => {
    if (!classPools[a.system.source]) {
      classPools[a.system.source] = { value: a.system.effort, max: data.classes[a.system.source]?.max ?? 1 };
    } else {
      classPools[a.system.source].value += a.system.effort;
    }
  });
  actor.system.classes = classPools;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export async function computeSlots(actor) {
  const spells = actor.items.filter((s) => s.type === "spell");
  const slots = actor.system.spells.slots;
  Object.keys(slots).forEach((level) => (actor.system.spells.slots[level].used = 0));
  spells.forEach((spell) => {
    const spellLvl = spell.system.lvl;
    slots[spellLvl].used += spell.system.memorized;
  });
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeTreasure(actor) {
  if (actor.type !== "character" && actor.type !== "ship" && actor.type !== "vehicle") return;
  let total = 0;
  const treasures = actor.items.filter(
    (i) => i.type === "item" && i.system.treasure && !i.system.personal
  );
  treasures.forEach((item) => { total += item.system.quantity * item.system.price; });
  let cargoTotal = 0;
  if (actor.type === "ship") {
    const cargos = actor.items.filter((i) => i.type === "cargo" && i.system.treasure);
    cargos.forEach((c) => { if (c.system.treasure) cargoTotal += c.system.price * c.system.quantity; });
  }
  actor.system.treasure = total + cargoTotal;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computePersonalTreasure(actor) {
  if (actor.type !== "character") return;
  let total = 0;
  const treasures = actor.items.filter((i) => i.type === "item" && i.system.personal);
  treasures.forEach((item) => { total += item.system.quantity * item.system.price; });
  actor.system.personalTreasure = total;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function _calculateMovement(actor) {
  if (actor.type !== "character") return;
  const data = actor.system;
  if (!data.config?.movementAuto) return;
  const readiedValue = data.encumbrance?.readied?.value ?? 0;
  const readiedMax = data.encumbrance?.readied?.max ?? 0;
  const stowedValue = data.encumbrance?.stowed?.value ?? 0;
  const stowedMax = data.encumbrance?.stowed?.max ?? 0;
  const bonus = data.movement?.bonus ?? 0;
  const systemBase = game.settings.get("wwn", "movementRate") === "movebx" ? [40, 30, 20] : [30, 20, 15];
  let newBase;
  if (readiedValue <= readiedMax && stowedValue <= stowedMax) newBase = systemBase[0] + bonus;
  else if (readiedValue <= readiedMax + 2 && stowedValue <= stowedMax) newBase = systemBase[1] + bonus;
  else if (readiedValue <= readiedMax && stowedValue <= stowedMax + 4) newBase = systemBase[1] + bonus;
  else if (readiedValue <= readiedMax + 2 && stowedValue <= stowedMax + 4) newBase = systemBase[2] + bonus;
  else if (readiedValue <= readiedMax + 4 && stowedValue <= stowedMax) newBase = systemBase[2] + bonus;
  else if (readiedValue <= readiedMax && stowedValue <= stowedMax + 8) newBase = systemBase[2] + bonus;
  else newBase = 0;
  actor.system.movement = { base: newBase, exploration: newBase * 3, overland: newBase / 5, bonus };
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeEncumbrance(actor) {
  if (actor.type !== "character") return;
  const data = actor.system;
  let totalReadied = 0, totalStowed = 0;
  const maxReadied = Math.floor(data.scores.str.value / 2);
  const maxStowed = data.scores.str.value;
  const weapons = actor.items.filter((w) => w.type === "weapon");
  const armors = actor.items.filter((a) => a.type === "armor");
  const items = actor.items.filter((i) => i.type === "item");
  const roundWeight = game.settings.get("wwn", "roundWeight");

  weapons.forEach((w) => {
    if ((w.system.weightless === "whenReadied" && w.system.equipped) || (w.system.weightless === "whenStowed" && w.system.stowed)) return;
    const wgt = w.system.weight * w.system.quantity;
    if (w.system.equipped) totalReadied += roundWeight ? Math.ceil(wgt) : wgt;
    else if (w.system.stowed) totalStowed += roundWeight ? Math.ceil(wgt) : wgt;
  });
  armors.forEach((a) => {
    if ((a.system.weightless === "whenReadied" && a.system.equipped) || (a.system.weightless === "whenStowed" && a.system.stowed)) return;
    if (a.system.equipped) totalReadied += roundWeight ? Math.ceil(a.system.weight) : a.system.weight;
    else if (a.system.stowed) totalStowed += roundWeight ? Math.ceil(a.system.weight) : a.system.weight;
  });
  items.forEach((i) => {
    if ((i.system.weightless === "whenReadied" && i.system.equipped) || (i.system.weightless === "whenStowed" && i.system.stowed)) return;
    let itemWeight;
    if (i.system.charges?.value || i.system.charges?.max) {
      if (i.system.charges.value <= i.system.charges.max || !i.system.charges.value) itemWeight = i.system.weight;
      else if (!i.system.charges.max) itemWeight = i.system.charges.value * i.system.weight;
      else itemWeight = (i.system.charges.value / i.system.charges.max) * i.system.weight;
    } else itemWeight = i.system.weight * i.system.quantity;
    if (i.system.equipped) totalReadied += roundWeight ? Math.ceil(itemWeight) : itemWeight;
    else if (i.system.stowed) totalStowed += roundWeight ? Math.ceil(itemWeight) : itemWeight;
  });

  if (!game.settings.get("wwn", "disableCoinWeight")) {
    const c = data.currency ?? {};
    const coinWeight = game.settings.get("wwn", "currencyTypes") === "currencybx"
      ? (c.cp + c.sp + c.ep + c.gp + c.pp) / 100
      : (c.cp + c.sp + c.gp) / 100;
    totalStowed += coinWeight;
  }

  actor.system.encumbrance = {
    readied: { max: maxReadied, value: totalReadied.toFixed(2) },
    stowed: { max: maxStowed, value: totalStowed.toFixed(2) },
  };
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeAC(actor) {
  if (actor.type !== "character") return;
  const data = actor.system;
  let baseAac = 10, AacShieldMod = 0, AacShieldNaked = 0;
  const naked = baseAac + data.scores.dex.mod + data.aac.mod;
  let exertPenalty = 0, sneakPenalty = 0;
  let traumaTarget = 6;
  if (game.settings.get("wwn", "useTrauma")) traumaTarget += data.trauma?.bonus ?? 0;

  const armors = actor.items.filter((i) => i.type === "armor");
  armors.forEach((a) => {
    if (!a.system.equipped) return;
    if (game.settings.get("wwn", "useTrauma")) traumaTarget += a.system.traumaMod ?? 0;
    const isShield = a.system.type === "shield" || (game.settings.get("wwn", "useFlatArmorPenalty") && a.system.isShield);
    if (!isShield) {
      baseAac = Number(a.system.aac.value) + a.system.aac.mod;
      if (game.settings.get("wwn", "useFlatArmorPenalty")) {
        if (a.system.ashesHeavy) { sneakPenalty = Math.max(sneakPenalty, 1); exertPenalty = Math.max(exertPenalty, 1); }
      } else {
        if (a.system.type === "medium" && a.system.weight > sneakPenalty) sneakPenalty = a.system.weight;
        if (a.system.type === "heavy" && a.system.weight > sneakPenalty) sneakPenalty = a.system.weight;
        if (a.system.type === "heavy" && a.system.weight > exertPenalty) exertPenalty = a.system.weight;
      }
    } else {
      AacShieldMod = 1 + a.system.aac.mod;
      AacShieldNaked = Number(a.system.aac.value) + a.system.aac.mod;
    }
  });

  if (AacShieldMod > 0) {
    const shieldOnly = AacShieldNaked + data.scores.dex.mod + data.aac.mod;
    const shieldBonus = baseAac + data.scores.dex.mod + data.aac.mod + AacShieldMod;
    actor.system.aac = {
      value: shieldOnly > shieldBonus ? shieldOnly : shieldBonus,
      shield: shieldOnly > shieldBonus ? 0 : AacShieldMod,
      naked,
      mod: data.aac.mod,
    };
  } else {
    actor.system.aac = { value: baseAac + data.scores.dex.mod + data.aac.mod, naked, shield: 0, mod: data.aac.mod };
  }
  actor.system.skills.sneakPenalty = sneakPenalty;
  actor.system.skills.exertPenalty = exertPenalty;
  if (game.settings.get("wwn", "useTrauma")) actor.system.trauma.value = traumaTarget;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 * @param {number} excess
 */
export async function applyWounds(actor, excess) {
  const locations = {
    1: ["Left Arm", "Disabled", "Your arm becomes unusable. It cannot hold things and any held item is dropped.", "<b>Mangled.</b> Make a Physical save. On a failure, a limb is permanently disabled or hacked off. On a success, you merely lose a finger or toe."],
    2: ["Right Arm", "Disabled", "Your arm becomes unusable. It cannot hold things and any held item is dropped.", "<b>Mangled.</b> Make a Physical save. On a failure, a limb is permanently disabled or hacked off. On a success, you merely lose a finger or toe."],
    3: ["Left Leg", "Disabled", "Your leg becomes unusable. It cannot support your weight and you fall prone. Movement cut in half.", "<b>Mangled.</b> Make a Physical save. On a failure, a limb is permanently disabled or hacked off. On a success, you merely lose a finger or toe."],
    4: ["Right Leg", "Disabled", "Your leg becomes unusable. It cannot support your weight and you fall prone. Movement cut in half.", "<b>Mangled.</b> Make a Physical save. On a failure, a limb is permanently disabled or hacked off. On a success, you merely lose a finger or toe."],
    5: ["Torso", "Blood Loss", "Your maximum HP is reduced by 1 per HD you possess.", "<b>Crushed.</b> Make a Physical save. On a success, you gain a cool scar. On a failure, roll [[/r 1d6]]:<br />1) Permanently lose 1 Strength.<br />2) Permanently lose 1 Dexterity.<br />3) Permanently lose 1 Constitution.<br />4) Crushed throat. You cannot speak louder than a whisper.<br />5) Crushed ribs. Treat Constitution as 4 when holding your breath.<br />6) Your spine is broken and you are paralyzed from the neck down. You can attempt recovery twice: by making a Con Check after [[1d6]] days and again after [[1d6]] weeks. If you fail both, it is permanent."],
    6: ["Torso", "Blood Loss", "Your maximum HP is reduced by 1 per HD you possess.", "<b>Crushed.</b> Make a Physical save. On a success, you gain a cool scar. On a failure, roll [[/r 1d6]]: (same as 5)"],
    7: ["Torso", "Blood Loss", "Your maximum HP is reduced by 1 per HD you possess.", "<b>Crushed.</b> (same as 5)"],
    8: ["Torso", "Blood Loss", "Your maximum HP is reduced by 1 per HD you possess.", "<b>Crushed.</b> (same as 5)"],
    9: ["Head", "Concussed", "Always act last in combat. Make an Int check (DC 12) when you cast a spell to avoid it fizzling.", "<b>Skullcracked.</b> Make a Physical save. On a success, you gain a cool scar. On a failure, roll [[/r 1d6]]:<br />1) Permanently lose 1 Intelligence.<br />2) Permanently lose 1 Wisdom.<br />3) Permanently lose 1 Charisma.<br />4) Lose your left eye. -1 to Ranged Attacks.<br />5) Lose your right eye. -1 to Ranged Attacks.<br />6) Slip into a coma. You can attempt recovery twice: by making a Con Check after [[1d6]] days and again after [[1d6]] weeks. If you fail both, it is permanent."],
    10: ["Head", "Concussed", "Always act last in combat. Make an Int check (DC 12) when you cast a spell to avoid it fizzling.", "<b>Skullcracked.</b> (same as 9)"],
    11: ["Head", "Concussed", "Always act last in combat. Make an Int check (DC 12) when you cast a spell to avoid it fizzling.", "<b>Skullcracked.</b> (same as 9)"],
    12: ["Head", "Concussed", "Always act last in combat. Make an Int check (DC 12) when you cast a spell to avoid it fizzling.", "<b>Skullcracked.</b> (same as 9)"],
  };

  const locationRoll = await new Roll("1d12").evaluate();
  const hitLocation = locations[locationRoll.total];
  const currInjuries = actor.system.hp.injuries ?? 0;
  const currWounds = actor.system.hp.wounds ?? 0;
  const woundRoll = await new Roll(`1d12 + ${currInjuries} + ${excess}`).evaluate();
  const woundMessage = woundRoll.result;
  const woundResult = woundRoll.total;
  let newInjuries = 0, newWounds = 0;
  let content = `<p><b>Location: ${hitLocation[0]}.</b></p><p><b>Severity: ${woundResult}</b> (${woundMessage})</p><p><b>${hitLocation[1]} for ${woundResult} days.</b> ${hitLocation[2]}*</p>`;
  if (woundResult >= 16) newWounds += woundResult - 15;
  if (woundResult >= 11) {
    content += `<p>${hitLocation[3]}*</p><p><b>You are unconscious.</b></p>`;
    newInjuries++;
    newWounds++;
  }
  newInjuries++;
  content += "<p><b>* Fire/Acid/Lightning/Arcane:</b> Consult rules for alternate injuries.</p>";

  await actor.update({
    "system.hp": { wounds: currWounds + newWounds, injuries: currInjuries + newInjuries },
  });

  content += `
    <table>
      <thead><tr><td/><td><b>Prev</b></td><td><b>New</b></td><td><b>Total</b></td></tr></thead>
      <tbody>
        <tr><td><b>Injuries</b></td><td>${currInjuries}</td><td>${newInjuries}</td><td>${actor.system.hp.injuries}</td></tr>
        <tr><td><b>Wounds</b></td><td>${currWounds}</td><td>${newWounds}</td><td>${actor.system.hp.wounds}</td></tr>
      </tbody>
    </table>`;

  const template = "systems/wwn/templates/chat/apply-damage.hbs";
  const templateData = { title: `${actor.name}: ${hitLocation[0]} Wounded!`, body: content, image: "icons/svg/blood.svg" };
  const html = await renderTemplate(template, templateData);
  await ChatMessage.create({ user: game.user.id, content: html }, {});
}
