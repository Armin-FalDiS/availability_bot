const { Telegraf } = require('telegraf');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL;

// Only start bot if BOT_TOKEN is provided (optional for local testing)
if (!BOT_TOKEN) {
  console.warn('⚠️  BOT_TOKEN not provided - Telegram bot will not start (OK for local testing)');
  module.exports = null;
} else if (!WEB_APP_URL) {
  console.warn('⚠️  WEB_APP_URL not provided - Telegram bot will not start (OK for local testing)');
  module.exports = null;
} else {
  const bot = new Telegraf(BOT_TOKEN);

  // Parse allowed user IDs from environment variable (comma-separated)
  const ALLOWED_USER_IDS = process.env.ALLOWED_USER_IDS
    ? process.env.ALLOWED_USER_IDS.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
    : null;

  // Check if user is whitelisted (returns true if whitelist is not enabled)
  function isUserWhitelisted(userId) {
    // If no whitelist is configured, allow all users
    if (!ALLOWED_USER_IDS || ALLOWED_USER_IDS.length === 0) {
      return true;
    }
    // Check if user ID is in the whitelist
    return ALLOWED_USER_IDS.includes(userId);
  }

  // Start command handler
  bot.command('start', (ctx) => {
    const userId = ctx.from.id;
    
    // Check whitelist - silently ignore if not whitelisted
    if (!isUserWhitelisted(userId)) {
      console.error('[Bot] User not whitelisted - /start command:', userId);
      return; // Don't respond at all
    }

    ctx.reply('Welcome to the Availability Bot!', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Open Availability Calendar',
              web_app: { url: WEB_APP_URL }
            }
          ]
        ]
      }
    });
  });

  // Launch bot
  bot.launch().then(() => {
    console.log('Bot is running...');
    if (ALLOWED_USER_IDS && ALLOWED_USER_IDS.length > 0) {
      console.log(`🔒 Whitelist enabled: ${ALLOWED_USER_IDS.length} user(s) allowed`);
    }
  });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  module.exports = bot;
}
