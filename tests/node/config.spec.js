import { describe, it } from "mocha";
import { expect } from "chai";
import { WWN } from "../../module/config.js";

describe("module/config.js", () => {
  describe("WWN", () => {
    it("has scores with expected keys", () => {
      expect(WWN.scores).to.have.keys("str", "dex", "con", "int", "wis", "cha");
    });
    it("has roll_type", () => {
      expect(WWN.roll_type).to.include({ result: "=", above: "≥", below: "≤" });
    });
    it("has saves with expected keys", () => {
      expect(WWN.saves).to.have.keys("evasion", "mental", "physical", "luck");
    });
    it("has skills object with expected count", () => {
      const skillKeys = Object.keys(WWN.skills);
      expect(skillKeys).to.include("admin", "connect", "shoot", "sneak", "work");
      expect(skillKeys.length).to.be.greaterThanOrEqual(20);
    });
    it("has skillDice", () => {
      expect(WWN.skillDice).to.include({ "2d6": "2d6", "3d6kh2": "3d6" });
    });
    it("has encumbLocation", () => {
      expect(WWN.encumbLocation).to.have.keys("readied", "stowed", "other");
    });
    it("has weightless", () => {
      expect(WWN.weightless).to.have.keys("never", "whenReadied", "whenStowed");
    });
    it("has ranges", () => {
      expect(WWN.ranges).to.have.keys("abreast", "near", "far", "sighted");
    });
    it("has sizes", () => {
      expect(WWN.sizes).to.have.keys("small", "medium", "large");
    });
    it("has armor", () => {
      expect(WWN.armor).to.have.keys("unarmored", "light", "medium", "heavy", "shield");
    });
    it("has colors", () => {
      expect(WWN.colors).to.have.keys("green", "red", "yellow", "purple", "blue", "orange", "white");
    });
    it("has languages array", () => {
      expect(WWN.languages).to.be.an("array");
      expect(WWN.languages).to.include("Trade Cant");
    });
    it("has tags and tag_images and tag_desc", () => {
      expect(WWN.tags).to.be.an("object");
      expect(WWN.tag_images).to.be.an("object");
      expect(WWN.tag_desc).to.be.an("object");
      expect(Object.keys(WWN.tags).length).to.equal(Object.keys(WWN.tag_images).length);
    });
    it("has assetTypes", () => {
      expect(WWN.assetTypes).to.have.keys("cunning", "force", "wealth");
    });
    it("has assetMagic", () => {
      expect(WWN.assetMagic).to.have.keys("none", "low", "medium", "high");
    });
    it("roll_type values are non-empty strings", () => {
      expect(Object.values(WWN.roll_type).every((v) => typeof v === "string" && v.length > 0)).to.equal(true);
    });
    it("scores values are i18n keys", () => {
      expect(Object.values(WWN.scores).every((v) => v.startsWith("WWN."))).to.equal(true);
    });
  });
});
