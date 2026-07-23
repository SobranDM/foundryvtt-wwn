/**
 * Compose a list of mixin factories over a base class (reduceRight so the
 * first mixin listed is the outermost).
 *
 * Ported from games-without-number/module/sheets/mixins/compose-mixins.mjs
 * (system-agnostic; no renames needed).
 * @param {...Function} mixins
 * @returns {(Base: Function) => Function}
 */
export default function composeMixins(...mixins) {
  return (Base) => mixins.reduceRight((acc, mixin) => mixin(acc), Base);
}
