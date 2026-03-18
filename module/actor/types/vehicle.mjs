/**
 * Vehicle-specific actor logic (prepareData).
 */
import { computeTreasure } from "./character.mjs";

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeEncumbranceVehicle(actor) {
  if (actor.type !== "vehicle") return;
  const encMax = actor.system.encumbranceMax;
  if (encMax == null || encMax === "") {
    actor.system.encumbrance = { value: 0, max: null };
    return;
  }
  let total = 0;
  const roundWeight = game.settings.get("wwn", "roundWeight");
  const weapons = actor.items.filter((w) => w.type === "weapon");
  const armors = actor.items.filter((a) => a.type === "armor");
  const items = actor.items.filter((i) => i.type === "item");

  weapons.forEach((w) => {
    const wgt = w.system.weight * w.system.quantity;
    total += roundWeight ? Math.ceil(wgt) : wgt;
  });
  armors.forEach((a) => {
    total += roundWeight ? Math.ceil(a.system.weight) : a.system.weight;
  });
  items.forEach((i) => {
    let itemWeight;
    if (i.system.charges?.value || i.system.charges?.max) {
      if (i.system.charges.value <= i.system.charges.max || !i.system.charges.value) itemWeight = i.system.weight;
      else if (!i.system.charges.max) itemWeight = i.system.charges.value * i.system.weight;
      else itemWeight = (i.system.charges.value / i.system.charges.max) * i.system.weight;
    } else itemWeight = i.system.weight * i.system.quantity;
    total += roundWeight ? Math.ceil(itemWeight) : itemWeight;
  });

  const data = actor.system;
  if (data.currency && !game.settings.get("wwn", "disableCoinWeight")) {
    const c = data.currency;
    const coinWeight = game.settings.get("wwn", "currencyTypes") === "currencybx"
      ? (c.cp + c.sp + c.ep + c.gp + c.pp) / 100
      : (c.cp + c.sp + c.gp) / 100;
    total += coinWeight;
  }

  const max = Number(encMax);
  actor.system.encumbrance = {
    value: Number(total.toFixed(2)),
    max: Number.isNaN(max) ? null : max,
  };
}

/**
 * Run prepareData for vehicle.
 * @param {import("../../entity.js").WwnActor} actor
 */
export function prepare(actor) {
  if (actor.type !== "vehicle") return;
  computeEncumbranceVehicle(actor);
  computeTreasure(actor);
}
