/**
 * Guard: every AE key used in abilities packs exists in the unfiltered registry.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../build/foundry-shim.mjs";
import { getAeTargetGroups, getAeTargets } from "../module/config/ae-targets.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.join(__dirname, "..", "packs", "source");

function collectAbilityPackKeys() {
  const keys = new Set();
  const packs = ["abilities-wwn", "abilities-swn", "abilities-awn", "abilities-cwn"];
  for (const pack of packs) {
    const root = path.join(sourceRoot, pack);
    if (!fs.existsSync(root)) continue;
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (ent.name.endsWith(".json")) {
          const data = JSON.parse(fs.readFileSync(p, "utf8"));
          for (const e of data.effects ?? []) {
            for (const c of e.system?.changes ?? e.changes ?? []) {
              if (c?.key) keys.add(c.key);
            }
          }
        }
      }
    };
    walk(root);
  }
  return keys;
}

describe("abilities-pack AE keys vs registry", () => {
  before(() => {
    globalThis.game = {
      settings: { get: () => "wwn" },
      i18n: { localize: (k) => k, format: (k) => k },
    };
    globalThis.CONFIG = {
      WWN: {
        saveSets: {
          wwn: {
            saves: {
              physical: { label: "Physical" },
              evasion: { label: "Evasion" },
              mental: { label: "Mental" },
              luck: { label: "Luck" },
            },
          },
        },
      },
      Canvas: { detectionModes: {} },
    };
  });

  it("every pack AE key is present in unfiltered getAeTargets()", () => {
    // Ensure groups build (side effect: saves/token groups)
    assert.ok(Object.keys(getAeTargetGroups()).length > 0);
    const registry = getAeTargets();
    const packKeys = collectAbilityPackKeys();
    assert.ok(packKeys.size > 0, "expected pack AE keys");
    const missing = [...packKeys].filter((k) => !registry[k] && !k.startsWith("token."));
    // token.* keys may be dynamic; allow those present in packs if sight/light
    const stillMissing = missing.filter((k) => {
      if (k.startsWith("token.sight.") || k.startsWith("token.light.")) return !registry[k];
      return true;
    });
    assert.deepEqual(stillMissing, [], `Missing registry keys: ${stillMissing.join(", ")}`);
  });
});
