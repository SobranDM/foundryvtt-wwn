import { WwnActor } from "./entity.js";
import { WwnActorSheet } from "./actor-sheet.js";

/**
 *  Extend the basic ActorSheet
 */
export class WwnActorSheetFaction extends WwnActorSheet {
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
      classes: ["wwn", "sheet", "actor", "faction"],
      template: "systems/wwn/templates/actors/faction-sheet.html",
      width: 730,
      height: 625,
      resizable: false,
    });
  }
}