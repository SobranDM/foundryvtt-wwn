/**
 * Monster-specific actor logic (prepareData).
 * Delegates to shared creature compute methods.
 */
import { prepare as creaturePrepare } from "./creature.mjs";

/**
 * Run prepareData for monster (modifiers, saves, init).
 * @param {import("../../entity.js").WwnActor} actor
 */
export function prepare(actor) {
  creaturePrepare(actor);
}
