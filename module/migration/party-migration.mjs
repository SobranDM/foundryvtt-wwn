/**
 * Ensure every world has at least one Party actor. The "does a party exist"
 * check itself runs on every world load (not one-shot) and is naturally
 * idempotent -- no settings flag needed to avoid duplicate creation.
 *
 * Seeding a newly-created party from legacy PCs still carrying the old
 * `flags.wwn.party === true` boolean IS one-shot, gated by
 * `partyLegacySeedDone`, and deliberately separate from the "party exists"
 * check above: without that separate gate, a GM who deletes their only party
 * (to start over with an empty roster) would find it silently resurrected
 * with the same old legacy membership on the next world load, since nothing
 * ever clears the legacy flags. Once the one-time seed has run, any later
 * zero-party state creates a genuinely empty "Party" actor instead.
 */
import { isPc } from "../helpers/actor-types.mjs";

const NS = "wwn";
const SETTING_LEGACY_SEED_DONE = "partyLegacySeedDone";

/**
 * @param {Actor[]} actors  candidate world actors (usually game.actors)
 * @returns {string[]} uuids of PCs still flagged flags.wwn.party === true
 */
export function collectFlaggedPartyMemberUuids(actors) {
  return (actors ?? [])
    .filter((a) => isPc(a) && a.getFlag?.(NS, "party") === true)
    .map((a) => a.uuid);
}

/**
 * Run on every world load (GM only): create a default "Party" actor if none
 * exists yet. Gated on `activeGM`, not merely `isGM` -- two simultaneously
 * connected GM clients (a GM with two tabs, or a co-GM) would otherwise both
 * pass the same `alreadyHasParty`/`legacySeedDone` reads before either write
 * lands, each creating its own default party. `activeGM` is the same single
 * user on every connected client, so only one of them ever runs this.
 */
export async function maybeCreateDefaultParty() {
  if (!game.user?.isGM) return;
  if (game.users?.activeGM && game.user !== game.users.activeGM) return;

  const alreadyHasParty = game.actors.some((a) => a.type === "party");
  if (alreadyHasParty) return;

  const legacySeedDone = game.settings.get(NS, SETTING_LEGACY_SEED_DONE);
  const memberUuids = legacySeedDone
    ? []
    : collectFlaggedPartyMemberUuids(game.actors.contents ?? [...game.actors]);

  await Actor.implementation.create({
    name: game.i18n.localize("WWN.party.defaultName"),
    type: "party",
    system: { members: memberUuids },
  });
  await game.settings.set(NS, SETTING_LEGACY_SEED_DONE, true);
  console.info(`WWN | Created default party with ${memberUuids.length} member(s).`);
}
