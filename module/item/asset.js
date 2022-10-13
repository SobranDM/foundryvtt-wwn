import { WwnBaseItem } from "./base-item.js";

/**
 * Override and extend the basic :class:`Item` implementation
 */
 export class WwnAsset  extends WwnBaseItem {

  popUpDialog;

  async getAttackRolls(isOffense) {
    const data = this.system;
    let hitBonus = 0;
    let damage = isOffense ? data.attackDamage : data.counter;
    if ((damage === "Special" || damage === "None")) {
      if (data.attackSpecial && data.attackSpecial.length > 0) {
        damage = "";
      } else if (isOffense) {
        return null;
      }
    } else if (!damage && isOffense) {
      ui.notifications?.info("No damage to roll for asset");
      return null;
    }
    const attackType = isOffense ? data.attackSource : data.assetType;
    if (!this.actor) {
      ui.notifications?.error("Asset must be associated with a faction");
      return null;
    }
    if (this.actor.type != "faction") {
      ui.notifications?.error("Asset must be associated with a faction");
      return null;
    }
    const actor = this.actor;
    if (attackType) {
      if (attackType === "cunning") {
        hitBonus = actor.system.cunningRating;
      } else if (attackType === "force") {
        hitBonus = actor.system.forceRating;
      } else if (attackType === "wealth") {
        hitBonus = actor.system.wealthRating;
      }
    }
    const rollData = {
      hitBonus,
    };
    const hitRollStr = "1d10 + @hitBonus";
    const hitRoll = await new Roll(hitRollStr, rollData).roll({ async: true });
    if (!damage || damage === "None" || damage === "Special") {
      damage = "0";
    }
    const damageRoll = await new Roll(damage, rollData).roll({
      async: true,
    });
    return [hitRoll, damageRoll];
  }

  async _attack(isOffense) {
    const attackRolls = await this.getAttackRolls(isOffense);
    if (!attackRolls) {
      return;
    }
    const diceData = Roll.fromTerms([
      PoolTerm.fromRolls([attackRolls[0], attackRolls[1]]),
    ]);
    const attackKey = isOffense
      ? "WWN.faction.attack-roll"
      : "WWN.faction.counter-roll";

      const assetsWithLocationNotes = this.actor.items.filter(i => 
        i.id != this.id && i.type == "asset" && i.system.location === this.system.location && i.system.locationRoll
      );

    const dialogData = {
      desc: this.system.description,
      name: `${this.actor?.name} - ${this.name}`,
      hitRoll: await attackRolls[0].render(),
      damageRoll: await attackRolls[1].render(),
      attackKey: game.i18n.localize(attackKey),
      attackSpecial: this.system.attackSpecial,
      assetsWithLocationNotes
    };
    const template = "systems/wwn/templates/chat/asset-attack.html";
    const chatContent = await renderTemplate(template, dialogData);

    if (this.actor?.type == "faction") {
      const actor = this.actor;
      actor.logMessage("Attack Roll", chatContent, null, null);
    } else {
      const chatData = {
        roll: JSON.stringify(diceData),
        content: chatContent,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      };
      getDocumentClass("ChatMessage").applyRollMode(chatData, "gmroll");
      getDocumentClass("ChatMessage").create(chatData);
    }
  }

  // Search other factions for attack targets with targetType
  async _search(targetType) {
    if (!targetType) {
      ui.notifications?.info(
        "Attacking asset has no target type (cunning/wealth/force)"
      );
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const otherActiveFactions = game.actors?.filter(
      (i) =>
        i.type === "faction" &&
        i.system.active == true &&
        this.actor?.id != i.id
    );
    if (!otherActiveFactions || otherActiveFactions.length == 0) {
      ui.notifications?.info("No other active factions found");
      return;
    }
    // id - > [faction, array of targets]
    const targetFactions = {};
    // id -> name
    const factionIdNames = {};
    for (const fA of otherActiveFactions) {
      if (targetType === "cunning") {
        if (fA.id && fA.system.cunningAssets?.length > 0) {
          targetFactions[fA.id] = [fA, fA.system.cunningAssets];
          factionIdNames[fA.id] = fA.name;
        }
      } else if (targetType === "force") {
        if (fA.id && fA.system.forceAssets?.length > 0) {
          targetFactions[fA.id] = [fA, fA.system.forceAssets];
          factionIdNames[fA.id] = fA.name;
        }
      } else if (targetType === "wealth") {
        if (fA.id && fA.system.wealthAssets?.length > 0) {
          targetFactions[fA.id] = [fA, fA.system.wealthAssets];
          factionIdNames[fA.id] = fA.name;
        }
      }
    }
    if (Object.keys(targetFactions).length == 0) {
      ui.notifications?.info(
        `${otherActiveFactions.length} other active factions found, but no ${targetType} assets were found`
      );
      return;
    }
    const dialogData = {
      faction: this.actor,
      attackingAsset: this,
      targetFactionsIdNames: factionIdNames,
      targets: targetFactions,
    };
    const template = "systems/wwn/templates/items/dialogs/select-asset-target.html";
    const html = renderTemplate(template, dialogData);

    const _rollForm = async (html) => {
      const form = html[0].querySelector("form");

      const attackedFactionId = ((
        form.querySelector('[name="targetFaction"]')
      ))?.value;
      const attackedFaction = game.actors?.get(attackedFactionId);
      if (!attackedFaction) {
        ui.notifications?.info("Attack faction not selected or not found");
        return;
      }
      const assetFormName = `[name="asset-${attackedFactionId}"]`;
      const attackedAssetId = ((
        form.querySelector(assetFormName)
      ))?.value;
      const attackedAsset = attackedFaction?.getEmbeddedDocument(
        "Item",
        attackedAssetId
      );
      if (!attackedAsset) {
        ui.notifications?.info("Attacked asset not selected or not found");
        return;
      }
      const attackedAssetsWithLocationNotes = attackedFaction.items.filter(i => 
        i.type == "asset" && i.system.location === this.system.location && i.system.locationRoll
      );
      const attackingAssetsWithLocationNotes = this.actor.items.filter(i => 
        i.id != this.id && i.type == "asset" && i.system.location === this.system.location && i.system.locationRoll
      );
      const attackRolls = await this.getAttackRolls(true);
      const defenseRolls = await attackedAsset.getAttackRolls(
        false
      );
      if (!attackRolls || !defenseRolls) {
        ui.notifications?.error("Unable to roll for asset");
        return;
      }
      const hitRoll = attackRolls[0];
      const defRoll = defenseRolls[0];
      if (
        !hitRoll ||
        hitRoll == undefined ||
        !hitRoll.total ||
        !defRoll.total
      ) {
        return;
      }
      let attackDamage = null;
      let defDamage = null;
      let attackDesc = "";
      if (hitRoll.total > defRoll.total) {
        //attacker hits
        attackDamage = await attackRolls[1].render();
        attackDesc = "<b>Attacker Hits.</b><br>";
      } else if (hitRoll.total < defRoll.total) {
        //defender hits
        defDamage = await defenseRolls[1].render();
        attackDesc = "<b>Defender Hits Counter.</b><br>";
      } else {
        //both hit
        attackDamage = await attackRolls[1].render();
        defDamage = await defenseRolls[1].render();
        attackDesc = "<b>Tie! Both do damage.</b><br>";
      }
      const name = `${this.actor?.name} - ${this.name} attacking ${attackedAsset.name} (${attackedFaction.name})`;
      const dialogData = {
        desc: this.system.description,
        name,
        hitRoll: await hitRoll.render(),
        defRoll: await defRoll.render(),
        attackDamage: attackDamage,
        defDamage: defDamage,
        attackDesc: attackDesc,
        attackKey: game.i18n.localize("attackKey"),
        defenseSpecial: attackedAsset.system.attackSpecial,
        attackSpecial: this.system.attackSpecial,
        attackedAssetsWithLocationNotes,
        attackingAssetsWithLocationNotes,
      };
      const template = "systems/wwn/templates/chat/asset-attack-def.html";
      const chatContent = await renderTemplate(template, dialogData);
      if (this.actor?.type == "faction") {
        this.actor.logMessage(name, chatContent);
      } else {
        const chatData = {
          content: chatContent,
          type: CONST.CHAT_MESSAGE_TYPES.WHISPER,
        };
        getDocumentClass("ChatMessage").applyRollMode(chatData, "gmroll");
        getDocumentClass("ChatMessage").create(chatData);
      }
    };

    this.popUpDialog?.close();
    this.popUpDialog = new Dialog(
      {
        title: `Select asset to attack for ${this.name} (${this.system.location})`,
        content: await html,
        default: "roll",
        buttons: {
          roll: {
            label: game.i18n.localize("WWN.faction.attack"),
            callback: _rollForm,
          },
        },
      },
      {
        classes: ["swnr"],
      }
    );
    this.popUpDialog.render(true);
  }

  async _logAction() {
    // Basic template rendering data
    let content = `<h3> ${this.name} </h3>`;
    if ("description" in this.system) {
      content += `<span class="flavor-text"> ${this.system.description}</span>`;
    } else {
      content += "<span class='flavor-text'> No Description</span>";
    }
    if (this.actor?.type == "faction") {
      const actor = this.actor;
      actor.logMessage("Attack Roll", content);
    } else {
      const gm_ids = ChatMessage.getWhisperRecipients("GM")
        .filter((i) => i)
        .map((i) => i.id)
        .filter((i) => i !== null);

      ChatMessage.create({
        speaker: ChatMessage.getSpeaker(),
        content: content, //${item.data.description}
        type: CONST.CHAT_MESSAGE_TYPES.WHISPER,
        whisper: gm_ids,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async roll(_shiftKey = false) {
    const data = this.system;
    if (data.unusable) {
      ui.notifications?.error("Asset is unusable");
      return;
    }
    if ((data.attackDamage && data.attackDamage !== "") || data.counter) {
      const d = new Dialog(
        {
          title: "Attack with Asset",
          content:
            "<p>Do you want to roll an attack(default), counter, search for an asset to attack, or use asset/chat description?</p>",
          buttons: {
            attack: {
              icon: '<i class="fas fa-check"></i>',
              label: "Attack",
              callback: () => this._attack(true),
            },
            counter: {
              icon: '<i class="fas fa-check"></i>',
              label: "Counter",
              callback: () => this._attack(false),
            },
            search: {
              icon: '<i class="fas fa-check"></i>',
              label: "Search active factions for an asset to attack",
              callback: () => this._search(data.attackTarget),
            },
            action: {
              icon: '<i class="fas fa-check"></i>',
              label: "Use Action",
              callback: () => this._logAction(),
            },
          },
          default: "attack",
        },
        {
          classes: ["wwn.dialog"],
        }
      );
      d.render(true);
    } else {
      this._logAction();
    }
  }
}
