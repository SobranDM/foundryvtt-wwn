/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @returns {Promise}      A Promise which resolves once the migration is completed
 */
 export const migrateWorld = async function() {
    ui.notifications.info(`Applying WWN System Migration for version ${game.system.data.version}. Please be patient and do not close your game or shut down your server.`, {permanent: true});
 
  // Set the migration as complete
  game.settings.set("wwn", "systemMigrationVersion", game.system.data.version);
  ui.notifications.info(`WWN System Migration to version ${game.system.data.version} completed!`, {permanent: true});
};