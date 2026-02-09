import { describe, it } from "mocha";
import { expect } from "chai";
import { prepareActiveEffectCategories } from "../../module/effects.mjs";

describe("module/effects.mjs", () => {
  describe("prepareActiveEffectCategories", () => {
    it("returns all three categories with correct structure", () => {
      const result = prepareActiveEffectCategories([]);
      expect(result).to.have.keys("temporary", "passive", "inactive");
      expect(result.temporary).to.deep.include({
        type: "temporary",
        label: "Temporary Effects",
        effects: [],
      });
      expect(result.passive).to.deep.include({
        type: "passive",
        label: "Passive Effects",
        effects: [],
      });
      expect(result.inactive).to.deep.include({
        type: "inactive",
        label: "Inactive Effects",
        effects: [],
      });
    });

    it("puts disabled effects in inactive", () => {
      const effects = [
        { disabled: true, isTemporary: false, SourceName: "x" },
        { disabled: true, isTemporary: true, SourceName: "y" },
      ];
      const result = prepareActiveEffectCategories(effects);
      expect(result.inactive.effects).to.have.length(2);
      expect(result.temporary.effects).to.have.length(0);
      expect(result.passive.effects).to.have.length(0);
    });

    it("puts temporary non-disabled effects in temporary", () => {
      const effects = [
        { disabled: false, isTemporary: true, SourceName: "a" },
      ];
      const result = prepareActiveEffectCategories(effects);
      expect(result.temporary.effects).to.have.length(1);
      expect(result.temporary.effects[0]).to.equal(effects[0]);
      expect(result.passive.effects).to.have.length(0);
      expect(result.inactive.effects).to.have.length(0);
    });

    it("puts passive (non-temporary, non-disabled) effects in passive", () => {
      const effects = [
        { disabled: false, isTemporary: false, SourceName: "b" },
      ];
      const result = prepareActiveEffectCategories(effects);
      expect(result.passive.effects).to.have.length(1);
      expect(result.passive.effects[0]).to.equal(effects[0]);
      expect(result.temporary.effects).to.have.length(0);
      expect(result.inactive.effects).to.have.length(0);
    });

    it("splits mixed effects into correct categories", () => {
      const inactive = { disabled: true, isTemporary: false, SourceName: "i" };
      const temp = { disabled: false, isTemporary: true, SourceName: "t" };
      const passive = { disabled: false, isTemporary: false, SourceName: "p" };
      const result = prepareActiveEffectCategories([inactive, temp, passive]);
      expect(result.inactive.effects).to.deep.equal([inactive]);
      expect(result.temporary.effects).to.deep.equal([temp]);
      expect(result.passive.effects).to.deep.equal([passive]);
    });

    it("handles empty effects array", () => {
      const result = prepareActiveEffectCategories([]);
      expect(result.temporary.effects).to.deep.equal([]);
      expect(result.passive.effects).to.deep.equal([]);
      expect(result.inactive.effects).to.deep.equal([]);
    });
  });
});
