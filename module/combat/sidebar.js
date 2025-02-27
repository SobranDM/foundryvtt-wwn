import { WWN } from "../config.js";
import { WWNGroupCombat } from "./combat-group.js";
import WWNCombatGroupSelector from "./combat-set-groups.js";

export class WWNCombatTab extends CombatTracker {
  // ===========================================================================
  // APPLICATION SETUP
  // ===========================================================================

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: 'systems/wwn/templates/sidebar/combat-tracker.hbs',
    });
  }

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
    }, []);

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
    const li = btn.closest(".combatant");
    const combat = this.viewed;
    const c = combat.combatants.get(li.dataset.combatantId);

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
          const combatantId = li.data('combatant-id')
          const turnToActivate = this.viewed.turns.findIndex(t => t.id === combatantId);
          this.viewed.activateCombatant(turnToActivate);
        }
      },
      ...options
    ];
  }
}