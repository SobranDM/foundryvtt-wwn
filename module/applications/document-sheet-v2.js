/**
 * Base Document Sheet using Foundry DocumentSheet and HandlebarsApplicationMixin (draw-steel style).
 * Centralizes drag-drop for Item and Folder; subclasses may override _onDrop for special types (e.g. RollTable).
 */
const api = foundry.applications.api;
const ux = foundry.applications.ux;

/**
 * Base class for WWN document sheets using AppV2 and Handlebars PARTS.
 */
export class WwnDocumentSheetV2 extends api.HandlebarsApplicationMixin(api.DocumentSheet) {
  static DEFAULT_OPTIONS = Object.freeze(
    foundry.utils.mergeObject(super.DEFAULT_OPTIONS ?? {}, {
      classes: ["wwn", "sheet"],
      form: {
        submitOnChange: true,
        closeOnSubmit: false,
      },
    })
  );

  get actor() {
    return this.document;
  }

  get object() {
    return this.document;
  }

  /** @inheritdoc — ensure backward-compat context for templates (cssClass, owner, editable). */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const doc = this.document;
    if (context.cssClass === undefined) {
      context.cssClass = [...(this.options?.classes ?? []), doc?.type ?? ""].filter(Boolean).join(" ");
    }
    if (context.owner === undefined) context.owner = !!doc?.isOwner;
    if (context.editable === undefined) context.editable = !!this.isEditable;
    return context;
  }

  /** @inheritdoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    if (typeof ux?.DragDrop === "function") {
      new ux.DragDrop({
        dropSelector: ".window-content",
        permissions: { drop: () => this.isEditable },
        callbacks: { drop: (ev) => this._onDrop(ev) },
      }).bind(this.element);
    }
  }

  /**
   * Handle drop on the sheet. Override in subclasses to handle additional types (e.g. RollTable) before calling super.
   * @param {DragEvent} event
   */
  async _onDrop(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const getDragEventData = ux?.TextEditor?.implementation?.getDragEventData;
    if (!getDragEventData) return;
    const data = getDragEventData(event);
    if (!data?.type || !this.document.isOwner) return;
    if (data.type === "Item") return this._onDropItem(event, data);
    if (data.type === "Folder") return this._onDropFolder(event, data);
  }

  /**
   * Handle dropping an Item onto the document.
   * @param {DragEvent} event
   * @param {object} data - Drag data from getDragEventData.
   */
  async _onDropItem(event, data) {
    const Item = game.items?.constructor;
    if (!Item?.fromDropData) return;
    const item = await Item.fromDropData(data);
    if (!item) return;
    await this.document.createEmbeddedDocuments("Item", [item.toObject()]);
    this.render();
  }

  /**
   * Handle dropping a Folder (of items) onto the document.
   * @param {DragEvent} event
   * @param {object} data - Drag data from getDragEventData.
   */
  async _onDropFolder(event, data) {
    const Folder = game.folders?.constructor;
    if (!Folder?.fromDropData) return;
    const folder = await Folder.fromDropData(data);
    if (!folder || folder.type !== "Item") return;
    const contents = Array.isArray(folder.contents) ? folder.contents : (folder.contents ? Array.from(folder.contents) : []);
    const itemDataList = contents.map((doc) => (doc?.document ?? doc)?.toObject?.()).filter(Boolean);
    if (itemDataList.length) {
      await this.document.createEmbeddedDocuments("Item", itemDataList);
      this.render();
    }
  }
}
