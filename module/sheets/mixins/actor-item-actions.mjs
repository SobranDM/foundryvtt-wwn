/**
 * Shared item CRUD actions + input focus-select for actor sheets that do not
 * (or cannot) extend WwnBaseActorSheet, and for WwnBaseActorSheet itself.
 */
import { confirmWwnDialog } from "../../applications/wwn-dialog.mjs";

/**
 * @param {typeof foundry.applications.api.ApplicationV2} Base
 */
export function ActorItemActionsMixin(Base) {
  return class ActorItemActions extends Base {
    static DEFAULT_OPTIONS = {
      actions: {
        editItem: ActorItemActions.#onEditItem,
        deleteItem: ActorItemActions.#onDeleteItem,
        rollItem: ActorItemActions.#onRollItem,
        showItem: ActorItemActions.#onShowItem,
        postItem: ActorItemActions.#onPostItem,
      },
    };

    /**
     * Resolve an embedded item from a click target with `data-item-id`.
     * @param {HTMLElement} target
     * @returns {Item|undefined}
     */
    _getItem(target) {
      const itemId = target.closest("[data-item-id]")?.dataset.itemId;
      return this.actor.items.get(itemId);
    }

    /**
     * Focus-to-select on every input (legacy sheet ergonomics).
     * Call from `_onRender` after `super._onRender`.
     */
    _bindFocusSelectInputs() {
      for (const input of this.element.querySelectorAll("input")) {
        input.addEventListener("focus", (event) => event.currentTarget.select());
      }
    }

    /**
     * Wire `[data-item-field]` inline editors.
     * @param {(event: Event) => void|Promise<void>} handler
     */
    _bindItemFieldEditors(handler) {
      for (const input of this.element.querySelectorAll("[data-item-field]")) {
        input.addEventListener("change", (event) => handler.call(this, event));
      }
    }

    static #onEditItem(event, target) {
      this._getItem(target)?.sheet.render(true);
    }

    static async #onDeleteItem(event, target) {
      const item = this._getItem(target);
      if (!item) return;
      const esc = foundry.utils.escapeHTML;
      const confirmed = await confirmWwnDialog({
        modifier: "delete-item",
        title: game.i18n.format("WWN.Delete", { name: item.name }),
        content: `<p>${game.i18n.format("WWN.DeleteContent", {
          name: esc(item.name),
          actor: esc(this.actor.name),
        })}</p>`,
      });
      if (confirmed) await item.delete();
    }

    static #onRollItem(event, target) {
      return this._getItem(target)?.roll({
        skipDialog: event.shiftKey || event.ctrlKey,
      });
    }

    /** Post the item's description card without triggering roll()'s side effects. */
    static #onPostItem(event, target) {
      return this._getItem(target)?.show();
    }

    /** Toggle an in-row description drawer; Shift+click posts a chat card. */
    static async #onShowItem(event, target) {
      const item = this._getItem(target);
      if (!item) return;
      if (event.shiftKey) return item.show();

      const entry = target.closest(".item-entry");
      if (!entry) return item.show();
      const row = entry.querySelector(":scope > .item");

      const existing = entry.querySelector(":scope > .item-summary");
      if (existing) {
        row?.classList.remove("expanded");
        await ActorItemActions.#slideUpRemove(existing);
        return;
      }

      const list = entry.closest(".item-list");
      const others = list
        ? [...list.querySelectorAll(":scope > .item-entry > .item-summary")]
        : [];
      await Promise.all(
        others.map((el) => {
          el.closest(".item-entry")?.querySelector(":scope > .item")?.classList.remove("expanded");
          return ActorItemActions.#slideUpRemove(el);
        })
      );

      const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        item.system.description ?? "",
        { async: true, relativeTo: item }
      );
      const summary = document.createElement("div");
      summary.classList.add("item-summary");
      summary.innerHTML = enriched || `<p><em>${game.i18n.localize("WWN.None")}</em></p>`;
      row?.classList.add("expanded");
      await ActorItemActions.#slideDownAppend(entry, summary);
    }

    /** Animate an element to height 0 then remove (legacy jQuery slideUp(200)). */
    static #slideUpRemove(el) {
      return new Promise((resolve) => {
        if (!el?.isConnected) return resolve();
        const finish = () => {
          el.removeEventListener("transitionend", onEnd);
          clearTimeout(fallback);
          el.remove();
          resolve();
        };
        const onEnd = (event) => {
          if (event.target !== el || event.propertyName !== "height") return;
          finish();
        };
        el.style.overflow = "hidden";
        el.style.height = `${el.scrollHeight}px`;
        void el.offsetHeight;
        el.style.transition = "height 200ms ease";
        el.style.height = "0px";
        el.addEventListener("transitionend", onEnd);
        const fallback = setTimeout(finish, 250);
      });
    }

    /** Append then animate from height 0 (legacy jQuery slideDown(200)). */
    static #slideDownAppend(parent, el) {
      return new Promise((resolve) => {
        const finish = () => {
          el.removeEventListener("transitionend", onEnd);
          clearTimeout(fallback);
          el.style.height = "";
          el.style.overflow = "";
          el.style.transition = "";
          resolve();
        };
        const onEnd = (event) => {
          if (event.target !== el || event.propertyName !== "height") return;
          finish();
        };
        el.style.overflow = "hidden";
        el.style.height = "0px";
        parent.appendChild(el);
        const targetHeight = el.scrollHeight;
        void el.offsetHeight;
        el.style.transition = "height 200ms ease";
        el.style.height = `${targetHeight}px`;
        el.addEventListener("transitionend", onEnd);
        const fallback = setTimeout(finish, 250);
      });
    }
  };
}
