/**
 * Run: node --test tests/power-effects.test.mjs
 *
 * Regression coverage for the `installed`-gating fix: cyberware/custom power
 * transfer effects must only be treated as "passive" (always-on) while
 * `system.installed` is true. Subtypes with no `installed` concept
 * (art/spell/ability/psychic/mutation/gift) must keep their prior
 * always-passive (or shared-pool `active`-gated) behavior unchanged.
 */
import "../build/foundry-shim.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPowerTransferMode } from "../module/helpers/power-effects.mjs";
import { hasFreeActiveToggle, hasActiveToggle, canToggleActive } from "../module/config/power-subtypes.mjs";

/** @param {object} overrides */
function power(overrides) {
  return {
    type: "power",
    system: {
      subType: "cyberware",
      installed: false,
      isActive: false,
      commitmentOptions: [{ cost: 0, length: "none", note: "" }],
      ...overrides,
    },
  };
}

describe("getPowerTransferMode", () => {
  it("cyberware: not installed -> none (disabled)", () => {
    assert.equal(getPowerTransferMode(power({ subType: "cyberware", installed: false })), "none");
  });

  it("cyberware: installed -> passive (enabled)", () => {
    assert.equal(getPowerTransferMode(power({ subType: "cyberware", installed: true })), "passive");
  });

  it("custom: not installed -> none (disabled)", () => {
    assert.equal(getPowerTransferMode(power({ subType: "custom", installed: false })), "none");
  });

  it("custom: installed -> passive (enabled)", () => {
    assert.equal(getPowerTransferMode(power({ subType: "custom", installed: true })), "passive");
  });

  it("custom: installed with a paid active-length commitment still resolves 'active' (isActive-gated), not forced passive", () => {
    const mode = getPowerTransferMode(
      power({
        subType: "custom",
        installed: true,
        commitmentOptions: [{ cost: 1, length: "active", note: "" }],
      })
    );
    assert.equal(mode, "active");
  });

  it("custom: not installed overrides an active shared-pool commitment -> none", () => {
    const mode = getPowerTransferMode(
      power({
        subType: "custom",
        installed: false,
        commitmentOptions: [{ cost: 1, length: "active", note: "" }],
      })
    );
    assert.equal(mode, "none");
  });

  it("mutation: no installed concept, no shared pool -> always passive regardless of (absent) installed", () => {
    assert.equal(
      getPowerTransferMode(power({ subType: "mutation", installed: false, commitmentOptions: [{ cost: 0, length: "none", note: "" }] })),
      "passive"
    );
  });

  it("art: no installed concept, zero-cost commitment -> passive (unaffected by the cyberware fix)", () => {
    assert.equal(
      getPowerTransferMode(power({ subType: "art", installed: false, commitmentOptions: [{ cost: 0, length: "none", note: "" }] })),
      "passive"
    );
  });

  it("art: no installed concept, paid active-length commitment -> active (isActive-gated, unaffected)", () => {
    assert.equal(
      getPowerTransferMode(
        power({
          subType: "art",
          installed: false,
          commitmentOptions: [{ cost: 1, length: "active", note: "" }],
        })
      ),
      "active"
    );
  });

  it("non-power items always resolve none", () => {
    assert.equal(getPowerTransferMode({ type: "weapon", system: {} }), "none");
  });

  describe("cyberware/custom poolless active/inactive toggle opt-in (Adrenal Suppression Pump style)", () => {
    const optedIn = { commitmentOptions: [{ cost: 0, length: "active", note: "" }] };

    it("not installed -> none, regardless of isActive", () => {
      assert.equal(
        getPowerTransferMode(power({ subType: "cyberware", installed: false, isActive: true, ...optedIn })),
        "none"
      );
    });

    it("installed but not active -> none", () => {
      assert.equal(
        getPowerTransferMode(power({ subType: "cyberware", installed: true, isActive: false, ...optedIn })),
        "none"
      );
    });

    it("installed AND active -> active (enabled)", () => {
      assert.equal(
        getPowerTransferMode(power({ subType: "cyberware", installed: true, isActive: true, ...optedIn })),
        "active"
      );
    });

    it("installed AND active, then deactivated -> back to none", () => {
      const installedActive = power({ subType: "cyberware", installed: true, isActive: true, ...optedIn });
      assert.equal(getPowerTransferMode(installedActive), "active");
      installedActive.system.isActive = false;
      assert.equal(getPowerTransferMode(installedActive), "none");
    });

    it("custom subtype also supports the opt-in toggle", () => {
      assert.equal(
        getPowerTransferMode(power({ subType: "custom", installed: true, isActive: false, ...optedIn })),
        "none"
      );
      assert.equal(
        getPowerTransferMode(power({ subType: "custom", installed: true, isActive: true, ...optedIn })),
        "active"
      );
    });

    it("cyberware WITHOUT opting in (default zero-cost 'none') stays installed-only gated, ignores isActive", () => {
      // Most cyberware (Dermal Armor, Stabilization Overrides, ...) never
      // opts in -- installed alone is enough, isActive is irrelevant.
      assert.equal(
        getPowerTransferMode(power({ subType: "cyberware", installed: true, isActive: false })),
        "passive"
      );
    });
  });
});

describe("hasFreeActiveToggle", () => {
  it("false for the cyberware default (zero-cost 'none')", () => {
    assert.equal(
      hasFreeActiveToggle("cyberware", { commitmentOptions: [{ cost: 0, length: "none", note: "" }] }),
      false
    );
  });

  it("true for a cyberware item opted in via zero-cost 'active'", () => {
    assert.equal(
      hasFreeActiveToggle("cyberware", { commitmentOptions: [{ cost: 0, length: "active", note: "" }] }),
      true
    );
  });

  it("false for a subtype with no installed concept (art), even with a zero-cost 'active' entry", () => {
    assert.equal(
      hasFreeActiveToggle("art", { commitmentOptions: [{ cost: 0, length: "active", note: "" }] }),
      false
    );
  });

  it("false when the 'active' entry is paid (that's hasActiveCommitment's job, not the free toggle)", () => {
    assert.equal(
      hasFreeActiveToggle("cyberware", { commitmentOptions: [{ cost: 1, length: "active", note: "" }] }),
      false
    );
  });
});

describe("hasActiveToggle", () => {
  it("true for arts with a paid active commitment (existing behavior preserved)", () => {
    assert.equal(
      hasActiveToggle("art", { commitmentOptions: [{ cost: 1, length: "active", note: "" }] }),
      true
    );
  });

  it("true for cyberware opted into the poolless toggle", () => {
    assert.equal(
      hasActiveToggle("cyberware", { commitmentOptions: [{ cost: 0, length: "active", note: "" }] }),
      true
    );
  });

  it("false for the plain cyberware default (no toggle shown in the UI)", () => {
    assert.equal(
      hasActiveToggle("cyberware", { commitmentOptions: [{ cost: 0, length: "none", note: "" }] }),
      false
    );
  });
});

describe("canToggleActive", () => {
  const optedIn = { commitmentOptions: [{ cost: 0, length: "active", note: "" }] };
  const paidActive = { commitmentOptions: [{ cost: 1, length: "active", note: "" }] };

  it("cyberware opted into the free toggle but NOT installed -> false (the Activate button must not appear/work)", () => {
    assert.equal(canToggleActive("cyberware", { installed: false, ...optedIn }), false);
  });

  it("cyberware opted into the free toggle AND installed -> true", () => {
    assert.equal(canToggleActive("cyberware", { installed: true, ...optedIn }), true);
  });

  it("custom with a paid active commitment but NOT installed -> false (installed gates the paid path too)", () => {
    assert.equal(canToggleActive("custom", { installed: false, ...paidActive }), false);
  });

  it("custom with a paid active commitment AND installed -> true", () => {
    assert.equal(canToggleActive("custom", { installed: true, ...paidActive }), true);
  });

  it("art has no installed concept -> a paid active commitment is enough regardless of (absent) installed", () => {
    assert.equal(canToggleActive("art", { installed: false, ...paidActive }), true);
  });

  it("plain cyberware default (no opt-in) -> false even when installed (nothing to toggle)", () => {
    assert.equal(
      canToggleActive("cyberware", { installed: true, commitmentOptions: [{ cost: 0, length: "none", note: "" }] }),
      false
    );
  });

  it("cyberware with no toggle at all and not installed -> false", () => {
    assert.equal(
      canToggleActive("cyberware", { installed: false, commitmentOptions: [{ cost: 0, length: "none", note: "" }] }),
      false
    );
  });
});
