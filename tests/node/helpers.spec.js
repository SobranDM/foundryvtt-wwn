import { describe, it, before } from "mocha";
import { expect } from "chai";
import Handlebars from "handlebars";
import { WWN } from "../../module/config.js";

// Foundry provides Math.clamp; Node does not
if (typeof Math.clamp !== "function") {
  Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value));
}

// Set globals required by registerHelpers (getTagIcon, getTagDesc)
global.Handlebars = Handlebars;
global.CONFIG = { WWN };
global.game = { i18n: { localize: (x) => x } };

import { registerHelpers } from "../../module/helpers.js";

// Handlebars passes positional args then options. We append {} so helpers receive (arg1, arg2, ..., options).
const h = (name, ...args) => {
  const fn = Handlebars.helpers[name];
  if (!fn) throw new Error(`Helper ${name} not registered`);
  return fn(...args, {});
};

describe("module/helpers.js", () => {
  before(async () => {
    await registerHelpers();
  });

  describe("eq", () => {
    it("returns true when a == b", () => {
      expect(h("eq", 1, 1)).to.equal(true);
      expect(h("eq", "a", "a")).to.equal(true);
    });
    it("returns false when a != b", () => {
      expect(h("eq", 1, 2)).to.equal(false);
    });
  });

  describe("nt", () => {
    it("returns true when a != b", () => {
      expect(h("nt", 1, 2)).to.equal(true);
    });
    it("returns false when a == b", () => {
      expect(h("nt", 1, 1)).to.equal(false);
    });
  });

  describe("gt", () => {
    it("returns true when a >= b", () => {
      expect(h("gt", 2, 1)).to.equal(true);
      expect(h("gt", 1, 1)).to.equal(true);
    });
    it("returns false when a < b", () => {
      expect(h("gt", 0, 1)).to.equal(false);
    });
  });

  describe("lt", () => {
    it("returns true when a <= b", () => {
      expect(h("lt", 1, 2)).to.equal(true);
      expect(h("lt", 1, 1)).to.equal(true);
    });
    it("returns false when a > b", () => {
      expect(h("lt", 2, 1)).to.equal(false);
    });
  });

  describe("evalOr", () => {
    it("returns a || b", () => {
      expect(h("evalOr", true, false)).to.equal(true);
      expect(h("evalOr", false, "x")).to.equal("x");
    });
  });

  describe("evalAnd", () => {
    it("returns a && b", () => {
      expect(h("evalAnd", true, true)).to.equal(true);
      expect(h("evalAnd", true, false)).to.equal(false);
    });
  });

  describe("evalNor", () => {
    it("returns !a && !b", () => {
      expect(h("evalNor", false, false)).to.equal(true);
      expect(h("evalNor", true, false)).to.equal(false);
    });
  });

  describe("mod", () => {
    it("formats positive with +", () => {
      expect(h("mod", 5)).to.equal("+5");
    });
    it("formats negative as-is", () => {
      expect(h("mod", -3)).to.equal("-3");
    });
    it("returns 0 for zero", () => {
      expect(h("mod", 0)).to.equal("0");
    });
  });

  describe("add", () => {
    it("adds two numbers", () => {
      expect(h("add", 2, 3)).to.equal(5);
    });
    it("parses string numbers", () => {
      expect(h("add", "10", "5")).to.equal(15);
    });
  });

  describe("subtract", () => {
    it("returns rh - lh", () => {
      expect(h("subtract", 2, 5)).to.equal(3);
    });
  });

  describe("divide", () => {
    it("returns floor(lh / rh)", () => {
      expect(h("divide", 10, 3)).to.equal(3);
    });
    it("uses parseFloat for decimals", () => {
      expect(h("divide", 7, 2)).to.equal(3);
    });
  });

  describe("mult", () => {
    it("multiplies two numbers", () => {
      expect(h("mult", 2, 3)).to.equal(6);
    });
  });

  describe("roundWeight", () => {
    it("rounds weight to one decimal (weight/100 rounded, then /10)", () => {
      expect(h("roundWeight", 1000)).to.equal(1);
      expect(h("roundWeight", 1500)).to.equal(1.5);
    });
  });

  describe("counter", () => {
    it("returns clamped percentage when status true", () => {
      expect(h("counter", true, 50, 100)).to.equal(50);
      expect(h("counter", true, 150, 100)).to.equal(100);
    });
    it("clamps to 0 when value 0 or over max", () => {
      expect(h("counter", true, 0, 100)).to.equal(0);
      expect(h("counter", false, 100, 100)).to.equal(0);
    });
    it("returns inverse when status false", () => {
      expect(h("counter", false, 50, 100)).to.equal(50);
      expect(h("counter", false, 25, 100)).to.equal(75);
    });
  });

  describe("reverseCounter", () => {
    it("returns inverse percentage when status true", () => {
      expect(h("reverseCounter", true, 25, 100)).to.equal(75);
    });
    it("returns percentage when status false", () => {
      expect(h("reverseCounter", false, 50, 100)).to.equal(50);
    });
  });

  describe("firstLetter", () => {
    it("returns first letter uppercased", () => {
      expect(h("firstLetter", "hello")).to.equal("H");
    });
    it("returns empty string for falsy", () => {
      expect(h("firstLetter", null)).to.equal("");
      expect(h("firstLetter", "")).to.equal("");
    });
  });

  describe("trim", () => {
    it("returns string as-is when length <= n", () => {
      expect(h("trim", "hi", 5)).to.equal("hi");
    });
    it("truncates and adds ... when length > n", () => {
      expect(h("trim", "hello world", 5)).to.equal("hello...");
    });
    it("returns empty string for falsy obj", () => {
      expect(h("trim", null, 3)).to.equal("");
    });
  });

  describe("partial", () => {
    it("returns systems path", () => {
      expect(h("partial", "actors/sheet.html")).to.equal("systems/wwn/templates/actors/sheet.html");
    });
  });

  describe("hasSuccessfulSaves", () => {
    it("returns true if any result is success", () => {
      expect(h("hasSuccessfulSaves", [{ isSuccess: false }, { isSuccess: true }])).to.equal(true);
    });
    it("returns false if none success", () => {
      expect(h("hasSuccessfulSaves", [{ isSuccess: false }])).to.equal(false);
    });
  });

  describe("hasFailedSaves", () => {
    it("returns true if any result is failure", () => {
      expect(h("hasFailedSaves", [{ isSuccess: true }, { isSuccess: false }])).to.equal(true);
    });
    it("returns false if none failure", () => {
      expect(h("hasFailedSaves", [{ isSuccess: true }])).to.equal(false);
    });
  });

  describe("getTagIcon", () => {
    it("returns tag image for known tag (tag is i18n value, e.g. WWN.items.Melee)", () => {
      expect(h("getTagIcon", "WWN.items.Melee")).to.equal("systems/wwn/assets/melee.png");
    });
  });

  describe("getTagDesc", () => {
    it("returns localized tag desc (stubbed; tag is i18n value)", () => {
      expect(h("getTagDesc", "WWN.items.Melee")).to.equal("WWN.items.desc.Melee");
    });
  });
});
