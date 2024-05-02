export class WwnFaction extends Actor {
  prepareData() {
    super.prepareData();
    const data = this.actor.system;

    if (this.type !== "faction") {
      return;
    }
  }

  prepareDerivedData() {

  }

  async _onCreate() {
    await this.actor.update({
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
    super.createEmbeddedDocuments(embeddedName, data, context);
  }

  isNew() {
    const data = this.actor.system;
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
    await this.actor.update({ system: { homeworld: journal.name } });
  }



}