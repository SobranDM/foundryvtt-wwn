import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../..");
const template = JSON.parse(fs.readFileSync(path.join(root, "template.json"), "utf8"));
const settingsSource = fs.readFileSync(path.join(root, "module/settings.js"), "utf8");
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
  assert.match(settingsSource, /default: false/);
  assert.match(settingsSource, /scope: "world"/);
});

test("local labels are present", () => {
  assert.equal(lang["WWN.WoundPointsShort"], "WP");
  assert.equal(lang["WWN.CriticalResistanceShort"], "CR");
  assert.equal(lang["WWN.InjuryResistanceShort"], "IR");
  assert.equal(lang["WWN.Setting.EnableWoundPoints"], "Enable Wound Points");
});
