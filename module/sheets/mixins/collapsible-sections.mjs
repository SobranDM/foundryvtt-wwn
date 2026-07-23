/**
 * CollapsibleSectionsMixin: section collapse/expand with per-user,
 * per-document persistence via the hidden "wwn.collapsedSections" client
 * setting.
 */
export function CollapsibleSectionsMixin(Base) {
  return class CollapsibleSections extends Base {
    static DEFAULT_OPTIONS = {
      actions: {
        toggleSection: CollapsibleSections.#onToggleSection,
      },
    };

    /** Read this document's collapse-state map. */
    get sectionStates() {
      const all = game.settings.get("wwn", "collapsedSections") ?? {};
      const own = all[this.document.id] ?? {};
      return { ...CONFIG.WWN.defaultCollapsedSections, ...own };
    }

    /** Is the given section currently collapsed? */
    isSectionCollapsed(sectionId) {
      return this.sectionStates[sectionId] === true;
    }

    static async #onToggleSection(event, target) {
      // Nested header controls (create/search/etc.) own their own data-action;
      // never treat those clicks as a section toggle.
      const actionEl = event.target.closest?.("[data-action]");
      if (actionEl && actionEl !== target) return;

      const section = target.closest(".wwn-collapsible");
      if (!section) return;
      const sectionId = section.dataset.sectionId;
      if (!sectionId) return;

      const collapsed = section.classList.toggle("collapsed");
      const all = foundry.utils.deepClone(game.settings.get("wwn", "collapsedSections") ?? {});
      all[this.document.id] ??= {};
      all[this.document.id][sectionId] = collapsed;
      await game.settings.set("wwn", "collapsedSections", all);
    }
  };
}
