/**
 * Applies custom styling and controls to the combat tracker
 */
export default class WWNCombatTracker extends foundry.applications.sidebar.tabs
  .CombatTracker {
  static DEFAULT_OPTIONS = {
    ...foundry.applications.sidebar.tabs.CombatTracker.DEFAULT_OPTIONS,
    actions: {
      ...foundry.applications.sidebar.tabs.CombatTracker.DEFAULT_OPTIONS
        .actions
    }
  }

  /** @inheritDoc */
  async _prepareTrackerContext(context, options) {
    await super._prepareTrackerContext(context, options)
    context.turns?.forEach(turn => {
      const combatant = game.combat.combatants.get(turn.id)
      turn.isOwnedByUser = !!combatant.actor?.isOwner
      turn.group = combatant.group
    })
    return context
  }

  /** @inheritDoc */
  async _onCombatantControl(event, target) {
    event.preventDefault()
    event.stopPropagation()

    return super._onCombatantControl(event, target)
  }

  /** @inheritDoc */
  _getEntryContextOptions() {
    const options = super._getEntryContextOptions()

    if (game.user.isGM) {
      options.unshift({
        name: game.i18n.localize("WWN.combat.SetCombatantAsActive"),
        icon: '<i class="fas fa-star-of-life"></i>',
        callback: li => {
          const { combatantId } = li.dataset;
          const turnToActivate = this.viewed.turns.findIndex(
            t => t.id === combatantId
          );
          this.viewed.activateCombatant(turnToActivate);
        }
      });
    }

    return options;
  }

  /**
   * Handle rendering of the combat tracker
   * @param {HTMLElement} html - The HTML element
   */
  async renderGroups(html) {
    // Only proceed if group initiative is enabled
    if (!this.viewed || game.settings.get(game.system.id, "initiative") !== "group") return;

    // Apply group colors to token names
    const tokenNames = html.querySelectorAll(".combatant > div.token-name");
    for (const tokenName of tokenNames) {
      const combatantElement = tokenName.closest(".combatant");
      if (!combatantElement) continue;

      const combatantId = combatantElement.dataset.combatantId;
      const combatant = game.combat.combatants.get(combatantId);
      if (!combatant || !combatant?.group) continue;

      const label = (combatant.group?.name ?? "").replace(/\*$/, "");

      // Apply color gradient based on group
      tokenName.style.background = `linear-gradient(90deg, var(--wwn-group-color-${label}, ${label}), transparent)`;
      tokenName.style.borderRadius = "4px";
      tokenName.style.padding = "2px";

      // Add group control button if user is GM
      if (game.user.isGM) {
        const controls = combatantElement.querySelector(".combatant-controls");
        if (controls && !controls.querySelector('[data-control="set-group"]')) {
          const groupButton = document.createElement("a");
          groupButton.className = "combatant-control";
          groupButton.setAttribute("role", "button");
          groupButton.setAttribute("data-tooltip", game.i18n.localize("WWN.combat.SetCombatantGroups"));
          groupButton.setAttribute("data-control", "set-group");
          groupButton.innerHTML = '<i class="fas fa-flag"></i>';

          // Insert at the start of controls
          controls.insertBefore(groupButton, controls.firstChild);

          // Add click handler
          groupButton.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            const groups = Object.keys(CONFIG.WWN.colors).map(key => ({
              key,
              color: `var(--wwn-group-color-${key})`,
              label: game.i18n.localize(CONFIG.WWN.colors[key])
            }));

            // Create dialog content
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

            new Dialog({
              title: game.i18n.localize("WWN.combat.SetCombatantGroups"),
              content,
              buttons: {
                set: {
                  icon: '<i class="fas fa-check"></i>',
                  label: game.i18n.localize("Submit"),
                  callback: async (html) => {
                    const formData = new FormData(html[0].querySelector("form"));
                    const group = formData.get("group");
                    await combatant.assignGroup(group)
                  }
                },
                cancel: {
                  icon: '<i class="fas fa-times"></i>',
                  label: game.i18n.localize("Cancel")
                }
              },
              default: "set"
            }).render(true);
          });
        }
      }

      if (!game.user.isGM) {
        const isOwned = !!combatant.actor?.isOwner;
        if (!isOwned) continue
        const input = combatantElement.querySelector("input.initiative-input");
        if (input) input.removeAttribute("readonly");
      }
    }
  }
}