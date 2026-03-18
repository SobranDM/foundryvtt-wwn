/**
 * Ship-specific actor logic (prepareData and compute methods).
 */
import * as creature from "./creature.mjs";
import { computeTreasure, computeTotalSP } from "./character.mjs";

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeEncumbranceShip(actor) {
  if (actor.type !== "ship") return;
  const data = actor.system;
  const ratio = Number(game.settings.get("wwn", "itemToCargoRatio"));
  let totalCargo = 0;
  let totalWeapons = 0;
  const weapons = actor.items.filter((w) => w.type === "weapon");
  const armors = actor.items.filter((a) => a.type === "armor");
  const items = actor.items.filter((i) => i.type === "item");
  const fittings = actor.items.filter((f) => f.type === "fitting");
  const shipweapons = actor.items.filter((s) => s.type === "shipweapon");
  const cargos = actor.items.filter((c) => c.type === "cargo");
  const roundWeight = game.settings.get("wwn", "roundWeight");

  weapons.forEach((w) => {
    let weaponWeight = roundWeight ? Math.ceil(w.system.weight * w.system.quantity) : w.system.weight * w.system.quantity;
    if (!w.system.ship) weaponWeight = weaponWeight / ratio;
    totalCargo += weaponWeight;
    if (w.system.ship) totalWeapons += weaponWeight;
  });

  armors.forEach((a) => { totalCargo += a.system.weight / ratio; });

  items.forEach((i) => {
    let itemWeight;
    if (i.system.charges?.value || i.system.charges?.max) {
      if (i.system.charges.value <= i.system.charges.max || !i.system.charges.value) itemWeight = i.system.weight;
      else if (!i.system.charges.max) itemWeight = i.system.charges.value * i.system.weight;
      else itemWeight = (i.system.charges.value / i.system.charges.max) * i.system.weight;
    } else itemWeight = i.system.weight * i.system.quantity;
    if (!i.system.cargo) itemWeight = itemWeight / ratio;
    totalCargo += roundWeight ? Math.ceil(itemWeight) : itemWeight;
  });

  fittings.forEach((f) => { totalCargo += f.system.cargo; });
  shipweapons.forEach((s) => {
    totalCargo += s.system.weight * s.system.quantity;
    totalWeapons += s.system.weight * s.system.quantity;
  });
  cargos.forEach((c) => { totalCargo += c.system.weight * c.system.quantity; });

  const c = data.currency ?? {};
  const coinWeight = game.settings.get("wwn", "currencyTypes") === "currencybx"
    ? (c.cp + c.sp + c.ep + c.gp + c.pp) / 1000
    : (c.cp + c.sp + c.gp) / 1000;
  totalCargo += coinWeight;

  actor.system.cargo.value = totalCargo;
  actor.system.weapons.value = totalWeapons;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeTotalCargoValue(actor) {
  if (actor.type !== "ship") return;
  let newTotal = 0;
  const cargos = actor.items.filter((c) => c.type === "cargo");
  cargos.forEach((c) => { newTotal += c.system.price * c.system.quantity; });
  actor.system.cargo.monetaryvalue = newTotal;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeCrewStrength(actor) {
  if (actor.type !== "ship") return;
  let totalStrength = 0;
  let pcStrength = 0;
  const crew = actor.items.filter((c) => c.type === "crewmember");
  crew.forEach((c) => {
    totalStrength += c.system.strength * c.system.quantity;
    if (c.system.ispc) pcStrength += c.system.strength * c.system.quantity;
  });
  actor.system.details.crew.totalstrength = totalStrength;
  actor.system.details.crew.pcstrength = pcStrength;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeCrewCost(actor) {
  if (actor.type !== "ship") return;
  let totalCost = 0;
  const crew = actor.items.filter((c) => c.type === "crewmember");
  crew.forEach((c) => { totalCost += c.system.cost * c.system.quantity; });
  actor.system.details.crew.totalcost = totalCost;
}

/**
 * Run prepareData for ship.
 * @param {import("../../entity.js").WwnActor} actor
 */
export function prepare(actor) {
  if (actor.type !== "ship") return;
  computeEncumbranceShip(actor);
  computeTreasure(actor);
  computeTotalSP(actor);
  computeTotalCargoValue(actor);
  creature.computeInit(actor);
  computeCrewStrength(actor);
  computeCrewCost(actor);
}
