/**
 * Applies custom styling and controls to the combat tracker
 */
import { WWN } from "../config/index.mjs";
import { showWwnDialog, confirmButton, cancelButton } from "../applications/wwn-dialog.mjs";

export default class WWNCombatTracker extends foundry.applications.sidebar.tabs
  .CombatTracker {
  /** @type {Set<string>} */
  #expandedGroupIds = new Set();

  static DEFAULT_OPTIONS = {
    ...foundry.applications.sidebar.tabs.CombatTracker.DEFAULT_OPTIONS,
    actions: {
      ...foundry.applications.sidebar.tabs.CombatTracker.DEFAULT_OPTIONS
        .actions,
      toggleGroupCollapse: WWNCombatTracker.#onToggleGroupCollapse,
      activateGroup: WWNCombatTracker.#onActivateGroup,
      rollGroupInitiative: WWNCombatTracker.#onRollGroupInitiative,
      setCombatantGroup: WWNCombatTracker.#onSetCombatantGroup
    }
  };

  /** @inheritDoc */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (this.viewed?.isSideCollapseEnabled) {
      parts.tracker = {
        ...parts.tracker,
        template: "systems/wwn/templates/sidebar/tabs/combat/tracker-grouped.hbs"
      };
    }
    return parts;
  }

  /** @inheritDoc */
  async _prepareTrackerContext(context, options) {
    await super._prepareTrackerContext(context, options);
    context.turns?.forEach(turn => {
      const combatant = this.viewed?.combatants.get(turn.id);
      turn.isOwnedByUser = !!combatant?.actor?.isOwner;
      turn.group = combatant?.group;
    });

    if (!this.viewed?.isSideCollapseEnabled) return context;

    context.groups = this.#prepareGroupedTurns(context.turns ?? []);
    return context;
  }

  /**
   * Nest flat turn contexts into CombatantGroup rows.
   * @param {object[]} turns
   * @returns {object[]}
   */
  #prepareGroupedTurns(turns) {
    const groups = [];
    const byId = new Map();

    for (const turn of turns) {
      const combatant = this.viewed.combatants.get(turn.id);
      const groupDoc = combatant?.group;
      const groupId = groupDoc?.id ?? `solo-${turn.id}`;
      let entry = byId.get(groupId);
      if (!entry) {
        const rawName = groupDoc?.name ?? "";
        const colorKey = rawName.replace(/\*$/, "") || "white";
        const isStar = rawName.endsWith("*");
        const colorLabel = game.i18n.localize(
          WWN.colors[colorKey] ?? colorKey
        );
        const initiative =
          groupDoc?.initiative ?? turn.initiative ?? null;
        entry = {
          id: groupId,
          name: rawName || turn.name,
          colorKey,
          label: isStar ? `${colorLabel} *` : colorLabel,
          initiative,
          isOwner: false,
          active: false,
          expanded: this.#expandedGroupIds.has(groupId),
          turns: [],
          memberCount: 0
        };
        byId.set(groupId, entry);
        groups.push(entry);
      }
      entry.turns.push(turn);
      entry.memberCount = entry.turns.length;
      entry.isOwner = entry.isOwner || turn.isOwner;
      if (turn.active) entry.active = true;
    }

    for (const entry of groups) {
      entry.css = [entry.active ? "active" : null].filterJoin(" ");
      if (Number.isFinite(Number(entry.initiative))) {
        const precision = CONFIG.Combat.initiative.decimals;
        entry.initiative = Number(entry.initiative).toFixed(
          contextHasDecimals(entry.turns) ? precision : 0
        );
      }
    }

    return groups;
  }

  /** @inheritDoc */
  _onUpdateInitiative(event) {
    const groupHeader = event.target.closest(".combatant-group-header");
    if (groupHeader && !event.target.closest("[data-combatant-id]")) {
      const { groupId } = groupHeader.dataset;
      const combat = this.viewed;
      if (!combat || !groupId) return;
      const raw = event.target.value;
      const group = combat.groups.get(groupId);
      const current = group?.initiative;
      const isDelta = /^[+-]/.test(raw);
      let value;
      if (!isDelta || raw[0] === "=") {
        value = raw ? Number(raw.replace(/^=/, "")) : null;
      } else {
        const delta = parseInt(raw, 10);
        if (isNaN(delta)) return;
        value = (Number(current) || 0) + delta;
      }
      return combat.setGroupInitiative(groupId, value);
    }
    return super._onUpdateInitiative(event);
  }

  /**
   * @this {WWNCombatTracker}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static #onToggleGroupCollapse(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const groupId = target.dataset.groupId
      ?? target.closest("[data-group-id]")?.dataset?.groupId;
    if (!groupId) return;

    const groupEl = this.element.querySelector(
      `.combatant-group[data-group-id="${groupId}"]`
    );
    if (!groupEl) return;

    const members = groupEl.querySelector(".combatant-group-members");
    const icon = groupEl.querySelector(".group-caret i");
    const expanded = this.#expandedGroupIds.has(groupId);

    if (expanded) {
      this.#expandedGroupIds.delete(groupId);
      members?.setAttribute("hidden", "");
      icon?.classList.remove("fa-caret-down");
      icon?.classList.add("fa-caret-right");
      groupEl.dataset.expanded = "false";
    } else {
      this.#expandedGroupIds.add(groupId);
      members?.removeAttribute("hidden");
      icon?.classList.remove("fa-caret-right");
      icon?.classList.add("fa-caret-down");
      groupEl.dataset.expanded = "true";
    }
  }

  /**
   * @this {WWNCombatTracker}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onActivateGroup(_event, target) {
    if (target.closest("[data-action='toggleGroupCollapse']")) return;
    if (target.closest("input, button")) return;

    const groupId = target.dataset.groupId
      ?? target.closest("[data-group-id]")?.dataset?.groupId;
    const combat = this.viewed;
    if (!combat || !groupId || !game.user.isGM) return;

    const current = combat.combatant;
    const currentKey = current?.group?.id ?? (current ? `solo-${current.id}` : null);
    let turnIndex =
      currentKey === groupId
        ? combat.turn
        : combat.turns.findIndex(
          t => (t.group?.id ?? `solo-${t.id}`) === groupId
        );
    if (turnIndex < 0) return;
    await combat.activateCombatant(turnIndex);
  }

  /**
   * @this {WWNCombatTracker}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onRollGroupInitiative(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const groupId = target.dataset.groupId;
    const combat = this.viewed;
    if (!combat || !groupId) return;

    const group = combat.groups.get(groupId);
    let combatant = group ? [...group.members][0] : null;
    if (!combatant && groupId.startsWith("solo-")) {
      combatant = combat.combatants.get(groupId.slice(5));
    }
    if (!combatant) return;
    return combat.rollInitiative([combatant.id]);
  }

  /**
   * @this {WWNCombatTracker}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onSetCombatantGroup(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const { combatantId } = target.closest("[data-combatant-id]")?.dataset ?? {};
    const combatant = this.viewed?.combatants.get(combatantId);
    if (!combatant || !game.user.isGM) return;

    const groups = Object.keys(CONFIG.WWN.colors).map(key => ({
      key,
      color: `var(--wwn-group-color-${key})`,
      label: game.i18n.localize(CONFIG.WWN.colors[key])
    }));

    const content = `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize("WWN.combat.SelectGroup")}</label>
          <select name="group">
            ${groups.map(g => `
              <option value="${g.key}" style="color: ${g.color}">
                ${g.label}
              </option>
            `).join("")}
          </select>
        </div>
      </form>
    `;

    const result = await showWwnDialog({
      modifier: "combat-set-group",
      title: game.i18n.localize("WWN.combat.SetCombatantGroups"),
      content,
      buttons: [
        confirmButton({ label: "Submit" }),
        cancelButton(),
      ],
    });
    if (!result || result === "cancel") return;
    await combatant.assignGroup(result.group);
  }

  /**
   * Handle rendering of the combat tracker (flat / non-collapsed mode).
   * @param {HTMLElement} html - The HTML element
   */
  async renderGroups(html) {
    if (!this.viewed || game.settings.get(game.system.id, "initiative") !== "group") {
      return;
    }
    if (this.viewed.isSideCollapseEnabled) return;

    const tokenNames = html.querySelectorAll(".combatant > div.token-name");
    for (const tokenName of tokenNames) {
      const combatantElement = tokenName.closest(".combatant");
      if (!combatantElement) continue;

      const combatantId = combatantElement.dataset.combatantId;
      const combatant = game.combat.combatants.get(combatantId);
      if (!combatant || !combatant?.group) continue;

      const label = (combatant.group?.name ?? "").replace(/\*$/, "");

      tokenName.style.background = `linear-gradient(90deg, var(--wwn-group-color-${label}, ${label}), transparent)`;
      tokenName.style.borderRadius = "4px";
      tokenName.style.padding = "2px";

      if (game.user.isGM) {
        const controls = combatantElement.querySelector(".combatant-controls");
        if (controls && !controls.querySelector('[data-control="set-group"]')) {
          const groupButton = document.createElement("a");
          groupButton.className = "combatant-control";
          groupButton.setAttribute("role", "button");
          groupButton.setAttribute(
            "data-tooltip",
            game.i18n.localize("WWN.combat.SetCombatantGroups")
          );
          groupButton.setAttribute("data-control", "set-group");
          groupButton.innerHTML = '<i class="fas fa-flag"></i>';

          controls.insertBefore(groupButton, controls.firstChild);

          groupButton.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();
            await WWNCombatTracker.#onSetCombatantGroup.call(
              this,
              event,
              groupButton
            );
          });
        }
      }

      if (!game.user.isGM) {
        const isOwned = !!combatant.actor?.isOwner;
        if (!isOwned) continue;
        const input = combatantElement.querySelector("input.initiative-input");
        if (input) input.removeAttribute("readonly");
      }
    }
  }
}

/**
 * @param {object[]} turns
 * @returns {boolean}
 */
function contextHasDecimals(turns) {
  return turns.some(t => {
    const n = Number(t.initiative);
    return Number.isFinite(n) && !Number.isInteger(n);
  });
}
