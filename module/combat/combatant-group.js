import { WWNCombatant } from "./combatant.js";

export class WWNGroupCombatant extends WWNCombatant {
  get group() {
    return this.groupRaw;
  }

  get groupRaw() {
    const assignedGroup = this.getFlag(game.system.id, "group");

    if (assignedGroup)
      return assignedGroup;

    if (canvas.tokens && this.token) {
      const token = canvas.tokens.get(this.token.id);
      if (!token) return 'white';

      const disposition = token.document.disposition;
      const alertTwo = token.document.delta.syntheticActor.system.initiative.alertTwo;
      if (alertTwo || token.document.delta.syntheticActor.type === "faction") return "black";

      switch (disposition) {
        case -1:
          return "red";
        case 0:
          return "yellow";
        case 1:
          return "green";
      }
    }

    return 'white';
  }

  set group(value) {
    if (value !== undefined && value !== null) {
      this.setFlag(game.system.id, 'group', value);
    }
  }
}