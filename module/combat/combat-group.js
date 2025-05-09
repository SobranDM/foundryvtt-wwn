import { WWN } from "../config.js";
import { WWNCombat } from "./combat.js";
import { WWNGroupCombatant } from "./combatant-group.js";

export const colorGroups = WWN.colors;

/**
 * An extension of Foundry's Combat class that implements side-based initiative.
 *
 * @todo Display the initiative results roll as a chat card
 */
export class WWNGroupCombat extends WWNCombat {
  // ===========================================================================
  // STATIC MEMBERS
  // ===========================================================================

  static get GROUPS() {
    return {
      ...colorGroups,
    };
  }

  // ===========================================================================
  // INITIATIVE MANAGEMENT
  // ===========================================================================

  async #rollAbsolutelyEveryone() {
    await this.rollInitiative();
  }

  async rollInitiative() {
    const groupsToRollFor = this.availableGroups.filter(g => g !== "black");
    const groupInitiatives = groupsToRollFor.map(group => {
      const initValues = game.combat.combatants
        .filter(c => c.group === group)
        .map(c => c.token.delta.syntheticActor.system.initiative.value);
      return Math.max(...initValues);
    });
    const rollPerGroup = groupsToRollFor.reduce((prev, curr) => ({
      ...prev,
      [curr]: new Roll(`1d8+${groupInitiatives[groupsToRollFor.indexOf(curr)]}`)
    }), {});

    const results = await this.#prepareGroupInitiativeDice(rollPerGroup);

    const alertCombatants = this.combatants.filter(c => c.group === "black");
    this.alertResults = {};
    for (const combatant of alertCombatants) {
      const combatantData = combatant.token.delta.syntheticActor.system;
      const roll = new Roll(`${combatantData.initiative.roll}+${combatantData.initiative.value}`);
      const evaluatedRoll = await roll.evaluate();
      this.alertResults[combatant.id] = {
        initiative: evaluatedRoll.total,
        roll: evaluatedRoll
      };
    }

    const updates = this.combatants.map(
      (c) => ({ _id: c.id, initiative: c.group === "black" ? this.alertResults[c.id].initiative : results[c.group].initiative })
    )

    await this.updateEmbeddedDocuments("Combatant", updates);
    await this.#rollInitiativeUIFeedback(results);
    await this.activateCombatant(0);
    return this;
  }

  async #prepareGroupInitiativeDice(rollPerGroup) {
    const groupLength = Object.keys(rollPerGroup).length;
    const groupRolls = {};
    for (const group in rollPerGroup) {
      groupRolls[group] = await new Roll(rollPerGroup[group].formula).evaluate();
    }

    if (this.availableGroups.includes("black")) {
      groupRolls.black = { initiative: 0, roll: null };
    }

    return this.availableGroups.reduce((prev, curr, i) => ({
      ...prev,
      [curr]: {
        initiative: groupRolls[curr].total,
        roll: groupRolls[curr]
      }
    }), {});
  }

  async #rollInitiativeUIFeedback(groups = []) {
    const content = [
      Object.keys(groups).map(
        (k) => this.#constructInitiativeOutputForGroup(k, groups[k].roll)
      ).join("\n")
    ];
    const chatData = content.map(c => {
      return {
        speaker: { alias: game.i18n.localize("WWN.Initiative") },
        sound: CONFIG.sounds.dice,
        content: c
      };
    });
    ChatMessage.implementation.createDocuments(chatData);
  }

  #constructInitiativeOutputForGroup(group, roll) {
    console.log(group, roll);
    if (group === "black") {
      const alertCombatants = this.combatants.filter(c => c.group === "black");
      return alertCombatants.map(combatant => {
        const alertResult = this.alertResults[combatant.id];
        if (!alertResult) return '';

        return `
        <p>${game.i18n.format("WWN.roll.initiative", { group: combatant.name })}
        <div class="dice-roll">   
          <div class="dice-result">
            <div class="dice-formula">${alertResult.roll.formula}</div>
              <div class="dice-tooltip">
                    <section class="tooltip-part">
                      <div class="dice">
                          <header class="part-header flexrow">
                              <span class="part-formula">${alertResult.roll.formula}</span>
                              <span class="part-total">${alertResult.roll.total}</span>
                          </header>
                      </div>
                    </section>
              </div>
            <h4 class="dice-total">${alertResult.roll.total}</h4>
          </div>
        </div>
      `;
      }).join("\n");
    } else {
      return `
      <p>${game.i18n.format("WWN.roll.initiative", { group })}
      <div class="dice-roll">   
        <div class="dice-result">
          <div class="dice-formula">${roll.formula}</div>
            <div class="dice-tooltip">
                  <section class="tooltip-part">
                    <div class="dice">
                        <header class="part-header flexrow">
                            <span class="part-formula">${roll.terms.map(t => t.total).join(" ")}</span>
                            <span class="part-total">${roll.total}</span>
                        </header>
                    </div>
                  </section>
            </div>
          <h4 class="dice-total">${roll.total}</h4>
        </div>
      </div>
    `;
    }
  }

  // ===========================================================================
  // GROUP GETTERS
  //
  // Get groups as:
  // - a list of strings
  // - a list of strings with combatants attached
  // - a map of groups to their initiative results
  // ===========================================================================

  get availableGroups() {
    return [...new Set(
      this.combatants.map(c => c.group)
    )]
  }

  get combatantsByGroup() {
    return this.availableGroups.reduce((prev, curr) => ({
      ...prev,
      [curr]: this.combatants.filter(c => c.group === curr)
    }), {});
  }

  get groupInitiativeScores() {
    const initiativeMap = new Map()
    for (const group in this.combatantsByGroup) {
      initiativeMap.set(group, this.combatantsByGroup[group][0].initiative)
    }

    return initiativeMap;
  }
}