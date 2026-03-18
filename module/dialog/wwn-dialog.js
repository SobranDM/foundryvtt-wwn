/**
 * WWN dialog wrapper using Foundry DialogV2 (v13-only).
 * WwnDialogV2 extends the API Dialog with system default options; WwnDialog provides confirm/wait/prompt facades.
 */
const _foundry = typeof globalThis !== "undefined" ? globalThis.foundry : undefined;
const DialogV2 = _foundry?.applications?.api?.Dialog ?? _foundry?.applications?.api?.DialogV2 ?? null;

/**
 * Extension of Foundry Dialog (DialogV2) with WWN default options.
 */
export class WwnDialogV2 extends (DialogV2 ?? class {}) {
  static DEFAULT_OPTIONS = Object.freeze({
    classes: ["wwn"],
    position: {
      width: 400,
      height: "auto",
    },
  });
}

function mergeOptions(config) {
  const defaults = WwnDialogV2.DEFAULT_OPTIONS ?? {};
  return foundry.utils.mergeObject(
    foundry.utils.deepClone(defaults),
    config ?? {},
    { inplace: false }
  );
}

export const WwnDialog = {
  /**
   * Show a yes/no confirmation dialog. Returns a Promise<boolean> (true = yes, false = no).
   * @param {object} config - { title, content, yes?, no?, ...DialogV2 options }
   * @returns {Promise<boolean|null>}
   */
  async confirm(config = {}) {
    if (!DialogV2) throw new Error("WWN: DialogV2 not available (requires Foundry v13)");
    const result = await DialogV2.confirm(mergeOptions(config));
    return result === true;
  },

  /**
   * Show a dialog and wait for user choice. Returns the button action or callback result.
   * @param {object} config - DialogV2 wait options (buttons, title, content, window, position, etc.)
   * @returns {Promise<any>}
   */
  async wait(config = {}) {
    if (!DialogV2) throw new Error("WWN: DialogV2 not available (requires Foundry v13)");
    return DialogV2.wait(mergeOptions(config));
  },

  /**
   * Show a prompt with a single Confirm button.
   * @param {object} config - DialogV2 prompt options
   * @returns {Promise<any>}
   */
  async prompt(config = {}) {
    if (!DialogV2) throw new Error("WWN: DialogV2 not available (requires Foundry v13)");
    return DialogV2.prompt(mergeOptions(config));
  },
};
