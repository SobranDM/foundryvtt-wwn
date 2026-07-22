/**
 * TableResult subclass: coerce legacy `range` arrays to Foundry v14's
 * required length-2 ascending integer pair before validation.
 */
export class WwnTableResult extends foundry.documents.TableResult {
  /** @override */
  static migrateData(data, options) {
    data = super.migrateData(data, options);
    if (!data || typeof data !== "object") return data;

    let range = data.range;
    if (!Array.isArray(range) || range.length === 0) {
      data.range = [0, 0];
      return data;
    }
    if (range.length === 1) {
      const n = Number(range[0]) || 0;
      data.range = [n, n];
      return data;
    }
    let lo = Number(range[0]);
    let hi = Number(range[1]);
    if (Number.isNaN(lo)) lo = 0;
    if (Number.isNaN(hi)) hi = lo;
    if (hi < lo) hi = lo;
    data.range = [lo, hi];
    return data;
  }
}
