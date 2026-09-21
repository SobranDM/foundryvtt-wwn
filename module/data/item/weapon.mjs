import WwnItemBase from "./base.mjs";
import { PhysicalDataMixin } from "../mixins/physical.mjs";
import { mergeFormulaMod } from "../../derivations/item-formulas.mjs";
import { AMMO_MODES, mapWeaponAmmoMigration, resolveLinkedAmmo } from "../../helpers/ammo.mjs";

const fields = foundry.data.fields;

/**
 * Weapon. Skill and ammo are linked by item ID with name fallback.
 */
export default class WwnWeapon extends PhysicalDataMixin(WwnItemBase) {
  /** @override */
  static migrateData(source) {
    source = super.migrateData(source);
    if (!source || typeof source !== "object") return source;

    // Coerce a legacy blank / non-numeric shock AC -- but only when `ac` is
    // actually part of THIS payload. `source` here can be a partial update
    // diff (toggling Equipped, spending ammo in combat, adjusting the shot
    // counter, ...), not just a full document load: defaulting an absent
    // `ac` would stamp 15 into any update that touches `shock` without
    // mentioning `ac` (e.g. editing shock damage alone), overwriting a real
    // custom value. A genuinely missing field on a full load is already
    // covered by the schema's own NumberField `initial`.
    if (source.shock && typeof source.shock === "object" && "ac" in source.shock) {
      const ac = source.shock.ac;
      if (ac === "" || ac === null) {
        // Pre-2.0.0-beta4 worlds represented "Shock applies to any AC" by
        // leaving this field blank. The schema now requires a real number
        // (see defineSchema below), so translate that legacy blank signal
        // into the anyAc flag instead of just picking an arbitrary number.
        //
        // Code-review fix: this used to also fire on an ordinary sheet edit
        // -- the AC input's `data-dtype` was "String" (unlike every sibling
        // numeric field), so clearing it submitted a live "" instead of the
        // `null` a Number-dtype field produces. The template now uses
        // "Number" like its siblings, so clearing the field submits `null`;
        // Foundry's own NumberField.clean() then substitutes the schema's
        // `initial` (15) for that `null` before migrateData ever sees it,
        // same as any other required-nonnullable numeric field cleared on an
        // item sheet. This branch is now only ever reached by a genuinely
        // persisted legacy "" from an old world's data, not a user
        // momentarily blanking the field.
        source.shock.ac = 15;
        source.shock.anyAc = true;
      } else if (Number.isNaN(Number(ac))) {
        source.shock.ac = 15;
      } else {
        source.shock.ac = Number(ac);
      }
    }

    // Pre-migration sheets wrote `system.skill`; the schema now uses skillFallback.
    if (typeof source.skill === "string") {
      if (!source.skillFallback) source.skillFallback = source.skill;
      delete source.skill;
    }
    delete source.skillDamage;

    // Only run the ammo-mode migration when the payload carries a genuine
    // LEGACY signal (the old `ammo` string field, or the old
    // charges.decrementOnAttack flag) -- never merely because ammoMode/
    // ammoFallback are absent from this payload. `source` can be a partial
    // update diff, exactly like the shock.ac case above: treating "absent"
    // as "needs migrating" recomputed ammoMode from an incomplete diff and
    // stamped ammoMode:"none" + wiped ammoFallback/charges into ordinary
    // actions like toggling Equipped or decrementing the shot counter. A
    // genuinely missing field on a full legacy document load is still
    // caught by the two real legacy-signal checks below. Same hazard
    // already fixed for WwnPc's renown/morale.
    const needs =
      source.charges?.decrementOnAttack !== undefined || typeof source.ammo === "string";
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

    schema.shock = new fields.SchemaField({
      damage: new fields.StringField({ required: true, blank: true, initial: "" }),
      ac: new fields.NumberField({ ...requiredInteger, initial: 15 }),
      /** Shock applies regardless of the target's AC ("N/Any" in AWN/CWN stat blocks). */
      anyAc: new fields.BooleanField({ initial: false }),
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
    /** Tech level (0–3 primitive; 4+ advanced). Default 0 = primitive. */
    schema.tl = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    /** Firearms (and hurlants) ignore TL≤2 non-magical armor/shields for hit rolls. */
    schema.firearm = new fields.BooleanField({ initial: false });

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
    return resolveLinkedAmmo(actor.items, {
      ammoId: this.ammoId,
      ammoFallback: this.ammoFallback,
    });
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
    // NPCs can flip an actor-wide "every weapon Shocks any AC" switch
    // (system.combat.allWeaponsShockAnyAc) instead of editing each
    // compendium weapon dragged onto the sheet. Centralizing this here
    // means every consumer of shockAcValue (attack rolls, end-of-turn
    // Shock, chat display) gets the same answer with no per-call-site
    // awareness of either flag.
    const forcedAnyAc = !!this.parent?.actor?.system?.combat?.allWeaponsShockAnyAc;
    this.shockAnyAcValue = !!this.shock?.anyAc || forcedAnyAc;
    this.shockAcValue = this.shockAnyAcValue ? Infinity : (this.shock?.ac ?? 0) + (this.shock?.acMod ?? 0);
    this.traumaRatingValue = (this.trauma?.rating ?? 0) + (this.trauma?.ratingMod ?? 0);
    this.charges.maxValue = (this.charges?.max ?? 0) + (this.charges?.maxMod ?? 0);

    this.damageDisplay = mergeFormulaMod(this.damage, this.damageMod);
    this.shockDamageDisplay = mergeFormulaMod(this.shock?.damage, this.shock?.damageMod);
  }
}
