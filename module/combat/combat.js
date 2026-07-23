/**
 * @file System-level modifications to the way combat works
 */
import { WWN } from "../config/index.mjs"
import WWNCombatGroupSelector from "./combat-set-groups.js"
import { findAdjacentGroupTurn } from "./side-collapse.mjs"
import { isNpc } from "../helpers/actor-types.mjs";

/**
 * An extension of Foundry's Combat class that implements initiative for individual combatants.
 */
export class WWNCombat extends foundry.documents.Combat {
  static FORMULA = "@initiativeRoll + @init"

  static get GROUPS() {
    return {
      ...WWN.colors
    }
  }

  #combatantGroups = new Map()

  // ===========================================================================
  // INITIATIVE MANAGEMENT
  // ===========================================================================

  get #rerollBehavior() {
    return game.settings.get(game.system.id, "rerollInitiative");
  }

  get isGroupInitiative() {
    return game.settings.get(game.system.id, "initiative") === "group";
  }

  /**
   * Group initiative + collapse-sides setting: side-skip turns and nested tracker.
   * @returns {boolean}
   */
  get isSideCollapseEnabled() {
    return (
      this.isGroupInitiative &&
      game.settings.get(game.system.id, "collapseSidesInGroupInitiative") === true
    );
  }

  /**
   * Descriptors used by side-collapse turn helpers.
   * @returns {{ id: string, groupId: string|null, isDefeated: boolean }[]}
   */
  #sideCollapseTurns() {
    return this.turns.map(c => ({
      id: c.id,
      groupId: c.group?.id ?? null,
      isDefeated: c.isDefeated
    }));
  }

  /** @inheritDoc */
  async nextTurn() {
    if (!this.isSideCollapseEnabled) return super.nextTurn();
    if (this.round === 0) return this.nextRound();

    const result = findAdjacentGroupTurn({
      turns: this.#sideCollapseTurns(),
      currentTurnIndex: this.turn,
      direction: 1,
      skipDefeated: this.settings.skipDefeated
    });

    if (result.kind === "none") return this.nextRound();
    if (result.kind === "round") return this.nextRound();

    const nextTurn = result.turnIndex;
    const advanceTime = this.getTimeDelta(this.round, this.turn, this.round, nextTurn);
    const updateData = { round: this.round, turn: nextTurn };
    const updateOptions = { direction: 1, worldTime: { delta: advanceTime } };
    Hooks.callAll("combatTurn", this, updateData, updateOptions);
    await this.update(updateData, updateOptions);
    return this;
  }

  /** @inheritDoc */
  async previousTurn() {
    if (!this.isSideCollapseEnabled) return super.previousTurn();
    if (this.round === 0) return this;

    const result = findAdjacentGroupTurn({
      turns: this.#sideCollapseTurns(),
      currentTurnIndex: this.turn,
      direction: -1,
      skipDefeated: this.settings.skipDefeated
    });

    if (result.kind === "none") return this;
    if (result.kind === "round") return this.previousRound();

    const previousTurn = result.turnIndex;
    const advanceTime = this.getTimeDelta(this.round, this.turn, this.round, previousTurn);
    const updateData = { round: this.round, turn: previousTurn };
    const updateOptions = { direction: -1, worldTime: { delta: advanceTime } };
    Hooks.callAll("combatTurn", this, updateData, updateOptions);
    await this.update(updateData, updateOptions);
    return this;
  }

  async _getGroupInitiativeData(group, olderSiblingGroup, { excludeAlreadyRolled = false } = {}) {
    if (
      group.members.size === 0 ||
      (excludeAlreadyRolled && group.initiative !== null)
    ) {
      return null;
    }

    let initRoll;
    let maxInitValue = -Infinity;
    // AE-seeded init: group.mod >= 1 ≈ Alert L1; individual/group mod >= 100 ≈ Alert L2 / Vigilant
    const hasAlert = [...group.members].some((combatant) => {
      const init = combatant.actor?.system?.combat?.initiative;
      return (Number(init?.group?.mod) || 0) >= 1 && (Number(init?.individual?.mod) || 0) < 100;
    });
    const hasTopCombatant = [...group.members].some((combatant) => {
      const init = combatant.actor?.system?.combat?.initiative;
      return (Number(init?.individual?.mod) || 0) >= 100 || (Number(init?.group?.mod) || 0) >= 100;
    });

    const allMembers = olderSiblingGroup
      ? [...group.members, ...olderSiblingGroup.members]
      : [...group.members];
    for (const combatant of allMembers) {
      const init = combatant.actor?.system?.combat?.initiative;
      if (!init) continue;

      const initValue = init.group?.value ?? init.value ?? -Infinity;
      if (initValue > maxInitValue) maxInitValue = initValue;
      if (!initRoll) initRoll = init.group?.roll ?? init.roll ?? "1d8";
    }

    if (maxInitValue === -Infinity) maxInitValue = 0;

    let rollBonus = maxInitValue;
    if (hasAlert || hasTopCombatant || !!olderSiblingGroup) rollBonus += 1;
    if (hasTopCombatant) rollBonus += 100;
    let roll = new Roll(`${initRoll} + ${rollBonus}`);
    await roll.evaluate();

    const combatantGroupUpdates = []
    combatantGroupUpdates.push({ _id: group.id, initiative: roll.total });

    const combatantUpdates = [];
    for (const combatant of group.members) {
      combatantUpdates.push({
        _id: combatant.id,
        initiative: roll.total
      });
    }

    if (olderSiblingGroup && olderSiblingGroup.members.size > 0 && !(excludeAlreadyRolled && olderSiblingGroup.initiative !== null)) {
      combatantGroupUpdates.push({ _id: olderSiblingGroup.id, initiative: (roll.total + 100) });
      for (const combatant of olderSiblingGroup.members) {
        combatantUpdates.push({
          _id: combatant.id,
          initiative: (roll.total + 100)
        });
      }
    }

    const rollMode = game.settings.get("core", "rollMode");
    const messageData = {
      speaker: {
        alias: game.i18n.localize("WWN.Initiative")
      },
      flavor: game.i18n.format("WWN.roll.initiative", {
        group: foundry.utils.escapeHTML(group.name)
      }),
      flags: { "core.initiativeRoll": true }
    };

    const chatMessage = await roll.toMessage(messageData, {
      rollMode,
      create: false
    });

    return { combatantGroupUpdates, combatantUpdates, chatMessage };
  }

  async #rollAbsolutelyEveryone({
    excludeAlreadyRolled = false,
    updateTurn = false
  } = {}) {
    const formula = WWNCombat.FORMULA

    await this.rollInitiative(
      this.combatants
        .filter(
          c => !c.defeated && (!excludeAlreadyRolled || c.initiative === null)
        )
        .map(c => c.id),
      {
        formula,
        updateTurn
      }
    )
  }

  /** @inheritDoc */
  async rollInitiative(ids, { formula = null, updateTurn = true, messageOptions = {} } = {}) {
    if (!this.isGroupInitiative) {
      return await super.rollInitiative(ids, { formula, updateTurn, messageOptions });
    }
    ids = typeof ids === "string" ? [ids] : ids;
    if (ids.size > 1) return;
    const combatant = this.combatants.get(ids[0]);
    const group = combatant.group;
    const olderSiblingGroup = this.groups.find(g => g.name === group.name + "*");
    const data = await this._getGroupInitiativeData(group, olderSiblingGroup);
    if (!data) return;
    if (game.user.isGM) {
      await this.updateEmbeddedDocuments("CombatantGroup", data.combatantGroupUpdates);
      await this.updateEmbeddedDocuments("Combatant", data.combatantUpdates);
    } else {
      game.socket.emit("system.wwn", {
        action: "updateGroupInitiative",
        data: {
          combatantGroupUpdates: data.combatantGroupUpdates,
          combatantUpdates: data.combatantUpdates
        }
      });
    }
    await foundry.documents.ChatMessage.implementation.create(data.chatMessage);
  }

  async smartRerollInitiative({
    excludeAlreadyRolled = false,
    excludePCGroups = false,
    updateTurn = false
  } = {}) {
    if (!this.isGroupInitiative) {
      return this.#rollAbsolutelyEveryone({ excludeAlreadyRolled, updateTurn });
    }

    const combatantGroupUpdates = [];
    const combatantUpdates = [];
    const messages = [];

    for (const group of this.groups) {
      const baseName = group.name?.replace(/\*$/, "");
      const youngerSiblingExists = this.groups.some(g => g.name === baseName && g !== group && g.members.size > 0);
      if (youngerSiblingExists) continue;

      const olderSiblingGroup = this.groups.find(g => g.name === group.name + "*");

      if (excludePCGroups) {
        let hasPC = [...group.members].some(c => !c.isNPC);
        hasPC = hasPC || [...olderSiblingGroup.members].some(c => !c.isNPC);
        if (hasPC) continue;
      }
      const data = await this._getGroupInitiativeData(group, olderSiblingGroup, { excludeAlreadyRolled });
      if (!data) continue;

      combatantGroupUpdates.push(...data.combatantGroupUpdates);
      combatantUpdates.push(...data.combatantUpdates);
      messages.push(data.chatMessage);
    }

    if (combatantGroupUpdates.length === 0) return this;

    await this.updateEmbeddedDocuments("CombatantGroup", combatantGroupUpdates);
    await this.updateEmbeddedDocuments("Combatant", combatantUpdates);
    await foundry.documents.ChatMessage.implementation.create(messages);

    this.setupTurns();
    const update = { combatants: this.combatants.toObject() };
    update.turn = 0;
    await this.update(update, { turnEvents: false, diff: false });
    await ui.combat.render(true);
    return this;
  }

  /** @inheritDoc */
  async rollAll(options) {
    if (!this.isGroupInitiative) {
      await super.rollAll(options)
    } else {
      await this.smartRerollInitiative()
    }
    let turn = this.turn === null || this.turns.length === 0 ? null : 0
    if (this.settings.skipDefeated && turn !== null) {
      turn = this.turns.findIndex(t => !t.isDefeated)
      if (turn === -1) {
        ui.notifications.warn("COMBAT.NoneRemaining", { localize: true })
        turn = 0
      }
    }
    await this.update({ turn })
    this.setupTurns()
    await ui.combat.render(true)
    return this
  }

  /** @inheritDoc */
  async rollNPC(options = {}) {
    if (!this.isGroupInitiative) {
      await super.rollNPC(options)
    } else {
      await this.smartRerollInitiative({ excludeAlreadyRolled: true, excludePCGroups: true })
    }
  }

  /** @inheritDoc */
  async startCombat() {
    await super.startCombat()
    await this.smartRerollInitiative({ excludeAlreadyRolled: true })
    return this
  }

  /** @inheritDoc */
  async _onEndRound(context) {
    await super._onEndRound(context)
    if (context?.round) {
      switch (this.#rerollBehavior) {
        case "reset":
          await this.resetAll({})
          break
        case "reroll":
          await this.smartRerollInitiative()
          break
        default:
          break
      }
    }

    const npcs = this.combatants.filter(c => isNpc(c.actor));
    npcs.forEach(npc => {
      const weapons = npc.token?.delta?.syntheticActor?.items.filter(i => i.type === "weapon");
      weapons.forEach(weapon => weapon.update({ "system.counter.value": weapon.system.counter.max }));
    });
  }

  /** @inheritDoc */
  async resetAll({ updateTurn = true } = {}) {
    const currentId = this.combatant?.id;

    await super.resetAll({ updateTurn });

    if (this.isGroupInitiative) {
      const groupUpdates = this.groups.map(g => ({
        _id: g.id,
        initiative: null
      }))

      if (groupUpdates.length > 0) {
        await this.updateEmbeddedDocuments("CombatantGroup", groupUpdates)
        this.setupTurns()
        const update = { combatants: this.combatants.toObject() };
        if (updateTurn && currentId) {
          update.turn = this.turns.findIndex(t => t.id === currentId);
          await this.update(update, { turnEvents: false, diff: false });
        }
        await ui.combat.render(true)
      }
    }
  }

  async activateCombatant(turn) {
    if (game.user.isGM) {
      await game.combat.update({ turn })
    }
  }

  /**
   * Set initiative for a CombatantGroup and all of its members.
   * @param {string} groupId
   * @param {number|null} value
   */
  async setGroupInitiative(groupId, value) {
    const group = this.groups.get(groupId);
    if (!group || !game.user.isGM) return;

    const combatantUpdates = [...group.members].map(c => ({
      _id: c.id,
      initiative: value
    }));

    if (combatantUpdates.length) {
      await this.updateEmbeddedDocuments("Combatant", combatantUpdates);
    } else {
      await group.update({ initiative: value });
    }
  }

  async assignGroup(combatant, groupName) {
    if (!groupName) return

    if (game.user.isGM) {
      if (this.#combatantGroups.has(groupName)) {
        await this.#combatantGroups.get(groupName);
      } else {
        const groupCreation = this.createEmbeddedDocuments("CombatantGroup", [
          { name: groupName, initiative: null }
        ]);
        this.#combatantGroups.set(groupName, groupCreation);
        await groupCreation
      }

      const group = this.groups.find(g => g.name === groupName)
      if (!group) return
      await combatant.update({ group: group.id, initiative: null });
    }
  }

  async updateGroup(group) {
    if (!group) return

    const maxInitiative = Math.max(
      ...[...group.members].map(c => c._source.initiative ?? -Infinity)
    );

    if (game.user.isGM) {
      const groupInit = group.initiative;
      if (groupInit !== maxInitiative && maxInitiative != -Infinity) {
        await group.update({ _id: group.id, initiative: maxInitiative });
        if (groupInit) {
          const { createNoticeMessage } = await import("../chat/chat-card.mjs");
          await createNoticeMessage({
            title: game.i18n.localize("WWN.Initiative"),
            body: game.i18n.format("WWN.combat.modifyInitiative", {
              group: foundry.utils.escapeHTML(group.name),
              oldInit: groupInit,
              newInit: maxInitiative
            }),
            flags: { kind: "initiative" },
          });
        }
      }
      this.setupTurns();
      await ui.combat.render(true);
    }
  }

  async createGroups() {
    for (const combatant of this.combatants) {
      if (combatant.group) continue

      const key = combatant.groupRaw
      if (!key) continue

      await this.assignGroup(combatant, key)
    }

    return this.groups
  }

  setCombatantGroups() {
    new WWNCombatGroupSelector().render(true, { focus: true })
  }

  _sortCombatants(a, b) {
    const ia = Number.isNumeric(a.initiative) ? a.initiative : -Infinity
    const ib = Number.isNumeric(b.initiative) ? b.initiative : -Infinity
    const initiativeDiff = ib - ia
    if (initiativeDiff !== 0) return initiativeDiff

    const sia = Number.isNumeric(a._source?.initiative) ? a._source?.initiative : -Infinity
    const sib = Number.isNumeric(b._source?.initiative) ? b._source?.initiative : -Infinity
    const sourceInitiativeDiff = sib - sia
    if (sourceInitiativeDiff !== 0) return sourceInitiativeDiff

    if (a.group?.name && b.group?.name && a.group?.name !== b.group?.name) {
      const colorsKeys = Object.keys(WWNCombat.GROUPS)
      const indexA = colorsKeys.indexOf(a.group.name)
      const indexB = colorsKeys.indexOf(b.group.name)
      const colorDiff = indexA - indexB
      if (colorDiff !== 0) return colorDiff
    }

    const dispositionA = a.token?.disposition ?? 0
    const dispositionB = b.token?.disposition ?? 0
    if (dispositionA !== dispositionB) {
      return dispositionB - dispositionA
    }

    if (a.hasPlayerOwner !== b.hasPlayerOwner) {
      return a.hasPlayerOwner ? -1 : 1
    }
    if (a.hasPlayerOwner && b.hasPlayerOwner) {
      const isRetainerA = !!a.system?.retainer?.enabled
      const isRetainerB = !!b.system?.retainer?.enabled
      if (isRetainerA !== isRetainerB) {
        return isRetainerA ? 1 : -1 // Reverse order for player-owned
      }
    } else if (!a.hasPlayerOwner && !b.hasPlayerOwner) {
      const isRetainerA = !!a.system?.retainer?.enabled
      const isRetainerB = !!b.system?.retainer?.enabled
      if (isRetainerA !== isRetainerB) {
        return isRetainerA ? -1 : 1
      }
    }

    if (a.name && a.name === b.name) {
      // Use ID comparison if the names are the same
      return a.id > b.id ? 1 : -1
    }

    return (a.name || "").localeCompare(b.name || "")
  }

}
