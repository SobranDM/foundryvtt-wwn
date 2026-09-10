/**
 * One-shot (2.0.0-beta4) backfill: seed the new per-item `bonusSkillsGranted`
 * flag from legacy grant evidence, for PCs whose focus/power/classEdge bonus
 * skills were granted under the pre-2.0.0-beta4 scheme.
 *
 * That scheme tracked "already granted" on the *skill* Item (a single
 * `focusBonusFrom`/`powerBonusFrom`/`classEdgeBonusFrom` id). When two
 * different foci (or powers/classEdges) targeted the same skill, each
 * grant overwrote the other's stamp, so the guard never held and both kept
 * re-granting on every world load — see the 2026-09 Talk/Stab runaway-rank
 * incident. The fix moved "already granted" onto the *granting* item
 * instead (`flags.wwn.bonusSkillsGranted`, an array of skill slugs that
 * item has granted), which has no shared slot to collide over.
 *
 * Items that already granted under the old scheme carry a legacy
 * `focusBonusGranted` / `powerBonusGranted` / `classEdgeBonusGranted`
 * boolean but no `bonusSkillsGranted` array. Without this backfill, editing
 * one of those items again (e.g. leveling a focus, which re-fires the
 * updateItem sync) would look ungranted under the new scheme and apply its
 * bonus a second time. This only ever writes the granting item's own flag —
 * it never touches `system.ownedLevel`/`system.pointsInvested` on any
 * skill, so it cannot itself grant or re-grant anything.
 */
import { isPc } from "../helpers/actor-types.mjs";
import { alwaysBonusSkills, resolveChoiceBonusSkillSlugs } from "../helpers/focus-bonus-skills.mjs";
import { resolvePowerBonusSkillSlugs } from "../helpers/power-bonus-skills.mjs";
import { GRANTED_SKILLS_FLAG } from "../helpers/bonus-skills-shared.mjs";

const NS = "wwn";
const SETTING_DONE = "bonusSkillsGrantedBackfillDone";

/** Legacy per-item "I already granted my bonus" markers, by item type. */
const LEGACY_GRANTED_FLAG = {
  focus: "focusBonusGranted",
  power: "powerBonusGranted",
  classEdge: "classEdgeBonusGranted",
};

/**
 * Whether `item` shows legacy grant evidence but hasn't been backfilled yet.
 * @param {{ type?: string, getFlag?: Function }} item
 * @returns {boolean}
 */
export function needsBonusSkillsBackfill(item) {
  const legacyFlag = LEGACY_GRANTED_FLAG[item?.type];
  if (!legacyFlag || typeof item.getFlag !== "function") return false;
  if (!item.getFlag(NS, legacyFlag)) return false;
  return !Array.isArray(item.getFlag(NS, GRANTED_SKILLS_FLAG));
}

/**
 * The skill slugs `item` currently resolves to grant — what its
 * `bonusSkillsGranted` flag should be seeded with.
 * @param {Item} item
 * @returns {string[]}
 */
export function computeBackfillSlugs(item) {
  if (item?.type === "focus") {
    return [...new Set([...alwaysBonusSkills(item), ...(resolveChoiceBonusSkillSlugs(item) ?? [])])];
  }
  if (item?.type === "power" || item?.type === "classEdge") {
    return resolvePowerBonusSkillSlugs(item) ?? [];
  }
  return [];
}

/**
 * @yields {Actor}
 */
function* iterWorldPcs() {
  for (const actor of game.actors) {
    if (isPc(actor)) yield actor;
  }
}

/**
 * @returns {Promise<Actor[]>}
 */
async function loadWorldPackPcs() {
  const out = [];
  for (const pack of game.packs) {
    if (pack.metadata.packageType !== "world") continue;
    if (pack.documentName !== "Actor") continue;
    if (pack.locked) continue;
    await pack.getDocuments();
    for (const actor of pack.contents) {
      if (isPc(actor)) out.push(actor);
    }
  }
  return out;
}

/**
 * Run the backfill once per world (GM only).
 */
export async function maybeBackfillBonusSkillsGranted() {
  if (!game.user?.isGM) return;
  if (game.settings.get(NS, SETTING_DONE)) return;

  const actors = [...iterWorldPcs(), ...(await loadWorldPackPcs())];
  let seeded = 0;
  console.info(`WWN | Bonus-skill grant backfill: ${actors.length} PC(s)…`);
  for (const actor of actors) {
    for (const item of actor.items ?? []) {
      if (!needsBonusSkillsBackfill(item)) continue;
      try {
        await item.setFlag(NS, GRANTED_SKILLS_FLAG, computeBackfillSlugs(item));
        seeded++;
      } catch (err) {
        console.error(`WWN | Bonus-skill grant backfill failed for ${actor.name} → ${item.name}:`, err);
      }
    }
  }

  await game.settings.set(NS, SETTING_DONE, true);
  console.info(`WWN | Bonus-skill grant backfill: seeded ${seeded} item(s).`);
}
