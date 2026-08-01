import { WWN } from "../config/index.mjs"
import { applyAppThemeClasses } from "../config/themes.mjs"

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api

export default class WWNCombatGroupSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  // ===========================================================================
  // APPLICATION SETUP
  // ===========================================================================
  static DEFAULT_OPTIONS = {
    id: "combat-set-groups-{id}",
    classes: ["wwn", "wwn-app", "wwn-app--combat-set-groups", "combat-set-groups", "scrollable"],
    tag: "form",
    window: {
      frame: true,
      positioned: true,
      title: "WWN.combat.SetCombatantGroups",
      icon: "fa-solid fa-flag",
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

  /** @inheritDoc */
  async _prepareContext(options) {
    return {
      groups: WWN.colors,
      combatants: game.combat?.combatants || []
    }
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    applyAppThemeClasses(this.element);
    // Bind once — ApplicationV2 reuses this.element across re-renders.
    if (!this.#listenersBound) {
      this.#onChange = this._updateObject.bind(this);
      this.#onHoverIn = this.#onCombatantHoverIn.bind(this);
      this.#onHoverOut = this.#onCombatantHoverOut.bind(this);
      this.element.addEventListener("change", this.#onChange);
      this.element.addEventListener("mouseover", this.#onHoverIn);
      this.element.addEventListener("mouseout", this.#onHoverOut);
      this.#listenersBound = true;
    }
  }

  #listenersBound = false;
  #onChange;
  #onHoverIn;
  #onHoverOut;

  // ===========================================================================
  // UPDATING
  // ===========================================================================

  /** @inheritDoc */
  async _updateObject(event) {
    event.preventDefault()
    event.stopPropagation()
    const input = event.target
    if (!input?.name || !input?.value) return
    const combatant = game.combat?.combatants.get(input.name)
    if (!combatant) return
    await combatant.assignGroup(input.value)
  }

  // ===========================================================================
  // UI EVENTS
  // ===========================================================================

  #onCombatantHoverIn(event) {
    event.preventDefault()
    if (!canvas.ready) return
    const li = event.target?.closest?.("[data-combatant-id]")
    if (!li || !this.element.contains(li)) return
    const { combatantId } = li.dataset
    if (!combatantId) return
    const combatant = game.combat?.combatants.get(combatantId)
    const token = combatant?.token?.object
    if (token?.isVisible) {
      if (!token.controlled) {
        token._onHoverIn(event, { hoverOutOthers: true })
      }
      this._highlighted = token
    }
  }

  #onCombatantHoverOut(event) {
    event.preventDefault()
    if (this._highlighted) {
      this._highlighted._onHoverOut(event)
    }
    this._highlighted = null
  }
}
