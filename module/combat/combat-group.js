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

    // Rewrite to make new roll for each black group combatant, using similar logic to what
    // is done in rollPerGroup / #prepareGroupInitiativeDice

    const alertCombatants = this.combatants.filter(c => c.group === "black");
    const alertResults = {};
    for (const combatant of alertCombatants) {
      const combatantData = combatant.token.delta.syntheticActor.system;
      const roll = new Roll(`${combatantData.initiative.roll}+${combatantData.initiative.value}`);
      const evaluatedRoll = await roll.evaluate();
      alertResults[combatant.id] = {
        initiative: evaluatedRoll.total,
        roll: evaluatedRoll
      };
    }

    const updates = this.combatants.map(
      (c) => ({ _id: c.id, initiative: c.group === "black" ? alertResults[c.id].initiative : results[c.group].initiative })
    )



    await this.updateEmbeddedDocuments("Combatant", updates);
    await this.#rollInitiativeUIFeedback(results);
    await this.activateCombatant(0);
    return this;
  }

  async #prepareGroupInitiativeDice(rollPerGroup) {
    console.log(rollPerGroup);
    const pool = foundry.dice.terms.PoolTerm.fromRolls(Object.values(rollPerGroup));
    const evaluatedRolls = await Roll.fromTerms([pool]).roll();
    const rollValues = evaluatedRolls.dice.map(d => d.total);
    if (this.availableGroups.includes("black")) {
      rollValues.splice(this.availableGroups.indexOf('black'), 0, 0)
    }
    console.log(this.availableGroups);

    return this.availableGroups.reduce((prev, curr, i) => ({
      ...prev,
      [[curr]]: {
        initiative: rollValues[i],
        roll: evaluatedRolls.dice[i]
      }
    }), {});
  }

  async #rollInitiativeUIFeedback(groups = []) {
    console.log(groups);
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
    if (group === "black") {
      // TODO: Display individual initiative rolls for black group combatants
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
                            <span class="part-formula">${roll.formula}</span>
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