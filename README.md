# Telegram Availability Bot

A Telegram bot with Mini App interface for team availability scheduling. Users can mark their hourly availability for the next 8 days using color-coded slots.

## Features

- **8-Day Calendar View**: Shows today through 7 days later (8 days total)
- **Hourly Slots**: 24-hour grid for each day
- **Color Coding**: 
  - 🟢 Green: Available
  - 🟡 Yellow: Maybe
  - 🔴 Red: Unavailable (default)
- **Team View**: See all team members' availability in one calendar
- **Telegram Mini App**: Native Telegram integration with secure authentication

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Public URL for hosting the Mini App (required for Telegram Web Apps)

## Setup

### 1. Clone and Install

```bash
npm install
```

### 2. Database Setup

Create a PostgreSQL database. Migrations will run automatically on startup when you run `npm start`, or you can run them manually:

```bash
# Automatic (runs migrations then starts bot + server)
npm start

# Or run migrations only
npm run migrate
```

The migration system uses Kysely's built-in migration framework:
- Migrations are JavaScript files in the `migrations/` directory
- Each migration exports `up` and `down` functions
- Kysely automatically tracks executed migrations
- Only executes each migration once

### 3. Environment Variables

Create a `.env` file with the following variables:

```env
BOT_TOKEN=your_telegram_bot_token_here
DATABASE_URL=postgresql://user:password@localhost:5432/availability_db
PORT=3000
WEB_APP_URL=https://your-domain.com
# Optional: Comma-separated list of allowed Telegram user IDs (e.g., "123456789,987654321")
# If not set, all users will have access
ALLOWED_USER_IDS=
```

### 4. Configure Telegram Bot

1. Create a bot with [@BotFather](https://t.me/BotFather)
2. Get your bot token
3. Set up the Mini App:
   - Send `/newapp` to BotFather
   - Select your bot
   - Provide the Mini App title
   - Provide the Mini App URL (your `WEB_APP_URL`)
   - Optionally upload a photo

### 5. Run the Application

**Development:**
```bash
# This runs migrations, then starts both bot and server
npm start
```

The application uses `index.js` as the entry point, which:
1. Runs database migrations automatically
2. Starts the Telegram bot (if `BOT_TOKEN` is provided)
3. Starts the Express server

**Development Mode:**
- If `BOT_TOKEN` is not set, the app runs in development mode
- In dev mode, Telegram verification is disabled
- A mock user (ID: 999999) is used for testing
- You can test the web interface at `http://localhost:PORT` without Telegram
- The bot will not start if `BOT_TOKEN` is missing (this is expected)

**Production with Docker:**
```bash
docker build -t availability-bot .
docker run -d --env-file .env -p 3000:3000 availability-bot
```

## Usage

1. Start a chat with your bot on Telegram
2. Send `/start` command
3. Click "Open Availability Calendar" button
4. For each hour, click the status button (Green/Yellow/Red) to set your availability
5. All team members can see each other's availability in the "Team Overview" view

## Project Structure

```
.
├── index.js            # Main entry point (runs migrations, starts bot + server)
├── bot.js              # Telegram bot setup
├── server.js           # Express server and API
├── db.js               # Database functions (using Kysely)
├── migrate.js          # Migration runner (using Kysely)
├── migrations/         # JavaScript migration files
│   └── 20241129_001_initial_schema.js
├── public/
│   ├── index.html      # Mini App frontend HTML
│   ├── app.js          # Frontend JavaScript (Alpine.js)
│   └── styles.css      # Frontend styles
├── schema.sql          # SQL schema (reference, migrations are preferred)
├── env.example         # Example environment variables
├── Dockerfile          # Docker configuration
├── package.json        # Dependencies
└── README.md           # This file
```

## API Endpoints

- `GET /api/user` - Get current user info (requires Telegram init data header)
- `GET /api/availability?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - Get availability for date range (requires Telegram init data header)
- `POST /api/availability` - Save availability slot (requires Telegram init data header)

All API endpoints require the `x-telegram-init-data` header for authentication. The frontend automatically includes this header when running in Telegram WebApp.

## Database Schema

- **users**: Stores Telegram user information
- **availability**: Stores hourly availability slots with status

## Technology Stack

- **Backend**: Node.js with Express
- **Database**: PostgreSQL with Kysely (type-safe SQL query builder)
- **Bot Framework**: Telegraf
- **Frontend**: Alpine.js + Shoelace Web Components

## Security

- **Telegram Authentication**: The application verifies Telegram WebApp init data using HMAC-SHA256 to ensure requests are coming from legitimate Telegram clients.
- **Optional Whitelist**: You can restrict access to specific users by setting the `ALLOWED_USER_IDS` environment variable with a comma-separated list of Telegram user IDs. If not set, all authenticated users have access.
  - To find a user's Telegram ID, they can message [@userinfobot](https://t.me/userinfobot) on Telegram
  - Non-whitelisted users receive no response (silent failure) but access attempts are logged on the server

## License

ISC
