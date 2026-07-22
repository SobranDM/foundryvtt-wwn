const fields = foundry.data.fields;

/**
 * Schema mixin: adds a rich-text description.
 * @param {typeof foundry.abstract.TypeDataModel} Base
 */
export function DescribedDataMixin(Base) {
  return class Described extends Base {
    static defineSchema() {
      // DataModel.defineSchema is abstract (it throws); when this mixin sits
      // directly on TypeDataModel it must start the schema chain itself.
      const inherited = Base.defineSchema !== foundry.abstract.DataModel.defineSchema;
      const schema = inherited ? super.defineSchema() : {};
      schema.description = new fields.HTMLField({ required: true, blank: true });
      return schema;
    }
  };
}
