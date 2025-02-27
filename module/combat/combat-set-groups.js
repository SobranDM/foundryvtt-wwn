import { colorGroups } from "./combat-group.js";

const {
  HandlebarsApplicationMixin,
  ApplicationV2
} = foundry.applications.api;

export default class WWNCombatGroupSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  _highlighted;


  // ===========================================================================
  // APPLICATION SETUP
  // ===========================================================================
  static DEFAULT_OPTIONS = {
    id: "combat-set-groups-{id}",
    classes: ["combat-set-groups", "scrollable"],
    tag: "form",
    window: {
      frame: true,
      positioned: true,
      title: "WWN.combat.SetCombatantGroups",
      icon: "fa-flag",
      controls: [],
      minimizable: false,
      resizable: true,
      contentTag: "section",
      contentClasses: []
    },
    actions: {},
    form: {
      handler: undefined,
      submitOnChange: true
    },
    position: {
      width: 330,
      height: "auto"
    }
  }

  static PARTS = {
    main: {
      template: `/systems/wwn/templates/apps/combat-set-groups.hbs`
    }
  }


  // ===========================================================================
  // RENDER SETUP
  // ===========================================================================

  async _prepareContext(_options) {
    return {
      groups: colorGroups,
      combatants: game.combat.combatants,
    }
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for (const li of this.element.querySelectorAll("[data-combatant-id]")) {
      li.addEventListener("mouseover", this.#onCombatantHoverIn.bind(this));
      li.addEventListener("mouseout", this.#onCombatantHoverOut.bind(this));
    }
    this.element.addEventListener("change", this._updateObject);
  }


  // ===========================================================================
  // UPDATING
  // ===========================================================================

  async _updateObject(event) {
    const combatant = game.combat.combatants.get(event.target.name);
    await combatant.setFlag(game.system.id, "group", event.target.value)
  }


  // ===========================================================================
  // UI EVENTS
  // ===========================================================================

  #onCombatantHoverIn(event) {
    event.preventDefault();
    if (!canvas.ready) return;
    const li = event.currentTarget;
    const combatant = game.combat.combatants.get(li.dataset.combatantId);
    const token = combatant.token?.object;
    if (token?.isVisible) {
      if (!token.controlled) token._onHoverIn(event, { hoverOutOthers: true });
      this._highlighted = token;
    }
  }

  #onCombatantHoverOut(event) {
    event.preventDefault();
    if (this._highlighted) this._highlighted._onHoverOut(event);
    this._highlighted = null;
  }
}