import { showWwnDialog, confirmButton, cancelButton } from "../applications/wwn-dialog.mjs";

/**
 * Group a Party actor's pooled currency items by denomination name (a split
 * creates additional same-named stacks, so more than one Item can share a
 * denomination -- these are seeded from the same CONFIG.WWN.currencySets as
 * PC starter currency, via buildDefaultCurrencyItemsData, so names line up).
 * @param {Actor} partyActor
 * @returns {Array<{name: string, img: string, multiplier: number, perSlot: number, total: number, items: Item[]}>}
 */
function groupPartyCurrency(partyActor) {
  const byName = new Map();
  for (const item of partyActor.items.filter((i) => i.type === "currency")) {
    if (!byName.has(item.name)) {
      byName.set(item.name, {
        name: item.name,
        img: item.img,
        multiplier: item.system.multiplier,
        perSlot: item.system.perSlot,
        total: 0,
        items: [],
      });
    }
    const entry = byName.get(item.name);
    entry.total += item.system.carried ?? 0;
    entry.items.push(item);
  }
  return [...byName.values()].sort((a, b) => (a.multiplier ?? 1) - (b.multiplier ?? 1));
}

/**
 * Deal every currency denomination currently pooled on the Party actor
 * among the given members, all at once -- one column per denomination,
 * defaulting to that denomination's current pooled total.
 * @param {Actor[]} actors  party members (deal recipients)
 * @param {Actor} partyActor
 */
export async function showPartyCurrencyDialog(actors, partyActor) {
  const denominations = groupPartyCurrency(partyActor);
  if (!denominations.length) {
    return ui.notifications.warn(game.i18n.localize("WWN.party.noCurrency"));
  }

  await showWwnDialog({
    modifier: "party-coin",
    title: game.i18n.localize("WWN.dialog.currency.deal"),
    template: "systems/wwn/templates/apps/party-coin.html",
    context: {
      actors,
      denominations,
      config: CONFIG.WWN,
      user: game.user,
      settings: game.settings,
    },
    position: { width: 480 },
    buttons: [
      confirmButton({
        label: "WWN.dialog.currency.deal",
        callback: async (_event, button) => {
          // Clamp what's actually credited to what the pool holds -- typed
          // amounts (or a manual override after "calculate shares") can sum
          // to more than a denomination's pooled total, and crediting the
          // full typed amount regardless would mint currency from nothing.
          const remainingByDenom = new Map(denominations.map((d) => [d.name, d.total]));
          let clamped = false;
          // Per-recipient audit trail of what actually got credited (post-
          // clamping), so the chat record below reflects real amounts, not
          // whatever was typed.
          const creditedByActor = new Map();

          // A recipient might not yet own this denomination at all (seeded
          // before this currency existed, a different currency set, a fresh
          // actor) -- rather than silently dropping their share, give them
          // one cloned from the party's own item (same name/img/multiplier/
          // perSlot as what's actually being dealt) before crediting.
          const creationPromises = [];
          for (const actor of actors) {
            const toCreate = [];
            denominations.forEach((denom, i) => {
              const input = button.form.querySelector(`input[data-actor-id="${actor.id}"][data-denom-idx="${i}"]`);
              const requested = Math.floor(Number(input?.value) || 0);
              if (!requested) return;
              const own = actor.items.find((it) => it.type === "currency" && it.name === denom.name);
              if (own) return;
              toCreate.push({
                name: denom.name,
                type: "currency",
                img: denom.img,
                system: { multiplier: denom.multiplier, perSlot: denom.perSlot, carried: 0, banked: 0 },
              });
            });
            if (toCreate.length) creationPromises.push(actor.createEmbeddedDocuments("Item", toCreate));
          }
          await Promise.all(creationPromises);

          // The clamping math below shares `remainingByDenom` across actors
          // (actor N's clamp depends on what actors before it already took
          // from the same pool), so that part must stay a synchronous,
          // in-order loop. Only the actual per-actor DB write is independent
          // of the other actors' writes -- collect those and fire them
          // together instead of awaiting each one before starting the next.
          const creditPromises = [];
          for (const actor of actors) {
            const updates = [];
            denominations.forEach((denom, i) => {
              const input = button.form.querySelector(`input[data-actor-id="${actor.id}"][data-denom-idx="${i}"]`);
              const requested = Math.floor(Number(input?.value) || 0);
              if (!requested) return;
              // The creation pass above guarantees a matching item exists
              // for every nonzero request; this is now just the normal
              // lookup, not a "maybe missing" check.
              const own = actor.items.find((it) => it.type === "currency" && it.name === denom.name);
              if (!own) return;
              const remaining = remainingByDenom.get(denom.name) ?? 0;
              const amount = Math.min(requested, remaining);
              if (amount < requested) clamped = true;
              if (amount <= 0) return;
              updates.push({ _id: own.id, "system.carried": (own.system.carried ?? 0) + amount });
              remainingByDenom.set(denom.name, remaining - amount);
              if (!creditedByActor.has(actor)) creditedByActor.set(actor, []);
              creditedByActor.get(actor).push({ name: denom.name, amount });
            });
            if (updates.length) creditPromises.push(actor.updateEmbeddedDocuments("Item", updates));
          }
          await Promise.all(creditPromises);

          if (clamped) ui.notifications.warn(game.i18n.localize("WWN.party.dealCurrencyClamped"));

          // Drain the party's pool for each denomination by what was actually
          // dealt (pool total minus whatever's left), across however many
          // stacks that denomination is split into.
          const partyUpdates = [];
          for (const denom of denominations) {
            let toDrain = denom.total - (remainingByDenom.get(denom.name) ?? denom.total);
            for (const item of denom.items) {
              if (toDrain <= 0) break;
              const carried = item.system.carried ?? 0;
              const take = Math.min(carried, toDrain);
              if (take <= 0) continue;
              partyUpdates.push({ _id: item.id, "system.carried": carried - take });
              toDrain -= take;
            }
          }
          if (partyUpdates.length) await partyActor.updateEmbeddedDocuments("Item", partyUpdates);

          // A chat record for session audit/record-keeping -- the single-
          // recipient depositBank() helper this bulk multi-denomination
          // dialog replaced always posted one on deposit; one card per
          // recipient (not per denomination) keeps that trail without
          // spamming the log for a many-denomination deal.
          if (creditedByActor.size) {
            const { createCardMessage } = await import("../chat/chat-card.mjs");
            const esc = foundry.utils.escapeHTML;
            for (const [actor, credits] of creditedByActor) {
              const breakdown = credits.map((c) => `${c.amount} ${esc(c.name)}`).join(", ");
              const body = game.i18n.format("WWN.party.dealCurrencyGrantBody", {
                user: esc(game.user.name),
                name: esc(actor.name),
                breakdown,
              });
              await createCardMessage({
                actor,
                title: game.i18n.localize("WWN.party.dealCurrencyGrant"),
                bodyTemplate: "systems/wwn/templates/chat/notice-body.hbs",
                context: { bodyHtml: `<p>${body}</p>` },
              });
            }
          }

          return true;
        },
      }),
      cancelButton(),
    ],
    onRender: (_event, dialog) => {
      const root = dialog.element;
      const form = root.querySelector("form") ?? root;

      const calculateShares = ({ notifyRemainder = false } = {}) => {
        let shares = 0;
        for (const a of actors) shares += a.system.currencyShare ?? 0;
        let totalRemainder = 0;
        denominations.forEach((_denom, i) => {
          const totalInput = form.querySelector(`input[data-denom-total-idx="${i}"]`);
          const toDeal = Math.floor(Number(totalInput?.value) || 0);
          const perShare = shares ? toDeal / shares : 0;
          let assigned = 0;
          for (const a of actors) {
            const input = form.querySelector(`input[data-actor-id="${a.id}"][data-denom-idx="${i}"]`);
            const amount = perShare ? Math.floor((a.system.currencyShare ?? 0) * perShare) : 0;
            if (input) input.value = amount;
            assigned += amount;
          }
          totalRemainder += toDeal - assigned;
        });
        // Per-recipient flooring can silently drop a remainder across the
        // whole deal -- fields stay editable so a GM can fix it by hand, but
        // only worth flagging when they actually asked for a recalculation,
        // not on the dialog's own initial pre-fill.
        if (notifyRemainder && totalRemainder !== 0) {
          ui.notifications.info(game.i18n.format("WWN.party.shareRemainder", { amount: totalRemainder }));
        }
      };

      root?.querySelector('[data-action="calculate-share"]')?.addEventListener("click", (ev) => {
        ev.preventDefault();
        calculateShares({ notifyRemainder: true });
      });
      calculateShares(); // pre-fill shares from the default (pooled) totals on open
    },
  });
}
