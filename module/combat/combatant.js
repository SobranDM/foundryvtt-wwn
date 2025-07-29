export class WWNCombatant extends Combatant {
  static INITIATIVE_VALUE_DEFEATED = -790

  // ===========================================================================
  // BOOLEAN FLAGS
  // ===========================================================================

  get isDefeated() {
    if (this.defeated) return true

    return !this.defeated && (this.actor.system.hp?.value === 0 || this.actor.system.health?.value === 0)
  }

  // ===========================================================================
  // INITIATIVE MANAGEMENT
  // ===========================================================================

  getInitiativeRoll(formula) {
    let term = formula || CONFIG.Combat.initiative.formula
    if (this.isDefeated) term = `${WWNCombatant.INITIATIVE_VALUE_DEFEATED}`
    const rollData = this.actor?.getRollData() || {}
    return new Roll(term, rollData)
  }

  async getData(options = {}) {
    return await super.getData(options)
  }

  getGroupSuffix() {
    const items = this.token?.delta?.syntheticActor?.items ?? [];

    const topCombatant = items.some(i =>
      (i.name === "Alert" && i.system?.ownedLevel === 2) ||
      i.name === "Vigilant"
    );

    return topCombatant ? "*" : "";
  }

  /**
   * Assign this combatant to a group.
   *
   * @param {string} groupName - The name of the group to assign this combatant to. If empty, the group will be automatically determined.
   */
  async assignGroup(groupName) {
    if (!groupName) {
      groupName = this.groupRaw
    }

    if (this.group?.name === groupName) {
      return
    }

    const suffix = this.getGroupSuffix();

    await this.combat.assignGroup(this, groupName + suffix)
  }

  async updateGroup() {
    const group = this.group
    if (group === null) return

    await this.combat.updateGroup(group)
  }

  /**
   * Key for the group to which this combatant should belong.
   *
   * @returns {string} - The group key for this combatant.
   */
  get groupRaw() {
    const assignedGroup = this.group?.name
    if (assignedGroup) {
      return assignedGroup
    }

    switch (this.token?.disposition) {
      case -1:
        return "red";
      case 0:
        return "purple";
      case 1:
        return "green";
      default:
        return "white";
    }
  }
}
