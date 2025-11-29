const fs = require('fs').promises;
const path = require('path');
const { FileMigrationProvider, Migrator } = require('kysely');
const { db } = require('./db');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Run all pending migrations using Kysely
 */
async function runMigrations() {
  try {
    const migrationProvider = new FileMigrationProvider({
      fs,
      path,
      migrationFolder: MIGRATIONS_DIR,
    });

    const migrator = new Migrator({
      db,
      provider: migrationProvider,
    });

    const { error, results } = await migrator.migrateToLatest();

    results?.forEach((it) => {
      if (it.status === 'Success') {
        console.log(`✓ Migration "${it.migrationName}" executed successfully`);
      } else if (it.status === 'Error') {
        console.error(`✗ Failed to execute migration "${it.migrationName}"`);
        console.error(it.error);
      }
    });

    if (error) {
      console.error('Failed to migrate');
      console.error(error);
      if (require.main === module) {
        process.exit(1);
      }
      throw error;
    }

    if (results && results.length === 0) {
      console.log('No pending migrations.');
    } else {
      console.log('All migrations completed successfully.');
    }

    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    if (require.main === module) {
      process.exit(1);
    }
    throw error;
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      db.destroy();
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      db.destroy();
      process.exit(1);
    });
}

module.exports = { runMigrations };
