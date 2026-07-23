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
      const confirmed = await confirmWwnDialog({
        modifier: "delete-item",
        title: game.i18n.format("WWN.Delete", { name: item.name }),
        content: `<p>${game.i18n.format("WWN.DeleteContent", { name: item.name, actor: this.actor.name })}</p>`,
      });
      if (confirmed) await item.delete();
    }

    static #onRollItem(event, target) {
      return this._getItem(target)?.roll({
        skipDialog: event.shiftKey || event.ctrlKey,
      });
    }
  };
}
