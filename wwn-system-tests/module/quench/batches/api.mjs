import { EXPECTED_WWN_API_KEYS, useQuenchTimeout } from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.api",
    (context) => {
      const { describe, it, assert } = context;

      describe("game.wwn API", function () {
        useQuenchTimeout(this);

        it("exposes expected game.wwn keys", function () {
          assert.exists(game.wwn);
          for (const key of EXPECTED_WWN_API_KEYS) {
            assert.property(game.wwn, key, `missing game.wwn.${key}`);
          }
        });

        it("registers WWN document classes on CONFIG", function () {
          assert.equal(CONFIG.Actor.documentClass, game.wwn.WwnActor);
          assert.equal(CONFIG.Item.documentClass, game.wwn.WwnItem);
          assert.exists(CONFIG.Combat.documentClass);
          assert.exists(CONFIG.ActiveEffect.documentClass);
        });
      });
    },
    { displayName: "WWN: API" },
  );
}
