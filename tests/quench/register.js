/**
 * Quench test registration for WWN system.
 * Loaded only when Quench is present. Registers test batches for in-Foundry integration tests.
 */
import { WwnDice } from "../../module/dice.js";
import { WWN } from "../../module/config.js";
import * as party from "../../module/party.js";
import * as chat from "../../module/chat.js";
import { WWNCombat } from "../../module/combat/combat.js";

Hooks.on("quenchReady", (quench) => {
  quench.registerBatch(
    "wwn.config",
    (context) => {
      const { describe, it, assert } = context;
      describe("WWN: CONFIG", () => {
        it("CONFIG.WWN is set after init", () => {
          assert.exists(CONFIG.WWN);
          assert.equal(CONFIG.WWN, WWN);
        });
        it("CONFIG.WWN has scores, saves, skills", () => {
          assert.hasAllKeys(CONFIG.WWN.scores, ["str", "dex", "con", "int", "wis", "cha"]);
          assert.hasAllKeys(CONFIG.WWN.saves, ["evasion", "mental", "physical", "luck"]);
          assert.isAtLeast(Object.keys(CONFIG.WWN.skills).length, 20);
        });
      });
    },
    { displayName: "WWN: Config" }
  );

  quench.registerBatch(
    "wwn.dice",
    (context) => {
      const { describe, it, assert } = context;
      describe("WWN: WwnDice.digestResult (in Foundry)", () => {
        it("above: success when total >= target", async () => {
          const data = { roll: { type: "above", target: 10 } };
          const roll = { total: 10, terms: [{ total: 10 }] };
          const result = await WwnDice.digestResult(data, roll);
          assert.isTrue(result.isSuccess);
          assert.isFalse(result.isFailure);
        });
        it("below: failure when total > target", async () => {
          const data = { roll: { type: "below", target: 10 } };
          const roll = { total: 11, terms: [{ total: 11 }] };
          const result = await WwnDice.digestResult(data, roll);
          assert.isFalse(result.isSuccess);
          assert.isTrue(result.isFailure);
        });
        it("table: sets details from table", async () => {
          const data = {
            roll: {
              type: "table",
              target: 0,
              table: { 1: "One", 2: "Two" },
            },
          };
          const roll = { total: 2, terms: [{ total: 2 }] };
          const result = await WwnDice.digestResult(data, roll);
          assert.equal(result.details, "Two");
        });
        it("instinct: success when total > target (no table draw)", async () => {
          const data = { roll: { type: "instinct", target: 5 } };
          const roll = { total: 6, terms: [{ total: 6 }] };
          const result = await WwnDice.digestResult(data, roll);
          assert.isTrue(result.isSuccess);
          assert.isFalse(result.isFailure);
        });
      });
    },
    { displayName: "WWN: Dice" }
  );

  quench.registerBatch(
    "wwn.party",
    (context) => {
      const { describe, it, assert } = context;
      describe("WWN: party module", () => {
        it("addControl is a function", () => {
          assert.isFunction(party.addControl);
        });
        it("update is a function", () => {
          assert.isFunction(party.update);
        });
        it("showPartySheet is a function", () => {
          assert.isFunction(party.showPartySheet);
        });
        it("update does not throw when actor has no party flag", () => {
          const mockActor = { getFlag: () => null };
          assert.doesNotThrow(() => party.update(mockActor, {}));
        });
      });
    },
    { displayName: "WWN: Party" }
  );

  quench.registerBatch(
    "wwn.documentClasses",
    (context) => {
      const { describe, it, assert } = context;
      describe("WWN: Document classes", () => {
        it("CONFIG.Actor.documentClass is WwnActor", () => {
          assert.exists(CONFIG.Actor.documentClass);
          assert.equal(CONFIG.Actor.documentClass.name, "WwnActor");
        });
        it("CONFIG.Item.documentClass is WwnItem", () => {
          assert.exists(CONFIG.Item.documentClass);
          assert.equal(CONFIG.Item.documentClass.name, "WwnItem");
        });
        it("CONFIG.Combat.documentClass is WWNCombat", () => {
          assert.exists(CONFIG.Combat.documentClass);
          assert.equal(CONFIG.Combat.documentClass.name, "WWNCombat");
        });
        it("CONFIG.Combatant.documentClass is WWNCombatant", () => {
          assert.exists(CONFIG.Combatant.documentClass);
          assert.equal(CONFIG.Combatant.documentClass.name, "WWNCombatant");
        });
      });
    },
    { displayName: "WWN: Document classes" }
  );

  quench.registerBatch(
    "wwn.actor.create",
    (context) => {
      const { describe, it, before, after, assert } = context;
      describe("WWN: Actor creation and prepareData", () => {
        let testActor;
        before(async () => {
          testActor = await Actor.create({
            name: "Quench Test Character",
            type: "character",
            system: {},
          });
        });
        after(async () => {
          if (testActor) await testActor.delete();
        });
        it("creates a character actor that is WwnActor", () => {
          assert.exists(testActor);
          assert.equal(testActor.constructor.name, "WwnActor");
        });
        it("prepareData runs without error", () => {
          testActor.prepareData();
          assert.exists(testActor.system);
        });
      });
    },
    { displayName: "WWN: Actor create" }
  );

  quench.registerBatch(
    "wwn.item.create",
    (context) => {
      const { describe, it, before, after, assert } = context;
      describe("WWN: Item creation and WwnItem", () => {
        let testItem;
        before(async () => {
          testItem = await Item.create({
            name: "Quench Test Weapon",
            type: "weapon",
            system: {},
          });
        });
        after(async () => {
          if (testItem) await testItem.delete();
        });
        it("creates an item that is WwnItem", () => {
          assert.exists(testItem);
          assert.equal(testItem.constructor.name, "WwnItem");
        });
        it("prepareData runs without error", () => {
          testItem.prepareData();
          assert.exists(testItem.system);
        });
        it("WwnItem.defaultIcons has expected item types", () => {
          const WwnItemClass = CONFIG.Item.documentClass;
          assert.exists(WwnItemClass.defaultIcons);
          assert.include(WwnItemClass.defaultIcons.weapon, "weapon");
          assert.include(WwnItemClass.defaultIcons.spell, "spell");
        });
      });
    },
    { displayName: "WWN: Item create" }
  );

  quench.registerBatch(
    "wwn.chat",
    (context) => {
      const { describe, it, assert } = context;
      describe("WWN: Chat module", () => {
        it("addChatMessageContextOptions is a function", () => {
          assert.isFunction(chat.addChatMessageContextOptions);
        });
        it("applyChatCardDamage is a function", () => {
          assert.isFunction(chat.applyChatCardDamage);
        });
        it("addChatMessageContextOptions extends options array", () => {
          const options = [];
          const html = document.createElement("div");
          html.dataset.messageId = "nonexistent";
          const result = chat.addChatMessageContextOptions(html, options);
          assert.isArray(result);
          assert.isAtLeast(result.length, 1);
        });
      });
    },
    { displayName: "WWN: Chat" }
  );

  quench.registerBatch(
    "wwn.combat",
    (context) => {
      const { describe, it, assert } = context;
      describe("WWN: Combat", () => {
        it("WWNCombat.FORMULA is set", () => {
          assert.exists(WWNCombat.FORMULA);
          assert.include(WWNCombat.FORMULA, "initiative");
        });
        it("WWNCombat.GROUPS includes WWN colors", () => {
          assert.exists(WWNCombat.GROUPS);
          assert.include(Object.keys(WWNCombat.GROUPS), "green");
          assert.include(Object.keys(WWNCombat.GROUPS), "red");
        });
        it("creating Combat uses WWNCombat when scene exists", function () {
          const scene = game.scenes.contents[0];
          if (!scene) this.skip();
          return Combat.create({ sceneId: scene.id }).then((combat) => {
            assert.exists(combat);
            assert.equal(combat.constructor.name, "WWNCombat");
            return combat.delete();
          });
        });
      });
    },
    { displayName: "WWN: Combat" }
  );
});
