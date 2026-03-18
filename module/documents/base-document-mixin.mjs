/**
 * Mixin for shared document behavior used across WWN document classes (Draw Steel–style).
 * Use for logic that applies to multiple document types; sheet-level behavior (e.g. drag-drop) stays in sheet base classes.
 *
 * @template {typeof foundry.documents.Actor} BaseDocument
 * @param {BaseDocument} Base
 * @returns {BaseDocument}
 */
export default function BaseDocumentMixin(Base) {
  return class WwnBaseDocument extends Base {
    /** @inheritdoc */
    async createEmbeddedDocuments(embeddedName, data = [], context = {}) {
      if (this.documentName === "Actor" && embeddedName === "Item" && data.length) {
        const { WwnItem } = await import("../item/entity.js");
        data = data.map((item) => ({
          ...item,
          img: item.img !== undefined ? item.img : (WwnItem.defaultIcons[item.type] ?? item.img),
        }));
      }
      return super.createEmbeddedDocuments(embeddedName, data, context);
    }
  };
}
