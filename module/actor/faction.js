export class WwnFaction extends Actor {
  prepareData() {
    super.prepareData();
    const data = this.system;

    if (this.type !== "faction") {
      return;
    }
  }

  prepareDerivedData() {
    const data = this.system;
    const assets = (
      this.items.filter((i) => i.type == "asset")
    );
    const cunningAssets = assets.filter(
      (i) => i.system["assetType"] === "cunning"
    );
    const forceAssets = assets.filter(
      (i) => i.system["assetType"] === "force"
    );
    const wealthAssets = assets.filter(
      (i) => i.system["assetType"] === "wealth"
    );

    data.cunningAssets = cunningAssets;
    data.forceAssets = forceAssets;
    data.wealthAssets = wealthAssets;

    data.health.max =
      4 +
      this.getHealth(data.wealthRating) +
      this.getHealth(data.forceRating) +
      this.getHealth(data.cunningRating);
  }

  async _onCreate() {
    await this.update({
      "token.actorLink": true,
      "img" : "systems/wwn/assets/default/faction.png"
    });
  }

  async createEmbeddedDocuments(embeddedName, data = [], context = {}) {
    data.map((item) => {
      if (item.img === undefined) {
        item.img = WwnItem.defaultIcons[item.type];
      }
    });
    return super.createEmbeddedDocuments(embeddedName, data, context);
  }

  isNew() {
    const data = this.system;
    if (this.type == "character") {
      let ct = 0;
      Object.values(data.scores).forEach((el) => {
        ct += el.value;
      });
      return ct == 0 ? true : false;
    } else if (this.type == "monster") {
      let ct = 0;
      Object.values(data.saves).forEach((el) => {
        ct += el.value;
      });
      return ct == 0 ? true : false;
    }
    return false;
  }

  getHealth(level) {
    if (level in HEALTH__XP_TABLE) {
      return HEALTH__XP_TABLE[level];
    } else {
      return 0;
    }
  }

  async logMessage(
    title,
    content,
    longContent = null,
    logRollString = null
  ) {
    const gm_ids = ChatMessage.getWhisperRecipients("GM")
      .filter((i) => i)
      .map((i) => i.id)
      .filter((i) => i !== null);

    if (game.modules?.get("foundryvtt-simple-calendar")?.active) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const c = SimpleCalendar.api.getCurrentCalendar();
      content = `(${c.currentDate.year}-${c.currentDate.month + 1}-${c.currentDate.day + 1
        }) ${content}`;
    }
    const cardData = {
      title,
      content,
      longContent,
      logRollString,
    };
    const template = "systems/wwn/templates/chat/faction-log.html";

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: await renderTemplate(template, cardData),
      type: CONST.CHAT_MESSAGE_TYPES.WHISPER,
      whisper: gm_ids,
    };
    const msg = await ChatMessage.create(chatData);
    if (msg) {
      // Old way but rolls are ugly
      //const chatString = msg.export();
      //content = chatString.split("]", 2)[1];
      const html = await msg.getHTML();
      html.find(".message-header").remove();
      content = html.html().toString();
    }
    const log = this.system.log;
    log.push(content);
    await this.update({
      data: {
        log: log,
      },
    });
  }


  async addTag(name) {
    const match = FACTION_TAGS.filter((i) => i.name == name);
    if (!match) {
      ui.notifications?.error(`Error unable to find tag ${name}`);
      return;
    }
    const tags = this.system.tags;
    tags.push(match[0]);
    await this.update({
      data: {
        tags: tags,
      },
    });
  }

  async addCustomTag(
    name,
    desc,
    effect
  ) {
    const tags = this.system.tags;
    const tag = {
      name,
      desc,
      effect,
    };
    tags.push(tag);
    await this.update({
      data: {
        tags: tags,
      },
    });
  }


  async addBase(
    hp,
    assetType,
    name,
    imgPath
  ) {
    if (hp > this.system.health.max) {
      ui.notifications?.error(
        `Error HP of new base (${hp}) cannot be greater than faction max HP (${this.system.health.max})`
      );
      return;
    }
    if (hp > this.system.facCreds) {
      ui.notifications?.error(
        `Error HP of new base (${hp}) cannot be greater than treasure  (${this.system.facCreds})`
      );
      return;
    }
    const newFacCreds = this.system.facCreds - hp;
    await this.update({ system: { facCreds: newFacCreds } });
    await this.createEmbeddedDocuments(
      "Item",
      [
        {
          name: name,
          type: "asset",
          img: imgPath,
          data: {
            assetType: assetType,
            health: {
              value: hp,
              max: hp,
            },
            baseOfInfluence: true,
          },
        },
      ],
      {}
    );
  }

  async startTurn() {
    /*
    At the beginning of each turn, a faction gains Fac-
    Creds equal to half their Wealth rating rounded up plus
    one-quarter of their total Force and Cunning ratings,
    rounded down. Any maintenance costs must be paid
    at the beginning of each turn. Assets that cannot be
    maintained are unusable; an asset that goes without
    maintenance for two consecutive rounds is lost. A fac-
    tion cannot voluntarily choose not to pay maintenance.
    If a faction has no goal at the start of a turn, they
    may pick a new one. If they wish to abandon a prior
    goal, they may do so, but the demoralization and con-
    fusion costs them that turn`s FacCred income and they
    may perform no other action that turn.
    */

    const assets = (
      this.items.filter((i) => i.type === "asset")
    );
    const wealthIncome = Math.ceil(this.system.wealthRating / 2);
    const cunningIncome = Math.floor(this.system.cunningRating / 4);
    const forceIncome = Math.floor(this.system.forceRating / 4);
    const assetIncome = assets
      .map((i) => i.system.income)
      .reduce((i, n) => i + n, 0);
    const assetWithMaint = assets.filter((i) => i.system.maintenance);
    const assetMaintTotal = assetWithMaint
      .map((i) => i.system.maintenance)
      .reduce((i, n) => i + n, 0);

    const cunningAssetsOverLimit = Math.min(
      this.system.cunningRating - this.system.cunningAssets.length,
      0
    );
    const forceAssetsOverLimit = Math.min(
      this.system.forceRating - this.system.forceAssets.length,
      0
    );
    const wealthAssetsOverLimit = Math.min(
      this.system.wealthRating - this.system.wealthAssets.length,
      0
    );
    const costFromAssetsOver =
      cunningAssetsOverLimit + forceAssetsOverLimit + wealthAssetsOverLimit;
    const income =
      wealthIncome +
      cunningIncome +
      forceIncome +
      assetIncome -
      assetMaintTotal +
      costFromAssetsOver;
    let new_creds = this.system.facCreds + income;

    const assetsWithTurn = assets.filter((i) => i.system.turnRoll);
    let msg = `<b>Income this round: ${income}</b>.<br> From ratings: ${wealthIncome + cunningIncome + forceIncome
      } (W:${wealthIncome} C:${cunningIncome} F:${forceIncome})<br>From assets: ${assetIncome}.<br>Maintenance -${assetMaintTotal}.<br>`;
    if (costFromAssetsOver < 0) {
      msg += `Cost from # of assets over rating: ${costFromAssetsOver}.<br>`;
    }
    if (income < 0) {
      msg += ` <b>Loosing Treasure this turn.</b><br>`;
    }
    let longMsg = "";
    if (assetsWithTurn.length > 0) {
      longMsg += "Assets with turn notes/rolls:<br>";
    }
    for (const a of assetsWithTurn) {
      longMsg += `<i>${a.name}</i>: ${a.system.turnRoll} <br><br>`;
    }
    const aitems = [];

    if (new_creds < 0) {
      if (assetMaintTotal + new_creds < 0) {
        //Marking all assets unusable would still not bring money above, can mark all w/maint as unusable.
        for (let i = 0; i < assetWithMaint.length; i++) {
          const asset = assetWithMaint[i];
          const assetCost = asset.system.maintenance;
          new_creds += assetCost; // return the money
          aitems.push({ _id: asset.id, data: { unusable: true } });
        }
        if (aitems.length > 0) {
          await this.updateEmbeddedDocuments("Item", aitems);
        }
        msg += ` <b>Out of money and unable to pay for all assets</b>, marking all assets with maintenance as unusable<br>`;
      } else {
        msg += ` <b>Out of money and unable to pay for all assets</b>, need to make assets unusable. Mark unusable for assets to cover treasure: ${income}<br>`;
      }
    }
    msg += `<b> Old Treasure: ${this.system.facCreds}. New Treasure: ${new_creds}</b><br>`;
    await this.update({ system: { facCreds: new_creds } });
    const title = `New Turn for ${this.name}`;
    await this.logMessage(title, msg, longMsg);
  }

  async setHomeWorld(journalId) {
    const journal = game.journal?.get(journalId);
    if (!journal || !journal.name) {
      ui.notifications?.error("Cannot find journal");
      return;
    }
    const performHome = await new Promise((resolve) => {
      Dialog.confirm({
        title: game.i18n.format("WWN.faction.setHomeworld", {
          name: journal.name,
        }),
        yes: () => resolve(true),
        no: () => resolve(false),
        content: game.i18n.format("WWN.faction.setHomeworld", {
          name: journal.name,
        }),
      });
    });
    if (!performHome) {
      return;
    }
    ui.notifications?.error("TODO create asset base with max health.");
    await this.update({ system: { homeworld: journal.name } });
  }

  async ratingUp(type) {
    const ratingName = `${type}Rating`;
    let ratingLevel = this.system[ratingName];
    if (ratingLevel == 8) {
      ui.notifications?.info("Rating is already at max");
      return;
    }
    if (!ratingLevel) {
      ratingLevel = 0;
    }
    const targetLevel = parseInt(ratingLevel) + 1;
    let xp = this.system.xp;
    if (targetLevel in HEALTH__XP_TABLE) {
      const req_xp = HEALTH__XP_TABLE[targetLevel];
      if (req_xp > xp) {
        ui.notifications?.error(
          `Not enough XP to raise rating. Have ${xp} Need ${req_xp}`
        );
        return;
      }
      xp -= req_xp;
      if (type == "cunning") {
        await this.update({
          "data.xp": xp,
          "data.cunningRating": targetLevel,
        });
      } else if (type == "force") {
        await this.update({
          "data.xp": xp,
          "data.forceRating": targetLevel,
        });
      } else if (type == "wealth") {
        await this.update({
          "data.xp": xp,
          "data.wealthRating": targetLevel,
        });
      }
      ui.notifications?.info(
        `Raised ${type} rating to ${targetLevel} using ${xp} xp`
      );
    }
  }

}


export const HEALTH__XP_TABLE = {
  1: 1,
  2: 2,
  3: 4,
  4: 6,
  5: 9,
  6: 12,
  7: 16,
  8: 20,
};

export const FACTION_TAGS = [
  { "name": "Antimagical", "desc": "The faction is dwarven or of some other breed of skilled counter-sorcerers. Assets that require Medium or higher Magic to purchase roll all attribute checks twice against this faction during an Attack and take the worst roll." },
  { "name": "Concealed", "desc": "All Assets the faction purchases enter play with the Stealth quality." },
  { "name": "Imperialist", "desc": "The faction quickly expands its Bases of Influence. Once per turn, it can use the Expand Influence action as a special ability instead of it taking a full action." },
  { "name": "Innovative", "desc": "The faction can purchase Assets as if their attribute ratings were two points higher than they are. Only two such over-complex Assets may be owned at any one time." },
  { "name": "Machiavellian", "desc": "The faction is diabolically cunning. It rolls an extra die for all Cunning attribute checks. Its Cunning must always be its highest attribute." },
  { "name": "Martial", "desc": "The faction is profoundly devoted to war. It rolls an extra die for all Force attribute checks. Force must always be its highest attribute." },
  { "name": "Massive", "desc": "The faction is an empire, major kingdom, or other huge organizational edifice. It automatically wins attribute checks if its attribute is more than twice as big as the opposing side's attribute, unless the other side is also Massive." },
  { "name": "Mobile", "desc": "The faction is exceptionally fast or mobile. Its faction turn movement range is twice what another faction would have in the same situation." },
  { "name": "Populist", "desc": "The faction has widespread popular support. Assets that cost 5 Treasure or less to buy cost one point less, to a minimum of 1." },
  { "name": "Rich", "desc": "The faction is rich or possessed of mercantile skill. It rolls an extra die for all Wealth attribute checks. Wealth must always be its highest attribute." },
  { "name": "Rooted", "desc": "The faction has very deep roots in its area of influence. They roll an extra die for attribute checks in their headquarters location, and all rivals roll their own checks there twice, taking the worst die." },
  { "name": "Scavenger", "desc": "As looters and raiders, when they destroy an enemy Asset they gain a quarter of its purchase value in Treasure, rounded up." },
  { "name": "Supported", "desc": "The faction has excellent logistical support. All damaged Assets except Bases of Influence regain one lost hit point per faction turn automatically." },
  { "name": "Tenacious", "desc": "The faction is hard to dislodge. When one of its Bases of Influence is reduced to zero hit points, it instead survives with 1 hit point. This trait can't be used again on that base until it's fully fixed." },
  { "name": "Zealot", "desc": "Once per turn, when an Asset fails an Attack action check, it can reroll the attribute check. It automatically takes counterattack damage from its target, however, or 1d6 if the target has less or none." }
];

export const FACTION_GOALS = [
  { "name": "Blood the Enemy", "desc": "Inflict a number of hit points of damage on enemy faction assets or bases equal to your faction's total Force, Cunning, and Wealth ratings. Difficulty 2." },
  { "name": "Destroy the Foe", "desc": "Destroy a rival faction. Difficulty equal to 2 plus the average of the faction's Force, Cunning, and Wealth ratings." },
  { "name": "Eliminate Target", "desc": "Choose an undamaged rival Asset. If you destroy it within three turns, succeed at a Difficulty 1 goal. If you fail, pick a new goal without suffering the usual turn of paralysis." },
  { "name": "Expand Influence", "desc": "Plant a Base of Influence at a new location. Difficulty 1, +1 if a rival contests it." },
  { "name": "Inside Enemy Territory", "desc": "Have a number of Stealthed assets in locations where there is a rival Base of Influence equal to your Cunning score. Units that are already Stealthed in locations when this goal is adopted don't count. Difficulty 2." },
  { "name": "Invincible Valor", "desc": "Destroy a Force asset with a minimum purchase rating higher than your faction's Force rating. Difficulty 2." },
  { "name": "Peaceable Kingdom", "desc": "Don't take an Attack action for four turns. Difficulty 1." },
  { "name": "Root Out the Enemy", "desc": "Destroy a Base of Influence of a rival faction in a specific location. Difficulty equal to half the average of the current ruling faction's Force, Cunning, and Wealth ratings, rounded up." },
  { "name": "Sphere Dominance", "desc": "Choose Wealth, Force, or Cunning. Destroy a number of rival assets of that kind equal to your score in that attribute. Difficulty of 1 per 2 destroyed, rounded up." },
  { "name": "Wealth of Kingdoms", "desc": "Spend Treasure equal to four times your faction's Wealth rating on bribes and influence. This money is effectively lost, but the goal is then considered accomplished. The faction's Wealth rating must increase before this goal can be selected again. Difficulty 2." }
];

export const FACTION_ACTIONS = [
  { "name": "Attack", "desc": "The faction nominates one or more Assets to attack the enemy in their locations. In each location, the defender chooses which of the Assets present will meet the Attack; thus, if a unit of Infantry attacks in a location where there is an enemy Base of Influence, Informers, and Idealistic Thugs, the defender could decide to use Idealistic Thugs to defend against the attack.", "longDesc": "The attacker makes an attribute check based on the attack of the acting Asset; thus, the Infantry would roll Force versus Force. On a success, the defending Asset takes damage equal to the attacking Asset's attack score, or [[1d8]] in the case of Infantry. On a failure, the attacking Asset takes damage equal to the defending Asset's counterattack score, or [[1d6]] in the case of Idealistic Thugs. If the damage done to an Asset reduces it to zero hit points, it is destroyed. The same Asset may be used to defend against multiple attacking Assets, provided it can survive the onslaught. Damage done to a Base of Influence is also done directly to the faction's hit points. Overflow damage is not transmitted, however; if the Base of Influence only has 5 hit points and 7 hit points are inflicted, the faction loses the Base of Influence and 5 hit points from its total." },
  { "name": "Move Asset", "desc": "One or more Assets are moved up to one turn's worth of movement each. The receiving location must not have the ability and inclination to forbid the Asset from operating there. Subtle and Stealthed Assets ignore this limit.", "longDesc": "If an asset loses the Subtle or Stealth qualities while in a hostile location, they must use this action to retreat to safety within one turn or they will take half their maximum hit points in damage at the start of the next turn, rounded up." },
  { "name": "Repair Asset", "desc": "The faction spends 1 Treasure on each Asset they wish to repair, fixing half their relevant attribute value in lost hit points, rounded up. Thus, fixing a Force Asset would heal half the faction's Force attribute, rounded up. Additional healing can be applied to an Asset in this same turn, but the cost increases by 1 Treasure for each subsequent fix; thus, the second costs 2 Treasure, the third costs 3 Treasure, and so forth. This ability can at the same time also be used to repair damage done to the faction, spending 1 Treasure to heal a total equal to the faction's highest and lowest Force, Wealth, or Cunning attribute divided by two, rounded up. Thus, a faction with a Force of 5, Wealth of 2, and Cunning of 4 would heal 4 points of damage. Only one such application of healing is possible for a faction each turn." },
  { "name": "Expand Influence", "desc": "The faction seeks to establish a new base of operations in a location. The faction must have at least one Asset there already to make this attempt, and must spend 1 Treasure for each hit point the new Base of Influence is to have. Thus, to create a new Base of Influence with a maximum hit point total of 10, 10 Treasure must be spent. Bases with high maximum hit point totals are harder to dislodge, but losing them also inflicts much more damage on the faction's own hit points.", "longDesc": "Once the Base of Influence is created, the owner makes a Cunning versus Cunning attribute check against every other faction that has at least one Asset in the same location. If the other faction wins the check, they are allowed to make an immediate Attack against the new Base of Influence with whatever Assets they have present in the location. The creating faction may attempt to block this action by defending with other Assets present. If the Base of Influence survives this onslaught, it operates as normal and allows the faction to purchase new Assets there with the Create Asset action." },
  { "name": "Create Asset", "desc": "The faction buys one Asset at a location where they have a Base of Influence. They must have the minimum attribute and Magic ratings necessary to buy the Asset and must pay the listed cost in Treasure to build it. A faction can create only one Asset per turn.", "longDesc": "A faction can have no more Assets of a particular attribute than their attribute score. Thus, a faction with a Force of 3 can have only 3 Force Assets. If this number is exceeded, the faction must pay 1 Treasure per excess Asset at the start of each turn, or else they will lose the excess." },
  { "name": "Hide Asset", "desc": "An action available only to factions with a Cunning score of 3 or better, this action allows the faction to give one owned Asset the Stealth quality for every 2 Treasure they spend. Assets currently in a location with another faction's Base of Influence can't be hidden. If the Asset later loses the Stealth, no refund is given." },
  { "name": "Sell Asset", "desc": "The faction voluntarily decommissions an Asset, salvaging it for what it's worth. The Asset is lost and the faction gains half its purchase cost in Treasure, rounded down. If the Asset is damaged when it is sold, however, no Treasure is gained." }
];