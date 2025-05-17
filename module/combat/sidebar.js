import { WWN } from "../config.js";
import { WWNGroupCombat } from "./combat-group.js";
import WWNCombatGroupSelector from "./combat-set-groups.js";

export class WWNCombatTab extends foundry.applications.sidebar.tabs.CombatTracker {
  // ===========================================================================
  // APPLICATION SETUP
  // ===========================================================================

  /** @inheritdoc */

  static GROUP_CONFIG_APP = new WWNCombatGroupSelector();


  // ===========================================================================
  // RENDERING
  // ===========================================================================

  async getData(options) {
    const context = await super.getData(options);
    const isGroupInitiative = game.settings.get(game.system.id, "initiative") === "group";

    const turns = context.turns.map((turn) => {
      const combatant = game.combat.combatants.get(turn.id);
      turn.isOwnedByUser = !!combatant.actor.isOwner;
      turn.group = combatant.group;
      return turn;
    });

    // Group combatants by their group and sort by initiative
    const groups = turns.reduce((arr, turn) => {
      const idx = arr.findIndex(r => r.group === turn.group);

      if (idx !== -1) {
        arr[idx].turns.push(turn);
        return arr;
      }

      return [...arr, {
        group: turn.group,
        label: WWNGroupCombat.GROUPS[turn.group],
        initiative: turn.initiative,
        turns: [turn]
      }];
    }, []).sort((a, b) => b.initiative - a.initiative); // Sort groups by initiative, highest first

    return foundry.utils.mergeObject(context, {
      turns,
      groups,
      isGroupInitiative
    })
  }


  // ===========================================================================
  // UI EVENTS
  // ===========================================================================

  activateListeners(html) {
    super.activateListeners(html);
    const trackerHeader = html.find("#combat > header");

    // Reroll group initiative
    html.find('.combat-button[data-control="reroll"]').click((ev) => {
      game.combat.rollInitiative();
    });

    html.find('.combat-button[data-control="set-groups"]').click((ev) => {
      WWNCombatTab.GROUP_CONFIG_APP.render(true, { focus: true });
    });
  }

  /**
   * Handle updating initiative for a Combatant within the Combat encounter
   * @param {Event} event   The originating click event
   * @private
   */
  async _onUpdateInitiative(event) {

    // Let Foundry handle the base initiative update
    await super._onUpdateInitiative(event);

    // If not in group initiative mode, use default behavior
    if (game.settings.get(game.system.id, "initiative") !== "group") {
      return;
    }

    // Get the combatant that was just updated
    const { combatantId } = event.target.closest("[data-combatant-id]")?.dataset ?? {};
    const combatant = this.viewed.combatants.get(combatantId);
    if (!combatant) return;

    // Update all other combatants in the same group to match
    const groupCombatants = this.viewed.combatants.filter(c => c.group === combatant.group && c.id !== combatant.id);
    if (groupCombatants.length === 0) return;

    const updates = groupCombatants.map(c => ({
      _id: c.id,
      initiative: combatant.initiative
    }));

    await this.viewed.updateEmbeddedDocuments("Combatant", updates);
  }

  async #toggleFlag(combatant, flag) {
    const isActive = !!combatant.getFlag(game.system.id, flag);
    await combatant.setFlag(game.system.id, flag, !isActive);
  }

  /**
   * Handle a Combatant control toggle
   * @private
   * @param {Event} event   The originating mousedown event
   */
  async _onCombatantControl(event) {
    event.preventDefault();
    event.stopPropagation();
    const btn = event.currentTarget;
    const li = btn.closest.combatant;
    this.viewed;
    return super._onCombatantControl(event);
  }

  // ===========================================================================
  // ADDITIONS TO THE COMBATANT CONTEXT MENU
  // ===========================================================================

  _getEntryContextOptions() {
    const options = super._getEntryContextOptions();
    return [
      {
        name: game.i18n.localize("WWN.combat.SetCombatantAsActive"),
        icon: '<i class="fas fa-star-of-life"></i>',
        callback: (li) => {
          const combatantId = li.dataset.combatantId;
          const turnToActivate = this.viewed.turns.findIndex(t => t.id === combatantId);
          this.viewed.activateCombatant(turnToActivate);
        }
      },
      ...options
    ];
  }
}