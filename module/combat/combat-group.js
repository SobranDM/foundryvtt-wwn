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
      const groupCombatants = game.combat.combatants.filter(c => c.group === group);
      const alertOneCombatants = groupCombatants.find(c => c.token.delta.syntheticActor.items.find(i => i.name === "Alert" && i.system.ownedLevel === 1));
      const initValues = groupCombatants
        .map(c => alertOneCombatants ? c.token.delta.syntheticActor.system.initiative.value + 1 : c.token.delta.syntheticActor.system.initiative.value);
      return Math.max(...initValues);
    });

    const rollPerGroup = groupsToRollFor.reduce((prev, curr) => ({
      ...prev,
      [curr]: new Roll(`1d8+${groupInitiatives[groupsToRollFor.indexOf(curr)]}`)
    }), {});

    const results = await this.#prepareGroupInitiativeDice(rollPerGroup);

    // Check for ties and resolve them
    const initiativeValues = new Map();
    for (const [group, result] of Object.entries(results)) {
      if (group === "black") continue; // Skip black group
      const value = result.initiative;
      if (!initiativeValues.has(value)) {
        initiativeValues.set(value, []);
      }
      initiativeValues.get(value).push(group);
    }

    // For each tie, randomly select one group to get a small bonus
    for (const [value, groups] of initiativeValues.entries()) {
      if (groups.length > 1) {
        // Randomly select one group to get the bonus
        const selectedGroup = groups[Math.floor(Math.random() * groups.length)];
        results[selectedGroup].initiative = value + 0.001;
      }
    }

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
    // Collect all roll results
    const rollResults = [];

    // Handle regular groups first
    for (const [group, result] of Object.entries(groups)) {
      if (group === "black") continue; // Skip black group for now

      const rollWWN = await result.roll.render();
      rollResults.push({
        group: group.charAt(0).toUpperCase() + group.slice(1), // Capitalize first letter
        rollWWN,
        roll: result.roll
      });
    }

    // Handle alert combatants
    for (const combatant of this.combatants.filter(c => c.group === "black")) {
      const alertResult = this.alertResults[combatant.id];
      if (!alertResult) continue;

      const rollWWN = await alertResult.roll.render();
      rollResults.push({
        group: combatant.name,
        rollWWN,
        roll: alertResult.roll
      });
    }

    // Sort results by initiative (highest first)
    rollResults.sort((a, b) => b.roll.total - a.roll.total);

    // Create a single chat message with all rolls
    const content = `
      <div class="initiative-header">Group Initiative</div>
      ${rollResults.map(result => `
        <div class="initiative-roll">
          <div class="roll-header">${result.group}</div>
          ${result.rollWWN}
        </div>
      `).join('')}
    `;

    const chatData = {
      speaker: { alias: game.i18n.localize("WWN.Initiative") },
      sound: CONFIG.sounds.dice,
      content: `<div class="wwn chat-message"><div class="wwn chat-block">${content}</div></div>`
    };

    // Handle Dice So Nice for all rolls
    if (game.dice3d) {
      for (const result of rollResults) {
        await game.dice3d.showForRoll(result.roll, game.user, true);
      }
    }

    await ChatMessage.create(chatData);
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

  /**
   * Override nextTurn to handle group initiative
   * @returns {Promise<this>}
   */
  async nextTurn() {
    if (this.round === 0) return this.nextRound();

    // Get current combatant and its group
    const currentCombatant = this.combatants.get(this.current.combatantId);
    if (!currentCombatant) return this.nextRound();

    // Get all groups sorted by initiative
    const groups = [...new Set(this.combatants.map(c => c.group))]
      .map(group => {
        const combatants = this.combatants.filter(c => c.group === group);
        const initiative = Math.max(...combatants.map(c => c.initiative));
        return { group, initiative };
      })
      .sort((a, b) => b.initiative - a.initiative); // Sort by initiative, highest first

    const currentGroupIndex = groups.findIndex(g => g.group === currentCombatant.group);

    // If we're on the last group, move to next round
    if (currentGroupIndex === groups.length - 1) {
      return this.nextRound();
    }

    // Move to first combatant of next group
    const nextGroup = groups[currentGroupIndex + 1].group;
    const nextCombatant = this.combatants.find(c => c.group === nextGroup);
    if (!nextCombatant) return this.nextRound();

    const turnIndex = this.turns.findIndex(t => t.id === nextCombatant.id);
    const advanceTime = this.getTimeDelta(this.round, this.turn, this.round, turnIndex);

    // Update the document, passing data through a hook first
    const updateData = { round: this.round, turn: turnIndex };
    const updateOptions = { direction: 1, worldTime: { delta: advanceTime } };
    Hooks.callAll("combatTurn", this, updateData, updateOptions);
    await this.update(updateData, updateOptions);
    return this;
  }

  /**
   * Override previousTurn to handle group initiative
   * @returns {Promise<this>}
   */
  async previousTurn() {
    if (this.round === 0) return this;

    // Get current combatant and its group
    const currentCombatant = this.combatants.get(this.current.combatantId);
    if (!currentCombatant) return this.previousRound();

    // Get all groups sorted by initiative
    const groups = [...new Set(this.combatants.map(c => c.group))]
      .map(group => {
        const combatants = this.combatants.filter(c => c.group === group);
        const initiative = Math.max(...combatants.map(c => c.initiative));
        return { group, initiative };
      })
      .sort((a, b) => b.initiative - a.initiative); // Sort by initiative, highest first

    const currentGroupIndex = groups.findIndex(g => g.group === currentCombatant.group);

    // If we're on the first group, move to previous round
    if (currentGroupIndex === 0) {
      return this.previousRound();
    }

    // Move to first combatant of previous group
    const prevGroup = groups[currentGroupIndex - 1].group;
    const prevCombatant = this.combatants.find(c => c.group === prevGroup);
    if (!prevCombatant) return this.previousRound();

    const turnIndex = this.turns.findIndex(t => t.id === prevCombatant.id);
    const advanceTime = this.getTimeDelta(this.round, this.turn, this.round, turnIndex);

    // Update the document, passing data through a hook first
    const updateData = { round: this.round, turn: turnIndex };
    const updateOptions = { direction: -1, worldTime: { delta: advanceTime } };
    Hooks.callAll("combatTurn", this, updateData, updateOptions);
    await this.update(updateData, updateOptions);
    return this;
  }

  /**
   * Override setInitiative to update all combatants in the same group
   * @param {string} id         The combatant ID for which to set initiative
   * @param {number} value      A specific initiative value to set
   */
  async setInitiative(id, value) {
    const combatant = this.combatants.get(id, { strict: true });
    if (!combatant) return;

    // Get all combatants in the same group
    const groupCombatants = this.combatants.filter(c => c.group === combatant.group);

    // Update all combatants in the group
    const updates = groupCombatants.map(c => ({
      _id: c.id,
      initiative: value
    }));

    await this.updateEmbeddedDocuments("Combatant", updates);
  }
}