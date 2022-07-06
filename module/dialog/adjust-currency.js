export class WwnAdjustCurrency extends FormApplication {

  static get defaultOptions() {
    const options = super.defaultOptions;
    options.id = 'sheet-tweaks';
    options.template =
      'systems/wwn/templates/actors/dialogs/adjust-currency.html';
    options.width = 280;
    return options;
  }

  /* -------------------------------------------- */
  /**
   * Add the Entity name into the window title
   * @type {String}
   */
  get title() {
    return game.i18n.localize("WWN.dialog.xp.deal");
  }
  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData() {
    const data = foundry.utils.deepClone(this.object.data);
    if (data.type === 'character') {
      data.isCharacter = true;
    }
    data.user = game.user;
    data.config = CONFIG.WWN;
    return data;
  }
  /* -------------------------------------------- */

  async _adjustCurrency(ev) {
    let updatedCurrency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, bank: 0 };
    updatedCurrency.cp = parseInt($(ev.currentTarget.parentElement.parentElement).find('input[name="copper"]').val()) || 0;
    updatedCurrency.sp = parseInt($(ev.currentTarget.parentElement.parentElement).find('input[name="silver"]').val()) || 0;
    updatedCurrency.gp = parseInt($(ev.currentTarget.parentElement.parentElement).find('input[name="gold"]').val()) || 0;
    updatedCurrency.bank = parseInt($(ev.currentTarget.parentElement.parentElement).find('input[name="bank"]').val()) || 0;
    if (game.settings.get("wwn", "currencyTypes") === "currencybx") {
      updatedCurrency.ep = parseInt($(ev.currentTarget.parentElement.parentElement).find('input[name="electrum"]').val()) || 0;
      updatedCurrency.pp = parseInt($(ev.currentTarget.parentElement.parentElement).find('input[name="bank"]').val()) || 0;
    }
    updatedCurrency = {
      cp: updatedCurrency.cp + this.object.data.data.currency.cp,
      sp: updatedCurrency.sp + this.object.data.data.currency.sp,
      ep: updatedCurrency.ep + this.object.data.data.currency.ep,
      gp: updatedCurrency.gp + this.object.data.data.currency.gp,
      pp: updatedCurrency.pp + this.object.data.data.currency.pp,
      bank: updatedCurrency.bank + this.object.data.data.currency.bank
    }
    const invalidEntries = Object.entries(updatedCurrency).filter(curr => curr[1] < 0)
    if (invalidEntries.length > 0) {
      return ui.notifications.warn(`Cannot reduce ${invalidEntries[0][0].toUpperCase()} below 0!`)
    }
    await this.object.update({ "data.currency": updatedCurrency });
  }

  async _updateObject(event, formData) {
    event.preventDefault();
    this.object.sheet.render(true);
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html
      .find('button[data-action="adjust-currency"')
      .click(this._adjustCurrency.bind(this));
  }
}