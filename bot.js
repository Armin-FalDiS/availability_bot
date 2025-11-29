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

  // Start command handler
  bot.command('start', (ctx) => {
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
  });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  module.exports = bot;
}
