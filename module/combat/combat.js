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
    await this.activateCombatant(0);
    return this;
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
