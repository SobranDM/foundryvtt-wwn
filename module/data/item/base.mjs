import { DescribedDataMixin } from "../mixins/described.mjs";

/**
 * Base item data model: every WWN item has a description.
 */
export default class WwnItemBase extends DescribedDataMixin(foundry.abstract.TypeDataModel) {
  static defineSchema() {
    return super.defineSchema();
  }
}
