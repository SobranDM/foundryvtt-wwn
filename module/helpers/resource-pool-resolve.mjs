/**
 * Resolve which ClassEdge poolGrant a power should spend against.
 *
 * Pack arts use generic `resourceName: "Effort"` while classEdges grant
 * distinct names ("Vowed Effort", "High Mage Effort", …). Match by exact
 * name first, then `{source} Effort`, then a unique Effort-suffixed grant.
 *
 * @param {Actor} actor
 * @param {{ resourceName?: string, source?: string }} opts
 * @returns {Item|null} classEdge item, or null if unresolved/ambiguous
 */
export function findPoolGrantEdge(actor, { resourceName = "", source = "" } = {}) {
  const name = String(resourceName ?? "").trim();
  const src = String(source ?? "").trim();
  if (!actor?.items) return null;

  const edges = [...actor.items].filter((i) => {
    if (i.type !== "classEdge") return false;
    const grantName = String(i.system?.poolGrant?.name ?? "").trim();
    return !!grantName;
  });

  if (name) {
    const exact = edges.find((ce) => String(ce.system.poolGrant.name).trim() === name);
    if (exact) return exact;
  }

  if (name === "Effort" && src) {
    const expected = `${src} Effort`;
    const bySource = edges.find((ce) => String(ce.system.poolGrant.name).trim() === expected);
    if (bySource) return bySource;
  }

  if (name === "Effort") {
    const effortEdges = edges.filter((ce) => {
      const gn = String(ce.system.poolGrant.name).trim();
      return gn === "Effort" || gn.endsWith(" Effort");
    });
    if (effortEdges.length === 1) return effortEdges[0];
  }

  return null;
}

/**
 * Find the derived resource pool entry for a power on its actor.
 * @param {Actor} actor
 * @param {{ resourceName?: string, source?: string, subType?: string, level?: number }} system
 * @param {object[]} [pools] defaults to actor.system.resourcePools
 * @returns {object|null}
 */
export function findNamedResourcePool(actor, system = {}, pools = null) {
  const list = pools ?? actor?.system?.resourcePools ?? [];
  if (!list.length) return null;

  const edge = findPoolGrantEdge(actor, {
    resourceName: system.resourceName,
    source: system.source,
  });
  if (edge) {
    const grantName = String(edge.system.poolGrant.name).trim();
    const matched = list.find((p) => p.name === grantName && p.level == null);
    if (matched) return matched;
  }

  const resourceName = String(system.resourceName ?? "").trim();
  if (!resourceName) return null;
  return list.find((p) => p.name === resourceName && p.level == null) ?? null;
}
