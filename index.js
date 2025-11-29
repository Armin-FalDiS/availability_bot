// Start both bot and server
function start() {
  // Only start bot if it's available (BOT_TOKEN provided)
  const bot = require('./bot.js');
  if (bot) {
    console.log('Telegram bot initialized');
  }
  
  require('./server.js');
}

start();

// Keep process alive
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});
