/**
 * WWN System Tests — Quench batch registration.
 */
import registerApi from "./quench/batches/api.mjs";
import registerActorsSmoke from "./quench/batches/actors-smoke.mjs";
import registerItemsSmoke from "./quench/batches/items-smoke.mjs";
import registerActorsDerived from "./quench/batches/actors-derived.mjs";
import registerSheetsPersistence from "./quench/batches/sheets-persistence.mjs";
import registerRolls from "./quench/batches/rolls.mjs";
import registerAmmo from "./quench/batches/ammo.mjs";
import registerCombat from "./quench/batches/combat.mjs";
import registerActiveEffects from "./quench/batches/active-effects.mjs";
import registerRegressions from "./quench/batches/regressions.mjs";
import registerPowers from "./quench/batches/powers.mjs";
import registerFocus from "./quench/batches/focus.mjs";
import registerFociCombat from "./quench/batches/foci-combat.mjs";
import registerFociSheet from "./quench/batches/foci-sheet.mjs";
import registerArtsInnate from "./quench/batches/arts-innate.mjs";
import registerCompendiums from "./quench/batches/compendiums.mjs";
import registerStarship from "./quench/batches/starship.mjs";
import registerPowerArmor from "./quench/batches/power-armor.mjs";
import registerDamageApply from "./quench/batches/damage-apply.mjs";
import registerAttackPipeline from "./quench/batches/attack-pipeline.mjs";
import registerChatApply from "./quench/batches/chat-apply.mjs";
import registerEncumbrance from "./quench/batches/encumbrance.mjs";
import registerPowersLifecycle from "./quench/batches/powers-lifecycle.mjs";
import registerClassEdge from "./quench/batches/class-edge.mjs";
import registerCombatEncounters from "./quench/batches/combat-encounters.mjs";
import registerStarshipCombat from "./quench/batches/starship-combat.mjs";
import registerPowerArmorCombat from "./quench/batches/power-armor-combat.mjs";
import registerCyberware from "./quench/batches/cyberware.mjs";
import registerProjects from "./quench/batches/projects.mjs";
import registerBonusSkillsBackfill from "./quench/batches/bonus-skills-backfill.mjs";

const BATCH_REGISTRARS = [
  registerApi,
  registerActorsSmoke,
  registerItemsSmoke,
  registerActorsDerived,
  registerSheetsPersistence,
  registerRolls,
  registerAmmo,
  registerCombat,
  registerActiveEffects,
  registerRegressions,
  registerPowers,
  registerFocus,
  registerFociCombat,
  registerFociSheet,
  registerArtsInnate,
  registerCompendiums,
  registerStarship,
  registerPowerArmor,
  registerDamageApply,
  registerAttackPipeline,
  registerChatApply,
  registerEncumbrance,
  registerPowersLifecycle,
  registerClassEdge,
  registerCombatEncounters,
  registerStarshipCombat,
  registerPowerArmorCombat,
  registerCyberware,
  registerProjects,
  registerBonusSkillsBackfill,
];

/**
 * Called by wwn.mjs's own quenchReady listener (module/wwn.mjs) via a
 * dynamic import — this file is not a separate Foundry package and is not
 * self-registering, so importing it has no side effects on its own.
 * @param {Quench} quench
 */
export function registerAllBatches(quench) {
  for (const register of BATCH_REGISTRARS) {
    register(quench);
  }
  console.log(`WWN System Tests | Registered ${BATCH_REGISTRARS.length} Quench batches`);
}
