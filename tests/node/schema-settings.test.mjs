import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../..");
const template = JSON.parse(fs.readFileSync(path.join(root, "template.json"), "utf8"));
const settingsSource = fs.readFileSync(path.join(root, "module/settings.js"), "utf8");
const actorSource = fs.readFileSync(path.join(root, "module/actor/entity.js"), "utf8");
const chatSource = fs.readFileSync(path.join(root, "module/chat.js"), "utf8");
const diceSource = fs.readFileSync(path.join(root, "module/dice.js"), "utf8");
const thresholdSource = fs.readFileSync(path.join(root, "module/injury-thresholds.mjs"), "utf8");
const characterAttributesTemplate = fs.readFileSync(path.join(root, "templates/actors/partials/character-attributes-tab.html"), "utf8");
const monsterAttributesTemplate = fs.readFileSync(path.join(root, "templates/actors/partials/monster-attributes-tab.html"), "utf8");
const lang = JSON.parse(fs.readFileSync(path.join(root, "lang/en.json"), "utf8"));

test("characters and monsters define local mechanic fields", () => {
  for (const type of ["character", "monster"]) {
    const actor = template.Actor[type];
    assert.deepEqual(actor.wp, { value: 4, max: 4 });
    assert.equal(actor.critResistance, 0);
    assert.equal(actor.injuryResistance, 0);
    assert.equal(actor.hp.injuries, 0);
    assert.equal(actor.hp.wounds, 0);
  }
});

test("monster strain defaults exist without removing current 1.6.1 fields", () => {
  assert.deepEqual(template.Actor.monster.details.strain, { value: 0, max: 10 });
  assert.ok(template.Actor.templates.common.trauma);
  assert.equal(template.Item.weapon.burst, false);
  assert.ok(template.Item.weapon.counter);
  assert.ok(template.Item.weapon.charges);
  assert.equal(template.Item.armor.traumaMod, 0);
});

test("local mechanics are opt-in world settings", () => {
  assert.match(settingsSource, /game\.settings\.register\("wwn", "enableWoundPoints"/);
  assert.match(settingsSource, /game\.settings\.register\("wwn", "thresholdInjuries"/);
  assert.match(settingsSource, /name: "Use Wounds with Strain"/);
  assert.doesNotMatch(settingsSource, /Removes System Strain/);
  assert.match(settingsSource, /default: false/);
  assert.match(settingsSource, /scope: "world"/);
});

test("wound rule sheet fields are additive with system strain", () => {
  assert.match(characterAttributesTemplate, /name="system\.hp\.injuries"[\s\S]*?name="system\.hp\.wounds"/);
  assert.match(characterAttributesTemplate, /name="system\.details\.strain\.value"[\s\S]*?name="system\.details\.strain\.max"/);
  assert.doesNotMatch(
    characterAttributesTemplate,
    /\{\{#unless config\.replaceStrainWithWounds\}\}[\s\S]*?system\.details\.strain\.value/,
  );

  assert.match(monsterAttributesTemplate, /name="system\.hp\.injuries"[\s\S]*?name="system\.hp\.wounds"/);
  assert.match(
    monsterAttributesTemplate,
    /\{\{#if config\.replaceStrainWithWounds\}\}[\s\S]*?system\.details\.strain\.value[\s\S]*?system\.details\.strain\.max[\s\S]*?\{\{\/if\}\}/,
  );
});

test("below-zero wound chat is awaited by applyWounds", () => {
  assert.match(actorSource, /await ChatMessage\.create\(chatData, \{\}\);/);
});

test("unrelated v1.6.1 settings stay unchanged", () => {
  assert.match(
    settingsSource,
    /game\.settings\.register\("wwn", "showMovement", \{[\s\S]*?requiresReload: true[\s\S]*?\}\);/,
  );
});

test("local labels are present", () => {
  assert.equal(lang["WWN.WoundPointsShort"], "WP");
  assert.equal(lang["WWN.CriticalResistanceShort"], "CR");
  assert.equal(lang["WWN.InjuryResistanceShort"], "IR");
  assert.equal(lang["WWN.Setting.EnableWoundPoints"], "Enable Wound Points");
});

test("critical resistance is separate from threshold injury resistance", () => {
  assert.match(actorSource, /getActorCriticalResistance\(this\)/);
  assert.match(actorSource, /computeInjuryTargetNumber\(\{ injuryResistance, edge: edge\.edge \}\)/);
  assert.match(characterAttributesTemplate, /name="system\.critResistance"/);
  assert.match(monsterAttributesTemplate, /name="system\.critResistance"/);
});

test("threshold routing uses upper-half damage gate and allows repeated clicks", () => {
  assert.match(actorSource, /evaluateUpperHalfDamageGate/);
  assert.match(actorSource, /lower-half-damage-roll|damageGate/);
  assert.match(actorSource, /_wwnDamageApplicationQueue/);
  assert.match(actorSource, /_applyDamageNow/);
  assert.doesNotMatch(actorSource, /thresholdInjuryAttempts/);
  assert.doesNotMatch(actorSource, /duplicate-threshold-attempt/);
});

test("trusted damage gate uses the full damage formula while weapon pressure keeps the base formula", () => {
  assert.match(
    diceSource,
    /const normalDamageFormula = data\.roll\?\.dmg\?\.join\(" \+ "\) \?\? data\.roll\?\.baseWeaponDamageFormula \?\? "";/,
  );
  assert.match(diceSource, /baseWeaponDamageFormula: data\.roll\?\.baseWeaponDamageFormula \?\? normalDamageFormula/);
  assert.match(actorSource, /computeWeaponPressure\(attackContext\.baseWeaponDamageFormula\)/);
  assert.doesNotMatch(diceSource, /passedUpperHalf/);
});

test("removed threshold idempotency leaves no dead helper or stale skip labels", () => {
  assert.doesNotMatch(thresholdSource, /buildThresholdAttemptKey/);
  assert.doesNotMatch(chatSource, /duplicate-threshold-attempt/);
  assert.doesNotMatch(chatSource, /missing-attempt-key/);
});
