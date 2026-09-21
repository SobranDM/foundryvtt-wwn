import { createTestActor, deleteTestActor, settle, useQuenchTimeout, withSetting } from "../helpers.mjs";

/**
 * Document-level coverage for the `party` Actor type (module/data/actor/party.mjs,
 * module/sheets/actor/party-sheet.mjs, module/helpers/party-treasury.mjs) and
 * the party-specific branches of module/wwn.mjs's item/actor hooks.
 *
 * The pure helpers (partyCarriedRawWeight / partiesCarryingFor /
 * buildCarrierClearUpdate / getPartyActors) already have thorough coverage
 * against mocked documents in tests/party-treasury.test.mjs, and the
 * default-party migration logic against a mocked `game` in
 * tests/party-migration.test.mjs. What those Node tests cannot exercise is
 * the real document lifecycle: a real PC dropped onto a real Party sheet via
 * `_onDropActor`, a real embedded pool item's carrier assignment actually
 * flowing into another real actor's `prepareDerivedData` via the shared
 * `game.actors` collection, the real `removeMember` sheet action clearing
 * assignments through an actual DOM click, and the real `deleteItem`/`_preCreate`
 * hook wiring in module/wwn.mjs / module/documents/actor.mjs. That real-hook
 * wiring is what these tests cover.
 *
 * Deliberately NOT covered here: `maybeCreateDefaultParty` actually creating
 * a real "Party" actor when none exists -- the shared dev world always has a
 * live "Party" actor other tests/sessions depend on, and deleting it (even
 * temporarily) to exercise the zero-party branch would risk corrupting that
 * shared state for no real gain over the fully-mocked coverage already in
 * tests/party-migration.test.mjs. Also not covered: GM-vs-non-GM permission
 * gating on `_onDropActor`/`removeMember`/Deal XP/Deal Currency -- no other
 * Quench batch in this suite simulates a non-GM user, so there's no
 * established pattern to follow here either.
 */
export default function register(quench) {
  quench.registerBatch(
    "wwn.party",
    (context) => {
      const { describe, it, assert } = context;

      describe("Party actor document lifecycle", function () {
        useQuenchTimeout(this);

        it("creating a Party actor seeds default currency and defaults to Observer ownership (real _preCreate hook)", async function () {
          const party = await createTestActor("party", "party-seed");
          try {
            await settle();
            assert.equal(
              party.ownership.default,
              CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
              "players must see the shared pool/roster without per-actor grants",
            );
            const currencyItems = party.items.filter((i) => i.type === "currency");
            assert.isAbove(currencyItems.length, 0, "a new party must come with a seeded currency set");
            for (const c of currencyItems) {
              assert.equal(c.system.carried, 0);
              assert.equal(c.system.banked, 0);
            }

            // Creating it a second time round-trip must not double-seed --
            // #preCreate only seeds when the incoming data has no currency
            // items yet.
            const currencyCountBefore = party.items.filter((i) => i.type === "currency").length;
            await party.update({}); // no-op update; just proves nothing re-seeds on its own
            await settle();
            assert.equal(
              game.actors.get(party.id).items.filter((i) => i.type === "currency").length,
              currencyCountBefore,
            );
          } finally {
            await deleteTestActor(party);
          }
        });

        it("_onDropActor adds a real PC to the roster, and rejects a non-PC actor (real sheet override, GM-gated)", async function () {
          const party = await createTestActor("party", "party-drop");
          const pc = await createTestActor("character", "party-drop-pc", {}, { wwnSkipSeeding: true });
          const monster = await createTestActor("monster", "party-drop-monster");
          try {
            await settle();
            await party.sheet.render(true);
            await settle();
            try {
              assert.deepEqual(party.system.members, []);

              await party.sheet._onDropActor({}, pc);
              await settle();
              assert.deepEqual(
                game.actors.get(party.id).system.members,
                [pc.uuid],
                "dropping a real PC actor must add it to system.members via the real _onDropActor override",
              );

              await party.sheet._onDropActor({}, monster);
              await settle();
              assert.deepEqual(
                game.actors.get(party.id).system.members,
                [pc.uuid],
                "dropping a non-PC actor must be rejected (only player characters can be party members)",
              );

              // Dropping the same PC again must not duplicate the roster entry.
              await party.sheet._onDropActor({}, pc);
              await settle();
              assert.deepEqual(game.actors.get(party.id).system.members, [pc.uuid]);
            } finally {
              await party.sheet.close();
            }
          } finally {
            await deleteTestActor(party);
            await deleteTestActor(pc);
            await deleteTestActor(monster);
          }
        });

        it("a carrier assignment on a pooled item flows into the carrying PC's real encumbrance (system.carrierAssignments -> partyCarried/stowed)", async function () {
          const party = await createTestActor("party", "party-carry");
          const pc = await createTestActor(
            "character",
            "party-carry-pc",
            { system: { abilities: { str: { value: 10 } } } },
            { wwnSkipSeeding: true },
          );
          try {
            await party.update({ "system.members": [pc.uuid] });
            const [coin] = await party.createEmbeddedDocuments("Item", [
              {
                name: "Quench Party Coin",
                type: "currency",
                system: { multiplier: 1, perSlot: 100, carried: 250, banked: 0 },
              },
            ]);
            await settle();

            await withSetting("roundWeight", true, async () => {
              await party.update({ [`system.carrierAssignments.${coin.id}`]: pc.uuid });
              await settle();
              game.actors.get(pc.id).prepareData();

              assert.equal(
                game.actors.get(pc.id).system.encumbrance.partyCarried,
                2.5,
                "the raw (unrounded) party contribution must be exposed as-is",
              );
              assert.equal(
                game.actors.get(pc.id).system.encumbrance.stowed.value,
                3,
                "the PC's own (empty) currency plus the party's 2.5 slots must round to 3 once, together",
              );
            });
          } finally {
            await deleteTestActor(party);
            await deleteTestActor(pc);
          }
        });

        it("the removeMember sheet action clears the removed member's carrier assignments on that party (real DOM click, real document round-trip)", async function () {
          const party = await createTestActor("party", "party-remove");
          const pc = await createTestActor("character", "party-remove-pc", {}, { wwnSkipSeeding: true });
          try {
            await party.update({ "system.members": [pc.uuid] });
            const [coin] = await party.createEmbeddedDocuments("Item", [
              { name: "Quench Removable Coin", type: "currency", system: { multiplier: 1, perSlot: 100, carried: 10, banked: 0 } },
            ]);
            await party.update({ [`system.carrierAssignments.${coin.id}`]: pc.uuid });
            await settle();
            assert.equal(game.actors.get(party.id).system.carrierAssignments[coin.id], pc.uuid);

            await party.sheet.render(true);
            await settle();
            try {
              const btn = party.sheet.element.querySelector(
                `[data-actor-uuid="${pc.uuid}"] [data-action="removeMember"]`,
              );
              assert.exists(btn, "roster row should have a remove-member control for this member");
              btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
              await settle();

              const refreshed = game.actors.get(party.id);
              assert.deepEqual(refreshed.system.members, [], "removed member must be dropped from the roster");
              assert.notExists(
                refreshed.system.carrierAssignments[coin.id],
                "removing a member must clear any pooled-item assignment that pointed at them",
              );
            } finally {
              await party.sheet.close();
            }
          } finally {
            await deleteTestActor(party);
            await deleteTestActor(pc);
          }
        });

        it("deleting a pooled item clears its stale carrierAssignments entry (real deleteItem hook)", async function () {
          const party = await createTestActor("party", "party-item-delete");
          const pc = await createTestActor("character", "party-item-delete-pc", {}, { wwnSkipSeeding: true });
          try {
            await party.update({ "system.members": [pc.uuid] });
            const [coin] = await party.createEmbeddedDocuments("Item", [
              { name: "Quench Doomed Coin", type: "currency", system: { multiplier: 1, perSlot: 100, carried: 5, banked: 0 } },
            ]);
            await party.update({ [`system.carrierAssignments.${coin.id}`]: pc.uuid });
            await settle();
            assert.equal(game.actors.get(party.id).system.carrierAssignments[coin.id], pc.uuid);

            await coin.delete();
            await settle();

            assert.notExists(
              game.actors.get(party.id).system.carrierAssignments[coin.id],
              "deleting a pooled item must clear its carrierAssignments entry via the real deleteItem hook, not leave a stale item-id key forever",
            );
          } finally {
            await deleteTestActor(party);
            await deleteTestActor(pc);
          }
        });

        it("a PC removed from the world is scrubbed from every party's roster and carrierAssignments (real deleteActor hook, cross-party)", async function () {
          const partyA = await createTestActor("party", "party-cleanup-a");
          const partyB = await createTestActor("party", "party-cleanup-b");
          const pc = await createTestActor("character", "party-cleanup-pc", {}, { wwnSkipSeeding: true });
          try {
            const [coinA] = await partyA.createEmbeddedDocuments("Item", [
              { name: "Quench Coin A", type: "currency", system: { multiplier: 1, perSlot: 100, carried: 1, banked: 0 } },
            ]);
            await partyA.update({ "system.members": [pc.uuid], [`system.carrierAssignments.${coinA.id}`]: pc.uuid });
            await partyB.update({ "system.members": [pc.uuid] });
            await settle();

            await pc.delete();
            await settle();

            const refreshedA = game.actors.get(partyA.id);
            const refreshedB = game.actors.get(partyB.id);
            assert.deepEqual(refreshedA.system.members, [], "deleted PC must be scrubbed from party A's roster");
            assert.deepEqual(refreshedB.system.members, [], "deleted PC must be scrubbed from party B's roster too");
            assert.notExists(
              refreshedA.system.carrierAssignments[coinA.id],
              "deleted PC's carrier assignment must also be cleared",
            );
          } finally {
            await deleteTestActor(partyA);
            await deleteTestActor(partyB);
            // pc already deleted above; deleteTestActor no-ops if it's gone.
            await deleteTestActor(pc);
          }
        });
      });
    },
    { displayName: "WWN: Party" },
  );
}
