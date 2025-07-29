/**
 * @file System-level modifications to the way combat works
 */
import { WWN } from "../config.js"
import WWNCombatGroupSelector from "./combat-set-groups.js"

/**
 * An extension of Foundry's Combat class that implements initiative for individual combatants.
 */
export class WWNCombat extends foundry.documents.Combat {
  static FORMULA = "@initiative.roll + @initiative.value"

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

  async _getGroupInitiativeData(group, olderSiblingGroup, { excludeAlreadyRolled = false } = {}) {
    if (
      group.members.size === 0 ||
      (excludeAlreadyRolled && group.initiative !== null)
    ) {
      return null;
    }

    let initRoll;
    let maxInitValue = -Infinity;
    const hasAlert = [...group.members].some(combatant => {
      const items = combatant.token?.delta?.syntheticActor?.items ?? [];
      return items.find(i => i.name === "Alert" && i.system?.ownedLevel === 1);
    });
    const hasTopCombatant = [...group.members].some(combatant => {
      const items = combatant.token?.delta?.syntheticActor?.items ?? [];
      return items.some(i =>
        (i.name === "Alert" && i.system?.ownedLevel === 2) ||
        i.name === "Vigilant"
      );
    });

    const allMembers = olderSiblingGroup
      ? [...group.members, ...olderSiblingGroup.members]
      : [...group.members];
    for (const combatant of allMembers) {
      const data = combatant.token?.delta?.syntheticActor?.system;
      if (!data?.initiative) continue;

      const initValue = data.initiative.value ?? -Infinity;
      if (initValue > maxInitValue) maxInitValue = initValue;
      if (!initRoll) initRoll = data.initiative.roll;
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
          ChatMessage.create({
            speaker: {
              alias: game.i18n.localize("WWN.Initiative")
            },
            flavor: game.i18n.format("WWN.combat.modifyInitiative", {
              group: foundry.utils.escapeHTML(group.name),
              oldInit: groupInit,
              newInit: maxInitiative
            }),
          })
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
