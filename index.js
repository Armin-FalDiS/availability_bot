const { runMigrations } = require('./migrate');

// Start both bot and server after migrations
async function start() {
  try {
    console.log('Running database migrations...');
    await runMigrations();
    console.log('Migrations completed, starting application...');
    
    // Only start bot if it's available (BOT_TOKEN provided)
    const bot = require('./bot.js');
    if (bot) {
      console.log('Telegram bot initialized');
    }
    
    require('./server.js');
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

start();

// Keep process alive
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});
