export class WWNCombatant extends Combatant {

  // ===========================================================================
  // BOOLEAN FLAGS
  // ===========================================================================

  get isDefeated() {
    if (this.defeated)
      return true;

    return !this.defeated && (this.actor.system.hp.value === 0)
  }

  // ===========================================================================
  // INITIATIVE MANAGEMENT
  // ===========================================================================

  getInitiativeRoll(formula) {
    let term = formula || CONFIG.Combat.initiative.formula;

    return new Roll(term);
  }

  async getData(options = {}) {
    const context = await super.getData(options);
    return foundry.utils.mergeObject(context, {});
  }

}