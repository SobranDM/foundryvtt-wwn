import { WWNGroupCombatant } from "./combatant-group.js";
import { colorGroups } from "./combat-group.js";

// Map of group keys to vibrant but readable hex colors
const groupColors = {
  green: "#2d8a4d",    // Vibrant forest green
  red: "#c43c3c",      // Rich red
  yellow: "#d4b82e",   // Bright gold
  purple: "#8c3d8c",   // Rich purple
  blue: "#3d5d9c",     // Deep blue
  orange: "#d47c2e",   // Rich orange
  white: "#7aa8c9",    // Slightly more saturated blue-gray
  black: "#3d3d3d"     // Slightly lighter dark gray
};

/**
 * Applies custom styling and controls to the combat tracker
 */
export class WWNCombatTracker {
  static init() {
    Hooks.on("renderCombatTracker", this._onRenderCombatTracker.bind(this));
  }

  /**
   * Handle rendering of the combat tracker
   * @param {CombatTracker} app - The combat tracker application
   * @param {HTMLElement} html - The HTML element
   */
  static async _onRenderCombatTracker(app, html) {
    // Only proceed if group initiative is enabled
    if (game.settings.get(game.system.id, "initiative") !== "group") return;

    // Apply group colors to token names
    const tokenNames = html.querySelectorAll("#combat > ol > li > div.token-name");

    for (const tokenName of tokenNames) {
      const combatant = tokenName.closest(".combatant");
      if (!combatant) continue;

      const combatantId = combatant.dataset.combatantId;
      const combatantObj = game.combat.combatants.get(combatantId);
      if (!combatantObj) continue;

      // Apply color gradient based on group
      const group = combatantObj.group;
      const color = groupColors[group] || groupColors.white;
      tokenName.style.background = `linear-gradient(90deg, ${color}66, transparent)`;
      tokenName.style.borderRadius = "4px";
      tokenName.style.padding = "2px";

      // Add group control button if user is GM
      if (game.user.isGM) {
        const controls = combatant.querySelector(".combatant-controls");
        if (controls) {
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

            // Create a simple dialog to select group
            const groups = Object.entries(colorGroups).map(([key]) => ({
              key,
              color: groupColors[key],
              label: game.i18n.localize(`WWN.combat.Group.${key}`)
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
              content: content,
              buttons: {
                set: {
                  icon: '<i class="fas fa-check"></i>',
                  label: game.i18n.localize("Submit"),
                  callback: async (html) => {
                    const formData = new FormData(html[0].querySelector("form"));
                    const group = formData.get("group");
                    await combatantObj.setFlag(game.system.id, "group", group);
                    app.render();
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
    }
  }
} 