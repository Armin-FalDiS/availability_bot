const { sql } = require('kysely');

/**
 * @param { import("kysely").Kysely } db
 */
async function up(db) {
  // Users table
  await db.schema
    .createTable('users')
    .addColumn('user_id', 'bigint', (col) => col.primaryKey())
    .addColumn('display_name', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Availability table
  await db.schema
    .createTable('availability')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'bigint', (col) => col.notNull().references('users.user_id').onDelete('cascade'))
    .addColumn('date', 'date', (col) => col.notNull())
    .addColumn('hour', 'integer', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addCheckConstraint('hour_check', sql`hour >= 0 AND hour <= 23`)
    .addCheckConstraint('status_check', sql`status IN ('green', 'yellow', 'red')`)
    .addUniqueConstraint('user_date_hour_unique', ['user_id', 'date', 'hour'])
    .execute();

  // Indexes for performance
  await db.schema
    .createIndex('idx_availability_user_date_hour')
    .on('availability')
    .columns(['user_id', 'date', 'hour'])
    .execute();

  await db.schema
    .createIndex('idx_availability_date')
    .on('availability')
    .column('date')
    .execute();
}

/**
 * @param { import("kysely").Kysely } db
 */
async function down(db) {
  await db.schema.dropTable('availability').execute();
  await db.schema.dropTable('users').execute();
}

module.exports = { up, down };
