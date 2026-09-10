import {
  createTestActor,
  deleteTestActor,
  settle,
  useQuenchTimeout,
  wwnImport,
} from "../helpers.mjs";

/**
 * Regression coverage for the cyberware `installed` transfer-effect gating
 * fix: before the fix, a cyberware/custom power's transfer effects were
 * always treated as passive (always-on) regardless of `system.installed`.
 * The pure-logic half of this (`getPowerTransferMode` /
 * `hasFreeActiveToggle` / `hasActiveToggle`) already has thorough coverage
 * in the main repo's `tests/power-effects.test.mjs` (plain Node, fake power
 * objects). What that Node suite structurally cannot exercise is the real
 * document lifecycle: an actual embedded ActiveEffect's `disabled` flag
 * being flipped by the `updateItem` hook (`syncPowerTransferEffects`) when
 * `installed`/`isActive` change on a real Item embedded in a real Actor.
 * That real-hook wiring is what these tests cover.
 */
export default function register(quench) {
  quench.registerBatch(
    "wwn.cyberware",
    (context) => {
      const { describe, it, assert } = context;

      describe("Cyberware installed/active transfer-effect gating", function () {
        useQuenchTimeout(this);

        it("installed toggle gates a cyberware power's transfer effect (via real create/update hooks)", async function () {
          const actor = await createTestActor("character", "cyber-installed", {}, { wwnSkipSeeding: true });
          try {
            const [power] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Dermal Plating",
                type: "power",
                system: {
                  subType: "cyberware",
                  installed: false,
                  commitmentOptions: [{ cost: 0, length: "none", note: "" }],
                },
              },
            ]);
            // Deliberately wrong initial state: not installed should gate
            // this off, so if nothing re-evaluates the gate the effect
            // would incorrectly stay enabled.
            await power.createEmbeddedDocuments("ActiveEffect", [
              {
                name: "Quench Dermal AC",
                transfer: true,
                disabled: false,
                changes: [
                  {
                    key: "system.combat.ac.mod",
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    value: "1",
                    priority: 20,
                    phase: "initial",
                  },
                ],
              },
            ]);
            await settle();

            // Nudge a field other than `installed` to trigger the
            // updateItem hook's syncPowerTransferEffects -- proves the
            // not-installed gate is actively enforced, not just
            // coincidentally matching the effect's starting `disabled`.
            await power.update({ "system.userStrain": "quench-nudge" });
            await settle();
            assert.isTrue(
              actor.items.get(power.id).effects.contents[0].disabled,
              "not installed -> transfer effect must be disabled"
            );

            await power.update({ "system.installed": true });
            await settle();
            assert.isFalse(
              actor.items.get(power.id).effects.contents[0].disabled,
              "installed -> cyberware default is passive (always-on while installed)"
            );

            await power.update({ "system.installed": false });
            await settle();
            assert.isTrue(
              actor.items.get(power.id).effects.contents[0].disabled,
              "un-installing must re-disable the transfer effect"
            );
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("cyberware opted into the poolless active/inactive toggle requires both installed and isActive", async function () {
          const actor = await createTestActor("character", "cyber-toggle", {}, { wwnSkipSeeding: true });
          try {
            const [power] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Adrenal Suppression Pump",
                type: "power",
                system: {
                  subType: "cyberware",
                  installed: false,
                  isActive: false,
                  // Opt-in: a zero-cost "active"-length commitment option.
                  commitmentOptions: [{ cost: 0, length: "active", note: "" }],
                },
              },
            ]);
            // Deliberately wrong initial state, same reasoning as above.
            await power.createEmbeddedDocuments("ActiveEffect", [
              {
                name: "Quench Pump Buff",
                transfer: true,
                disabled: false,
                changes: [
                  {
                    key: "system.combat.ab",
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    value: "1",
                    priority: 20,
                    phase: "initial",
                  },
                ],
              },
            ]);
            await settle();

            // installed: false -> true, isActive stays false. If the
            // free-toggle gate only checked `installed` (like plain
            // cyberware), this would go enabled; it must stay disabled
            // because the opted-in toggle also requires isActive.
            await power.update({ "system.installed": true });
            await settle();
            assert.isTrue(
              actor.items.get(power.id).effects.contents[0].disabled,
              "installed but not active -> must stay disabled"
            );

            // No resource pool exists on this actor at all; activatePower
            // must not require one for a poolless (zero-cost) toggle.
            await power.activatePower({ skipDialog: true });
            await settle();
            const active = actor.items.get(power.id);
            assert.isTrue(active.system.isActive);
            assert.isFalse(active.effects.contents[0].disabled, "installed + active -> enabled");

            await power.deactivatePower();
            await settle();
            const inactive = actor.items.get(power.id);
            assert.isFalse(inactive.system.isActive);
            assert.isTrue(inactive.effects.contents[0].disabled, "deactivated -> disabled again");
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("activatePower() refuses a not-installed cyberware item (installed gate applies to the poolless toggle too)", async function () {
          const actor = await createTestActor("character", "cyber-not-installed", {}, { wwnSkipSeeding: true });
          try {
            const [power] = await actor.createEmbeddedDocuments("Item", [
              {
                name: "Quench Uninstalled Pump",
                type: "power",
                system: {
                  subType: "cyberware",
                  installed: false,
                  isActive: false,
                  // Opted into the poolless active/inactive toggle.
                  commitmentOptions: [{ cost: 0, length: "active", note: "" }],
                },
              },
            ]);
            await settle();

            // Before the fix, this would silently flip isActive:true even
            // though the item is not installed -- a UI "Active" state with
            // no underlying effect ever actually applying.
            await power.activatePower({ skipDialog: true });
            await settle();
            assert.isFalse(
              actor.items.get(power.id).system.isActive,
              "activatePower() must refuse while not installed",
            );

            // Installing first, THEN activating, must work normally.
            await power.update({ "system.installed": true });
            await settle();
            await power.activatePower({ skipDialog: true });
            await settle();
            assert.isTrue(
              actor.items.get(power.id).system.isActive,
              "activatePower() must succeed once installed",
            );
          } finally {
            await deleteTestActor(actor);
          }
        });

        it("custom subtype gets the same Installed toggle as cyberware (buildPowerSectionColumns.showInstalled)", async function () {
          const { buildPowerSectionColumns } = await wwnImport(
            "/systems/wwn/module/helpers/power-sections.mjs",
          );
          const customPower = {
            id: "quench-custom-installed",
            name: "Quench Custom Implant",
            type: "power",
            system: {
              subType: "custom",
              installed: false,
              level: 1,
              customTypeName: "",
              source: "",
              resourceName: "",
              commitmentOptions: [{ cost: 1, length: "scene", note: "" }],
              poolCommitted: { none: 0, active: 0, scene: 0, day: 0 },
              internalResource: { value: 0, max: 0 },
              isActive: false,
              prepared: false,
              damageRoll: "",
            },
          };
          const cols = buildPowerSectionColumns("custom", [customPower]);
          assert.isTrue(cols.showInstalled, "custom-subtype powers must show the Installed column, same as cyberware");
        });
      });
    },
    { displayName: "WWN: Cyberware" },
  );
}
