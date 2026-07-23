/**
 * Powers tab sheet data: subtype sections, column flags, pool column layout.
 */
import {
  getPowerSheetVisibility,
  resolveCommitmentOptions,
  usesSharedPool,
  hasActiveCommitment,
} from "../config/power-subtypes.mjs";
import { WWN } from "../config/index.mjs";
import { isPc } from "./actor-types.mjs";

function poolSortKey(pool) {
  const level = pool.level ?? 0;
  return `${pool.name ?? ""}\0${String(level).padStart(3, "0")}`;
}

function slugify(value) {
  if (typeof value?.slugify === "function") return value.slugify();
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function groupBy(items, keyFn) {
  const groups = {};
  for (const item of items) {
    const key = keyFn(item);
    (groups[key] ??= []).push(item);
  }
  return groups;
}

/**
 * Split derived pools into two display columns.
 * Non–spell-slot pools sort alphabetically and fill column 1, then wrap to column 2.
 * Spell slot pools always appear at the end of column 2.
 * @param {Array<object>} pools
 * @returns {{ column1: object[], column2: object[] }}
 */
export function layoutResourcePoolColumns(pools) {
  const spellName = WWN.SPELL_SLOTS_POOL_NAME;
  const list = pools ?? [];
  const spellPools = list
    .filter((p) => p.name === spellName)
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const otherPools = list
    .filter((p) => p.name !== spellName)
    .sort((a, b) => poolSortKey(a).localeCompare(poolSortKey(b), undefined, { sensitivity: "base" }));

  const split = Math.ceil(otherPools.length / 2);
  return {
    column1: otherPools.slice(0, split),
    column2: [...otherPools.slice(split), ...spellPools],
  };
}

/**
 * Column visibility for a Powers tab subtype section (header + row alignment).
 * @param {string} subType
 * @param {Item[]} powers
 */
export function buildPowerSectionColumns(subType, powers) {
  const showUnion = {};
  for (const power of powers) {
    const { show } = getPowerSheetVisibility(power.system.subType, power.system);
    for (const [key, visible] of Object.entries(show)) {
      if (visible) showUnion[key] = true;
    }
  }
  return {
    showLevel: !!showUnion.level,
    showSource: !!showUnion.source,
    showPrepared: subType === "spell",
    showInstalled: subType === "cyberware",
    showCommitment: powers.some(
      (p) => resolveCommitmentOptions(p.system.subType, p.system).some((o) => o.cost > 0)
    ),
    showPoolCommitted: powers.some((p) => usesSharedPool(p.system.subType, p.system)),
    showUses: powers.some((p) => (p.system.internalResource?.max ?? 0) > 0),
    showStatus: powers.some(
      (p) => p.system.isActive || hasActiveCommitment(p.system.subType, p.system)
    ),
    showDamage: powers.some((p) => !!p.system.damageRoll),
  };
}

/**
 * Annotate power items with sheet-row helpers (activate/deactivate, level column).
 * @param {Item[]} powers
 */
export function annotatePowerRows(powers) {
  return powers.map((item) => {
    if (item.type !== "power") return item;
    const subType = item.system.subType;
    return {
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
      system: item.system,
      canActivatePower: hasActiveCommitment(subType, item.system) && !item.system.isActive,
      canDeactivatePower: !!item.system.isActive,
      tabShowLevel: getPowerSheetVisibility(subType, item.system).show.level,
    };
  });
}

/**
 * Build presence-driven power subtype sections for the Powers tab.
 * @param {Item[]} powers
 * @param {object} [options]
 * @param {(id: string) => boolean} [options.isSectionCollapsed]
 * @param {(key: string) => string} [options.localize]
 * @returns {object[]}
 */
export function buildPowerSections(powers, { isSectionCollapsed, localize } = {}) {
  const loc = localize ?? ((key) => (typeof game !== "undefined" ? game.i18n.localize(key) : key));
  const collapsed = isSectionCollapsed ?? (() => false);
  const sectionOrder = WWN.powerSectionOrder ?? [];
  const powerSubtypes = WWN.powerSubtypes ?? {};
  const sections = [];

  for (const subType of sectionOrder) {
    if (subType === "custom") {
      const customs = powers.filter((p) => p.system.subType === "custom");
      if (!customs.length) continue;
      const groups = groupBy(customs, (p) => {
        const name = (p.system.customTypeName ?? "").trim();
        return name || "__uncategorized__";
      });
      for (const [groupKey, members] of Object.entries(groups)) {
        members.sort(
          (a, b) => (a.system.level ?? 0) - (b.system.level ?? 0) || a.name.localeCompare(b.name)
        );
        const annotated = annotatePowerRows(members);
        const sectionId = `powers.custom.${slugify(groupKey)}`;
        sections.push({
          id: sectionId,
          subType: "custom",
          label: groupKey === "__uncategorized__" ? "WWN.Power.UncategorizedCustom" : groupKey,
          displayLabel:
            groupKey === "__uncategorized__"
              ? loc("WWN.Power.UncategorizedCustom")
              : groupKey,
          powers: annotated,
          columns: buildPowerSectionColumns("custom", members),
          collapsed: collapsed(sectionId),
        });
      }
      continue;
    }

    const members = powers.filter((p) => p.system.subType === subType);
    if (!members.length) continue;
    members.sort(
      (a, b) => (a.system.level ?? 0) - (b.system.level ?? 0) || a.name.localeCompare(b.name)
    );
    const annotated = annotatePowerRows(members);
    const sectionId = `powers.${subType}`;
    const labelKey = powerSubtypes[subType]?.label ?? subType;
    sections.push({
      id: sectionId,
      subType,
      label: labelKey,
      displayLabel: loc(labelKey),
      powers: annotated,
      columns: buildPowerSectionColumns(subType, members),
      collapsed: collapsed(sectionId),
    });
  }

  return sections;
}

/**
 * Attach Powers-tab context fields onto sheet data.
 * @param {object} data  Sheet getData() object
 * @param {Actor} actor
 * @param {object} [options]
 * @param {(id: string) => boolean} [options.isSectionCollapsed]
 */
export function preparePowersTabContext(data, actor, { isSectionCollapsed } = {}) {
  const items = Array.from(actor.items.values()).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const powers = items.filter((i) => i.type === "power");
  const classEdges = items.filter((i) => i.type === "classEdge");
  const foci = items.filter((i) => i.type === "focus");

  data.powerSections = buildPowerSections(powers, { isSectionCollapsed });
  data.classEdges = classEdges
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((edge) => ({
      id: edge.id,
      name: edge.name,
      img: edge.img,
      type: edge.type,
      system: edge.system,
      edgeTypeLabel:
        edge.system?.edgeType === "edge" ? "WWN.ClassEdge.edge" : "WWN.ClassEdge.class",
    }));
  data.foci = foci.slice().sort((a, b) => a.name.localeCompare(b.name));
  data.resourcePools = actor.system.resourcePools ?? [];
  data.resourcePoolColumns = layoutResourcePoolColumns(data.resourcePools);
  data.hasSpellPowers = powers.some((p) => p.system.subType === "spell");
  // WWN PC document type is "pc"
  data.showPreparedCounter = isPc(actor) && data.hasSpellPowers;
  // Monsters omit empty Class/Edge and Foci chrome; PCs always show create affordances.
  data.showClassEdgesSection = isPc(actor) || data.classEdges.length > 0;
  data.showFociSection = isPc(actor) || data.foci.length > 0;
  if (data.showPreparedCounter) {
    const prepared = actor.system.casting?.prepared ?? {};
    data.preparedOverMax = (prepared.value ?? 0) > (prepared.max ?? 0);
  }
  data.hasPowersContent =
    data.powerSections.length > 0 ||
    data.classEdges.length > 0 ||
    data.foci.length > 0 ||
    data.resourcePools.length > 0;
}
