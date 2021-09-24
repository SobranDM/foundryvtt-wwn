export class WwnCombat {
  static rollInitiative(combat, data) {
    // Check groups
    data.combatants = [];
    let groups = {};
    combat.data.combatants.forEach((cbt) => {
      const group = cbt.getFlag("wwn", "group");
      groups[group] = { present: true };
      data.combatants.push(cbt);
    });

    // Roll init
    Object.keys(groups).forEach((group) => {
      let roll = new Roll("1d8").roll({async: false});
      roll.toMessage({
        flavor: game.i18n.format('WWN.roll.initiative', { group: CONFIG["WWN"].colors[group] }),
      });
      groups[group].initiative = roll.total;
    });

    // Set init
    for (let i = 0; i < data.combatants.length; ++i) {
      if (!data.combatants[i].actor) {
        return;
      }
      const group = data.combatants[i].getFlag("wwn", "group");
      data.combatants[i].update({initiative: groups[group].initiative});
    }
    combat.setupTurns();
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
    combat.data.combatants.forEach((c, i) => {
      // Initialize variables
      let alert = c.actor.data.items.filter((a) => a.name == "Alert");
      let roll = null;
      let roll2 = null;

      // Reset initative to zero
      c.actor.data.data.initiative.roll = 0;

      // Roll initiative
      roll = new Roll("1d8+" + c.actor.data.data.initiative.value).roll({async: false});
      roll.toMessage({
        flavor: game.i18n.format('WWN.roll.individualInit', { name: c.token.name })
      });
      if (alert.length > 0) {
        roll2 = new Roll("1d8+" + c.actor.data.data.initiative.value).roll({async: false});
        roll2.toMessage({
        flavor: game.i18n.format('WWN.roll.individualInit', { name: c.token.name })
      });
      }

      // Set initiative
      if (alert.length > 0) {
        console.log('ALERT!!');
        console.log(alert);
        if (alert[0].data.data.ownedLevel == 2) {
          updates.push({ _id: c.id, initiative: 100 + Math.max(roll.total, roll2.total) });
        } else {
          updates.push({ _id: c.id, initiative: Math.max(roll.total, roll2.total) });
        }
        
      } else {
        updates.push({ _id: c.id, initiative: roll.total });
      }
    });

    await combat.updateEmbeddedEntity("Combatant", updates);
    await CONFIG.ChatMessage.entityClass.create(messages);
    data.turn = 0;
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
          ct.initiative != "-789.00" &&
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
      game.combat.combatant.update({
        _id: id,
        flags: { wwn: { group: colors[index] } },
      });
    });

    html.find('.combat-control[data-control="reroll"]').click((ev) => {
      if (!game.combat) {
        return;
      }
      let data = {};
      WwnCombat.rollInitiative(game.combat, data);
      game.combat.update({ data: data }).then(() => {
        game.combat.setupTurns();
      });
    });
  }

  static addCombatant(combat, data, options, id) {
    let token = canvas.tokens.get(data.tokenId);
    let color = "black";
    switch (token.data.disposition) {
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
  }

  static activateCombatant(li) {
    const turn = game.combat.turns.findIndex(turn => turn.id === li.data('combatant-id'));
    game.combat.update({turn: turn})
  }

  static addContextEntry(html, options) {
    options.unshift({
      name: "Set Active",
      icon: '<i class="fas fa-star-of-life"></i>',
      callback: WwnCombat.activateCombatant
    });
  }

  static async preUpdateCombat(combat, data, diff, id) {
    let init = game.settings.get("wwn", "initiative");
    let reroll = game.settings.get("wwn", "rerollInitiative");
    if (!data.round) {
      return;
    }
    if (data.round !== 1) {
      if (reroll === "reset") {
        WwnCombat.resetInitiative(combat, data, diff, id);
        return;
      } else if (reroll === "keep") {
        return;
      }
    }
    if (init === "group") {
      WwnCombat.rollInitiative(combat, data, diff, id);
    } else {
      WwnCombat.individualInitiative(combat, data, diff, id);
    }
  }
}
