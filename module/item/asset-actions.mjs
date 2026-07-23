/**
 * Faction asset item actions (ported from legacy item entity).
 */
import { showWwnDialog, confirmButton, cancelButton } from "../applications/wwn-dialog.mjs";
import { createCardMessage, createNoticeMessage } from "../chat/chat-card.mjs";

export class AssetItemActions {
  async getAssetAttackRolls(isOffense, attackTarget = null) {
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
    const attackType = isOffense ? data.attackSource : attackTarget;
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
    const hitRoll = await new Roll(hitRollStr, rollData).roll();
    if (!damage || damage === "None" || damage === "Special") {
      damage = "0";
    }
    const damageRoll = await new Roll(damage, rollData).roll();
    return [hitRoll, damageRoll];
  }

  async _assetAttack(isOffense) {
    const attackRolls = await this.getAssetAttackRolls(isOffense);
    if (!attackRolls) {
      return;
    }
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
    if (this.actor?.type == "faction") {
      // Faction attacks are logged via sheet flows; keep parity with prior no-op branch.
      return;
    }
    await createCardMessage({
      title: dialogData.name,
      subtitle: dialogData.attackKey,
      actor: this.actor,
      bodyTemplate: "systems/wwn/templates/chat/asset-attack-body.hbs",
      context: dialogData,
      messageMode: "gmroll",
      flags: { kind: "asset-attack" },
    });
  }

  // Search other factions for attack targets with targetType
  async _assetSearch(targetType) {
    if (!targetType) {
      ui.notifications?.info(
        "Attacking asset has no target type (cunning/wealth/force)"
      );
      return;
    }
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
      const totalAssets = [...fA.system.cunningAssets, ...fA.system.forceAssets, ...fA.system.wealthAssets];
      if (fA.id && totalAssets.length > 0) {
        targetFactions[fA.id] = [fA, totalAssets];
        factionIdNames[fA.id] = fA.name;
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

    const result = await showWwnDialog({
      modifier: "asset-select-target",
      title: `Select asset to attack for ${this.name} (${this.system.location})`,
      template: "systems/wwn/templates/items/dialogs/select-asset-target.html",
      context: dialogData,
      buttons: [confirmButton({ label: "WWN.faction.attack" }), cancelButton()],
      onRender: (_event, dialog) => {
        const root = dialog.element;
        const select = root?.querySelector("#targetFaction") ?? root?.querySelector('[name="targetFaction"]');
        const sync = () => {
          const optionValue = select?.value;
          root?.querySelectorAll(".sel").forEach((el) => {
            el.style.display = optionValue && el.classList.contains(optionValue) ? "" : "none";
          });
        };
        select?.addEventListener("change", sync);
        sync();
      },
    });
    if (!result || result === "cancel") return;

    const attackedFactionId = result.targetFaction;
    const attackedFaction = game.actors?.get(attackedFactionId);
    if (!attackedFaction) {
      ui.notifications?.info("Attack faction not selected or not found");
      return;
    }
    const attackedAssetId = result[`asset-${attackedFactionId}`];
    const attackedAsset = attackedFaction?.getEmbeddedDocument("Item", attackedAssetId);
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
    const attackRolls = await this.getAssetAttackRolls(true);
    const defenseRolls = await attackedAsset.getAssetAttackRolls(
      false, this.system.attackTarget
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
      attackDamage = await attackRolls[1].render();
      attackDesc = "<b>Attacker Hits.</b><br>";
    } else if (hitRoll.total < defRoll.total) {
      defDamage = await defenseRolls[1].render();
      attackDesc = "<b>Defender Hits Counter.</b><br>";
    } else {
      attackDamage = await attackRolls[1].render();
      defDamage = await defenseRolls[1].render();
      attackDesc = "<b>Tie! Both do damage.</b><br>";
    }
    const name = `${this.actor?.name} - ${this.name} attacking ${attackedAsset.name} (${attackedFaction.name})`;
    const cardData = {
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
    if (this.actor?.type == "faction") {
      await createCardMessage({
        title: name,
        actor: this.actor,
        bodyTemplate: "systems/wwn/templates/chat/asset-attack-def-body.hbs",
        context: cardData,
        messageMode: "gmroll",
        flags: { kind: "asset-attack-def" },
      });
    }
  }

  async _assetLogAction() {
    let body = "";
    if ("description" in this.system) {
      body = `<span class="flavor-text">${this.system.description}</span>`;
    } else {
      body = "<span class='flavor-text'> No Description</span>";
    }
    if (this.actor?.type == "faction") {
      const gm_ids = ChatMessage.getWhisperRecipients("GM")
        .filter((i) => i)
        .map((i) => i.id)
        .filter((i) => i !== null);

      await createNoticeMessage({
        title: this.name,
        body,
        actor: this.actor,
        whisper: gm_ids,
        flags: { kind: "asset-action" },
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async rollAsset(_shiftKey = false) {
    const data = this.system;
    if (data.unusable) {
      ui.notifications?.error("Asset is unusable");
      return;
    }
    if ((data.attackDamage && data.attackDamage !== "") || data.counter) {
      const choice = await showWwnDialog({
        modifier: "asset-action",
        title: "Attack with Asset",
        content:
          "<p>Do you want to roll an attack(default), counter, search for an asset to attack, or use asset/chat description?</p>",
        buttons: [
          { action: "attack", label: "Attack", default: true, callback: () => "attack" },
          { action: "counter", label: "Counter", callback: () => "counter" },
          {
            action: "search",
            label: "Search active factions for an asset to attack",
            callback: () => "search",
          },
          { action: "action", label: "Use Action", callback: () => "action" },
          cancelButton(),
        ],
      });
      if (choice === "attack") return this._assetAttack(true);
      if (choice === "counter") return this._assetAttack(false);
      if (choice === "search") return this._assetSearch(data.attackTarget);
      if (choice === "action") return this._assetLogAction();
    } else {
      this._assetLogAction();
    }
  }

  /**
   * Get attack rolls for multiple assets simultaneously
   * @param {Array<WwnItem>} assets - Array of asset items to get rolls for
   * @param {boolean} isOffense - Whether these are offensive attacks
   * @returns {Promise<Array<{asset: WwnItem, status: string, value: Array<Roll>|Error}>>}
   */
  static async getMultipleAssetAttackRolls(assets, isOffense) {
    // Create an array of promises for each asset's attack rolls
    const rollPromises = assets.map(async (asset) => {
      try {
        const rolls = await asset.getAssetAttackRolls(isOffense);
        return {
          asset,
          status: 'fulfilled',
          value: rolls
        };
      } catch (error) {
        return {
          asset,
          status: 'rejected',
          value: error
        };
      }
    });

    // Use Promise.allSettled to wait for all rolls to complete
    const results = await Promise.allSettled(rollPromises);

    // Transform the results into a more usable format
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          asset: assets[index],
          status: 'fulfilled',
          value: result.value
        };
      } else {
        return {
          asset: assets[index],
          status: 'rejected',
          value: result.reason
        };
      }
    });
  }
}
