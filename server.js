const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Development mode: skip Telegram verification if BOT_TOKEN is not set
const DEV_MODE = !process.env.BOT_TOKEN;

// Verify Telegram WebApp init data
function verifyTelegramWebAppData(initData) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  // In development mode without BOT_TOKEN, allow requests
  if (DEV_MODE) {
    return true;
  }
  
  if (!BOT_TOKEN) {
    return false;
  }

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  if (!hash) {
    return false;
  }
  
  urlParams.delete('hash');

  // Sort parameters and create data check string
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Create secret key
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  // Calculate hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return calculatedHash === hash;
}

// Parse init data
function parseInitData(initData) {
  const urlParams = new URLSearchParams(initData);
  const userStr = urlParams.get('user');
  if (!userStr) return null;
  return JSON.parse(userStr);
}

// API: Get current user from Telegram WebApp init data
app.get('/api/user', async (req, res) => {
  try {
    const initData = req.headers['x-telegram-init-data'];
    
    // In development mode, create a mock user if no init data
    if (DEV_MODE && !initData) {
      const mockUser = await db.getOrCreateUser(999999, 'Test User');
      return res.json(mockUser);
    }
    
    if (!initData) {
      return res.status(401).json({ error: 'Missing Telegram init data' });
    }

    if (!verifyTelegramWebAppData(initData)) {
      return res.status(401).json({ error: 'Invalid Telegram init data' });
    }

    const userData = parseInitData(initData);
    if (!userData) {
      return res.status(400).json({ error: 'Invalid user data' });
    }

    const user = await db.getOrCreateUser(userData.id, userData.first_name || userData.username || 'User');
    res.json(user);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Get availability for date range
app.get('/api/availability', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    }

    const availability = await db.getAvailability(startDate, endDate);
    res.json(availability);
  } catch (error) {
    console.error('Error getting availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Save availability slot
app.post('/api/availability', async (req, res) => {
  try {
    console.log('[Backend] POST /api/availability - Request body:', req.body);
    console.log('[Backend] Headers:', { 'x-telegram-init-data': req.headers['x-telegram-init-data'] ? 'present' : 'missing' });
    
    const initData = req.headers['x-telegram-init-data'];
    let userData;
    
    // In development mode, use mock user if no init data
    if (DEV_MODE && !initData) {
      userData = { id: 999999, first_name: 'Test User' };
      console.log('[Backend] Using dev mode mock user:', userData);
    } else {
      if (!initData) {
        console.error('[Backend] Missing Telegram init data');
        return res.status(401).json({ error: 'Missing Telegram init data' });
      }

      if (!verifyTelegramWebAppData(initData)) {
        console.error('[Backend] Invalid Telegram init data');
        return res.status(401).json({ error: 'Invalid Telegram init data' });
      }

      userData = parseInitData(initData);
      if (!userData) {
        console.error('[Backend] Invalid user data');
        return res.status(400).json({ error: 'Invalid user data' });
      }
      console.log('[Backend] Parsed user data:', userData);
    }

    const { date, hour, status } = req.body;
    console.log('[Backend] Parsed request:', { date, hour, status });
    
    if (!date || hour === undefined || !status) {
      console.error('[Backend] Missing required fields');
      return res.status(400).json({ error: 'date, hour, and status are required' });
    }

    if (!['green', 'yellow', 'red'].includes(status)) {
      console.error('[Backend] Invalid status:', status);
      return res.status(400).json({ error: 'Invalid status. Must be green, yellow, or red' });
    }

    if (hour < 0 || hour > 23) {
      console.error('[Backend] Invalid hour:', hour);
      return res.status(400).json({ error: 'Hour must be between 0 and 23' });
    }

    // Ensure user exists
    console.log('[Backend] Getting/creating user:', userData.id);
    await db.getOrCreateUser(userData.id, userData.first_name || userData.username || 'User');

    console.log('[Backend] Saving availability:', { userId: userData.id, date, hour, status });
    const availability = await db.saveAvailability(userData.id, date, hour, status);
    console.log('[Backend] saveAvailability result:', availability);
    
    // If status is 'red', the record was deleted, return a success response
    if (status === 'red') {
      const response = { 
        user_id: userData.id, 
        date, 
        hour, 
        status: 'red',
        deleted: true 
      };
      console.log('[Backend] Returning deletion response:', response);
      return res.json(response);
    }
    
    console.log('[Backend] Returning availability:', availability);
    res.json(availability);
  } catch (error) {
    console.error('Error saving availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (DEV_MODE) {
    console.log('⚠️  Development mode: Telegram verification disabled (BOT_TOKEN not set)');
    console.log('   You can test the web interface at http://localhost:' + PORT);
  }
});

module.exports = app;
