import WwnItemBase from "./base.mjs";
import { PhysicalDataMixin } from "../mixins/physical.mjs";
import { mergeFormulaMod } from "../../derivations/item-formulas.mjs";
import { AMMO_MODES, mapWeaponAmmoMigration } from "../../helpers/ammo.mjs";

const fields = foundry.data.fields;

/**
 * Weapon. Skill and ammo are linked by item ID with name fallback.
 */
export default class WwnWeapon extends PhysicalDataMixin(WwnItemBase) {
  /** @override */
  static migrateData(source) {
    source = super.migrateData(source);
    if (!source || typeof source !== "object") return source;

    // Coerce legacy blank / non-numeric shock AC before NumberField validation.
    if (source.shock && typeof source.shock === "object") {
      const ac = source.shock.ac;
      if (ac === "" || ac === null || ac === undefined || Number.isNaN(Number(ac))) {
        source.shock.ac = 15;
      } else {
        source.shock.ac = Number(ac);
      }
    }

    const needs =
      source.ammoMode === undefined ||
      source.ammoFallback === undefined ||
      source.charges?.decrementOnAttack !== undefined ||
      typeof source.ammo === "string";
    if (!needs) return source;
    const mapped = mapWeaponAmmoMigration(source);
    source.ammoMode = mapped.ammoMode;
    source.ammoId = mapped.ammoId || source.ammoId || "";
    source.ammoFallback = mapped.ammoFallback;
    source.charges = { ...(source.charges ?? {}), ...mapped.charges };
    delete source.charges.decrementOnAttack;
    delete source.ammo;
    return source;
  }

  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.damage = new fields.StringField({ required: true, initial: "1d6" });
    schema.bonus = new fields.NumberField({ ...requiredInteger, initial: 0 });
    schema.skillDamage = new fields.BooleanField({ initial: false });

    schema.shock = new fields.SchemaField({
      damage: new fields.StringField({ required: true, blank: true, initial: "" }),
      ac: new fields.NumberField({ ...requiredInteger, initial: 15 }),
    });

    schema.trauma = new fields.SchemaField({
      die: new fields.StringField({ required: true, blank: true, initial: "1d6" }),
      rating: new fields.NumberField({ ...requiredInteger, initial: 2 }),
    });

    // Linked skill item id; name fallback retained for migration edge cases.
    schema.skillId = new fields.StringField({ required: true, blank: true });
    schema.skillFallback = new fields.StringField({ required: true, blank: true });
    schema.score = new fields.StringField({ required: true, initial: "str" });

    schema.melee = new fields.BooleanField({ initial: true });
    schema.missile = new fields.BooleanField({ initial: false });
    schema.slow = new fields.BooleanField({ initial: false });
    schema.burst = new fields.BooleanField({ initial: false });

    schema.range = new fields.SchemaField({
      short: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      medium: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      long: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    schema.save = new fields.StringField({ required: true, blank: true });
    schema.tags = new fields.ArrayField(new fields.StringField(), { required: true, initial: [] });

    schema.ammoMode = new fields.StringField({
      required: true,
      choices: Object.values(AMMO_MODES),
      initial: AMMO_MODES.none,
    });
    schema.ammoId = new fields.StringField({ required: true, blank: true });
    schema.ammoFallback = new fields.StringField({ required: true, blank: true });

    schema.charges = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    schema.counter = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 1 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 1 }),
    });

    return schema;
  }

  /** Resolve the linked skill item on the owning actor. */
  get linkedSkill() {
    const actor = this.parent?.actor;
    if (!actor) return null;
    if (this.skillId) {
      const skill = actor.items.get(this.skillId);
      if (skill) return skill;
    }
    if (this.skillFallback) {
      return actor.items.find(
        (i) => i.type === "skill" && i.name.toLowerCase() === this.skillFallback.toLowerCase()
      ) ?? null;
    }
    return null;
  }

  /** Resolve the linked ammo item on the owning actor. */
  get linkedAmmo() {
    const actor = this.parent?.actor;
    if (!actor) return null;
    if (this.ammoId) {
      const ammo = actor.items.get(this.ammoId);
      if (ammo) return ammo;
    }
    if (this.ammoFallback) {
      const fallback = this.ammoFallback.toLowerCase();
      return actor.items.find(
        (i) => i.type === "item" && i.name.toLowerCase().includes(fallback)
      ) ?? null;
    }
    return null;
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
    this.bonusMod = 0;
    this.damageMod = 0;
    this.shock ??= {};
    this.shock.damageMod = 0;
    this.shock.acMod = 0;
    this.trauma ??= {};
    this.trauma.ratingMod = 0;
    this.charges ??= {};
    this.charges.maxMod = 0;
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    this.parent?.applyItemActiveEffects?.("final");

    this.bonusValue = (this.bonus ?? 0) + (this.bonusMod ?? 0);
    this.shockAcValue = (this.shock?.ac ?? 0) + (this.shock?.acMod ?? 0);
    this.traumaRatingValue = (this.trauma?.rating ?? 0) + (this.trauma?.ratingMod ?? 0);
    this.charges.maxValue = (this.charges?.max ?? 0) + (this.charges?.maxMod ?? 0);

    this.damageDisplay = mergeFormulaMod(this.damage, this.damageMod);
    this.shockDamageDisplay = mergeFormulaMod(this.shock?.damage, this.shock?.damageMod);
  }
}
