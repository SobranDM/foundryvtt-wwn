/**
 * Shared Quench document factories for WWN system tests.
 */
import { createTestActor, settle, wwnImport } from "./helpers.mjs";

/**
 * Character with a single-mode melee weapon (no attack dialog) and optional armor.
 * @param {object} [opts]
 * @returns {Promise<{ actor: Actor, weapon: Item, armor: Item|null }>}
 */
export async function createArmedCharacter({
  label = "armed",
  actorSystem = {},
  weaponSystem = {},
  armorSystem = null,
  options = {},
} = {}) {
  const actor = await createTestActor(
    "character",
    label,
    {
      system: foundry.utils.mergeObject(
        {
          hp: { value: 20, max: 20 },
          abilities: {
            str: { value: 10 },
            dex: { value: 10 },
            con: { value: 10 },
            int: { value: 10 },
            wis: { value: 10 },
            cha: { value: 10 },
          },
        },
        actorSystem,
        { inplace: false },
      ),
    },
    { wwnSkipSeeding: true, ...options },
  );

  const [weapon] = await actor.createEmbeddedDocuments("Item", [
    {
      name: `Quench Sword ${foundry.utils.randomID(4)}`,
      type: "weapon",
      system: foundry.utils.mergeObject(
        {
          damage: "1d8",
          melee: true,
          missile: false,
          ammoMode: "none",
          score: "str",
          tl: 0,
        },
        weaponSystem,
        { inplace: false },
      ),
    },
  ]);

  let armor = null;
  if (armorSystem !== null) {
    [armor] = await actor.createEmbeddedDocuments("Item", [
      {
        name: `Quench Armor ${foundry.utils.randomID(4)}`,
        type: "armor",
        system: foundry.utils.mergeObject(
          {
            equipped: true,
            stowed: false,
            type: "heavy",
            ac: 16,
            soak: 2,
            weight: 2,
            tl: 0,
          },
          armorSystem,
          { inplace: false },
        ),
      },
    ]);
  }

  await settle();
  return { actor, weapon, armor };
}

/**
 * Monster with known HP/AC for attack and damage tests.
 * @param {object} [opts]
 * @returns {Promise<Actor>}
 */
export async function createTargetMonster({
  label = "target",
  hp = 20,
  ac = 10,
  system = {},
} = {}) {
  const actor = await createTestActor("monster", label, {
    system: foundry.utils.mergeObject(
      {
        hp: { value: hp, max: hp },
        hd: "2d8",
        combat: {
          ab: 0,
          acManual: { melee: ac, ranged: ac },
        },
      },
      system,
      { inplace: false },
    ),
  });
  await settle();
  return actor;
}

/**
 * Power armor linked to a pilot character.
 * @param {object} [opts]
 * @returns {Promise<{ armor: Actor, pilot: Actor }>}
 */
export async function createPilotedPowerArmor({
  label = "pa",
  pilotLabel = "pilot",
  pilotSystem = {},
  armorSystem = {},
} = {}) {
  const pilot = await createTestActor(
    "character",
    pilotLabel,
    {
      system: foundry.utils.mergeObject(
        { hp: { value: 12, max: 12 } },
        pilotSystem,
        { inplace: false },
      ),
    },
    { wwnSkipSeeding: true },
  );
  const armor = await createTestActor("powerArmor", label, {
    system: foundry.utils.mergeObject(
      {
        soak: { value: 5, max: 5 },
        viHp: { value: 15, max: 15 },
        mass: { max: 10 },
        power: { max: 10 },
        powered: true,
        pilot: { actor: pilot.uuid },
        trainedPilots: [pilot.uuid],
      },
      armorSystem,
      { inplace: false },
    ),
  });
  await settle();
  return { armor, pilot };
}

/**
 * Starship with an optional captain crew character assigned.
 * @param {object} [opts]
 * @returns {Promise<{ ship: Actor, crew: Actor|null }>}
 */
export async function createCrewedStarship({
  label = "ship",
  crewLabel = "crew",
  withCaptain = true,
  hullType = "freeMerchant",
  shipSystem = {},
} = {}) {
  const { applyHullPreset } = await wwnImport("/systems/wwn/module/config/starship-hulls.mjs");
  const { buildStationAssignmentUpdate } = await wwnImport(
    "/systems/wwn/module/helpers/starship-crew.mjs",
  );

  let crew = null;
  if (withCaptain) {
    crew = await createTestActor("character", crewLabel, {}, { wwnSkipSeeding: true });
  }
  const ship = await createTestActor("starship", label, {
    system: foundry.utils.mergeObject({}, shipSystem, { inplace: false }),
  });
  const hullUpdate = applyHullPreset(hullType);
  await ship.update(hullUpdate);
  if (crew) {
    const stationUpdate = buildStationAssignmentUpdate(ship.system.stations, "captain", crew.uuid, {
      exclusive: true,
    });
    await ship.update(stationUpdate);
  }
  await settle();
  return { ship, crew };
}
