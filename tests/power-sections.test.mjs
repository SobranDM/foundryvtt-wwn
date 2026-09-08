/**
 * Node unit tests for Powers tab section grouping / pool columns.
 * Run: node --test tests/power-sections.test.mjs
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { POWER_SECTION_ORDER, POWER_SUBTYPES } from "../module/config/power-subtypes.mjs";
import { WWN } from "../module/config/index.mjs";
import {
  buildPowerSections,
  layoutResourcePoolColumns,
  buildPowerSectionColumns,
  annotatePowerRows,
} from "../module/helpers/power-sections.mjs";

// Ensure config is populated for helper (index side effects)
WWN.powerSectionOrder = POWER_SECTION_ORDER;
WWN.powerSubtypes = POWER_SUBTYPES;
WWN.SPELL_SLOTS_POOL_NAME = "Spell Slots";

function makePower({ id, name, subType, level = 0, customTypeName = "", extra = {} }) {
  return {
    id,
    name,
    type: "power",
    system: {
      subType,
      level,
      customTypeName,
      source: "",
      resourceName: "",
      commitmentOptions: [],
      poolCommitted: { none: 0, active: 0, scene: 0, day: 0 },
      internalResource: { value: 0, max: 0 },
      isActive: false,
      prepared: false,
      damageRoll: "",
      ...extra,
    },
  };
}

describe("buildPowerSections", () => {
  it("omits empty subtypes", () => {
    const sections = buildPowerSections(
      [makePower({ id: "1", name: "Fireball", subType: "spell", level: 1 })],
      { localize: (k) => k }
    );
    assert.equal(sections.length, 1);
    assert.equal(sections[0].subType, "spell");
  });

  it("orders sections by POWER_SECTION_ORDER", () => {
    const sections = buildPowerSections(
      [
        makePower({ id: "a", name: "Ability", subType: "ability" }),
        makePower({ id: "s", name: "Spell", subType: "spell", level: 1 }),
        makePower({ id: "r", name: "Art", subType: "art" }),
      ],
      { localize: (k) => k }
    );
    assert.deepEqual(
      sections.map((s) => s.subType),
      ["art", "spell", "ability"]
    );
  });

  it("groups custom powers by customTypeName and sorts by level then name", () => {
    const sections = buildPowerSections(
      [
        makePower({ id: "1", name: "Beta", subType: "custom", level: 1, customTypeName: "Gifts" }),
        makePower({ id: "2", name: "Alpha", subType: "custom", level: 1, customTypeName: "Gifts" }),
        makePower({ id: "3", name: "Zed", subType: "custom", level: 0, customTypeName: "Gifts" }),
        makePower({ id: "4", name: "Lone", subType: "custom", level: 0, customTypeName: "" }),
      ],
      { localize: (k) => (k === "WWN.Power.UncategorizedCustom" ? "Custom (Uncategorized)" : k) }
    );
    const gift = sections.find((s) => s.displayLabel === "Gifts");
    const uncat = sections.find((s) => s.displayLabel === "Custom (Uncategorized)");
    assert.ok(gift);
    assert.ok(uncat);
    assert.deepEqual(
      gift.powers.map((p) => p.name),
      ["Zed", "Alpha", "Beta"]
    );
  });

  it("marks spell sections with prepared column", () => {
    const sections = buildPowerSections(
      [makePower({ id: "1", name: "Spell", subType: "spell", level: 1 })],
      { localize: (k) => k }
    );
    assert.equal(sections[0].columns.showPrepared, true);
  });
});

describe("layoutResourcePoolColumns", () => {
  it("puts spell slot pools at end of column 2", () => {
    const cols = layoutResourcePoolColumns([
      { name: "Effort", value: 0, max: 3 },
      { name: "Psychic Effort", value: 0, max: 2 },
      { name: "Spell Slots", level: 1, value: 0, max: 2 },
      { name: "Spell Slots", level: 2, value: 0, max: 1 },
    ]);
    assert.ok(cols.column1.length + cols.column2.length === 4);
    assert.equal(cols.column2.at(-1).name, "Spell Slots");
    assert.equal(cols.column2.at(-2).name, "Spell Slots");
  });
});

describe("buildPowerSectionColumns", () => {
  it("shows commitment when any power has paid options", () => {
    const cols = buildPowerSectionColumns("art", [
      makePower({
        id: "1",
        name: "Art",
        subType: "art",
        extra: {
          commitmentOptions: [{ cost: 1, length: "scene", note: "" }],
          resourceName: "Effort",
        },
      }),
    ]);
    assert.equal(cols.showCommitment, true);
    assert.equal(cols.showPoolCommitted, true);
  });

  // Regression: showInstalled used to be hardcoded to `subType === "cyberware"`,
  // silently omitting the Installed toggle for custom-subtype powers even
  // though `installed` is one of custom's visible fields too.
  it("shows the Installed column for cyberware", () => {
    const cols = buildPowerSectionColumns("cyberware", [
      makePower({ id: "1", name: "Dermal Armor", subType: "cyberware", extra: { installed: false } }),
    ]);
    assert.equal(cols.showInstalled, true);
  });

  it("shows the Installed column for custom (previously missing)", () => {
    const cols = buildPowerSectionColumns("custom", [
      makePower({ id: "1", name: "Custom Implant", subType: "custom", extra: { installed: false } }),
    ]);
    assert.equal(cols.showInstalled, true);
  });

  it("does not show the Installed column for subtypes with no installed concept", () => {
    const cols = buildPowerSectionColumns("art", [
      makePower({ id: "1", name: "Art", subType: "art" }),
    ]);
    assert.equal(cols.showInstalled, false);
  });
});

describe("annotatePowerRows: canActivatePower respects the installed gate (finding #2)", () => {
  it("cyberware opted into the free toggle but not installed -> canActivatePower is false", () => {
    const [row] = annotatePowerRows([
      makePower({
        id: "1",
        name: "Adrenal Suppression Pump",
        subType: "cyberware",
        extra: {
          installed: false,
          isActive: false,
          commitmentOptions: [{ cost: 0, length: "active", note: "" }],
        },
      }),
    ]);
    assert.equal(row.canActivatePower, false);
  });

  it("cyberware opted into the free toggle AND installed -> canActivatePower is true", () => {
    const [row] = annotatePowerRows([
      makePower({
        id: "1",
        name: "Adrenal Suppression Pump",
        subType: "cyberware",
        extra: {
          installed: true,
          isActive: false,
          commitmentOptions: [{ cost: 0, length: "active", note: "" }],
        },
      }),
    ]);
    assert.equal(row.canActivatePower, true);
  });

  it("art with a paid active commitment is unaffected by the installed gate (no installed concept)", () => {
    const [row] = annotatePowerRows([
      makePower({
        id: "1",
        name: "Art",
        subType: "art",
        extra: {
          isActive: false,
          commitmentOptions: [{ cost: 1, length: "active", note: "" }],
        },
      }),
    ]);
    assert.equal(row.canActivatePower, true);
  });
});
