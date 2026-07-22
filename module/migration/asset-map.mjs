/**
 * Remap legacy asset paths under systems/wwn/assets/ to the current icons layout.
 * Shared by world migration (transforms.mjs).
 *
 * Assets live under assets/icons/{items,powers,skills,tags,misc} —
 * deduplicated from the older scattered root/default/new/skills layout.
 */

const WWN_ASSET_PREFIX = "systems/wwn/assets/";

/** Relative path (after systems/wwn/assets/) -> current relative path. */
const MAP = {
  /* default/ — item type icons */
  "default/ability.png": "icons/items/ability.png",
  "default/armor.png": "icons/items/armor.png",
  "default/art.png": "icons/items/art.png",
  "default/class ability.png": "icons/items/class-ability.png",
  "default/faction.png": "icons/items/faction.png",
  "default/focus.png": "icons/items/focus.png",
  "default/item.png": "icons/items/gear.png",
  "default/origin_focus.png": "icons/items/origin-focus.png",
  "default/spell.png": "icons/items/spell.png",
  "default/weapon.png": "icons/items/weapon.png",

  /* default/ — class art/spell icons */
  "default/accursed_art.png": "icons/powers/accursed-art.png",
  "default/bard_art.png": "icons/powers/bard-art.png",
  "default/beastmaster_art.png": "icons/powers/beastmaster-art.png",
  "default/bloodPriest_art.png": "icons/powers/blood-priest-art.png",
  "default/cunning.png": "icons/factions/cunning-alt.png",
  "default/duelistArt_art.png": "icons/powers/duelist-art.png",
  "default/elementalist_art.png": "icons/powers/elementalist-art.png",
  "default/elementalist_spell.png": "icons/powers/elementalist-spell.png",
  "default/force.png": "icons/factions/force-alt.png",
  "default/healer_art.png": "icons/powers/healer-art.png",
  "default/legate_ability.png": "icons/powers/legate-ability.png",
  "default/mageslayer_art.png": "icons/powers/mageslayer-art.png",
  "default/necromancer_art.png": "icons/powers/necromancer-art.png",
  "default/necromancer_spell.png": "icons/powers/necromancer-spell.png",
  "default/skinshifter_art.png": "icons/powers/skinshifter-art.png",
  "default/thoughtNoble_art.png": "icons/powers/thought-noble-art.png",
  "default/verderer_art.png": "icons/powers/verderer-art.png",
  "default/verderer_spell.png": "icons/powers/verderer-spell.png",
  "default/vowed_art.png": "icons/powers/vowed-art.png",
  "default/wealth.png": "icons/factions/wealth-alt.png",
  "default/wise_art.png": "icons/powers/wise-art.png",

  /* new/ — byte-identical duplicates of default/, collapse to same targets */
  "new/ability.png": "icons/items/ability.png",
  "new/beastmaster_art.png": "icons/powers/beastmaster-art.png",
  "new/bloodPriest_art.png": "icons/powers/blood-priest-art.png",
  "new/duelistArt_art.png": "icons/powers/duelist-art.png",
  "new/elementalist_art.png": "icons/powers/elementalist-art.png",
  "new/elementalist_spell.png": "icons/powers/elementalist-spell.png",
  "new/healer_art.png": "icons/powers/healer-art.png",
  "new/necromancer_art.png": "icons/powers/necromancer-art.png",
  "new/necromancer_spell.png": "icons/powers/necromancer-spell.png",
  "new/skinshifter_art.png": "icons/powers/skinshifter-art.png",
  "new/thoughtNoble_art.png": "icons/powers/thought-noble-art.png",
  "new/vowed_art.png": "icons/powers/vowed-art.png",

  /* default/ — unused "backup" variants collapse to the canonical icon */
  "default/ability backup.png": "icons/items/ability.png",
  "default/armor backup.png": "icons/items/armor.png",
  "default/art backup.png": "icons/items/art.png",
  "default/item backup.png": "icons/items/gear.png",
  "default/spell backup.png": "icons/items/spell.png",
  "default/weapon backup.png": "icons/items/weapon.png",

  /* skills/ — six identical psychic icons dedupe to psychic.png */
  "skills/biopsionics.png": "icons/skills/psychic.png",
  "skills/metapsionics.png": "icons/skills/psychic.png",
  "skills/precognition.png": "icons/skills/psychic.png",
  "skills/telekinesis.png": "icons/skills/psychic.png",
  "skills/telepathy.png": "icons/skills/psychic.png",
  "skills/teleportation.png": "icons/skills/psychic.png",

  /* root — weapon tag icons */
  "armor_piercing.png": "icons/tags/armor-piercing.png",
  "blunt.png": "icons/tags/blunt.png",
  "brace.png": "icons/tags/brace.png",
  "charge.png": "icons/tags/charge.png",
  "crossbow.png": "icons/tags/crossbow.png",
  "fixed.png": "icons/tags/fixed.png",
  "less_lethal.png": "icons/tags/less-lethal.png",
  "long.png": "icons/tags/long.png",
  "melee.png": "icons/tags/melee.png",
  "missile.png": "icons/tags/missile.png",
  "numerous.png": "icons/tags/numerous.png",
  "precisely_murderous.png": "icons/tags/precisely-murderous.png",
  "reload.png": "icons/tags/reload.png",
  "single_shot.png": "icons/tags/single-shot.png",
  "slow_reload.png": "icons/tags/slow-reload.png",
  "splash.png": "icons/tags/splash.png",
  "subtle.png": "icons/tags/subtle.png",
  "throwable.png": "icons/tags/throwable.png",
  "twohanded.png": "icons/tags/two-handed.png",

  /* root — faction asset category icons (Cunning / Force / Wealth) */
  "cunning.png": "icons/factions/cunning.png",
  "force.png": "icons/factions/force.png",
  "wealth.png": "icons/factions/wealth.png",

  /* root — misc */
  "dragon.png": "icons/misc/dragon.png",
  "gold.png": "icons/misc/gold.png",
  "treasure.png": "icons/misc/treasure.png",
  // Root origin_focus.png was a near-duplicate of default's — collapse
  "origin_focus.png": "icons/items/origin-focus.png",
};

/* skills/ — straight copies share their WWN basename */
for (const s of [
  "administer", "connect", "convince", "craft", "exert", "heal", "know", "lead",
  "magic", "notice", "perform", "polymath", "pray", "punch", "ride", "sail",
  "shoot", "sneak", "stab", "survive", "trade", "work",
]) {
  MAP[`skills/${s}.png`] = `icons/skills/${s}.png`;
}

const WWN_PATH = /^\/?systems\/wwn\/assets\/(.+)$/;

/**
 * Remap a WWN asset path to its WWN equivalent. Non-WWN paths (core icons,
 * already-WWN paths, module content) pass through unchanged.
 * @param {string} path
 * @returns {string}
 */
export function remapAssetPath(path) {
  const match = WWN_PATH.exec(String(path ?? ""));
  if (!match) return path;
  let rel = match[1];
  try {
    rel = decodeURIComponent(rel);
  } catch {
    /* keep raw */
  }
  const mapped = MAP[rel];
  return mapped ? `${WWN_ASSET_PREFIX}${mapped}` : path;
}

/**
 * Remap every WWN asset reference inside arbitrary document JSON (img fields,
 * token textures, RollTable result icons, embedded HTML, ...).
 * @param {object} doc  Plain document data
 * @returns {object}
 */
export function remapAssetPathsDeep(doc) {
  const json = JSON.stringify(doc);
  const replaced = json.replace(
    /\/?systems\/wwn\/assets\/[^"\\]+/g,
    (m) => remapAssetPath(m)
  );
  return JSON.parse(replaced);
}
