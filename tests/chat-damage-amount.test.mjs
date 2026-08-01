/**
 * Context-menu damage amount resolution.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getChatDamageAmount,
  resolveApplyRowAmount,
} from "../module/chat/damage-amount.mjs";

function gmMessage(extra = {}) {
  return {
    author: { isGM: true, id: "gm" },
    ...extra,
  };
}

describe("getChatDamageAmount", () => {
  it("prefers damage roll total over inflated applyRows flags", () => {
    const message = {
      rolls: [{ total: 25, options: { kind: "attack" } }, { total: 8, options: { kind: "damage" } }],
      getFlag(ns, key) {
        if (ns === "wwn" && key === "applyRows") {
          return [{ id: "damage", value: 99 }, { id: "shock", value: 3 }];
        }
        return undefined;
      },
    };
    assert.equal(getChatDamageAmount(message), 8);
  });

  it("prefers trauma row over base damage when source is trusted", () => {
    assert.equal(
      getChatDamageAmount(gmMessage({
        flags: {
          wwn: {
            applyRows: [
              { id: "damage", value: 5 },
              { id: "trauma", value: 20 },
            ],
          },
        },
        rolls: [],
      })),
      20
    );
  });

  it("falls back to miss-damage / shock rows when trusted", () => {
    assert.equal(
      getChatDamageAmount(gmMessage({
        flags: { wwn: { applyRows: [{ id: "miss-damage", value: 4 }] } },
        rolls: [],
      })),
      4
    );
    assert.equal(
      getChatDamageAmount(gmMessage({
        flags: { wwn: { applyRows: [{ id: "shock", value: 2 }] } },
        rolls: [],
      })),
      2
    );
  });

  it("uses damage-kind roll when applyRows missing", () => {
    const message = {
      rolls: [
        { total: 18, options: { kind: "attack" } },
        { total: 7, options: { kind: "damage" } },
      ],
    };
    assert.equal(getChatDamageAmount(message), 7);
  });

  it("uses rolls[1] on attack cards without kind metadata", () => {
    assert.equal(
      getChatDamageAmount({ rolls: [{ total: 19 }, { total: 6 }] }),
      6
    );
  });

  it("does not treat a lone attack roll as damage", () => {
    assert.equal(
      getChatDamageAmount({ rolls: [{ total: 22, options: { kind: "attack" } }] }),
      null
    );
  });

  it("allows a single non-attack roll (pure damage card)", () => {
    assert.equal(
      getChatDamageAmount({ rolls: [{ total: 11, options: { kind: "damage" } }] }),
      11
    );
  });
});

describe("resolveApplyRowAmount", () => {
  it("rejects untrusted trauma flags with no matching roll", () => {
    assert.equal(
      resolveApplyRowAmount(
        { author: { isGM: false, id: "p1" }, rolls: [] },
        { id: "trauma", value: 40 },
      ),
      null
    );
  });

  it("allows shock-floored damage above the roll for trusted sources", () => {
    assert.equal(
      resolveApplyRowAmount(
        gmMessage({
          rolls: [{ total: 2, options: { kind: "damage" } }],
        }),
        { id: "damage", value: 5, shockFloored: true },
      ),
      5
    );
  });
});
