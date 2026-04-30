const express = require('express');
const session = require('express-session');
const path = require('path');
const { PORT, DISCORD_BOT_TOKEN } = require('./config');
const { corsMiddleware } = require('./middleware/cors');
const { readDb, writeDb } = require('./services/dbService');
const { appendLog } = require('./services/logService');
const { shutdownAllBots, startBotForUser } = require('./services/botService');
const { authRoutes } = require('./routes/authRoutes');
const { accountRoutes } = require('./routes/accountRoutes');
const { settingsRoutes } = require('./routes/settingsRoutes');
const { featuresRoutes } = require('./routes/featuresRoutes');
const { logsRoutes } = require('./routes/logsRoutes');
const { discordRoutes } = require('./routes/discordRoutes');
const { gamesRoutes } = require('./routes/gamesRoutes');
const { soundboardRoutes } = require('./routes/soundboardRoutes');
const { languageRoutes } = require('./routes/languageRoutes');

const app = express();

const crypto = require('crypto');

app.use(express.json({ limit: '50mb' }));
app.use(
  session({
    name: 'botpanel.sid',
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);
app.use(corsMiddleware);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/features', featuresRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/discord', discordRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/soundboard', soundboardRoutes);
app.use('/api/languages', languageRoutes);

// Serve built frontend in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

async function recoverBotsOnStartup() {
  const db = await readDb();
  const entries = Object.entries(db.settingsByUser || {});

  let recovered = 0;
  let failed = 0;

  for (const [userId, settings] of entries) {
    if (!settings?.is_online) {
      continue;
    }

    const token = String(settings.bot_token || '').trim() || DISCORD_BOT_TOKEN;
    if (!token) {
      settings.is_online = false;
      settings.updated_at = new Date().toISOString();
      appendLog(db, userId, 'error', 'Bot marked as offline after restart: No bot token set.');
      failed += 1;
      continue;
    }

    try {
      await startBotForUser(userId, token);
      appendLog(db, userId, 'info', 'Bot automatically reconnected on API start.');
      recovered += 1;
    } catch (error) {
      settings.is_online = false;
      settings.updated_at = new Date().toISOString();
      const msg = error instanceof Error ? error.message : 'Unknown error';
      appendLog(db, userId, 'error', `Auto-reconnect on API start failed: ${msg}`);
      failed += 1;
    }
  }

  if (recovered > 0 || failed > 0) {
    await writeDb(db);
  }

  if (recovered > 0 || failed > 0) {
    console.log(`Bot-Recovery: ${recovered} connected, ${failed} failed.`);
  }
}

app.listen(PORT, async () => {
  await recoverBotsOnStartup();
  console.log(`API laeuft auf http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  await shutdownAllBots();
  process.exit(0);
});
