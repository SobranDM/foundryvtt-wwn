/**
 * Character score generator ApplicationV2.
 */
import { createRollMessage, createCardMessage } from "../chat/chat-card.mjs";
import { applyAppThemeClasses } from "../config/themes.mjs";
import { setBaseCurrencyCarried } from "../helpers/currency.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class WwnCharacterCreator extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "character-creator",
    classes: ["wwn", "wwn-app", "wwn-app--creator"],
    tag: "form",
    form: {
      handler: WwnCharacterCreator.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    window: {
      resizable: false,
      contentClasses: [],
    },
    position: { width: 235 },
    actions: {
      rollScore: WwnCharacterCreator.#onRollScore,
      rollSilver: WwnCharacterCreator.#onRollSilver,
    },
  };

  static PARTS = {
    main: {
      template: "systems/wwn/templates/actors/dialogs/character-creation.html",
    },
  };

  /** @param {Actor} actor */
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.counters = { str: 0, wis: 0, dex: 0, int: 0, cha: 0, con: 0, silver: 0 };
    this.stats = { sum: 0, avg: 0, std: 0 };
    this.#postedSummary = false;
  }

  #postedSummary = false;

  /** @override */
  get title() {
    return `${this.actor.name}: ${game.i18n.localize("WWN.dialog.generator")}`;
  }

  /** @override */
  async _prepareContext(_options) {
    return {
      ...foundry.utils.deepClone(this.actor),
      user: game.user,
      config: CONFIG.WWN,
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    applyAppThemeClasses(this.element);
    this.element.querySelectorAll("input.score-value").forEach((input) => {
      input.addEventListener("change", (ev) => this.#doStats(ev));
    });
  }

  #doStats(ev) {
    const list = ev.currentTarget.closest(".attribute-list");
    if (!list) return;
    const values = [];
    list.querySelectorAll(".score-value").forEach((s) => {
      if (s.value != 0) values.push(parseInt(s.value, 10));
    });
    const n = values.length;
    if (!n) return;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const std = Math.sqrt(values.map((x) => (x - mean) ** 2).reduce((a, b) => a + b, 0) / n);
    const stats = list.parentElement?.querySelector(".roll-stats");
    if (stats) {
      const sumEl = stats.querySelector(".sum");
      const avgEl = stats.querySelector(".avg");
      const stdEl = stats.querySelector(".std");
      if (sumEl) sumEl.textContent = String(sum);
      if (avgEl) avgEl.textContent = String(Math.round((10 * sum) / n) / 10);
      if (stdEl) stdEl.textContent = String(Math.round(100 * std) / 100);
    }
    const submit = this.element.querySelector('button[type="submit"]');
    if (submit && n >= 6) submit.removeAttribute("disabled");
    this.stats = {
      sum,
      avg: Math.round((10 * sum) / n) / 10,
      std: Math.round(100 * std) / 100,
    };
  }

  async #rollScore(score) {
    this.counters[score] = (this.counters[score] ?? 0) + 1;
    const abilityKey = CONFIG.WWN.abilities?.[score];
    const label = score !== "silver"
      ? (abilityKey ? game.i18n.localize(abilityKey) : score)
      : game.i18n.localize("WWN.Currency.Silver");
    const title = game.i18n.format("WWN.dialog.generateScore", {
      score: label,
      count: this.counters[score],
    });
    const roll = await new Roll("3d6", this.actor.getRollData()).evaluate();
    await createRollMessage({
      rolls: [roll],
      kind: "formula",
      actor: this.actor,
      title,
      bodyTemplate: "systems/wwn/templates/chat/simple-roll.hbs",
      context: {},
    });
    return roll;
  }

  static async #onRollScore(event, target) {
    const el = target.closest("[data-score]");
    const score = el?.dataset.score;
    if (!score) return;
    const roll = await this.#rollScore(score);
    const input = el.querySelector("input.score-value");
    if (input) {
      input.value = roll.total;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  static async #onRollSilver() {
    const roll = await this.#rollScore("silver");
    const silver = roll.total * 10;
    const input = this.element.querySelector(".silver-value");
    if (input) {
      input.disabled = false;
      input.value = silver;
    }
  }

  async #postCreationSummary() {
    if (this.#postedSummary || !this.element) return;
    const scores = {};
    this.element.querySelectorAll("[data-score]").forEach((gr) => {
      const score = gr.dataset.score;
      const val = gr.querySelector(".score-value")?.value;
      if (score) scores[score] = val;
    });
    if (!Object.values(scores).some((v) => Number(v) > 0)) return;
    this.#postedSummary = true;
    const silver = this.element.querySelector(".silver-value")?.value;
    await createCardMessage({
      title: game.i18n.localize("WWN.dialog.generator"),
      img: this.actor.img,
      actor: this.actor,
      bodyTemplate: "systems/wwn/templates/chat/roll-creation-body.hbs",
      context: {
        config: CONFIG.WWN,
        scores,
        stats: this.stats,
        silver,
      },
      flags: { kind: "character-creation" },
    });
  }

  static async #onSubmit(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    delete data.silver;
    const silverFinal = Math.floor(Number(this.element.querySelector(".silver-value")?.value) || 0);
    await this.#postCreationSummary();
    await this.actor.update(data);
    if (silverFinal > 0) await setBaseCurrencyCarried(this.actor, silverFinal);
    this.actor.sheet?.render(true);
  }

  /** @override */
  async close(options = {}) {
    await this.#postCreationSummary();
    return super.close(options);
  }
}
