/**
 * Shared Quench helpers for WWN system tests.
 * Pattern adapted from deltagreen-system-tests (no Cypress).
 */

export const QUENCH_DEFAULT_TIMEOUT_MS = 30000;

/** @param {Mocha.Context} mochaCtx @param {number} [ms] */
export function useQuenchTimeout(mochaCtx, ms = QUENCH_DEFAULT_TIMEOUT_MS) {
  if (mochaCtx && typeof mochaCtx.timeout === "function") {
    mochaCtx.timeout(ms);
  }
  return ms;
}

/**
 * @param {string} path Absolute URL under /systems/wwn/...
 * @returns {Promise<*>}
 */
export function wwnImport(path) {
  return import(/* @vite-ignore */ path);
}

/**
 * @param {string} type
 * @param {string} [label]
 * @param {object} [data] Document data merged into Actor.create payload
 * @param {object} [options] Actor.create context (e.g. `{ wwnSkipSeeding: true }`)
 */
export async function createTestActor(type, label = type, data = {}, options = {}) {
  return Actor.create(
    {
      name: `Quench ${label} ${foundry.utils.randomID()}`,
      type,
      ...data,
    },
    options,
  );
}

/**
 * @param {string} type
 * @param {string} [label]
 * @param {object} [data]
 */
export async function createTestItem(type, label = type, data = {}) {
  return Item.create({
    name: `Quench ${label} ${foundry.utils.randomID()}`,
    type,
    ...data,
  });
}

/** Brief settle for prepareDerivedData / hook side effects. */
export async function settle(ms = 50) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** @param {Actor} actor */
export async function deleteTestActor(actor) {
  if (!actor?.id) return;
  await settle();
  const current = game.actors.get(actor.id);
  if (!current) return;
  await current.delete();
}

/** @param {Item} item */
export async function deleteTestItem(item) {
  if (!item?.id) return;
  const current = game.items.get(item.id);
  if (!current) return;
  await current.delete();
}

/**
 * @param {Actor|Item} doc
 * @param {string} path
 * @param {*} expected
 * @param {Chai.AssertStatic} assert
 */
export function assertPersists(doc, path, expected, assert) {
  assert.equal(foundry.utils.getProperty(doc, path), expected);
  doc.reset();
  assert.equal(foundry.utils.getProperty(doc._source, path), expected);
  let collection;
  if (doc.documentName === "Actor") collection = game.actors;
  else if (doc.isEmbedded) collection = doc.actor?.items ?? doc.parent?.items;
  else collection = game.items;
  const refetched = collection?.get(doc.id);
  assert.exists(refetched, `refetch ${doc.documentName} ${doc.id}`);
  assert.equal(foundry.utils.getProperty(refetched, path), expected);
}

/**
 * @param {string} settingKey
 * @param {*} value
 * @param {() => Promise<*>|*} fn
 */
export async function withSetting(settingKey, value, fn) {
  const prior = game.settings.get("wwn", settingKey);
  await game.settings.set("wwn", settingKey, value);
  try {
    return await fn();
  } finally {
    await game.settings.set("wwn", settingKey, prior);
  }
}

/**
 * Foundry v14 maps `randomUniform` → face via `Math.ceil((1 - u) * faces)`.
 * Low u ⇒ high face; high u ⇒ low face.
 */
export const PIN_D20_HIGH = 0.01; // nat 20
export const PIN_D20_LOW = 0.99; // nat 1

/**
 * Pin dice to a constant unit roll (0..1 exclusive convention).
 * @param {number} unit
 * @param {() => Promise<*>|*} fn
 */
export async function withPinnedDice(unit, fn) {
  const prior = CONFIG.Dice.randomUniform;
  CONFIG.Dice.randomUniform = () => unit;
  try {
    return await fn();
  } finally {
    CONFIG.Dice.randomUniform = prior;
  }
}

/**
 * Temporarily replace game.user.targets with fake token-like objects.
 * Also clears canvas.tokens.controlled so ChatListener (selection-first)
 * does not apply to a selected scene token instead of the fake target.
 * @param {Array<{ actor: Actor, name?: string }>} fakeTargets
 * @param {() => Promise<*>|*} fn
 */
export async function withFakeTargets(fakeTargets, fn) {
  const user = game.user;
  const descriptor = Object.getOwnPropertyDescriptor(user, "targets");
  const fakeTokens = fakeTargets.map((t) => ({
    actor: t.actor,
    name: t.name ?? t.actor.name,
    document: t.actor,
    // Canvas ticker calls this on game.user.targets while the stub is active.
    _drawTargetArrows() {},
    _refreshTarget() {},
  }));
  const fakeSet = new Set(fakeTokens);
  Object.defineProperty(user, "targets", {
    configurable: true,
    enumerable: true,
    get: () => fakeSet,
  });

  const tokens = canvas?.tokens;
  const controlledDesc = tokens
    ? Object.getOwnPropertyDescriptor(tokens, "controlled")
    : undefined;
  if (tokens) {
    Object.defineProperty(tokens, "controlled", {
      configurable: true,
      enumerable: true,
      get: () => [],
    });
  }

  try {
    return await fn();
  } finally {
    if (tokens) {
      if (controlledDesc) Object.defineProperty(tokens, "controlled", controlledDesc);
      else delete tokens.controlled;
    }
    if (descriptor) Object.defineProperty(user, "targets", descriptor);
    else delete user.targets;
  }
}

/**
 * @param {object} options
 * @param {Actor|Item} options.doc
 * @param {string} options.fieldPath
 * @param {*} options.value
 * @param {Chai.AssertStatic} options.assert
 */
export async function renderSheetRoundTrip({ doc, fieldPath, value, assert }) {
  await doc.sheet.render(true);
  try {
    await doc.update({ [fieldPath]: value });
    assert.equal(foundry.utils.getProperty(doc, fieldPath), value);
  } finally {
    await doc.sheet.close();
  }
  await doc.sheet.render(true);
  try {
    assertPersists(doc, fieldPath, value, assert);
  } finally {
    await doc.sheet.close();
  }
}

/**
 * Poll for an open DialogV2 whose title includes `titleIncludes`, then click
 * its confirm button (optionally after setting a `<select name="...">`'s
 * value first). Used to drive a real player-facing dialog to completion
 * instead of bypassing it with `{ prompt: false }`. Dialogs are AppV2, so
 * they live in `foundry.applications.instances`, not the legacy `ui.windows`.
 * @param {string} titleIncludes
 * @param {{ selectName?: string, selectValue?: string, timeoutMs?: number }} [opts]
 */
export async function answerActiveDialog(titleIncludes, { selectName = "skill", selectValue, timeoutMs = 2000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let dialog;
  while (Date.now() < deadline) {
    dialog = Array.from(foundry.applications.instances.values())
      .find((a) => a.constructor.name === "DialogV2" && a.title?.includes(titleIncludes));
    if (dialog) break;
    await settle(20);
  }
  if (!dialog) throw new Error(`answerActiveDialog: no open dialog titled like "${titleIncludes}"`);

  if (selectValue != null) {
    const select = dialog.element.querySelector(`select[name="${selectName}"]`);
    if (!select) throw new Error(`answerActiveDialog: no <select name="${selectName}"> in dialog`);
    select.value = selectValue;
  }

  const confirmBtn = dialog.element.querySelector('button[data-action="confirm"]');
  if (!confirmBtn) throw new Error("answerActiveDialog: no confirm button in dialog");
  confirmBtn.click();
  await settle();
}

/** @param {string} collection e.g. "wwn.abilities-wwn" */
export function packAvailable(collection) {
  return Boolean(game.packs.get(collection));
}

/**
 * @param {string} collection
 * @param {{ type?: string, nameIncludes?: string }} [opts]
 */
export async function importCompendiumItem(collection, opts = {}) {
  const pack = game.packs.get(collection);
  if (!pack) return null;
  const index = pack.index?.size ? pack.index : await pack.getIndex();
  let entry = [...index].find((e) => {
    if (opts.type && e.type !== opts.type) return false;
    if (opts.nameEquals && e.name !== opts.nameEquals) return false;
    if (opts.nameIncludes && !String(e.name).toLowerCase().includes(opts.nameIncludes.toLowerCase())) {
      return false;
    }
    return true;
  });
  if (opts.nameEquals && !entry) return null;
  if (!entry) entry = index.contents?.[0] ?? [...index][0];
  if (!entry) return null;
  return pack.getDocument(entry._id);
}

export const ACTOR_SMOKE_TYPES = ["character", "monster", "faction", "starship", "powerArmor", "project"];

/** Creatable / primary item types (skip legacy aliases art/spell/ability). */
export const ITEM_SMOKE_TYPES = [
  "item",
  "weapon",
  "armor",
  "skill",
  "power",
  "classEdge",
  "focus",
  "currency",
  "asset",
  "shipFitting",
  "shipWeapon",
  "shipDefense",
  "armorFitting",
  "contribution",
];

export const EXPECTED_WWN_API_KEYS = [
  "WwnActor",
  "WwnItem",
  "WwnDice",
  "migrateWorld",
  "refreshPowers",
  "endScene",
  "endDay",
  "rollItemMacro",
];

// Factories live in builders.mjs to keep this file focused on primitives.
export {
  createArmedCharacter,
  createTargetMonster,
  createPilotedPowerArmor,
  createCrewedStarship,
} from "./builders.mjs";

/** @param {Combat} combat */
export async function deleteTestCombat(combat) {
  if (!combat?.id) return;
  const current = game.combats.get(combat.id);
  if (!current) return;
  try {
    // Deleting the active/viewed combat triggers Foundry activate() on a stale id.
    if (game.combat?.id === current.id || ui.combat?.viewed?.id === current.id) {
      const others = game.combats.filter((c) => c.id !== current.id);
      if (others.length) await others[0].activate().catch(() => {});
      else await current.update({ active: false }).catch(() => {});
    }
    await current.delete();
  } catch (err) {
    // Post-delete activate races are Foundry noise; ignore if already gone.
    if (game.combats.get(combat.id)) throw err;
  }
}

/**
 * Dispatch a chat-card `data-action` the same way ChatListener does.
 * Attaches listeners via `renderChatMessageHTML`, then clicks the control.
 *
 * @param {ChatMessage} message
 * @param {{ action: string, rowId?: string, multiplier?: number, heal?: boolean }} opts
 */
export async function applyChatCardAction(message, { action, rowId, multiplier, heal } = {}) {
  if (!message) throw new Error("applyChatCardAction: missing message");

  let html;
  if (typeof message.renderHTML === "function") {
    html = await message.renderHTML();
  } else {
    const wrap = document.createElement("div");
    wrap.innerHTML = message.content ?? "";
    html = wrap;
  }

  // ChatListener attaches its click handler on this hook.
  Hooks.callAll("renderChatMessageHTML", message, html);

  const root =
    (html.classList?.contains("wwn-chat-card") ? html : null) ??
    html.querySelector?.(".wwn-chat-card");
  if (!root) throw new Error("applyChatCardAction: no .wwn-chat-card in message HTML");

  if (multiplier != null) root.dataset.multiplier = String(multiplier);
  if (heal != null) {
    root.dataset.heal = heal ? "true" : "false";
    root.classList.toggle("wwn-heal-mode", !!heal);
  }

  let selector = `[data-action="${action}"]`;
  if (rowId) selector += `[data-row-id="${rowId}"]`;
  const btn = root.querySelector(selector);
  if (!btn) throw new Error(`applyChatCardAction: no control for ${selector}`);

  btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  // ChatListener handlers are async fire-and-forget.
  await settle(150);
  return btn;
}
