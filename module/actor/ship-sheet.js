import { WwnActorSheet } from "./actor-sheet.js";
import { WwnCharacterModifiers } from "../dialog/character-modifiers.js";
import { WwnAdjustCurrency } from "../dialog/adjust-currency.js";
import { WwnCharacterCreator } from "../dialog/character-creation.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 */
export class WwnActorSheetShip extends WwnActorSheet {
  constructor(...args) {
    super(...args);
  }

  /* -------------------------------------------- */

  /**
   * Extend and override the default options used by the 5e Actor Sheet
   * @returns {Object}
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wwn", "sheet", "actor", "ship"],
      template: "systems/wwn/templates/actors/ship-sheet.html",
      width: 755,
      height: 625,
      resizable: false,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "attributes",
        },
      ],
    });
  }

  /**
   * Organize and classify Owned Items for Character sheets
   * @private
   */
  _prepareItems(data) {
    // Partition items by category
    let [items, weapons, armors, abilities, spells, arts, foci, skills, crewmembers, fittings, shipweapons, cargos] =
      this.actor.items.reduce(
        (arr, item) => {
          // Classify items into types
          if (item.type === "item") arr[0].push(item);
          else if (item.type === "weapon") arr[1].push(item);
          else if (item.type === "armor") arr[2].push(item);
          else if (item.type === "ability") arr[3].push(item);
          else if (item.type === "spell") arr[4].push(item);
          else if (item.type === "art") arr[5].push(item);
          else if (item.type === "focus") arr[6].push(item);
          else if (item.type === "skill") arr[7].push(item);
          else if (item.type === "crewmember") arr[8].push(item); 
          else if (item.type === "fitting") arr[9].push(item); 
          else if (item.type === "shipweapon") arr[10].push(item);
          else if (item.type === "cargo") arr[11].push(item);
          return arr;
        },
        [[], [], [], [], [], [], [], [], [], [], [], []]
      );

    // Sort spells by level
    var sortedSpells = {};
    var slots = {};
    for (var i = 0; i < spells.length; i++) {
      const lvl = spells[i].system.lvl;
      if (!sortedSpells[lvl]) sortedSpells[lvl] = [];
      if (!slots[lvl]) slots[lvl] = 0;
      slots[lvl] += spells[i].system.memorized;
      sortedSpells[lvl].push(spells[i]);
    }

    // Sort each level
    Object.keys(sortedSpells).forEach((level) => {
      sortedSpells[level].sort((a, b) => a.name > b.name ? 1 : -1);
    });

    data.slots = {
      used: slots,
    };

    // Sort arts by class
    let sortedArts = {};
    for (var i = 0; i < arts.length; i++) {
      let source = arts[i].system.source;
      if (!sortedArts[source]) sortedArts[source] = [];
      sortedArts[source].push(arts[i]);
    }

    // Sort each class
    Object.keys(sortedArts).forEach(source => {
      sortedArts[source].sort((a, b) => a.name > b.name ? 1 : -1);
    });

    // Divide skills into primary and secondary
    const primarySkills = skills.filter((skill) => !skill.system.secondary)
      .sort((a, b) => a.name > b.name ? 1 : -1);
    const secondarySkills = skills.filter((skill) => skill.system.secondary)
      .sort((a, b) => a.name > b.name ? 1 : -1);

    // Assign and return
    data.owned = {
      items: items.sort((a, b) => a.name > b.name ? 1 : -1),
      armors: armors.sort((a, b) => a.name > b.name ? 1 : -1),
      abilities: abilities.sort((a, b) => a.name > b.name ? 1 : -1),
      weapons: weapons.sort((a, b) => a.name > b.name ? 1 : -1),
      arts: sortedArts,
      foci: foci.sort((a, b) => a.name > b.name ? 1 : -1),
      skills: [...primarySkills, ...secondarySkills],
      spells: sortedSpells,
      crewmembers: crewmembers.sort((a, b) => a.name > b.name ? 1 : -1),
      fittings: fittings.sort((a, b) => a.name > b.name ? 1 : -1),
      shipweapons: shipweapons.sort((a, b) => a.name > b.name ? 1 : -1),
      cargos: cargos.sort((a, b) => a.name > b.name ? 1 : -1),
    };
  }

  generateScores() {
    new WwnCharacterCreator(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

  adjustCurrency() {
    new WwnAdjustCurrency(this.actor, {
      top: this.position.top + 300,
      left: this.position.left + (this.position.width - 200) / 2,
    }).render(true);
  }

  // toSilver(currency) {
  //   // takes a system.currency object and returns equivalent values in whole silver pieces
  //   let silver = currency
  //   // console.log(this)
  //   silver.cp = math.floor(currency.cp / 10)
  //   silver.ep = currency.ep * 5
  //   silver.gp = currency.gp * 10
  //   silver.pp = currency.pp * 100
  //   return silver; 
  // }

  payCrew() {
    // ELEPHANT

    if (this.actor.type != "ship"){
      return; 
    }

    let ship = this.actor.system
    console.log("ship currency:")
    console.log(ship.currency)
    let silver = ship.currency

    silver.cp = Math.floor(ship.currency.cp / 10)
    silver.ep = ship.currency.ep * 5
    silver.gp = ship.currency.gp * 10 
    silver.pp = ship.currency.pp * 100

    console.log("ship currency in silver:")
    console.log(silver)

    // return; 
    let cost = ship.details.crew.totalcost;
    let coin = ship.currency.total;
    let content = ` Previous total ship coin was ${coin}. </br>New total ship coin is `;

    // Check if the ship has enough coin to pay the crew
    if (cost > coin){
      return ui.notifications.error("This ship does not have sufficient coin to pay all crew.");
    } else if (cost === 0){
      return ui.notifications.warn("The crew pay is zero.")
    } else if (!(Number.isInteger(cost))) {
      return ui.notifications.error("This button only handles integer monthly crew pay calculations.")
    } else{ 
      
      let remaining_cost = cost

      for (let key in silver){
        if (silver.hasOwnProperty(key)) {
          if (!(key === "total" || key === "share" || key === "bank")){
            let value = silver[key];
            console.log(key, value);
            remaining_cost = remaining_cost - value
            console.log("Remaining cost: " + remaining_cost)

            if (remaining_cost <= 0 ){
              // the cost is paid off
              // refund any money that was overpaid
              silver[key] = Math.abs(remaining_cost)
              break; 
            } else {
              silver[key] = 0
            }
          }
        }
      }

      console.log("ship currency in silver:")
      console.log(silver)

      ship.currency.cp = silver.cp * 10 + (ship.currency.cp % 10)
      ship.currency.ep = Math.floor(silver.ep / 5)
      ship.currency.gp = Math.floor(silver.gp / 10)
      ship.currency.pp = Math.floor(silver.pp / 100) 

      // chuck any remainders into the silver. Ugly but functional
      ship.currency.sp = ship.currency.sp + (silver.ep % 5) + ( silver.gp % 10 ) + (silver.pp % 100)

      console.log("ship currency:")
      console.log(ship.currency)

      // let remaining_cost = cost

      // // first translate all ship coinage to sp
      // let copper_sp = Math.floor(ship.currency.cp / 10);
      // let electrum_sp = ship.currency.ep * 5; // I think? 
      // let gold_sp = ship.currency.gp * 10;
      // let plat_sp = ship.currency.pp * 100; 

      // let currencylist = [copper_sp, ship.currency.sp, electrum_sp, gold_sp, plat_sp]
      // let varlist = [ship.currency.cp, ship.currency.sp, ship.currency.ep, ship.currency.gp, ship.currency.pp]

      // console.log("currencylist: " + currencylist)
      // console.log("varlist: " + varlist)
      // // then start paying crew, using smallest currency first
      // for (const currency of currencylist) {

      //   console.log("Currency in sp before transaction: " + currency)
      //   remaining_cost = cost - currency

      //   console.log("remaining cost: " + remaining_cost)

      //   // deal with copper separately
      //   // if (currency === copper_sp) {
      //   //   console.log("copper stage")
      //   //   remainder = ship.currency.cp % 10
      //   // }        
      
      //     // if we didn't end up paying off our debt, we can set the current currency 
      //     // to zero
      //     if (currencylist.indexOf(currency) === 0){ 
      //       // handle copper separately because we don't use single coppers
      //       ship.currency.cp += -(copper_sp*10)
      //     } else {
      //       // this is failing because it's finding an earlier index with this value, somehow. 
      //       console.log("quantity getting set to zero: " + varlist[currencylist.indexOf(currency)])
      //       varlist[currencylist.indexOf(currency)] = 0
      //     }

      //     console.log("Currency status after transaction: " + varlist[currencylist.indexOf(currency)])

      //   if (remaining_cost <= 0) {
      //     // if we end up with a negative number, need to refund something
      //     // remaining_cost is always in silver pieces, so let's assume we're allowed to give change
      //     ship.currency.sp += -(remaining_cost)
      //     break
      //   }
      //     cost = remaining_cost
      //     console.log("cost for next currency: " + cost)

      // }

      // report crew payments in chat 
      const speaker = ChatMessage.getSpeaker({ actor: this });
      ChatMessage.create({
        title: game.i18n.format("WWN.messages.crew.paid"),
        content: content, 
        speaker: speaker
      });
    }
  }


  /**
   * Prepare data for rendering the Actor sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   */
  async getData() {
    const data = super.getData();
    // Prepare owned items
    this._prepareItems(data);

    data.config.initiative = game.settings.get("wwn", "initiative") != "group";
    data.config.showMovement = game.settings.get("wwn", "showMovement");
    data.config.currencyTypes = game.settings.get("wwn", "currencyTypes");
    data.config.replaceStrainWithWounds = game.settings.get("wwn", "replaceStrainWithWounds");
    data.config.xpPerChar = game.settings.get("wwn", "xpPerChar");
    data.config.medRange = game.settings.get("wwn", "medRange");

    data.enrichedBiography = await TextEditor.enrichHTML(
      this.object.system.details.biography,
      { async: true }
    );
    data.enrichedNotes = await TextEditor.enrichHTML(
      this.object.system.details.notes,
      { async: true }
    );
    return data;
  }

  async _chooseLang() {
    const languages = game.settings.get("wwn", "languageList");
    const choices = languages.split(",");

    let templateData = { choices: choices },
      dlg = await renderTemplate(
        "systems/wwn/templates/actors/dialogs/lang-create.html",
        templateData
      );
    //Create Dialog window
    return new Promise((resolve) => {
      new Dialog({
        title: "",
        content: dlg,
        buttons: {
          ok: {
            label: game.i18n.localize("WWN.Ok"),
            icon: '<i class="fas fa-check"></i>',
            callback: (html) => {
              resolve({
                choice: html.find('select[name="choice"]').val(),
              });
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("WWN.Cancel"),
          },
        },
        default: "ok",
      }).render(true);
    });
  }

  async _chooseItemType(choices = { focus: "focus", ability: "ability" }) {
    let templateData = { types: choices },
      dlg = await renderTemplate(
        "systems/wwn/templates/items/entity-create.html",
        templateData
      );
    //Create Dialog window
    return new Promise((resolve) => {
      new Dialog({
        title: game.i18n.localize("WWN.dialog.createItem"),
        content: dlg,
        buttons: {
          ok: {
            label: game.i18n.localize("WWN.Ok"),
            icon: '<i class="fas fa-check"></i>',
            callback: (html) => {
              resolve({
                type: html.find('select[name="type"]').val(),
                name: html.find('input[name="name"]').val(),
              });
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("WWN.Cancel"),
          },
        },
        default: "ok",
      }).render(true);
    });
  }

  _pushLang(table) {
    const data = this.actor.system;
    let update = duplicate(data[table]);
    let language = game.settings.get("wwn", "languageList");
    let languages = language.split(",");
    this._chooseLang().then((dialogInput) => {
      const name = languages[dialogInput.choice];
      if (update.value) {
        update.value.push(name);
      } else {
        update = { value: [name] };
      }
      let newData = {};
      newData[table] = update;
      return this.actor.update({ system: newData });
    });
  }

  _popLang(table, lang) {
    const data = this.actor.system;
    let update = data[table].value.filter((el) => el != lang);
    let newData = {};
    newData[table] = { value: update };
    return this.actor.update({ system: newData });
  }

  /* -------------------------------------------- */

  async _onQtChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.update({ "system.quantity": parseInt(event.target.value) });
  }

  async _onChargeChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.update({
      "system.charges.value": parseInt(event.target.value),
    });
  }

  _onShowModifiers(event) {
    event.preventDefault();
    new WwnCharacterModifiers(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".ability-score .attribute-name a").click((ev) => {
      let actorObject = this.actor;
      let element = ev.currentTarget;
      let score = element.parentElement.parentElement.dataset.score;
      let stat = element.parentElement.parentElement.dataset.stat;
      if (!score) {
        actorObject.rollCheck(score, { event: event });
      }
    });

    html.find(".skills .attribute-name a").click((ev) => {
      let actorObject = this.actor;
      let element = ev.currentTarget;
      let expl = element.parentElement.parentElement.dataset.skills;
      actorObject.rollSkills(expl, { event: event });
    });

    html.find(".inventory .item-titles .item-caret").click((ev) => {
      let items = $(ev.currentTarget.parentElement.parentElement).children(
        ".item-list"
      );
      if (items.css("display") == "none") {
        let el = $(ev.currentTarget).find(".fas.fa-caret-right");
        el.removeClass("fa-caret-right");
        el.addClass("fa-caret-down");
        items.slideDown(200);
      } else {
        let el = $(ev.currentTarget).find(".fas.fa-caret-down");
        el.removeClass("fa-caret-down");
        el.addClass("fa-caret-right");
        items.slideUp(200);
      }
    });

    html.find("a[data-action='modifiers']").click((ev) => {
      this._onShowModifiers(ev);
    });

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Update Inventory Item
    html.find(".item-edit").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find(".item-delete").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
    });

    html.find(".item-push").click((ev) => {
      ev.preventDefault();
      const header = ev.currentTarget;
      const table = header.dataset.array;
      this._pushLang(table);
    });

    html.find(".item-pop").click((ev) => {
      ev.preventDefault();
      const header = ev.currentTarget;
      const table = header.dataset.array;
      this._popLang(table, $(ev.currentTarget).closest(".item").data("lang"));
    });

    //Toggle Equipment
    html.find(".item-toggle").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      await item.update({
        system: {
          equipped: !item.system.equipped,
        },
      });
    });

    html.find(".item-prep").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      await item.update({
        system: {
          prepared: !item.system.prepared,
        },
      });
    });

    html.find(".stow-toggle").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      await item.update({
        system: {
          stowed: !item.system.stowed,
        },
      });
    });

    html
      .find(".quantity input")
      .click((ev) => ev.target.select())
      .change(this._onQtChange.bind(this));

    html
      .find(".charges input")
      .click((ev) => ev.target.select())
      .change(this._onChargeChange.bind(this));

    html.find("a[data-action='generate-scores']").click((ev) => {
      this.generateScores(ev);
    });

    html.find("a[data-action='currency-adjust']").click((ev) => {
      this.adjustCurrency(ev);
    });

    html.find("a[data-action='pay-crew']").click((ev) => {
      this.payCrew(ev);
    });

    // Use unspent skill points to improve the skill
    html.find(".skill-up").click(async (ev) => {
      ev.preventDefault();
      const li = $(ev.currentTarget).parents(".item");
      const skill = this.actor.items.get(li.data("itemId"));
      if (skill.type == "skill") {
        const rank = skill.system.ownedLevel;
        // Check if char has sufficient level
        if (rank > 0) {
          const lvl = this.actor.system.details.level;
          if (!game.settings.get("wwn", "noSkillLevelReq")) {
            if (rank == 1 && lvl < 3) {
              ui.notifications?.error(
                "Must be at least level 3 (edit manually to override)"
              );
              return;
            } else if (rank == 2 && lvl < 6) {
              ui.notifications?.error(
                "Must be at least level 6 (edit manually to override)"
              );
              return;
            } else if (rank == 3 && lvl < 9) {
              ui.notifications?.error(
                "Must be at least level 9 (edit manually to override)"
              );
              return;
            } else if (rank > 3) {
              ui.notifications?.error("Cannot auto-level above 4");
              return;
            }
          }
        }
        // check costs and update if points available
        const flatCost = game.settings.get("wwn", "flatSkillCost");
        const skillCost = flatCost ? 1 : rank + 2;
        const skillPointsAvail = this.actor.system.skills.unspent;
        if (skillCost > skillPointsAvail) {
          ui.notifications.error(
            `Not enough skill points. Have: ${skillPointsAvail}, need: ${skillCost}`
          );
          return;
        } else if (isNaN(skillPointsAvail)) {
          ui.notifications.error(`Unspent skill points not set`);
          return;
        }
        await skill.update({ "system.ownedLevel": rank + 1 });
        const newSkillPoints = skillPointsAvail - skillCost;
        await this.actor.update({ "system.skills.unspent": newSkillPoints });
        ui.notifications.info(`Removed ${skillCost} skill points`);
      }
    });

    // Show / hide skill buttons
    html.find(".lock-skills").click((ev) => {
      ev.preventDefault();
      const lock = $(ev.currentTarget).data("type") == "lock" ? true : false;
      if (lock) {
        html.find(".lock-skills.unlock").css("display", "inline-block");
        html.find(".lock-skills.lock").hide();
      } else {
        html.find(".lock-skills.unlock").hide();
        html.find(".lock-skills.lock").css("display", "inline-block");
      }
      html.find(".skill-lock").each(function () {
        if (lock) {
          $(this).hide();
        } else {
          $(this).show();
        }
      });
      html.find(".reverse-lock").each(function () {
        if (!lock) {
          $(this).hide();
        } else {
          $(this).show();
        }
      });
    });
  }
}
