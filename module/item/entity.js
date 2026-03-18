import { addEventListener as addCustomEventListener } from "../utils/listener-funcs.js";
import * as chatCards from "./chat-cards.mjs";
import * as rolls from "./rolls.mjs";
import * as assets from "./assets.mjs";

/**
 * WWN Item document (modern Document API). Registered as CONFIG.Item.documentClass.
 * @extends foundry.documents.Item
 */
export class WwnItem extends foundry.documents.Item {
  static get defaultIcons() {
    return {
      spell: "/systems/wwn/assets/default/spell.png",
      ability: "/systems/wwn/assets/default/ability.png",
      armor: "/systems/wwn/assets/default/armor.png",
      weapon: "/systems/wwn/assets/default/weapon.png",
      item: "/systems/wwn/assets/default/item.png",
      focus: "/systems/wwn/assets/default/focus.png",
      art: "/systems/wwn/assets/default/art.png",
      effect: "",
      crewmember: "icons/sundries/gaming/chess-pawn-white-glass.webp",
      fitting: "icons/commodities/wood/lumber-stack.webp",
      shipweapon: "icons/weapons/artillery/cannon-engraved-gold.webp",
      cargo: "icons/consumables/grains/sacks-grain-white.webp",
    };
  }

  static async create(data, context = {}) {
    if (data.img === undefined) {
      data.img = this.defaultIcons[data.type];
    }
    return super.create(data, context);
  }

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();
  }

  static chatListeners(html) {
    chatCards.chatListeners(html);
  }

  getChatData(htmlOptions) {
    const sys = this.system?.toObject?.() ?? foundry.utils.deepClone(this.system ?? {});
    const itemData = { ...sys };
    const props = [];

    if (this.type === "weapon") {
      const tags = itemData.tags ?? [];
      tags.forEach((t) => props.push(t.value ?? t));
    }
    if (this.type === "spell") {
      props.push(
        `${itemData.class ?? ""} ${itemData.lvl ?? ""}`.trim(),
        itemData.range,
        itemData.duration
      );
    }
    if (Object.hasOwn(itemData, "equipped")) {
      props.push(itemData.equipped ? "Equipped" : "Not Equipped");
    }
    if (Object.hasOwn(itemData, "stowed")) {
      props.push(itemData.stowed ? "Stowed" : "Not Stowed");
    }
    if (Object.hasOwn(itemData, "prepared")) {
      props.push(itemData.prepared ? "Prepared" : "Not Prepared");
    }

    if (itemData.roll) {
      const rollData = this.actor?.getRollData?.() ?? this.actor?._getRollData?.() ?? {};
      const unevaluatedRoll = new Roll(itemData.roll, { ...rollData, actor: this.actor });
      itemData.roll = unevaluatedRoll.formula;
    }

    itemData.properties = props.filter(Boolean);
    return itemData;
  }

  async rollSkill(options = {}) {
    return rolls.rollSkill(this, options);
  }

  rollWeapon(options = {}) {
    return rolls.rollWeapon(this, options);
  }

  rollShipWeapon(options = {}) {
    return rolls.rollShipWeapon(this, options);
  }

  async rollFormula(options = {}) {
    return rolls.rollFormula(this, options);
  }

  async spendSpell() {
    return rolls.spendSpell(this);
  }

  spendArt() {
    return rolls.spendArt(this);
  }

  getTags() {
    const formatTag = (tag, icon) => {
      if (!tag) return "";
      const fa = icon ? `<i class="fas ${icon}"></i> ` : "";
      return `<li class='tag'>${fa}${tag}</li>`;
    };
    const data = this.system;
    const type = this.type;
    if (type === "weapon") {
      let wTags = formatTag(data.damage, "fa-tint");
      (data.tags ?? []).forEach((t) => {
        wTags += formatTag(t.value ?? t);
      });
      wTags += formatTag(CONFIG.WWN?.saves?.[data.save], "fa-skull");
      if (data.missile) {
        wTags += formatTag(
          data.range?.short + "/" + data.range?.long,
          "fa-bullseye"
        );
      }
      return wTags;
    }
    if (type === "armor") {
      return formatTag(CONFIG.WWN?.armor?.[data.type], "fa-tshirt");
    }
    if (type === "spell") {
      let sTags = `${formatTag(data.class)}${formatTag(data.range)}${formatTag(data.duration)}${formatTag(data.roll)}`;
      if (data.save) {
        sTags += formatTag(CONFIG.WWN?.saves?.[data.save], "fa-skull");
      }
      return sTags;
    }
    if (type === "art") {
      const roll = (data.roll ?? "") + (data.rollTarget ? CONFIG.WWN?.roll_type?.[data.rollType] ?? "" : "") + (data.rollTarget ?? "");
      return `${formatTag(data.requirements)}${formatTag(roll)}`;
    }
    return "";
  }

  pushTag(values) {
    const data = this.system;
    let update = foundry.utils.deepClone(data.tags ?? []);
    const newData = {};
    const regExp = /\(([^)]+)\)/;
    values.forEach((val) => {
      const matches = regExp.exec(val);
      let title = "";
      if (matches) {
        title = matches[1];
        val = val.substring(0, matches.index).trim();
      } else {
        val = val.trim();
        title = val;
      }
      if (val === CONFIG.WWN?.tags?.melee) newData.melee = true;
      else if (val === CONFIG.WWN?.tags?.missile) newData.missile = true;
      update.push({ title, value: val });
    });
    newData.tags = update;
    return this.update({ system: newData });
  }

  popTag(value) {
    const data = this.system;
    const tags = data.tags ?? [];
    const update = tags.filter((el) => (el.value ?? el) !== value);
    return this.update({ system: { tags: update } });
  }

  roll() {
    return rolls.roll(this);
  }

  async show(options = {}) {
    return rolls.show(this, options);
  }

  async getAssetAttackRolls(isOffense, attackTarget = null) {
    return assets.getAssetAttackRolls(this, isOffense, attackTarget);
  }

  async _assetAttack(isOffense) {
    return assets.assetAttack(this, isOffense);
  }

  async _assetSearch(targetType) {
    return assets.assetSearch(this, targetType);
  }

  async _assetLogAction() {
    return assets.assetLogAction(this);
  }

  rollAsset(_shiftKey = false) {
    return assets.rollAsset(this, _shiftKey);
  }

  static async getMultipleAssetAttackRolls(assets, isOffense) {
    const rollPromises = assets.map(async (asset) => {
      try {
        const attackRolls = await asset.getAssetAttackRolls(isOffense);
        return { asset, status: "fulfilled", value: attackRolls };
      } catch (error) {
        return { asset, status: "rejected", value: error };
      }
    });
    const results = await Promise.allSettled(rollPromises);
    return results.map((result, index) => {
      if (result.status === "fulfilled") {
        return { asset: assets[index], status: "fulfilled", value: result.value };
      }
      return { asset: assets[index], status: "rejected", value: result.reason };
    });
  }

  async rollMultipleAssets(assets, isOffense) {
    return WwnItem.getMultipleAssetAttackRolls(assets, isOffense);
  }
}
