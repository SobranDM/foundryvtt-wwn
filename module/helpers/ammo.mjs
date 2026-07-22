/**
 * Weapon ammo / magazine helpers.
 * Pure helpers take plain system-like objects for unit tests; document wrappers update Foundry items.
 */

export const AMMO_MODES = Object.freeze({
  none: "none",
  linked: "linked",
  magazine: "magazine",
});

/**
 * Whether this ammo item stores count in charges (vs quantity).
 * @param {object} ammoSystem
 * @returns {boolean}
 */
export function usesChargeStack(ammoSystem) {
  return (Number(ammoSystem?.charges?.max) || 0) > 0;
}

/**
 * @param {object} ammoSystem  Gear system data
 * @returns {number}
 */
export function availableAmmoCount(ammoSystem) {
  if (!ammoSystem) return 0;
  if (usesChargeStack(ammoSystem)) return Number(ammoSystem.charges?.value) || 0;
  return Number(ammoSystem.quantity) || 0;
}

/**
 * Resolve magazine capacity (AE-aware).
 * @param {object} weaponSystem
 * @returns {number}
 */
export function magazineMax(weaponSystem) {
  if (!weaponSystem?.charges) return 0;
  if (weaponSystem.charges.maxValue != null) return Number(weaponSystem.charges.maxValue) || 0;
  return (Number(weaponSystem.charges.max) || 0) + (Number(weaponSystem.charges.maxMod) || 0);
}

/**
 * Resolve linked ammo from actor items.
 * @param {Iterable} items
 * @param {{ ammoId?: string, ammoFallback?: string }} link
 * @returns {object|null}
 */
export function resolveLinkedAmmo(items, { ammoId = "", ammoFallback = "" } = {}) {
  const list = [...(items ?? [])];
  if (ammoId) {
    const byId = list.find((i) => i.id === ammoId || i._id === ammoId);
    if (byId) return byId;
  }
  const fallback = (ammoFallback ?? "").trim().toLowerCase();
  if (!fallback) return null;
  return (
    list.find(
      (i) =>
        i.type === "item" &&
        String(i.name ?? "")
          .toLowerCase()
          .includes(fallback)
    ) ?? null
  );
}

/**
 * Compute spend result without mutating.
 * @returns {{ ok: boolean, reason?: string, cost: number, path?: string, updates?: object[] }}
 */
export function planAttackAmmoSpend(weaponSystem, linkedAmmo, { burst = false } = {}) {
  const cost = burst ? 3 : 1;
  const mode = weaponSystem?.ammoMode ?? AMMO_MODES.none;

  if (mode === AMMO_MODES.none) {
    return { ok: true, cost: 0, path: "none" };
  }

  if (mode === AMMO_MODES.magazine) {
    const value = Number(weaponSystem.charges?.value) || 0;
    if (value < cost) return { ok: false, reason: "charges", cost };
    return {
      ok: true,
      cost,
      path: "magazine",
      updates: [{ target: "weapon", data: { "system.charges.value": value - cost } }],
    };
  }

  if (mode === AMMO_MODES.linked) {
    if (!linkedAmmo) return { ok: false, reason: "ammo", cost };
    const available = availableAmmoCount(linkedAmmo.system);
    if (available < cost) return { ok: false, reason: "ammo", cost };
    if (usesChargeStack(linkedAmmo.system)) {
      return {
        ok: true,
        cost,
        path: "linked-charges",
        updates: [{
          target: "ammo",
          id: linkedAmmo.id ?? linkedAmmo._id,
          data: { "system.charges.value": available - cost },
        }],
      };
    }
    return {
      ok: true,
      cost,
      path: "linked-quantity",
      updates: [{
        target: "ammo",
        id: linkedAmmo.id ?? linkedAmmo._id,
        data: { "system.quantity": available - cost },
      }],
    };
  }

  return { ok: true, cost: 0, path: "none" };
}

/**
 * Plan magazine reload from linked ammo.
 */
export function planReload(weaponSystem, linkedAmmo) {
  const mode = weaponSystem?.ammoMode ?? AMMO_MODES.none;
  if (mode !== AMMO_MODES.magazine) {
    return { ok: false, reason: "mode" };
  }

  const current = Number(weaponSystem.charges?.value) || 0;
  const max = magazineMax(weaponSystem);
  const needed = max - current;
  if (needed <= 0) return { ok: false, reason: "full" };
  if (!linkedAmmo) return { ok: false, reason: "ammo" };

  const available = availableAmmoCount(linkedAmmo.system);
  if (available <= 0) return { ok: false, reason: "empty" };

  const transferred = Math.min(needed, available);
  const ammoUpdate = usesChargeStack(linkedAmmo.system)
    ? { "system.charges.value": available - transferred }
    : { "system.quantity": available - transferred };

  return {
    ok: true,
    transferred,
    partial: transferred < needed,
    newWeaponCharges: current + transferred,
    max,
    updates: [
      { target: "weapon", data: { "system.charges.value": current + transferred } },
      {
        target: "ammo",
        id: linkedAmmo.id ?? linkedAmmo._id,
        data: ammoUpdate,
      },
    ],
  };
}

/**
 * Plan gear expend-on-use.
 */
export function planExpendGear(gearSystem, cost = 1) {
  if (!gearSystem?.expendOnUse) return { ok: true, skipped: true };
  if (usesChargeStack(gearSystem)) {
    const value = Number(gearSystem.charges?.value) || 0;
    if (value < cost) return { ok: false, reason: "charges" };
    return {
      ok: true,
      updates: [{ data: { "system.charges.value": value - cost } }],
    };
  }
  const qty = Number(gearSystem.quantity) || 0;
  if (qty < cost) return { ok: false, reason: "quantity" };
  return {
    ok: true,
    updates: [{ data: { "system.quantity": qty - cost } }],
  };
}

/**
 * Map legacy weapon system fields to ammoMode / ammoFallback.
 * @param {object} s
 */
export function mapWeaponAmmoMigration(s = {}) {
  const legacyAmmo = typeof s.ammo === "string" ? s.ammo : "";
  const ammoId = s.ammoId ?? "";
  const ammoFallback = (s.ammoFallback ?? legacyAmmo ?? "").trim();
  const decrement = !!s.charges?.decrementOnAttack;

  let ammoMode = s.ammoMode;
  if (!ammoMode || !Object.values(AMMO_MODES).includes(ammoMode)) {
    if (decrement) ammoMode = AMMO_MODES.magazine;
    else if (ammoId || ammoFallback) ammoMode = AMMO_MODES.linked;
    else ammoMode = AMMO_MODES.none;
  }

  return {
    ammoMode,
    ammoId: ammoId || "",
    ammoFallback,
    charges: {
      value: Number(s.charges?.value) || 0,
      max: Number(s.charges?.max) || 0,
    },
  };
}

/* -------------------------------------------- */
/*  Document wrappers                           */
/* -------------------------------------------- */

export async function spendAttackAmmo(weapon, { burst = false } = {}) {
  const actor = weapon.actor;
  if (!actor) return true;
  const linked = resolveLinkedAmmo(actor.items, {
    ammoId: weapon.system.ammoId,
    ammoFallback: weapon.system.ammoFallback,
  });
  const plan = planAttackAmmoSpend(weapon.system, linked, { burst });
  if (!plan.ok) {
    const key = plan.reason === "charges" ? "WWN.Roll.NoCharges" : "WWN.Roll.NoAmmo";
    ui.notifications.warn(game.i18n.localize(key));
    return false;
  }
  for (const u of plan.updates ?? []) {
    if (u.target === "weapon") await weapon.update(u.data);
    else if (u.target === "ammo" && linked) await linked.update(u.data);
  }
  return true;
}

export async function reloadWeapon(weapon) {
  const actor = weapon.actor;
  if (!actor) return false;
  if ((weapon.system.ammoMode ?? AMMO_MODES.none) !== AMMO_MODES.magazine) {
    ui.notifications.warn(game.i18n.localize("WWN.Weapon.ReloadNotMagazine"));
    return false;
  }
  const linked = resolveLinkedAmmo(actor.items, {
    ammoId: weapon.system.ammoId,
    ammoFallback: weapon.system.ammoFallback,
  });
  const plan = planReload(weapon.system, linked);
  if (!plan.ok) {
    if (plan.reason === "full") {
      ui.notifications.info(`${weapon.name} is already fully loaded.`);
    } else if (plan.reason === "ammo" || plan.reason === "empty") {
      ui.notifications.error(game.i18n.localize("WWN.Roll.NoAmmo"));
    }
    return false;
  }
  await weapon.update(plan.updates[0].data);
  if (linked && plan.updates[1]) await linked.update(plan.updates[1].data);

  const content = plan.partial
    ? `${actor.name} partially reloaded ${weapon.name} (${plan.newWeaponCharges}/${plan.max}).`
    : `${actor.name} reloaded ${weapon.name}.`;
  await ChatMessage.create({
    user: game.user.id,
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
  });
  return true;
}

export async function expendGear(item, cost = 1) {
  if (item.type !== "item") return true;
  const plan = planExpendGear(item.system, cost);
  if (plan.skipped) return true;
  if (!plan.ok) {
    ui.notifications.warn(game.i18n.localize("WWN.Roll.NoCharges"));
    return false;
  }
  for (const u of plan.updates ?? []) await item.update(u.data);
  return true;
}
