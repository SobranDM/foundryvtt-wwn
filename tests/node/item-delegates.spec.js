/**
 * Tests for item delegate modules (Phase 2 chunking).
 */
import { describe, it } from "mocha";
import { assert } from "chai";
import * as chatCards from "../../module/item/chat-cards.mjs";
import * as rolls from "../../module/item/rolls.mjs";
import * as assets from "../../module/item/assets.mjs";

describe("WWN: Item delegates", () => {
  it("chat-cards exports chatListeners and helpers", () => {
    assert.isFunction(chatCards.chatListeners);
    assert.isFunction(chatCards.getChatCardActor);
    assert.isFunction(chatCards.getChatCardTargets);
  });
  it("rolls exports roll and use methods", () => {
    assert.isFunction(rolls.rollSkill);
    assert.isFunction(rolls.rollWeapon);
    assert.isFunction(rolls.rollShipWeapon);
    assert.isFunction(rolls.rollFormula);
    assert.isFunction(rolls.spendSpell);
    assert.isFunction(rolls.spendArt);
    assert.isFunction(rolls.roll);
    assert.isFunction(rolls.show);
  });
  it("assets exports faction asset methods", () => {
    assert.isFunction(assets.getAssetAttackRolls);
    assert.isFunction(assets.assetAttack);
    assert.isFunction(assets.assetSearch);
    assert.isFunction(assets.assetLogAction);
    assert.isFunction(assets.rollAsset);
  });
});
