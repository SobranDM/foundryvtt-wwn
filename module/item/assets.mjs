/**
 * Faction asset methods for WwnItem (attack, counter, search, log).
 * Called with (item, ...args) from WwnItem.
 */
import { WwnDialog } from "../dialog/wwn-dialog.js";
export async function getAssetAttackRolls(item, isOffense, attackTarget = null) {
  const data = item.system;
  let hitBonus = 0;
  let damage = isOffense ? data.attackDamage : data.counter;
  if (damage === "Special" || damage === "None") {
    if (data.attackSpecial?.length > 0) damage = "";
    else if (isOffense) return null;
  } else if (!damage && isOffense) {
    ui.notifications?.info("No damage to roll for asset");
    return null;
  }
  const attackType = isOffense ? data.attackSource : attackTarget;
  if (!item.actor) {
    ui.notifications?.error("Asset must be associated with a faction");
    return null;
  }
  if (item.actor.type !== "faction") {
    ui.notifications?.error("Asset must be associated with a faction");
    return null;
  }
  const actor = item.actor;
  if (attackType === "cunning") hitBonus = actor.system.cunningRating;
  else if (attackType === "force") hitBonus = actor.system.forceRating;
  else if (attackType === "wealth") hitBonus = actor.system.wealthRating;
  const rollData = { hitBonus };
  const hitRoll = await new Roll("1d10 + @hitBonus", rollData).roll();
  if (!damage || damage === "None" || damage === "Special") damage = "0";
  const damageRoll = await new Roll(damage, rollData).roll();
  return [hitRoll, damageRoll];
}

export async function assetAttack(item, isOffense) {
  const attackRolls = await getAssetAttackRolls(item, isOffense);
  if (!attackRolls) return;
  const diceData = Roll.fromTerms([
    foundry.dice.terms.PoolTerm.fromRolls([attackRolls[0], attackRolls[1]]),
  ]);
  const attackKey = isOffense ? "WWN.faction.attack-roll" : "WWN.faction.counter-roll";
  const assetsWithLocationNotes = item.actor.items.filter(
    (i) => i.id !== item.id && i.type === "asset" && i.system.location === item.system.location && i.system.locationRoll
  );
  const dialogData = {
    desc: item.system.description,
    name: `${item.actor?.name} - ${item.name}`,
    hitRoll: await attackRolls[0].render(),
    damageRoll: await attackRolls[1].render(),
    attackKey: game.i18n.localize(attackKey),
    attackSpecial: item.system.attackSpecial,
    assetsWithLocationNotes,
  };
  const chatContent = await renderTemplate("systems/wwn/templates/chat/asset-attack.hbs", dialogData);
  const chatData = {
    roll: JSON.stringify(diceData),
    content: chatContent,
    type: CONST.CHAT_MESSAGE_STYLES.ROLL,
  };
  getDocumentClass("ChatMessage").applyRollMode(chatData, "gmroll");
  getDocumentClass("ChatMessage").create(chatData);
}

export async function assetSearch(item, targetType) {
  if (!targetType) {
    ui.notifications?.info("Attacking asset has no target type (cunning/wealth/force)");
    return;
  }
  const otherActiveFactions = game.actors?.filter(
    (i) => i.type === "faction" && i.system.active === true && item.actor?.id !== i.id
  );
  if (!otherActiveFactions?.length) {
    ui.notifications?.info("No other active factions found");
    return;
  }
  const targetFactions = {};
  const factionIdNames = {};
  for (const fA of otherActiveFactions) {
    const totalAssets = [...(fA.system.cunningAssets || []), ...(fA.system.forceAssets || []), ...(fA.system.wealthAssets || [])];
    if (fA.id && totalAssets.length > 0) {
      targetFactions[fA.id] = [fA, totalAssets];
      factionIdNames[fA.id] = fA.name;
    }
  }
  if (Object.keys(targetFactions).length === 0) {
    ui.notifications?.info(
      `${otherActiveFactions.length} other active factions found, but no ${targetType} assets were found`
    );
    return;
  }
  const dialogData = {
    faction: item.actor,
    attackingAsset: item,
    targetFactionsIdNames: factionIdNames,
    targets: targetFactions,
  };
  const html = await renderTemplate("systems/wwn/templates/items/dialogs/select-asset-target.hbs", dialogData);
  const _rollAssetForm = async (dialogHtml) => {
    const form = (dialogHtml?.length ? dialogHtml[0] : dialogHtml)?.querySelector?.("form");
    if (!form) return;
    const attackedFactionId = form.querySelector('[name="targetFaction"]')?.value;
    const attackedFaction = game.actors?.get(attackedFactionId);
    if (!attackedFaction) {
      ui.notifications?.info("Attack faction not selected or not found");
      return;
    }
    const attackedAssetId = form.querySelector(`[name="asset-${attackedFactionId}"]`)?.value;
    const attackedAsset = attackedFaction.getEmbeddedDocument?.("Item", attackedAssetId)
      ?? attackedFaction.items?.get?.(attackedAssetId)
      ?? attackedFaction.items?.find?.(i => i.id === attackedAssetId);
    if (!attackedAsset) {
      ui.notifications?.info("Attacked asset not selected or not found");
      return;
    }
    const attackedAssetsWithLocationNotes = attackedFaction.items.filter(
      (i) => i.type === "asset" && i.system.location === item.system.location && i.system.locationRoll
    );
    const attackingAssetsWithLocationNotes = item.actor.items.filter(
      (i) => i.id !== item.id && i.type === "asset" && i.system.location === item.system.location && i.system.locationRoll
    );
    const attackRolls = await getAssetAttackRolls(item, true);
    const defenseRolls = await getAssetAttackRolls(attackedAsset, false, item.system.attackTarget);
    if (!attackRolls || !defenseRolls) {
      ui.notifications?.error("Unable to roll for asset");
      return;
    }
    const hitRoll = attackRolls[0];
    const defRoll = defenseRolls[0];
    if (!hitRoll?.total || !defRoll?.total) return;
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
    const name = `${item.actor?.name} - ${item.name} attacking ${attackedAsset.name} (${attackedFaction.name})`;
    const innerData = {
      desc: item.system.description,
      name,
      hitRoll: await hitRoll.render(),
      defRoll: await defRoll.render(),
      attackDamage,
      defDamage,
      attackDesc,
      attackKey: game.i18n.localize("attackKey"),
      defenseSpecial: attackedAsset.system.attackSpecial,
      attackSpecial: item.system.attackSpecial,
      attackedAssetsWithLocationNotes,
      attackingAssetsWithLocationNotes,
    };
    const chatContent = await renderTemplate("systems/wwn/templates/chat/asset-attack-def.hbs", innerData);
    const chatData = { content: chatContent, type: CONST.CHAT_MESSAGE_STYLES.WHISPER };
    getDocumentClass("ChatMessage").applyRollMode(chatData, "gmroll");
    getDocumentClass("ChatMessage").create(chatData);
  };
  item.popUpDialog?.close();
  item.popUpDialog = null;
  await WwnDialog.wait({
    title: `Select asset to attack for ${item.name} (${item.system.location})`,
    content: html,
    buttons: [
      {
        action: "roll",
        label: game.i18n.localize("WWN.faction.attack"),
        default: true,
        callback: async (_ev, _btn, dialog) => {
          await _rollAssetForm(dialog?.element);
        },
      },
    ],
  });
}

export async function assetLogAction(item) {
  let content = `<h3> ${item.name} </h3>`;
  if ("description" in item.system) {
    content += `<span class="flavor-text"> ${item.system.description}</span>`;
  } else {
    content += "<span class='flavor-text'> No Description</span>";
  }
  if (item.actor?.type === "faction") {
    const gmIds = ChatMessage.getWhisperRecipients("GM")
      ?.filter((i) => i)
      ?.map((i) => i.id)
      ?.filter((i) => i !== null) ?? [];
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker(),
      content,
      type: CONST.CHAT_MESSAGE_STYLES.WHISPER,
      whisper: gmIds,
    });
  }
}

export async function rollAsset(item, _shiftKey = false) {
  const data = item.system;
  if (data.unusable) {
    ui.notifications?.error("Asset is unusable");
    return;
  }
  if ((data.attackDamage && data.attackDamage !== "") || data.counter) {
    await WwnDialog.wait({
      title: "Attack with Asset",
      content: "<p>Do you want to roll an attack(default), counter, search for an asset to attack, or use asset/chat description?</p>",
      buttons: [
        { action: "attack", icon: "fa-solid fa-check", label: "Attack", default: true, callback: () => assetAttack(item, true) },
        { action: "counter", icon: "fa-solid fa-check", label: "Counter", callback: () => assetAttack(item, false) },
        { action: "search", icon: "fa-solid fa-check", label: "Search active factions for an asset to attack", callback: () => assetSearch(item, data.attackTarget) },
        { action: "action", icon: "fa-solid fa-check", label: "Use Action", callback: () => assetLogAction(item) },
      ],
    });
  } else {
    assetLogAction(item);
  }
}
