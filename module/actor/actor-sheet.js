import { WwnActor } from "./entity.js";
import { WwnEntityTweaks } from "../dialog/entity-tweaks.js";

export class WwnActorSheet extends ActorSheet {
  constructor(...args) {
    super(...args);
  }
  /* -------------------------------------------- */

  getData() {
    const data = foundry.utils.deepClone(super.getData().data);
    data.owner = this.actor.isOwner;
    data.editable = this.actor.sheet.isEditable;

    data.config = CONFIG.WWN;
    data.isNew = this.actor.isNew();

    return data;
  }

  activateEditor(name, options, initialContent) {
    // remove some controls to the editor as the space is lacking
    if (name == "data.details.description") {
      options.toolbar = "styleselect bullist hr table removeFormat save";
    } 
    super.activateEditor(name, options, initialContent);
  }

  _onItemSummary(event) {
    event.preventDefault();
    let li = $(event.currentTarget).parents(".item"),
      item = this.actor.items.get(li.data("item-id")),
      description = TextEditor.enrichHTML(item.data.data.description);
    // Toggle summary
    if (li.hasClass("expanded")) {
      let summary = li.parents(".item-entry").children(".item-summary");
      summary.slideUp(200, () => summary.remove());
    } else {
      // Add item tags
      let div = $(
        `<div class="item-summary"><ol class="tag-list">${item.getTags()}</ol><div>${description}</div></div>`
      );
      li.parents(".item-entry").append(div.hide());
      div.slideDown(200);
    }
    li.toggleClass("expanded");
  }

  async _onSpellChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (event.target.dataset.field == "cast") {
      return item.update({ "data.cast": parseInt(event.target.value) });
    } else if (event.target.dataset.field == "memorize") {
      return item.update({
        "data.memorized": parseInt(event.target.value),
      });
    }
  }

  async _resetSpells(event) {
    this.actor.update({
      "data.spells.perDay.value": 0
      }
    );
  }

  async _resetEffort(event) {
    const arts = this.actor.items.filter(item => item.type === "art");
    await arts.forEach(art => {
      const itemId = art.id;
      const item = this.actor.items.get(itemId);
      item.update({ "data.effort": 0 });
    });
  }

  async _onEffortChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.update({ "data.effort": parseInt(event.target.value) });
  }

  async _onArtSourceChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.update({ "data.source": event.target.value });
  }

  async _onArtTimeChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.update({ "data.time": event.target.value });
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Item summaries
    html
      .find(".item .item-name h4")
      .click((event) => this._onItemSummary(event));

    html.find(".item .item-controls .item-show").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.show();
    });

    html.find(".saving-throw .attribute-name a").click((ev) => {
      let actorObject = this.actor;
      let element = ev.currentTarget;
      let save = element.parentElement.parentElement.dataset.save;
      actorObject.rollSave(save, { event: ev });
    });

    html.find(".item .item-rollable .item-image").click(async (ev) => {
      const itemId = $(ev.currentTarget).parents(".item");
      const item = this.document.items.get(itemId.data("itemId"));
      if (item.type == "weapon") {
        if (this.actor.data.type === "monster") {
          await item.update({
            data: { counter: { value: item.data.data.counter.value - 1 } }
          })
        }
        item.rollWeapon({ skipDialog: ev.ctrlKey });
      } else if (item.type == "spell") {
        item.spendSpell({ skipDialog: ev.ctrlKey });
      } else if (item.type == "art") {
        item.spendArt({ skipDialogue: ev.ctrlKey, itemId: itemId });
      } else {
        item.roll({ skipDialog: ev.ctrlKey });
      }
    });

    html.find(".attack a").click((ev) => {
      let actorObject = this.actor;
      let element = event.currentTarget;
      let attack = element.parentElement.parentElement.dataset.attack;
      const rollData = {
        actor: this.data,
        roll: {},
      };
      actorObject.targetAttack(rollData, attack, {
        type: attack,
        skipDialog: ev.ctrlKey,
      });
    });

    html
      .find(".artEffort input")
      .click((ev) => ev.target.select())
      .change(this._onEffortChange.bind(this));

    html
      .find(".artSource input")
      .click((ev) => ev.target.select())
      .change(this._onArtSourceChange.bind(this));

    html
      .find(".artTime input")
      .click((ev) => ev.target.select())
      .change(this._onArtTimeChange.bind(this));
    
    html.find(".check-field .check.hd-roll").click((ev) => {
      let actorObject = this.actor;
      actorObject.rollHitDice({ event: event });
    });

    html.find(".morale-check a").click((ev) => {
      let actorObject = this.actor;
      actorObject.rollMorale({ event: event });
    });

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    html
      .find(".memorize input")
      .click((ev) => ev.target.select())
      .change(this._onSpellChange.bind(this));


    html.find(".slot-reset").click((ev) => {
      this._resetSpells(ev);
    });

    html.find(".effort-reset").click((ev) => {
      this._resetEffort(ev);
    });

    /** Attempt to copy input focus */
    if ( this.isEditable ) {
      const inputs = html.find("input");
      inputs.focus(ev => ev.currentTarget.select());
    }
  }

  // Override to set resizable initial size
  /* async _renderInner(...args) {
    const html = await super._renderInner(...args);
    this.form = html[0];

    // Resize resizable classes
    let resizable = html.find(".resizable");
    if (resizable.length == 0) {
      return;
    }
    if (character) {
      return;
    }
    resizable.each((_, el) => {
      let heightDelta = this.position.height - this.options.height;
      el.style.height = `${heightDelta + parseInt(el.dataset.baseSize)}px`;
    });
    return html;
  } */

  async _onResize(event) {
    super._onResize(event);

    let html = $(this.form);
    let resizable = html.find(".resizable");
    if (resizable.length == 0) {
      return;
    }
    // Resize divs
    resizable.each((_, el) => {
      let heightDelta = this.position.height - this.options.height;
      el.style.height = `${heightDelta + parseInt(el.dataset.baseSize)}px`;
    });
    // Resize editors
    let editors = html.find(".editor");
    editors.each((id, editor) => {
      let container = editor.closest(".resizable-editor");
      if (container) {
        let heightDelta = this.position.height - this.options.height;
        editor.style.height = `${
          heightDelta + parseInt(container.dataset.editorSize)
          }px`;
      }
    });
  }

  _onConfigureActor(event) {
    event.preventDefault();
    new WwnEntityTweaks(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

  /**
   * Extend and override the sheet header buttons
   * @override
   */
  _getHeaderButtons() {
    let buttons = super._getHeaderButtons();

    // Token Configuration
    const canConfigure = game.user.isGM || this.actor.isOwner;
    if (this.options.editable && canConfigure) {
      buttons = [
        {
          label: game.i18n.localize("WWN.dialog.tweaks"),
          class: "configure-actor",
          icon: "fas fa-code",
          onclick: (ev) => this._onConfigureActor(ev),
        },
      ].concat(buttons);
    }
    return buttons;
  }
}
