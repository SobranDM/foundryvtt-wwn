const fields = foundry.data.fields;

/**
 * Schema mixin: physical carried-item fields (price, weight, quantity,
 * readied/stowed state, weightless behavior, container linkage).
 * @param {typeof foundry.abstract.TypeDataModel} Base
 */
export function PhysicalDataMixin(Base) {
  return class Physical extends Base {
    /**
     * Legacy WWN used `weightless: "never"`; schema choices are now
     * `"" | whenReadied | whenStowed`. Must run in migrateData so embedded
     * items validate at document load (before ready-hook world migration).
     * @override
     */
    static migrateData(source) {
      source = super.migrateData(source);
      if (!source || typeof source !== "object") return source;
      if (source.weightless === "never") source.weightless = "";
      return source;
    }

    static defineSchema() {
      const requiredInteger = { required: true, nullable: false, integer: true };
      const schema = super.defineSchema();
      schema.price = new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0 });
      schema.weight = new fields.NumberField({ required: true, nullable: false, initial: 1, min: 0 });
      schema.quantity = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });
      schema.equipped = new fields.BooleanField({ initial: false });
      schema.stowed = new fields.BooleanField({ initial: true });
      schema.weightless = new fields.StringField({
        required: true,
        blank: true,
        choices: ["", "whenReadied", "whenStowed"],
        initial: "",
      });
      schema.containerId = new fields.StringField({ required: true, blank: true });
      return schema;
    }
  };
}
