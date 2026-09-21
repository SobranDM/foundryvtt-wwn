import { showWwnDialog, confirmButton, cancelButton } from "../applications/wwn-dialog.mjs";

/**
 * Deal XP among the given party members.
 * @param {Actor[]} actors
 */
export async function showPartyXpDialog(actors) {
  await showWwnDialog({
    modifier: "party-xp",
    title: game.i18n.localize("WWN.dialog.xp.deal"),
    template: "systems/wwn/templates/apps/party-xp.html",
    context: {
      actors,
      config: CONFIG.WWN,
      user: game.user,
      settings: game.settings,
    },
    position: { width: 320 },
    buttons: [
      confirmButton({
        label: "WWN.dialog.xp.deal",
        callback: async (_event, button) => {
          const rows = button.form.querySelectorAll(".actor");
          // Each recipient's write is independent -- fire them together
          // instead of serializing N round-trips one at a time.
          const updates = [];
          // Code-review fix: Deal XP had no chat/audit record, unlike the
          // sibling Deal Currency flow -- track what actually got granted so
          // the same session record-keeping trail applies to both.
          const grantedByActor = [];
          for (const row of rows) {
            const value = row.querySelector("input")?.value;
            const id = row.dataset.actorId;
            const actor = game.actors.get(id);
            const amount = Math.floor(parseInt(value, 10));
            if (amount && actor) {
              updates.push(actor.update({
                "system.details.xp.value": (actor.system.details.xp.value ?? 0) + amount,
              }));
              grantedByActor.push({ actor, amount });
            }
          }
          await Promise.all(updates);

          if (grantedByActor.length) {
            const { createCardMessage } = await import("../chat/chat-card.mjs");
            const esc = foundry.utils.escapeHTML;
            await Promise.all(grantedByActor.map(({ actor, amount }) => {
              const body = game.i18n.format("WWN.party.dealXpGrantBody", {
                user: esc(game.user.name),
                name: esc(actor.name),
                amount,
              });
              return createCardMessage({
                actor,
                title: game.i18n.localize("WWN.party.dealXpGrant"),
                bodyTemplate: "systems/wwn/templates/chat/notice-body.hbs",
                context: { bodyHtml: `<p>${body}</p>` },
              });
            }));
          }

          return true;
        },
      }),
      cancelButton(),
    ],
    onRender: (_event, dialog) => {
      const root = dialog.element;
      root?.querySelector('[data-action="calculate-share"]')?.addEventListener("click", (ev) => {
        ev.preventDefault();
        const form = root.querySelector("form") ?? root;
        const toDeal = form.querySelector('input[name="total"]')?.value;
        const requested = Math.floor(Number(toDeal) || 0);
        const shares = actors.length;
        const value = parseFloat(toDeal) / shares / 100;
        if (!value) return;
        let assigned = 0;
        for (const a of actors) {
          const input = form.querySelector(`div[data-actor-id='${a.id}'] input`);
          if (input) {
            const amount = Math.floor(a.system.details.xp.share * value);
            input.value = amount;
            assigned += amount;
          }
        }
        // Per-recipient flooring can silently drop a remainder (e.g. 7 XP
        // over 3 equal shares -> 2/2/2, losing 1) -- fields stay editable so
        // a GM can fix it by hand, but they need to know something was left
        // unassigned rather than discovering it later.
        const remainder = requested - assigned;
        if (remainder !== 0) {
          ui.notifications.info(game.i18n.format("WWN.party.shareRemainder", { amount: remainder }));
        }
      });
    },
  });
}
