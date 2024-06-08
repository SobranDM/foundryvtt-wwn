/**
 * Extend the basic ItemSheet with some very simple modifications
 */

// Import helper/utility classes and constants.
import { onManageActiveEffect, prepareActiveEffectCategories } from "../effects.mjs";

export class WwnItemSheet extends ItemSheet {
  constructor(...args) {
    super(...args);

    /**
     * Keep track of the currently active sheet tab
     * @type {string}
     */
  }

  /**
   * Extend and override the default options used by the Simple Item Sheet
   * @returns {Object}
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wwn", "sheet", "item"],
      width: 550,
      height: 510,
      resizable: true,
      tabs: [
        {
          navSelector: ".tabs",
          contentSelector: ".sheet-body",
          initial: "description",
        },
      ],
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = "systems/wwn/templates/items/";
    return `${path}/${this.item.type}-sheet.html`;
  }

  /**
   * Prepare data for rendering the Item sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   */
  async getData() {
    const data = super.getData().data;
    data.editable = this.document.sheet.isEditable;
    data.config = CONFIG.WWN;
    data.actor = this.actor;
    data.enrichedDescription = await TextEditor.enrichHTML(
      this.object.system.description,
      { async: true }
    );

    // Prepare active effects.
    data.effects = prepareActiveEffectCategories(this.item.effects);

    return data;
  }

  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Active Effect management
    html.find(".effect-control").click(ev => onManageActiveEffect(ev, this.item));

    html.find('input[data-action="add-tag"]').keypress((ev) => {
      if (event.which == 13) {
        let value = $(ev.currentTarget).val();
        let values = value.split(',');
        this.object.pushTag(values);
      }
    });
    html.find('.tag-delete').click((ev) => {
      let value = ev.currentTarget.parentElement.dataset.tag;
      this.object.popTag(value);
    });
    html.find('a.melee-toggle').click(() => {
      this.object.update({ system: { melee: !this.object.system.melee } });
    });

    html.find('a.missile-toggle').click(() => {
      this.object.update({ system: { missile: !this.object.system.missile } });
    });

    if (this.isEditable) {
      const inputs = html.find("input");
      inputs.focus(ev => ev.currentTarget.select());
    }
  }
}
