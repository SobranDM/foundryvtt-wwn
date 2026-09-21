import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  defaultRollRowLabel,
  formatShockAcDetail,
  formatAttackAcDetail,
  formatTraumaDetail,
  buildNoShockRollRow,
  buildRollRows,
} from "../module/chat/roll-rows.mjs";

function fakeRoll({
  kind = "formula",
  formula = "1d20",
  total = 10,
  evaluated = true,
  tooltip = "<div class=\"dice-tooltip\"></div>",
} = {}) {
  return {
    kind,
    options: { kind },
    _formula: formula,
    total,
    _evaluated: evaluated,
    getTooltip: async () => tooltip,
  };
}

describe("chat roll rows", () => {
  const originalGame = globalThis.game;

  before(() => {
    globalThis.game = {
      i18n: {
        localize: (key) => key,
        format: (key, data = {}) =>
          `${key}:${Object.entries(data).map(([k, v]) => `${k}=${v}`).join(",")}`,
      },
    };
  });

  after(() => {
    globalThis.game = originalGame;
  });

  it("maps roll kinds to default label keys", () => {
    assert.equal(defaultRollRowLabel("attack"), "WWN.Roll.Attack");
    assert.equal(defaultRollRowLabel("damage"), "WWN.Roll.Damage");
    assert.equal(defaultRollRowLabel("skill"), "WWN.Roll.Formula");
    assert.equal(defaultRollRowLabel("check"), "WWN.Roll.Formula");
    assert.equal(defaultRollRowLabel("save"), "WWN.Roll.Formula");
    assert.equal(defaultRollRowLabel("formula"), "WWN.Roll.Formula");
    assert.equal(defaultRollRowLabel("hitDice"), "WWN.Roll.Formula");
  });

  it("formats Shock AC detail from the threshold", () => {
    assert.equal(formatShockAcDetail(15), "WWN.Roll.ShockAcDetail:ac=15");
    assert.equal(formatShockAcDetail(null), "");
  });

  it("formats an infinite (Any AC) threshold as the dedicated Any-AC detail, not blank", () => {
    // Weapon.shock.anyAc / NPC combat.allWeaponsShockAnyAc both resolve to
    // shockAcValue = Infinity (module/data/item/weapon.mjs) so this is the
    // real threshold shape those flags produce.
    assert.equal(formatShockAcDetail(Infinity), "WWN.Roll.ShockAcAnyDetail");
  });

  it("formats attack AC as unified or melee/ranged", () => {
    assert.equal(formatAttackAcDetail(16), "WWN.Roll.AttackAc:ac=16");
    assert.equal(formatAttackAcDetail(null), "");
    assert.equal(
      formatAttackAcDetail(14, { separateRanged: true, acKind: "melee" }),
      "WWN.Roll.AttackAcKind:kind=WWN.Armor.ACMelee,ac=14",
    );
    assert.equal(
      formatAttackAcDetail(12, { separateRanged: true, acKind: "ranged" }),
      "WWN.Roll.AttackAcKind:kind=WWN.Armor.ACRanged,ac=12",
    );
  });

  it("formats trauma detail with and without a trauma target", () => {
    assert.equal(formatTraumaDetail(8, 3), "WWN.Roll.TraumaDetail:target=8,rating=3");
    assert.equal(formatTraumaDetail(null, 2), "WWN.Roll.TraumaRatingDetail:rating=2");
  });

  it("pairs rollMeta by index and ignores extra meta", async () => {
    const rows = await buildRollRows(
      [fakeRoll({ kind: "attack", formula: "1d20+7", total: 18 })],
      [
        { label: "Attack", breakdown: "1d20 (Die) + 7 (AB)" },
        { label: "Unused" },
      ],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].label, "Attack");
    assert.equal(rows[0].breakdown, "1d20 (Die) + 7 (AB)");
    assert.equal(rows[0].formula, "1d20+7");
    assert.equal(rows[0].total, "18");
    assert.match(rows[0].tooltipHtml, /dice-tooltip/);
  });

  it("uses kind defaults and hides the hint when breakdown is empty", async () => {
    const rows = await buildRollRows([fakeRoll({ kind: "damage", total: 4 })]);
    assert.equal(rows[0].label, "WWN.Roll.Damage");
    assert.equal(rows[0].breakdown, "");
    assert.equal(rows[0].detail, "");
  });

  it("formats private and unevaluated rolls", async () => {
    const privateRows = await buildRollRows(
      [fakeRoll({ formula: "1d20+2", total: 15, tooltip: "<div class=\"dice-tooltip\"></div>" })],
      [{ breakdown: "secret" }],
      { isPrivate: true },
    );
    assert.equal(privateRows[0].formula, "???");
    assert.equal(privateRows[0].total, "?");
    assert.equal(privateRows[0].tooltipHtml, "");
    assert.equal(privateRows[0].breakdown, "");

    const pending = await buildRollRows([
      fakeRoll({ formula: "1d8", evaluated: false, total: undefined }),
    ]);
    assert.equal(pending[0].formula, "1d8");
    assert.equal(pending[0].total, "");
    assert.equal(pending[0].tooltipHtml, "");
  });

  it("builds an exceeded-AC Shock row that keeps the Shock label and AC detail", () => {
    const row = buildNoShockRollRow(15);
    assert.equal(row.label, "WWN.Roll.ShockBase");
    assert.equal(row.detail, "WWN.Roll.ShockAcDetail:ac=15");
    assert.equal(row.total, "0");
    assert.equal(row.breakdown, "WWN.Roll.ShockExceededHint");
    assert.equal(row.strikeLabel, true);
    assert.equal(row.insertAt, 2);
  });

  it("inserts extra Shock rows after Attack/Damage so they stay next to Shock's slot", async () => {
    const rows = await buildRollRows(
      [
        fakeRoll({ kind: "attack", total: 12 }),
        fakeRoll({ kind: "damage", total: 5 }),
        fakeRoll({ kind: "formula", total: 4 }),
      ],
      [{ label: "Attack" }, { label: "Damage" }, { label: "Trauma" }],
      { extraRows: [buildNoShockRollRow(15)] },
    );
    assert.deepEqual(rows.map((r) => r.label), ["Attack", "Damage", "WWN.Roll.ShockBase", "Trauma"]);
    assert.equal(rows[2].detail, "WWN.Roll.ShockAcDetail:ac=15");
    assert.equal(rows[2].total, "0");
    assert.equal(rows[2].breakdown, "WWN.Roll.ShockExceededHint");
    assert.equal(rows[2].strikeLabel, true);
    assert.equal(rows[2].tooltipHtml, "");
  });
});
