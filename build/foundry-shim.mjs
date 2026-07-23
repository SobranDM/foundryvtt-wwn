/**
 * Minimal Foundry global shims so migration transforms can run under plain Node.
 */
globalThis.foundry ??= {};
globalThis.foundry.utils ??= {};
globalThis.foundry.utils.deepClone ??= (value) => structuredClone(value);
globalThis.foundry.utils.setProperty ??= (object, key, value) => {
  const parts = key.split(".");
  let target = object;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in target) || typeof target[part] !== "object") target[part] = {};
    target = target[part];
  }
  target[parts[parts.length - 1]] = value;
  return object;
};
globalThis.foundry.utils.randomID ??= (length = 16) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < length; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
};
globalThis.foundry.utils.getProperty ??= (object, key) => {
  if (!object) return undefined;
  const parts = key.split(".");
  let target = object;
  for (const part of parts) {
    if (target == null) return undefined;
    target = target[part];
  }
  return target;
};
globalThis.foundry.utils.mergeObject ??= (original = {}, other = {}) => ({ ...original, ...other });

Math.clamp ??= (value, min, max) => Math.min(Math.max(value, min), max);

if (!Array.prototype.filterJoin) {
  Array.prototype.filterJoin = function (separator) {
    return this.filter((v) => !!v).join(separator);
  };
}

globalThis.CONFIG ??= {};
globalThis.CONFIG.WWN ??= {
  defaultIcons: { currency: "icons/svg/coins.svg" },
};

if (!String.prototype.slugify) {
  String.prototype.slugify = function ({ replacement = "-" } = {}) {
    return this.normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/[\s-]+/g, replacement);
  };
}
