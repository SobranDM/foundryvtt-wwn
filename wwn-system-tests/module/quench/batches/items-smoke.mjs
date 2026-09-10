import {
  ITEM_SMOKE_TYPES,
  createTestItem,
  deleteTestItem,
  settle,
  useQuenchTimeout,
} from "../helpers.mjs";

export default function register(quench) {
  quench.registerBatch(
    "wwn.items.smoke",
    (context) => {
      const { describe, it, assert } = context;

      describe("Item creation", function () {
        useQuenchTimeout(this);

        for (const type of ITEM_SMOKE_TYPES) {
          it(`creates a ${type} item`, async function () {
            const item = await createTestItem(type);
            try {
              await settle();
              assert.equal(item.type, type);
              assert.exists(item.system);
            } finally {
              await deleteTestItem(item);
            }
          });
        }
      });
    },
    { displayName: "WWN: Items smoke" },
  );
}
