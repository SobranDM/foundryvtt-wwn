import WwnItemBase from "./base.mjs";
import { PhysicalDataMixin } from "../mixins/physical.mjs";

const fields = foundry.data.fields;

/**
 * Armor: ascending melee AC base, optional ranged AC (CWN split),
 * CWN soak and trauma target (sets actor base when equipped).
 */
export default class WwnArmor extends PhysicalDataMixin(WwnItemBase) {
  /**
   * Legacy `type: "unarmored"` is not a valid choice; map to light.
   * @override
   */
  static migrateData(source) {
    source = super.migrateData(source);
    if (!source || typeof source !== "object") return source;
    if (source.type === "unarmored") source.type = "light";
    if (source.isShield) {
      source.type = "shield";
      delete source.isShield;
    }
    return source;
  }

  static defineSchema() {
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.ac = new fields.NumberField({ ...requiredInteger, initial: 10 });
    schema.acRanged = new fields.NumberField({ ...requiredInteger, initial: 10 });
    schema.mod = new fields.NumberField({ ...requiredInteger, initial: 0 });
    schema.type = new fields.StringField({
      required: true,
      choices: ["light", "medium", "heavy", "shield"],
      initial: "light",
    });
    schema.soak = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.traumaTarget = new fields.NumberField({ ...requiredInteger, initial: 6 });
    schema.ashesHeavy = new fields.BooleanField({ initial: false });

    return schema;
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
    this.acMod = 0;
    this.acRangedMod = 0;
    this.modMod = 0;
    this.soakMod = 0;
    this.traumaTargetMod = 0;
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    this.parent?.applyItemActiveEffects?.("final");

    this.acValue = (this.ac ?? 0) + (this.acMod ?? 0);
    this.acRangedValue = (this.acRanged ?? 0) + (this.acRangedMod ?? 0);
    this.modValue = (this.mod ?? 0) + (this.modMod ?? 0);
    this.soakValue = (this.soak ?? 0) + (this.soakMod ?? 0);
    this.traumaTargetValue = (this.traumaTarget ?? 6) + (this.traumaTargetMod ?? 0);
  }
}
