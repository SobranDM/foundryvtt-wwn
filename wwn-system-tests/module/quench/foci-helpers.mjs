/**
 * Pack-backed helpers for WWN foci / arts Quench batches.
 */
import {
  createTestActor,
  importCompendiumItem,
  packAvailable,
  settle,
  wwnImport,
} from "./helpers.mjs";

export const ABILITIES_PACK = "wwn.abilities-wwn";
export const GEAR_PACK = "wwn.gear";

const BASE_ABILITIES = {
  str: { value: 10 },
  dex: { value: 10 },
  con: { value: 10 },
  int: { value: 10 },
  wis: { value: 10 },
  cha: { value: 10 },
};

export function skipIfNoAbilitiesPack(mochaCtx) {
  if (!packAvailable(ABILITIES_PACK)) mochaCtx.skip();
}

export async function createFociTestPc({
  label = "foci-pc",
  level = 1,
  skills = { stab: 1, shoot: 1, punch: 1 },
} = {}) {
  const actor = await createTestActor(
    "character",
    label,
    {
      system: {
        details: { level },
        hp: { value: 20, max: 20 },
        abilities: BASE_ABILITIES,
      },
    },
    { wwnSkipSeeding: true },
  );
  const skillDocs = Object.entries(skills).map(([slug, ownedLevel]) => ({
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    type: "skill",
    system: {
      slug,
      ownedLevel,
      pointsInvested: 0,
      skillDice: "2d6",
      score: slug === "shoot" || slug === "punch" ? "dex" : "str",
    },
  }));
  if (skillDocs.length) await actor.createEmbeddedDocuments("Item", skillDocs);
  await settle();
  return actor;
}

export async function embedPackItem(actor, name, { collection = ABILITIES_PACK, type } = {}) {
  const src = await importCompendiumItem(collection, { nameEquals: name, type });
  if (!src) throw new Error(`Missing pack item "${name}" in ${collection}`);
  const data = src.toObject();
  delete data._id;
  delete data.folder;
  const [created] = await actor.createEmbeddedDocuments("Item", [data], { wwnMigrating: true });
  await settle();
  return created;
}

export async function setFocusOwnedLevel(focus, ownedLevel) {
  const { syncFocusTransferEffects } = await wwnImport("/systems/wwn/module/helpers/focus-effects.mjs");
  await focus.update({ "system.ownedLevel": ownedLevel });
  await syncFocusTransferEffects(focus);
  await settle();
  focus.actor?.prepareData();
}

export async function enableItemEffectByName(item, nameIncludes) {
  const effect = item.effects.find((e) => String(e.name).includes(nameIncludes));
  if (!effect) throw new Error(`No effect on ${item.name} matching "${nameIncludes}"`);
  await effect.update({ disabled: false });
  await settle();
  item.actor?.prepareData();
  return effect;
}

export async function createShockSword(actor, extra = {}) {
  const [weapon] = await actor.createEmbeddedDocuments("Item", [
    {
      name: "Quench Shock Sword",
      type: "weapon",
      system: foundry.utils.mergeObject(
        {
          damage: "1d8",
          shock: { damage: "2", ac: 15 },
          melee: true,
          missile: false,
          ammoMode: "none",
          score: "str",
          skillFallback: "Stab",
          tl: 0,
        },
        extra,
        { inplace: false },
      ),
    },
  ]);
  await settle();
  return weapon;
}

export async function createLightSpear(actor) {
  const [weapon] = await actor.createEmbeddedDocuments("Item", [
    {
      name: "Spear, Light",
      type: "weapon",
      system: {
        damage: "1d6",
        shock: { damage: "2", ac: 13 },
        melee: true,
        missile: true,
        tags: ["T"],
        ammoMode: "none",
        score: "dex",
        skillFallback: "Stab",
        tl: 0,
      },
    },
  ]);
  await settle();
  return weapon;
}

export async function createBow(actor) {
  const [weapon] = await actor.createEmbeddedDocuments("Item", [
    {
      name: "Quench Bow",
      type: "weapon",
      system: {
        damage: "1d8",
        shock: { damage: "", ac: 15 },
        melee: false,
        missile: true,
        ammoMode: "none",
        score: "dex",
        skillFallback: "Shoot",
        tl: 0,
      },
    },
  ]);
  await settle();
  return weapon;
}

export async function createUnarmedAttack(actor) {
  const [weapon] = await actor.createEmbeddedDocuments("Item", [
    {
      name: "Unarmed Attack",
      type: "weapon",
      system: {
        damage: "1d2",
        shock: { damage: "", ac: 15 },
        melee: true,
        missile: false,
        ammoMode: "none",
        score: "str",
        skillFallback: "Punch",
        tl: 0,
      },
    },
  ]);
  await settle();
  return weapon;
}

export function partValues(parts) {
  return (parts?.parts ?? []).map((p) => p.value);
}

export function hasPartValue(parts, value) {
  return partValues(parts).some((v) => v === value);
}

export async function refreshInnateAc(actor) {
  const { deriveAC } = await wwnImport("/systems/wwn/module/derivations/ac.mjs");
  actor.prepareData();
  deriveAC(actor);
}
