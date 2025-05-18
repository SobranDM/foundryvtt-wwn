/**
 * @file System-level odifications to the way combat works
 */

/**
 * An extension of Foundry's Combat class that implements initiative for individual combatants.
 *
 * @todo Use a single chat card for rolling group initiative
 */
export class WWNCombat extends Combat {
  static FORMULA = "@initiativeRoll + @init";

  get #rerollBehavior() {
    return game.settings.get(game.system.id, "rerollInitiative");
  }

  // ===========================================================================
  // INITIATIVE MANAGEMENT
  // ===========================================================================

  async #rollAbsolutelyEveryone() {
    await this.rollInitiative(
      // this.combatants.map(c => c.id),
      // { formula: this.constructor.FORMULA }
    );
  }


  // ===========================================================================
  // COMBAT LIFECYCLE MANAGEMENT
  // ===========================================================================

  async startCombat() {
    await super.startCombat();
    if (this.#rerollBehavior !== "reset")
      await this.#rollAbsolutelyEveryone();
    return this;
  }

  async _onEndRound() {
    switch (this.#rerollBehavior) {
      case "reset":
        this.resetAll();
        break;
      case "reroll":
        this.#rollAbsolutelyEveryone();
        break;
      case "keep":
      default:
        break;
    }
    // @ts-expect-error - This method exists, but the types package doesn't have it
    await super._onEndRound();
    await this.activateCombatant(0)
  }

  async activateCombatant(turn) {
    if (game.user.isGM) {
      await game.combat.update({ turn });
    }
  }

  async rollInitiative() {
    const combatants = game.combat.combatants;
    const results = {};

    for (let combatant of combatants) {
      const combatantData = combatant.token.delta.syntheticActor.system;
      const roll = new Roll(`${combatantData.initiative.roll}+${combatantData.initiative.value}`);
      const evaluatedRoll = await roll.evaluate();

      results[combatant.id] = {
        initiative: evaluatedRoll.total,
        roll: evaluatedRoll
      }
    }

    const updates = this.combatants.map((c) => ({ _id: c.id, initiative: results[c.id].initiative }));
    await this.updateEmbeddedDocuments("Combatant", updates);
    await this.#rollInitiativeUIFeedback(results);
    await this.activateCombatant(0);
    return this;
  }

  async #rollInitiativeUIFeedback(results = {}) {
    // Collect all roll results
    const rollResults = [];

    // Process each combatant's roll
    for (const [id, result] of Object.entries(results)) {
      const combatant = this.combatants.get(id);
      if (!combatant) continue;

      const rollWWN = await result.roll.render();
      rollResults.push({
        group: combatant.name,
        rollWWN,
        roll: result.roll
      });
    }

    // Sort results by initiative (highest first)
    rollResults.sort((a, b) => b.roll.total - a.roll.total);

    // Create a single chat message with all rolls
    const content = `
      <div class="initiative-header">Individual Initiative</div>
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
  // Randomize NPC HP
  // ===========================================================================
  static async preCreateToken(token, data, options, userId) {
    const actor = game.actors.get(data.actorId);
    const newData = {};

    if (!actor || data.actorLink || !game.settings.get("wwn", "randomHP")) {
      return token.updateSource(newData);
    }

    let newTotal = 0;
    const modSplit = token.actor.system.hp.hd.split("+");
    const dieSize = modSplit[0].split("d")[1];
    const dieCount = modSplit[0].split("d")[0];
    for (let i = 0; i < dieCount; i++) {
      newTotal += Math.floor(Math.random() * dieSize + 1);
    }
    newTotal += parseInt(modSplit[1]) || 0;

    foundry.utils.setProperty(newData, "delta.system.hp.value", newTotal);
    foundry.utils.setProperty(newData, "delta.system.hp.max", newTotal);

    return token.updateSource(newData);
  }
}
