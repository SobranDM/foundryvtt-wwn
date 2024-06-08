/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @returns {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function () {
  ui.notifications.info(`Applying WWN System Migration for version ${game.system.version}. Please be patient and do not close your game or shut down your server.`, { permanent: true });

  for (let actor of game.actors.contents) {
    let updateData = await migrateActorDataToItemSkills(actor);
    if (updateData && updateData.length) {
      console.log(`Adding skills to ${actor.name}.`);
      await actor.createEmbeddedDocuments("Item", updateData);
    }
    // If another actor migration is used to change the actor it should follow something like 
    // const updateData = await migrateActorDataToItemSkills(actor.data);
    // if (!foundry.utils.isObjectEmpty(updateData)) {
    //  await a.update(updateData, {enforceTypes: false});
  }

  for (let scene of game.scenes.contents) {
    let sceneUpdate = migrateSceneData(scene);
    if (!foundry.utils.isEmpty(sceneUpdate)) {
      console.log(`Migrating Scene ${scene.name}.`);
      await scene.update(sceneUpdate);
    }
  }

  for (let pack of game.packs) {
    if (pack.metadata.package != "world") {
      continue;
    }

    const packType = pack.metadata.entity;
    if (!["Actor", "Scene"].includes(packType)) {
      continue;
    }

    const wasLocked = pack.locked;
    await pack.configure({ locked: false });

    await pack.migrate();
    const documents = await pack.getDocuments();

    for (let document of documents) {
      let updateData = {};
      switch (packType) {
        case "Actor":
          updateData = await migrateActorDataToItemSkills(document.data);
          await document.createEmbeddedDocuments("Item", updateData);
          updateData = {};
          break;
        case "Scene":
          updateData = migrateSceneData(document.data);
          break;
      }
      if (foundry.utils.isObjectEmpty(updateData)) {
        continue;
      }
      await document.update(updateData);
      console.log(`Migrated ${packType} entity ${document.name} in Compendium ${pack.collection}`);
    }

    await pack.configure({ locked: wasLocked });
  }
  // Set the migration as complete
  game.settings.set("wwn", "systemMigrationVersion", game.system.version);
  ui.notifications.info(`WWN System Migration to version ${game.system.version} completed!`, { permanent: true });
};

/**
 * Apply migration to an actor to generate skills as items
 * @param {Actor} Actor to be migrated.
 * @returns {Array} Array of items that should be added to actor.
 */
async function migrateActorDataToItemSkills(actor) {
  let updateData = [];

  if (actor.type != "character") {
    return updateData;
  }
  let actorData = actor.system;
  let skills = actor.items.filter((i) => i.type == "skill");
  if (!skills || skills.length == 0) {
    // This character needs skills
    let skillPack = game.packs.get("wwn.skills");
    let toAdd = await skillPack.getDocuments();
    let primarySkills = toAdd.filter((i) => i.system.secondary == false).map(item => item.toObject());
    for (let skill of primarySkills) {
      let oldSkill = actorData.skills[skill.name.toLowerCase()];
      if (oldSkill) {
        //Actor has old skill.
        skill.data.skillDice = oldSkill.dice;
        skill.data.ownedLevel = oldSkill.value;
        skill.data.score = oldSkill.stat;
      }
    }
    // want to delete the old skills or leave? 
    // if delete, likely need to return a tuple
    updateData = primarySkills;
  }
  return updateData;
}

async function migrateSceneData(scene) {
  const tokens = scene.tokens.map(async token => {
    const t = token.toJSON();

    if (!t.actorLink) {
      const actor = foundry.utils.duplicate(t);
      actor.type = t.actor?.type;
      const updateData = migrateActorDataToItemSkills(actor);
      if (updateData && updateData.length) {
        await t.actor.createEmbeddedDocuments("Item", updateData);
        //mergeObject(t.actorData, update);
      }
    }
    return t;
  });

  return { tokens };
}