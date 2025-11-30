const { Kysely, PostgresDialect, sql } = require('kysely');
const { Pool } = require('pg');
require('dotenv').config();

// Database schema types
const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
});

/**
 * Get or create a user in the database
 * @param {number} userId - Telegram user ID
 * @param {string} displayName - User's display name
 * @returns {Promise<Object>} User object
 */
async function getOrCreateUser(userId, displayName) {
  // Try to get existing user
  const existingUser = await db
    .selectFrom('users')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (existingUser) {
    // Update display name if it changed
    if (existingUser.display_name !== displayName) {
      await db
        .updateTable('users')
        .set({ display_name: displayName })
        .where('user_id', '=', userId)
        .execute();
      return { ...existingUser, display_name: displayName };
    }
    return existingUser;
  }

  // Create new user
  const newUser = await db
    .insertInto('users')
    .values({
      user_id: userId,
      display_name: displayName,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return newUser;
}

/**
 * Get availability for all users within a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of availability records with user info
 */
async function getAvailability(startDate, endDate) {
  const results = await db
    .selectFrom('availability')
    .innerJoin('users', 'availability.user_id', 'users.user_id')
    .select([
      'availability.id',
      'availability.user_id',
      // Format date as YYYY-MM-DD string to avoid timestamp issues
      sql`availability.date::text`.as('date'),
      'availability.hour',
      'availability.status',
      'availability.updated_at',
      'users.display_name',
    ])
    .where('availability.date', '>=', startDate)
    .where('availability.date', '<=', endDate)
    .orderBy('availability.date')
    .orderBy('availability.hour')
    .orderBy('users.display_name')
    .execute();

  // Normalize dates to YYYY-MM-DD format
  return results.map(row => ({
    ...row,
    date: typeof row.date === 'string' && row.date.match(/^\d{4}-\d{2}-\d{2}$/) 
      ? row.date 
      : new Date(row.date).toISOString().split('T')[0]
  }));
}

/**
 * Save or update a user's availability slot
 * @param {number} userId - Telegram user ID
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {number} hour - Hour (0-23)
 * @param {string} status - Status ('green', 'yellow', 'red')
 * @returns {Promise<Object|null>} Saved availability record, or null if deleted
 */
async function saveAvailability(userId, date, hour, status) {
  console.log('[DB] saveAvailability called:', { userId, date, hour, status });
  
  // If status is 'red', delete the record (red is the default)
  if (status === 'red') {
    console.log('[DB] Deleting availability record');
    const deleteResult = await db
      .deleteFrom('availability')
      .where('user_id', '=', userId)
      .where('date', '=', date)
      .where('hour', '=', hour)
      .execute();
    console.log('[DB] Delete result:', deleteResult);
    return null;
  }

  // For green/yellow, upsert the record
  console.log('[DB] Upserting availability record');
  const result = await db
    .insertInto('availability')
    .values({
      user_id: userId,
      date: date,
      hour: hour,
      status: status,
      updated_at: new Date(),
    })
    .onConflict((oc) => oc
      .columns(['user_id', 'date', 'hour'])
      .doUpdateSet({
        status: status,
        updated_at: new Date(),
      })
    )
    .returningAll()
    .executeTakeFirstOrThrow();

  console.log('[DB] Upsert result:', result);
  return result;
}

/**
 * Batch save multiple availability slots
 * @param {number} userId - Telegram user ID
 * @param {Array<{date: string, hour: number, status: string}>} slots - Array of slots to save
 * @returns {Promise<Array>} Array of saved availability records
 */
async function batchSaveAvailability(userId, slots) {
  console.log('[DB] batchSaveAvailability called:', { userId, slotCount: slots.length });
  
  if (!slots || slots.length === 0) {
    return [];
  }
  
  const now = new Date();
  const slotsToInsert = [];
  const slotsToDelete = [];
  
  // Separate slots into inserts/updates vs deletes
  for (const slot of slots) {
    if (slot.status === 'red') {
      slotsToDelete.push({ date: slot.date, hour: slot.hour });
    } else {
      slotsToInsert.push({
        user_id: userId,
        date: slot.date,
        hour: slot.hour,
        status: slot.status,
        updated_at: now,
      });
    }
  }
  
  // Delete red status slots
  if (slotsToDelete.length > 0) {
    console.log('[DB] Deleting', slotsToDelete.length, 'red status slots');
    for (const slot of slotsToDelete) {
      await db
        .deleteFrom('availability')
        .where('user_id', '=', userId)
        .where('date', '=', slot.date)
        .where('hour', '=', slot.hour)
        .execute();
    }
  }
  
  // Batch insert/update green/yellow slots
  if (slotsToInsert.length > 0) {
    console.log('[DB] Upserting', slotsToInsert.length, 'slots');
    // Use a transaction or batch insert with conflict handling
    const results = [];
    for (const slot of slotsToInsert) {
      const result = await db
        .insertInto('availability')
        .values(slot)
        .onConflict((oc) => oc
          .columns(['user_id', 'date', 'hour'])
          .doUpdateSet({
            status: slot.status,
            updated_at: now,
          })
        )
        .returningAll()
        .executeTakeFirstOrThrow();
      results.push(result);
    }
    console.log('[DB] Batch upsert completed, saved', results.length, 'slots');
    return results;
  }
  
  return [];
}

module.exports = {
  db,
  getOrCreateUser,
  getAvailability,
  saveAvailability,
  batchSaveAvailability,
};
