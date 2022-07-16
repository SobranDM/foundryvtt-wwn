export const registerHelpers = async function () {
  // Handlebars template helpers
  Handlebars.registerHelper("eq", function (a, b) {
    return a == b;
  });

  Handlebars.registerHelper("nt", function (a, b) {
    return a != b;
  });

  Handlebars.registerHelper("gt", function (a, b) {
    return a >= b;
  });

  Handlebars.registerHelper("lt", function (a, b) {
    return a <= b;
  });

  Handlebars.registerHelper("mod", function (val) {
    if (val > 0) {
      return `+${val}`;
    } else if (val < 0) {
      return `${val}`;
    } else {
      return "0";
    }
  });

  Handlebars.registerHelper("add", function (lh, rh) {
    return parseInt(lh) + parseInt(rh);
  });

  Handlebars.registerHelper("subtract", function (lh, rh) {
    return parseInt(rh) - parseInt(lh);
  });

  Handlebars.registerHelper("divide", function (lh, rh) {
    return Math.floor(parseFloat(lh) / parseFloat(rh));
  });

  Handlebars.registerHelper("mult", function (lh, rh) {
    return parseFloat(lh) * parseFloat(rh);
  });

  Handlebars.registerHelper("roundWeight", function (weight) {
    return Math.round(parseFloat(weight) / 100) / 10;
  });

  Handlebars.registerHelper("getTagIcon", function (tag) {
    let idx = Object.keys(CONFIG.WWN.tags).find(k => (CONFIG.WWN.tags[k] == tag));
    return CONFIG.WWN.tag_images[idx];
  });

  Handlebars.registerHelper("getTagDesc", function (tag) {
    let idd = Object.keys(CONFIG.WWN.tags).find(k => (CONFIG.WWN.tags[k] == tag));
    return game.i18n.localize(CONFIG.WWN.tag_desc[idd]);
  });

  Handlebars.registerHelper("counter", function (status, value, max) {
    return status
      ? Math.clamped((100.0 * value) / max, 0, 100)
      : Math.clamped(100 - (100.0 * value) / max, 0, 100);
  });

  Handlebars.registerHelper("reverseCounter", function (status, value, max) {
    return status
      ? Math.clamped(100 - (100.0 * value) / max, 0, 100)
      : Math.clamped((100.0 * value) / max, 0, 100);
  });
};