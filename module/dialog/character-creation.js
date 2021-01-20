import { WwnActor } from '../actor/entity.js';
import { WwnDice } from "../dice.js";

export class WwnCharacterCreator extends FormApplication {
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.classes = ["wwn", "dialog", "creator"],
      options.id = 'character-creator';
    options.template =
      'systems/wwn/templates/actors/dialogs/character-creation.html';
    options.width = 235;
    return options;
  }

  /* -------------------------------------------- */

  /**
   * Add the Entity name into the window title
   * @type {String}
   */
  get title() {
    return `${this.object.name}: ${game.i18n.localize('WWN.dialog.generator')}`;
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData() {
    let data = this.object.data;
    data.user = game.user;
    data.config = CONFIG.WWN;
    data.counters = {
      str: 0,
      wis: 0,
      dex: 0,
      int: 0,
      cha: 0,
      con: 0,
      silver: 0
    }
    data.stats = {
      sum: 0,
      avg: 0,
      std: 0
    }
    return data;
  }

  /* -------------------------------------------- */

  doStats(ev) {
    let list = $(ev.currentTarget).closest('.attribute-list');
    let values = [];
    list.find('.score-value').each((i, s) => {
      if (s.value != 0) {
        values.push(parseInt(s.value));
      }
    })

    let n = values.length;
    let sum = values.reduce((a, b) => a + b);
    let mean = parseFloat(sum) / n;
    let std = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);

    let stats = list.siblings('.roll-stats');
    stats.find('.sum').text(sum);
    stats.find('.avg').text(Math.round(10 * sum / n) / 10);
    stats.find('.std').text(Math.round(100 * std) / 100);

    if (n >= 6) {
      $(ev.currentTarget).closest('form').find('button[type="submit"]').removeAttr('disabled');
    }

    this.object.data.stats = {
      sum: sum,
      avg: Math.round(10 * sum / n) / 10,
      std: Math.round(100 * std) / 100
    }
  }

  rollScore(score, options = {}) {
    // Increase counter
    this.object.data.counters[score]++;

    const label = score != "silver" ? game.i18n.localize(`WWN.scores.${score}.long`) : "Silver";
    const rollParts = ["3d6"];
    const data = {
      roll: {
        type: "result"
      }
    };
    // Roll and return
    return WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format('WWN.dialog.generateScore', { score: label, count: this.object.data.counters[score] }),
      title: game.i18n.format('WWN.dialog.generateScore', { score: label, count: this.object.data.counters[score] }),
    });
  }

  async close(options) {
    // Gather scores
    let scores = {};
    $(this.form.children).find(".score-roll").each((_, d) => {
      let gr = $(d).closest('.form-group');
      let val = gr.find(".score-value").val();
      scores[gr.data("score")] = val;
    })
    const silver = $(this.form.children).find('.silver-value').val();
    const speaker = ChatMessage.getSpeaker({ actor: this });
    const templateData = {
      config: CONFIG.WWN,
      scores: scores,
      title: game.i18n.localize("WWN.dialog.generator"),
      stats: this.object.data.stats,
      silver: silver
    }
    const content = await renderTemplate("/systems/wwn/templates/chat/roll-creation.html", templateData)
    ChatMessage.create({
      content: content,
      speaker,
    });
    return super.close(options);
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('a.score-roll').click((ev) => {
      let el = ev.currentTarget.parentElement.parentElement;
      let score = el.dataset.score;
      this.rollScore(score, { event: ev }).then(r => {
        $(el).find('input').val(r.total).trigger('change');
      });
    });

    html.find('a.silver-roll').click((ev) => {
      let el = ev.currentTarget.parentElement.parentElement.parentElement;
      this.rollScore("silver", { event: ev }).then(r => {
        $(el).find('.silver-value').val(r.total * 10);
      });
    });

    html.find('input.score-value').change(ev => {
      this.doStats(ev);
    })
  }

  async _onSubmit(event, { updateData = null, preventClose = false, preventRender = false } = {}) {
    super._onSubmit(event, { updateData: updateData, preventClose: preventClose, preventRender: preventRender });
    // Generate silver
    let silver = event.target.elements.namedItem('silver').value;
    this.object.update({"data.currency.sp": silver});
    console.log(this.object.data.data.currency.sp);
  }
  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
  async _updateObject(event, formData) {
    event.preventDefault();
    // Update the actor
    this.object.update(formData);
    // Re-draw the updated sheet
    this.object.sheet.render(true);
  }
}
