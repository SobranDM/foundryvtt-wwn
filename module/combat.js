export class WwnCombat {
  debounce(callback, wait) {
    let timeoutId = null;
    return (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        callback.apply(null, args);
      }, wait);
    };
  }

  static async rollInitiative(combat, data) {
    // Check groups
    const groups = {};
    const combatants = combat?.combatants;
    combatants.forEach((cbt) => {
      const group = cbt.getFlag("wwn", "group");
      groups[group] = { present: true };
    });
    // Roll init
    for (const group in groups) {
      const modArray = [0];
      let alertGroup = false;
      const groupCbts = combatants.filter((cbt) => cbt.getFlag("wwn", "group") === group);
      groupCbts.forEach((cbt) => {
        if (cbt.actor.type !== "character") return;
        const alert = cbt.actor.items.find((a) => a.name === "Alert");
        if (alert) alertGroup = true;
        const dexMod = cbt.actor.system.scores.dex.mod;
        modArray.push(dexMod);
      });
      const finalMod = alertGroup ? Math.max(...modArray) + 1 : Math.max(...modArray);
      const roll = Math.floor((Math.random() * 8) + 1) + finalMod;
      groups[group].initiative = roll;
    }
    // Set init
    let updates = [];
    combatants.forEach((c) => {
      if (game.user.isGM) {
        if (!c.actor) return;
        const group = c.getFlag("wwn", "group");
        updates.push({ _id: c.id, initiative: groups[group].initiative });
      };
    });
    await combat.updateEmbeddedDocuments("Combatant", updates);
    await combat.setupTurns();
  }

  static async resetInitiative(combat, data) {
    let reroll = game.settings.get("wwn", "rerollInitiative");
    if (!["reset", "reroll"].includes(reroll)) {
      return;
    }
    combat.resetAll();
  }

  static async individualInitiative(combat, data) {
    let updates = [];
    let messages = [];
    combat.combatants.forEach(async (c, i) => {
      // Initialize variables
      let alert = c.actor.items.filter((a) => a.name == "Alert");
      let roll = null;
      let roll2 = null;


      // Check if initiative has already been manually rolled
      if (!c.initiative) {
        // Roll initiative
        roll = Math.floor((Math.random() * 8) + 1) + c.actor.system.initiative.value;
        if (alert.length > 0) {
          roll2 = Math.floor((Math.random() * 8) + 1) + c.actor.system.initiative.value;
        }

        // Set initiative
        if (alert.length > 0) {
          if (alert[0].system.ownedLevel == 2) {
            updates.push({ _id: c.id, initiative: 100 + Math.max(roll, roll2) });
          } else {
            updates.push({ _id: c.id, initiative: Math.max(roll, roll2) });
          }

        } else {
          updates.push({ _id: c.id, initiative: roll });
        }
      }
    });
    if (game.user.isGM) {
      await combat.updateEmbeddedDocuments("Combatant", updates);
      await CONFIG.ChatMessage.documentClass.create(messages);
      await combat.setupTurns();
    }
  }

  static format(object, html, user) {
    html.find(".initiative").each((_, span) => {
      span.innerHTML =
        span.innerHTML == "-789.00"
          ? '<i class="fas fa-weight-hanging"></i>'
          : span.innerHTML;
      span.innerHTML =
        span.innerHTML == "-790.00"
          ? '<i class="fas fa-dizzy"></i>'
          : span.innerHTML;
    });

    let init = game.settings.get("wwn", "initiative") === "group";
    if (!init) {
      return;
    }

    html.find('.combat-control[data-control="rollNPC"]').remove();
    html.find('.combat-control[data-control="rollAll"]').remove();
    let trash = html.find(
      '.encounters .combat-control[data-control="endCombat"]'
    );
    $(
      '<a class="combat-control" data-control="reroll"><i class="fas fa-dice"></i></a>'
    ).insertBefore(trash);

    html.find(".combatant").each((_, ct) => {
      // Can't roll individual inits
      $(ct).find(".roll").remove();

      // Get group color
      const cmbtant = object.viewed.combatants.get(ct.dataset.combatantId);
      let color = cmbtant.getFlag("wwn", "group");

      // Append colored flag
      let controls = $(ct).find(".combatant-controls");
      controls.prepend(
        `<a class='combatant-control flag' style='color:${color}' title="${CONFIG.WWN.colors[color]}"><i class='fas fa-flag'></i></a>`
      );
    });
    WwnCombat.addListeners(html);
  }

  static updateCombatant(combat, combatant, data) {
    let init = game.settings.get("wwn", "initiative");
    // Why do you reroll ?
    if (data.initiative && init == "group") {
      let groupInit = data.initiative;
      // Check if there are any members of the group with init
      combat.combatants.forEach((ct) => {
        if (
          ct.initiative &&
          ct.id != data.id &&
          ct.flags.wwn.group == combatant.flags.wwn.group
        ) {
          groupInit = ct.initiative;
          // Set init
          data.initiative = parseInt(groupInit);
        }
      });
    }
  }

  static addListeners(html) {
    // Cycle through colors
    html.find(".combatant-control.flag").click((ev) => {
      if (!game.user.isGM) {
        return;
      }
      let currentColor = ev.currentTarget.style.color;
      let colors = Object.keys(CONFIG.WWN.colors);
      let index = colors.indexOf(currentColor);
      if (index + 1 == colors.length) {
        index = 0;
      } else {
        index++;
      }
      let id = $(ev.currentTarget).closest(".combatant")[0].dataset.combatantId;
      const combatant = game.combat.combatants.get(id);
      combatant.setFlag('wwn', 'group', colors[index]);
    });

    html.find('.combat-control[data-control="reroll"]').click((ev) => {
      if (!game.combat) {
        return;
      }
      let data = {};
      WwnCombat.rollInitiative(game.combat, data);
      /* game.combat.update({ system: data }).then(() => {
        game.combat.setupTurns();
      }); */
    });
  }

  static addContextEntry(html, options) {
    options.unshift({
      name: "Set Active",
      icon: '<i class="fas fa-star-of-life"></i>',
      callback: WwnCombat.activateCombatant
    });
  }

  static addCombatant(combat, data, options, id) {
    let token = canvas.tokens.get(data.tokenId);
    let color = "black";
    switch (token.document.disposition) {
      case -1:
        color = "red";
        break;
      case 0:
        color = "yellow";
        break;
      case 1:
        color = "green";
        break;
    }
    data.flags = {
      wwn: {
        group: color,
      },
    };
    combat.updateSource({ flags: { wwn: { group: color } } });
  }

  static activateCombatant(li) {
    const turn = game.combat.turns.findIndex(
      (turn) => turn.id === li.data("combatant-id")
    );
    if (game.user.isGM) {
      game.combat.update({ turn: turn });
    }
  }

  static async preUpdateCombat(combat, data, diff, id) {
    const init = game.settings.get("wwn", "initiative");
    const reroll = game.settings.get("wwn", "rerollInitiative");
    if (!data.round) {
      return;
    }
    if (data.round !== 1) {
      for (const combatant of combat.combatants) {
        if (combatant.actor.type === "monster") {
          for (const itm of combatant.actor.items) {
            if (itm.system.counter) {
              const item = combatant.actor.items.get(itm.id);
              await item.update({ "system.counter.value": item.system.counter.max });
            }
          };
        }
      };
      if (reroll === "reset") {
        WwnCombat.resetInitiative(combat, data, diff, id);
        return;
      } else if (reroll === "keep") {
        return;
      }
    }
    if (init === "group") {
      await WwnCombat.rollInitiative(combat, data, diff, id);
    } else {
      await WwnCombat.individualInitiative(combat, data, diff, id);
    }
  }

  static async preCreateToken(token, data, options, userId) {
    const actor = game.actors.get(data.actorId);
    const newData = {};

    if (!actor || data.actorLink || !game.settings.get("wwn", "randomHP")) {
      return token.updateSource(newData);
    }

    let newTotal = 0;
    const modSplit = token.actor.system.hp.hd.split("+");
    const dieSize = modSplit[0].split("d")[1];
    const dieCount = modSplit[0].split("d")[0];
    for (let i = 0; i < dieCount; i++) {
      newTotal += Math.floor(Math.random() * dieSize + 1);
    }
    newTotal += parseInt(modSplit[1]) || 0;

    foundry.utils.setProperty(newData, "delta.system.hp.value", newTotal);
    foundry.utils.setProperty(newData, "delta.system.hp.max", newTotal);

    return token.updateSource(newData);
  }
}