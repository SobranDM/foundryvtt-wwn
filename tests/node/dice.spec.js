import { describe, it } from "mocha";
import { expect } from "chai";
import { WwnDice } from "../../module/dice.js";

/** Mock roll: { total, terms: [{ total }] } */
function mockRoll(total, dieTotal = total) {
  return {
    total,
    terms: [{ total: dieTotal }],
  };
}

describe("module/dice.js", () => {
  describe("WwnDice.digestResult", () => {
    describe("type: above", () => {
      it("sets isSuccess when total >= target", async () => {
        const data = { roll: { type: "above", target: 10 } };
        const roll = mockRoll(10);
        const result = await WwnDice.digestResult(data, roll);
        expect(result.isSuccess).to.equal(true);
        expect(result.isFailure).to.equal(false);
        expect(result.target).to.equal(10);
        expect(result.total).to.equal(10);
      });
      it("sets isFailure when total < target", async () => {
        const data = { roll: { type: "above", target: 10 } };
        const roll = mockRoll(9);
        const result = await WwnDice.digestResult(data, roll);
        expect(result.isSuccess).to.equal(false);
        expect(result.isFailure).to.equal(true);
      });
    });

    describe("type: below", () => {
      it("sets isSuccess when total <= target", async () => {
        const data = { roll: { type: "below", target: 10 } };
        const roll = mockRoll(10);
        const result = await WwnDice.digestResult(data, roll);
        expect(result.isSuccess).to.equal(true);
        expect(result.isFailure).to.equal(false);
      });
      it("sets isFailure when total > target", async () => {
        const data = { roll: { type: "below", target: 10 } };
        const roll = mockRoll(11);
        const result = await WwnDice.digestResult(data, roll);
        expect(result.isSuccess).to.equal(false);
        expect(result.isFailure).to.equal(true);
      });
    });

    describe("type: check", () => {
      it("sets isSuccess when die is 1", async () => {
        const data = { roll: { type: "check", target: 10 } };
        const roll = mockRoll(5, 1);
        const result = await WwnDice.digestResult(data, roll);
        expect(result.isSuccess).to.equal(true);
        expect(result.isFailure).to.equal(false);
      });
      it("sets isSuccess when total <= target and die < 20", async () => {
        const data = { roll: { type: "check", target: 15 } };
        const roll = mockRoll(12, 12);
        const result = await WwnDice.digestResult(data, roll);
        expect(result.isSuccess).to.equal(true);
      });
      it("sets isFailure when total > target and die not 1", async () => {
        const data = { roll: { type: "check", target: 10 } };
        const roll = mockRoll(15, 15);
        const result = await WwnDice.digestResult(data, roll);
        expect(result.isSuccess).to.equal(false);
        expect(result.isFailure).to.equal(true);
      });
      it("sets isFailure when die is 20 and total > target", async () => {
        const data = { roll: { type: "check", target: 10 } };
        const roll = mockRoll(25, 20);
        const result = await WwnDice.digestResult(data, roll);
        expect(result.isFailure).to.equal(true);
      });
    });

    describe("type: skill", () => {
      it("returns result with no success/failure set", async () => {
        const data = { roll: { type: "skill", target: 10 } };
        const roll = mockRoll(8);
        const result = await WwnDice.digestResult(data, roll);
        expect(result.isSuccess).to.equal(false);
        expect(result.isFailure).to.equal(false);
        expect(result.total).to.equal(8);
      });
    });

    describe("type: table", () => {
      it("sets details from table by roll total", async () => {
        const data = {
          roll: {
            type: "table",
            target: 0,
            table: { 0: "Zero", 1: "One", 2: "Two", 5: "Five" },
          },
        };
        const roll = mockRoll(2);
        const result = await WwnDice.digestResult(data, roll);
        expect(result.details).to.equal("Two");
      });
      it("uses highest table entry when multiple match", async () => {
        const data = {
          roll: {
            type: "table",
            target: 0,
            table: { 1: "A", 2: "B", 3: "C" },
          },
        };
        const roll = mockRoll(3);
        const result = await WwnDice.digestResult(data, roll);
        expect(result.details).to.equal("C");
      });
      it("leaves details empty when no table entry", async () => {
        const data = {
          roll: { type: "table", target: 0, table: {} },
        };
        const roll = mockRoll(10);
        const result = await WwnDice.digestResult(data, roll);
        expect(result.details).to.equal("");
      });
      it("table with roll 0 uses table[0] when present", async () => {
        const data = {
          roll: { type: "table", target: 0, table: { 0: "Zero" } },
        };
        const roll = mockRoll(0);
        const result = await WwnDice.digestResult(data, roll);
        expect(result.details).to.equal("Zero");
      });
    });
  });

  describe("WwnDice.checkCharges", () => {
    it("does not throw when no charges or ammo (NPC or no decrement)", () => {
      const attData = {
        actor: { type: "character", items: [] },
        item: { system: {} },
        form: null,
      };
      expect(() => WwnDice.checkCharges(attData)).to.not.throw();
    });

    it("does not throw when weapon has enough charges", () => {
      const attData = {
        actor: { type: "character", items: [] },
        item: {
          system: {
            charges: { value: 5, decrementOnAttack: true },
            ammo: null,
          },
        },
        form: null,
      };
      expect(() => WwnDice.checkCharges(attData)).to.not.throw();
    });

    it("throws when decrementOnAttack and not enough charges", () => {
      const attData = {
        actor: { type: "character", items: [] },
        item: {
          system: {
            charges: { value: 0, decrementOnAttack: true },
            ammo: null,
          },
        },
        form: null,
      };
      expect(() => WwnDice.checkCharges(attData))
        .to.throw(/Not enough charges remaining/);
    });

    it("throws when burst requires 3 charges but only 2 available", () => {
      const attData = {
        actor: { type: "character", items: [] },
        item: {
          system: {
            charges: { value: 2, decrementOnAttack: true },
            ammo: null,
          },
        },
        form: { burst: { checked: true } },
      };
      expect(() => WwnDice.checkCharges(attData))
        .to.throw(/Need 3 charge.*burst/);
    });

    it("throws when ammo required but none found", () => {
      const attData = {
        actor: {
          type: "character",
          items: [
            { name: "Arrow", system: { charges: { value: 0 } } },
          ],
        },
        item: {
          system: {
            charges: null,
            ammo: "Arrow",
          },
        },
        form: null,
      };
      expect(() => WwnDice.checkCharges(attData))
        .to.throw(/No Arrow remaining/);
    });

    it("does not throw when ammo item has charges", () => {
      const attData = {
        actor: {
          type: "character",
          items: [
            { name: "Arrow", system: { charges: { value: 10 } } },
          ],
        },
        item: {
          system: {
            charges: null,
            ammo: "Arrow",
          },
        },
        form: null,
      };
      expect(() => WwnDice.checkCharges(attData)).to.not.throw();
    });
  });
});
