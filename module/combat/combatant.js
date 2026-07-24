export class WWNCombatant extends Combatant {
  static INITIATIVE_VALUE_DEFEATED = -790

  // ===========================================================================
  // BOOLEAN FLAGS
  // ===========================================================================

  get isDefeated() {
    if (this.defeated) return true

    const actor = this.actor
    if (!actor) return false

    // Mortally damaged ships remain in the fight on a fuse; only burnt-out hulks / fighters at 0 HP are out.
    if (actor.type === "starship") {
      if (actor.getFlag("wwn", "burntOutHulk")) return true
      if (actor.getFlag("wwn", "mortallyDamaged")) return false
      return (actor.system.hp?.value === 0)
    }

    return (actor.system.hp?.value === 0 || actor.system.health?.value === 0)
  }

  // ===========================================================================
  // INITIATIVE MANAGEMENT
  // ===========================================================================

  getInitiativeRoll(formula) {
    let term = formula || CONFIG.Combat.initiative.formula
    if (this.combat?.isStarshipEncounter && this.actor?.type === "starship") {
      const bridgeUuid = this.actor.system?.stations?.bridge?.actor;
      let mod = 0;
      if (bridgeUuid) {
        try {
          const bridge = fromUuidSync(bridgeUuid);
          const abs = bridge?.system?.abilities;
          if (abs) {
            const int = Number(abs.int?.mod) || 0;
            const dex = Number(abs.dex?.mod) || 0;
            mod = Math.max(int, dex);
          }
        } catch { /* ignore */ }
      }
      term = mod >= 0 ? `1d8 + ${mod}` : `1d8 - ${Math.abs(mod)}`;
    }
    if (this.isDefeated) term = `${WWNCombatant.INITIATIVE_VALUE_DEFEATED}`
    const rollData = this.actor?.getRollData() || {}
    return new Roll(term, rollData)
  }

  async getData(options = {}) {
    return await super.getData(options)
  }

  getGroupSuffix() {
    const init = this.actor?.system?.combat?.initiative;
    const individualMod = Number(init?.individual?.mod) || 0;
    const groupMod = Number(init?.group?.mod) || 0;
    // Alert L2 / Vigilant style: large individual or group init mods
    return individualMod >= 100 || groupMod >= 100 ? "*" : "";
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
