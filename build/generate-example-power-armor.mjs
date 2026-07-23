/**
 * Generate packs/source/example-power-armor/ from frame presets.
 * Usage: node build/generate-example-power-armor.mjs
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { randomId, writeSourceDoc } from "./pack-folder-paths.mjs";
import { POWER_ARMOR_FRAMES, integralFittingDocuments } from "../module/config/power-armor-frames.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const FITTINGS_DATA = path.join(ROOT, "packs", "data", "armor-fittings.json");
const DEST = path.join(ROOT, "packs", "source", "example-power-armor");

function fittingTemplate(effectId, fittingsByEffect) {
  const entry = fittingsByEffect.get(effectId);
  if (entry) {
    return {
      name: entry.name,
      type: "armorFitting",
      img: "icons/svg/upgrade.svg",
      system: {
        description: `<p>${entry.description ?? ""}</p>`,
        tl: entry.tl,
        mass: 0,
        power: 0,
        cost: 0,
        stackable: Boolean(entry.stackable),
        disabled: false,
        integral: true,
        effectId,
        mountWeaponId: "",
      },
    };
  }
  return integralFittingDocuments("culverin").find((d) => d.system.effectId === effectId)
    ?? {
      name: effectId,
      type: "armorFitting",
      img: "icons/svg/upgrade.svg",
      system: {
        description: "",
        tl: 4,
        mass: 0,
        power: 0,
        cost: 0,
        stackable: false,
        disabled: false,
        integral: true,
        effectId,
        mountWeaponId: "",
      },
    };
}

function makeActor(frameKey, frame, fittingsByEffect) {
  const id = randomId(`example-power-armor:${frameKey}`);
  const items = (frame.integral ?? []).map((effectId, index) => {
    const base = fittingTemplate(effectId, fittingsByEffect);
    const itemId = randomId(`example-power-armor:${frameKey}:${effectId}`);
    return {
      _id: itemId,
      name: base.name,
      type: "armorFitting",
      img: base.img,
      effects: [],
      system: base.system,
      flags: {},
      sort: (index + 1) * 100000,
      _key: `!actors.items!${id}.${itemId}`,
    };
  });

  // Seed a basic plating on frames without integral plating so examples are wearable
  const hasPlating = items.some((i) => String(i.system.effectId).startsWith("plating"));
  if (!hasPlating && frameKey !== "scrap") {
    const plating = fittingsByEffect.get("platingBasic");
    if (plating) {
      const itemId = randomId(`example-power-armor:${frameKey}:platingBasic`);
      items.push({
        _id: itemId,
        name: plating.name,
        type: "armorFitting",
        img: "icons/svg/upgrade.svg",
        effects: [],
        system: {
          description: `<p>${plating.description}</p>`,
          tl: plating.tl,
          mass: plating.mass,
          power: plating.power,
          cost: 0,
          stackable: false,
          disabled: false,
          integral: false,
          effectId: "platingBasic",
          mountWeaponId: "",
        },
        flags: {},
        sort: (items.length + 1) * 100000,
        _key: `!actors.items!${id}.${itemId}`,
      });
    }
  }

  return {
    _id: id,
    name: frame.label,
    type: "powerArmor",
    img: "icons/svg/mystery-man.svg",
    items,
    effects: [],
    system: {
      description: `<p>Example ${frame.label} modular power armor frame.</p>`,
      frameType: frameKey,
      mass: { max: frame.mass },
      power: { max: frame.power },
      cost: frame.cost,
      pilot: { actor: null },
      trainedPilots: [],
      powered: true,
      runtime: { remaining: 30, max: 30 },
      maintenance: { skipped: 0 },
      soak: { value: 0, max: 0 },
      forbidEfficiency: !!frame.forbidEfficiency,
      runtimeMultiplier: frame.runtimeMultiplier ?? 1,
      perpetual: !!frame.perpetual,
      transportFrames: frame.transportFrames ?? 1,
      stealthPenalty: frame.stealthPenalty ?? 0,
      maxRuntimeCap: frame.maxRuntimeCap ?? null,
      ac: 10,
    },
    prototypeToken: {
      name: frame.label,
      displayName: 20,
      actorLink: true,
    },
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
    _stats: {
      systemId: "wwn",
      systemVersion: null,
      coreVersion: null,
      createdTime: null,
      modifiedTime: null,
      lastModifiedBy: null,
    },
    _key: `!actors!${id}`,
  };
}

function main() {
  const data = JSON.parse(fs.readFileSync(FITTINGS_DATA, "utf8"));
  const fittingsByEffect = new Map(data.fittings.map((f) => [f.effectId, f]));

  fs.rmSync(DEST, { recursive: true, force: true });
  fs.mkdirSync(DEST, { recursive: true });

  let sort = 0;
  const foldersById = new Map();
  for (const [key, frame] of Object.entries(POWER_ARMOR_FRAMES)) {
    const actor = makeActor(key, frame, fittingsByEffect);
    actor.sort = sort++;
    writeSourceDoc(DEST, actor, foldersById);
  }

  console.log(`Wrote ${Object.keys(POWER_ARMOR_FRAMES).length} example power armor actors to ${DEST}`);
}

main();
