import { WWN } from "../config/index.mjs";
import { applyFocusResourceGrants } from "./focus-resources.mjs";
import { progressionAtLevel, resolveCastProgression } from "./prepared-spells.mjs";
import { findPoolGrantEdge } from "../helpers/resource-pool-resolve.mjs";

/**
 * Resource pool builder.
 *
 * Pools are derived-only (never persisted): spend lives on each Power's
 * poolCommitted buckets. Maxes come from matching ClassEdge grants plus Focus resourceGrant bonuses.
 */

/** Safe deterministic formula evaluation against actor roll data. */
export function evaluatePoolFormula(formula, rollData) {
  if (!formula || !formula.trim()) return { value: 0, valid: false };
  try {
    const replaced = foundry.dice.Roll.replaceFormulaData(formula, rollData, { missing: "0" });
    const value = foundry.dice.Roll.safeEval(replaced);
    if (!Number.isFinite(value)) return { value: 0, valid: false };
    return { value: Math.floor(value), valid: true };
  } catch (err) {
    return { value: 0, valid: false };
  }
}

/**
 * Whether the actor has leveled spell slots from any Class/Edge slotGrant.
 * @param {Actor} actor
 * @returns {"leveled"|null}
 */
export function getActorSpellSlotMode(actor) {
  const hasLeveled = actor.items.some(
    (i) =>
      i.type === "classEdge" &&
      i.system.slotGrant?.enabled &&
      (i.system.slotGrant?.leveledProgression?.length ?? 0) > 0
  );
  return hasLeveled ? "leveled" : null;
}

function characterLevel(rollData) {
  return Math.max(Number(rollData.level) || 1, 1);
}

/** Max from poolGrant: optional level progression + formula. */
function poolGrantMax(classEdge, rollData) {
  const grant = classEdge.system.poolGrant;
  if (!grant) return { max: 0, valid: false };
  const progression = grant.progression ?? [];
  let base = 0;
  let hasBase = false;
  if (Array.isArray(progression) && progression.length) {
    base = progressionAtLevel(progression, characterLevel(rollData));
    hasBase = true;
  }
  const formula = grant.formula;
  if (formula?.trim()) {
    const { value, valid } = evaluatePoolFormula(formula, rollData);
    if (!valid && !hasBase) return { max: 0, valid: false };
    return { max: base + (valid ? value : 0), valid: valid || hasBase };
  }
  if (hasBase) return { max: base, valid: true };
  return { max: 0, valid: false };
}

/** Max from slotGrant: leveled matrix or unleveled progression (never both). */
function slotGrantMax(classEdge, rollData, spellLevel = null) {
  const slot = classEdge.system.slotGrant;
  const level = characterLevel(rollData);
  if (slot?.enabled) {
    const matrix = slot.leveledProgression ?? [];
    if (!matrix.length || spellLevel == null) return { max: 0, valid: false };
    const row = matrix[Math.min(level, matrix.length) - 1] ?? [];
    if (spellLevel - 1 >= row.length) return { max: 0, valid: false };
    return { max: Number(row[spellLevel - 1]) || 0, valid: true };
  }
  const table = slot?.progression ?? [];
  if (!table.length) return { max: 0, valid: false };
  const row = Math.min(level, table.length) - 1;
  return { max: Number(table[row]) || 0, valid: true };
}

function slotGrantActive(edge) {
  const slot = edge.system.slotGrant;
  if (!slot) return false;
  if (slot.enabled) return (slot.leveledProgression?.length ?? 0) > 0;
  return (slot.progression?.length ?? 0) > 0;
}

function poolGrantActive(edge) {
  const grant = edge.system.poolGrant;
  return grant?.name?.trim() || grant?.formula?.trim() || (grant?.progression?.length ?? 0) > 0;
}

function pushLeveledSlotPools(slotEdge, rollData, spellsByLevel, pools, spellSlotsName) {
  const matrix = slotEdge.system.slotGrant?.leveledProgression ?? [];
  if (!matrix.length) return "WWN.Pools.WarnNoSlotRow";

  const row = matrix[Math.min(characterLevel(rollData), matrix.length) - 1] ?? [];
  for (let spellLevel = 1; spellLevel <= row.length; spellLevel++) {
    const max = Number(row[spellLevel - 1]) || 0;
    if (max <= 0) continue;
    const members = spellsByLevel[spellLevel] ?? [];
    const value = members.reduce((sum, p) => sum + (p.system.poolCommittedSum ?? 0), 0);
    pools.push({
      id: `pool-${spellSlotsName}-${spellLevel}`.slugify(),
      name: spellSlotsName,
      level: spellLevel,
      value,
      max,
      warning: null,
    });
  }
  return null;
}

/**
 * Build derived resource pools for an actor.
 * Sets actor.system.resourcePools = array of:
 *   { id, name, level, value, max, warning }
 * @param {Actor} actor
 */
export function deriveResourcePools(actor) {
  const rollData = actor.getRollData();
  const pools = [];
  const spellSlotsName = WWN.SPELL_SLOTS_POOL_NAME;

  const powers = actor.items.filter(
    (i) => i.type === "power" && i.system.usesSharedPool && i.system.effectiveCommitmentOptions?.length
  );
  const classEdges = actor.items.filter((i) => i.type === "classEdge");
  const consumed = { pool: new Set(), slot: new Set() };
  const hasLeveledSlots = getActorSpellSlotMode(actor) === "leveled";
  const hasUnleveledSlots = classEdges.some(
    (ce) => ce.system.slotGrant && !ce.system.slotGrant.enabled && (ce.system.slotGrant.progression?.length ?? 0) > 0
  );
  const spellSlotsFromGrant = hasLeveledSlots || hasUnleveledSlots;

  /* ---- Named pool groups (effort-style) ----
   * Build from ClassEdge poolGrants. Powers with generic resourceName "Effort"
   * resolve onto "{source} Effort" (e.g. Vowed → Vowed Effort) so we never
   * invent a phantom Effort 0/0 pool beside the real grant.
   */
  const namedPowers = powers.filter(
    (p) => p.system.subType !== "spell" || !spellSlotsFromGrant
  );

  for (const edge of classEdges) {
    if (!poolGrantActive(edge)) continue;
    const grantName = String(edge.system.poolGrant?.name ?? "").trim();
    if (!grantName) continue;

    const members = namedPowers.filter(
      (p) =>
        findPoolGrantEdge(actor, {
          resourceName: p.system.resourceName,
          source: p.system.source,
        })?.id === edge.id
    );
    const value = members.reduce((sum, p) => sum + (p.system.poolCommittedSum ?? 0), 0);
    const result = poolGrantMax(edge, rollData);
    pools.push({
      id: `pool-${grantName}`.slugify(),
      name: grantName,
      level: null,
      value,
      max: result.max,
      warning: result.valid ? null : "WWN.Pools.WarnInvalidFormula",
    });
    consumed.pool.add(edge.id);
  }

  /* ---- Leveled Spell Slots (all tiers with max > 0, not only levels with spells) ---- */
  if (hasLeveledSlots) {
    const slotEdge = classEdges.find(
      (ce) => ce.system.slotGrant?.enabled && (ce.system.slotGrant?.leveledProgression?.length ?? 0) > 0
    );
    const spellsByLevel = Object.groupBy(
      powers.filter((p) => p.system.subType === "spell"),
      (p) => p.system.level ?? 1
    );
    if (slotEdge) {
      consumed.slot.add(slotEdge.id);
      pushLeveledSlotPools(slotEdge, rollData, spellsByLevel, pools, spellSlotsName);
      // Empty leveledProgression: do not push a placeholder Spell Slots row.
    } else {
      const leveledSpells = powers.filter((p) => p.system.subType === "spell");
      if (leveledSpells.length) {
        for (const [lvl, members] of Object.entries(
          Object.groupBy(leveledSpells, (p) => p.system.level ?? 1)
        )) {
          pools.push({
            id: `pool-${spellSlotsName}-${lvl}`.slugify(),
            name: spellSlotsName,
            level: Number(lvl),
            value: members.reduce((sum, p) => sum + (p.system.poolCommittedSum ?? 0), 0),
            max: 0,
            warning: "WWN.Pools.WarnNoClassEdge",
          });
        }
      }
    }
    pools.sort((a, b) => {
      const byName = (a.name ?? "").localeCompare(b.name ?? "");
      if (byName) return byName;
      return (a.level ?? 0) - (b.level ?? 0);
    });
  }

  /* ---- Unleveled Spell Slots (single Spell Slots pool) ---- */
  const castProgression = resolveCastProgression(classEdges);
  const useUnleveledCast = hasUnleveledSlots || (castProgression?.length > 0);
  const unleveledSpells = powers.filter(
    (p) => p.system.subType === "spell" && useUnleveledCast && !hasLeveledSlots
  );
  if (unleveledSpells.length || (castProgression?.length && !hasLeveledSlots)) {
    const slotEdge = classEdges.find(
      (ce) => !ce.system.slotGrant?.enabled && (ce.system.slotGrant?.progression?.length ?? 0) > 0
    );
    if (slotEdge) consumed.slot.add(slotEdge.id);
    // Mark all unleveled cast edges consumed when dual table overrides.
    if (castProgression) {
      for (const ce of classEdges) {
        if (!ce.system.slotGrant?.enabled && (ce.system.slotGrant?.progression?.length ?? 0) > 0) {
          consumed.slot.add(ce.id);
        }
      }
    }
    const value = unleveledSpells.reduce((sum, p) => sum + (p.system.poolCommittedSum ?? 0), 0);
    let max = 0;
    let warning = null;
    if (castProgression?.length) {
      max = progressionAtLevel(castProgression, characterLevel(rollData));
    } else if (slotEdge) {
      const result = slotGrantMax(slotEdge, rollData);
      max = result.max;
      if (!result.valid) warning = "WWN.Pools.WarnInvalidFormula";
    } else {
      warning = "WWN.Pools.WarnNoClassEdge";
    }
    pools.push({
      id: `pool-${spellSlotsName}`.slugify(),
      name: spellSlotsName,
      level: null,
      value,
      max,
      warning,
    });
  }

  /* ---- Standalone grants (no matching powers yet) ---- */
  for (const edge of classEdges) {
    if (!consumed.pool.has(edge.id) && poolGrantActive(edge)) {
      const grant = edge.system.poolGrant;
      const name = grant.name?.trim() || "";
      const result = poolGrantMax(edge, rollData);
      pools.push({
        id: `pool-edge-pool-${edge.id}`,
        name,
        level: null,
        value: 0,
        max: result.max,
        warning: result.valid ? null : "WWN.Pools.WarnInvalidFormula",
      });
      consumed.pool.add(edge.id);
    }

    if (!consumed.slot.has(edge.id) && slotGrantActive(edge)) {
      const slot = edge.system.slotGrant;
      if (slot.enabled) {
        pushLeveledSlotPools(edge, rollData, {}, pools, spellSlotsName);
      } else {
        const result = slotGrantMax(edge, rollData);
        pools.push({
          id: `pool-edge-slot-${edge.id}`,
          name: spellSlotsName,
          level: null,
          value: 0,
          max: result.max,
          warning: result.valid ? null : "WWN.Pools.WarnInvalidFormula",
        });
      }
      consumed.slot.add(edge.id);
    }
  }

  applyFocusResourceGrants(actor, pools);
  actor.system.resourcePools = pools;
}
