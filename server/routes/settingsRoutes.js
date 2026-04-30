const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { DISCORD_BOT_TOKEN, dataDir } = require('../config');
const { readDb, writeDb } = require('../services/dbService');
const { appendLog } = require('../services/logService');
const {
  stopBotForUser,
  startBotForUser,
  hasActiveBotForUser,
  updateBotPresenceForUser,
} = require('../services/botService');
const { createDefaultSettings, defaultFeatures } = require('../utils/defaults');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

const BRANDING_DIR = path.join(dataDir, 'general');
const BRANDING_FILE = path.join(BRANDING_DIR, 'branding.json');
function defaultBranding() {
  return {
    app_name: 'BotPanel',
    app_icon_file: null,
    updated_at: new Date().toISOString(),
  };
}

async function ensureBrandingFile() {
  await fsp.mkdir(BRANDING_DIR, { recursive: true });
  if (!fs.existsSync(BRANDING_FILE)) {
    await fsp.writeFile(BRANDING_FILE, JSON.stringify(defaultBranding(), null, 2), 'utf8');
  }
}

async function readBranding() {
  await ensureBrandingFile();
  try {
    const raw = await fsp.readFile(BRANDING_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      app_name: String(parsed?.app_name || '').trim() || 'BotPanel',
      app_icon_file: String(parsed?.app_icon_file || '').trim() || null,
      updated_at: String(parsed?.updated_at || new Date().toISOString()),
    };
  } catch {
    return defaultBranding();
  }
}

async function writeBranding(nextBranding) {
  await ensureBrandingFile();
  await fsp.writeFile(BRANDING_FILE, JSON.stringify(nextBranding, null, 2), 'utf8');
}

function parseImageDataUrl(dataUrl) {
  const value = String(dataUrl || '').trim();
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const mime = match[1].toLowerCase();
  const extensionByMime = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  const extension = extensionByMime[mime];
  if (!extension) {
    return null;
  }

  return {
    extension,
    buffer: Buffer.from(match[2], 'base64'),
  };
}

async function deleteBrandingIcon() {
  const possibleFiles = ['png', 'jpg', 'jpeg', 'webp', 'gif'].map((extension) => path.join(BRANDING_DIR, `icon.${extension}`));
  await Promise.all(possibleFiles.map((filePath) => fsp.rm(filePath, { force: true })));
}

async function writeBrandingIcon(dataUrl) {
  const parsed = parseImageDataUrl(dataUrl);
  await fsp.mkdir(BRANDING_DIR, { recursive: true });

  if (!parsed) {
    return null;
  }

  await deleteBrandingIcon();

  const iconPath = path.join(BRANDING_DIR, `icon.${parsed.extension}`);
  await fsp.writeFile(iconPath, parsed.buffer);
  return `icon.${parsed.extension}`;
}

router.get('/', requireAuth, requirePermission('read'), async (req, res) => {
  const db = await readDb();
  const userId = req.session.userId;

  if (!db.settingsByUser[userId]) {
    db.settingsByUser[userId] = createDefaultSettings(userId);
    db.featuresByUser[userId] = defaultFeatures();
    db.logsByUser[userId] = [];
    await writeDb(db);
  }

  const current = db.settingsByUser[userId];
  if (current && !current.is_online && hasActiveBotForUser(userId)) {
    await stopBotForUser(userId);
    appendLog(db, userId, 'info', 'Bot process was still active and has been synced with saved offline status.');
    await writeDb(db);
  }

  if (current?.is_online && !hasActiveBotForUser(userId)) {
    const effectiveBotToken = String(current.bot_token || '').trim() || DISCORD_BOT_TOKEN;

    if (!effectiveBotToken) {
      current.is_online = false;
      current.updated_at = new Date().toISOString();
      appendLog(db, userId, 'error', 'Bot marked as offline after restart: No bot token set.');
      await writeDb(db);
    } else {
      try {
        await startBotForUser(userId, effectiveBotToken);
        appendLog(db, userId, 'info', 'Bot automatically reconnected after restart.');
        await writeDb(db);
      } catch (error) {
        current.is_online = false;
        current.updated_at = new Date().toISOString();
        const msg = error instanceof Error ? error.message : 'Unknown error';
        appendLog(db, userId, 'error', `Auto-reconnect after restart failed: ${msg}`);
        await writeDb(db);
      }
    }
  }

  return res.json(db.settingsByUser[userId]);
});

router.get('/branding', requireAuth, requirePermission('read'), async (_req, res) => {
  const branding = await readBranding();
  const iconExists = branding.app_icon_file && fs.existsSync(path.join(BRANDING_DIR, branding.app_icon_file));

  return res.json({
    app_name: branding.app_name,
    icon_url: iconExists ? `/api/settings/branding/icon?v=${encodeURIComponent(branding.updated_at)}` : null,
    updated_at: branding.updated_at,
  });
});

router.get('/branding/icon', requireAuth, requirePermission('read'), async (_req, res) => {
  const branding = await readBranding();
  if (!branding.app_icon_file) {
    return res.status(404).json({ error: 'Kein App-Icon vorhanden.' });
  }

  const iconPath = path.join(BRANDING_DIR, branding.app_icon_file);
  if (!fs.existsSync(iconPath)) {
    return res.status(404).json({ error: 'Kein App-Icon vorhanden.' });
  }

  return res.sendFile(iconPath);
});

router.patch('/', requireAuth, requirePermission('write'), async (req, res) => {
  const db = await readDb();
  const userId = req.session.userId;
  const current = db.settingsByUser[userId] || createDefaultSettings(userId);
  const updates = req.body || {};
  const hasActiveBot = hasActiveBotForUser(userId);

  const next = {
    ...current,
    ...updates,
    command_prefix: '/',
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  if (Array.isArray(next.bot_profiles)) {
    next.bot_profiles = next.bot_profiles.map((profile) => ({
      ...profile,
      command_prefix: '/',
    }));
  }

  db.settingsByUser[userId] = next;

  const currentToken = String(current.bot_token || '').trim();
  const nextToken = String(next.bot_token || '').trim();
  const tokenChanged = nextToken !== currentToken;
  const turningOn = next.is_online && !current.is_online;
  const turningOff = !next.is_online && (current.is_online || hasActiveBot);
  const needsRestart = next.is_online && tokenChanged;

  if (turningOn || needsRestart) {
    const effectiveBotToken = nextToken || DISCORD_BOT_TOKEN;

    if (!effectiveBotToken) {
      next.is_online = false;
      appendLog(db, userId, 'error', 'Bot could not be started: No bot token set.');
      db.settingsByUser[userId] = next;
      await writeDb(db);
      return res.status(400).json({ error: 'Bot token missing. Please set it in settings.' });
    }

    try {
      await startBotForUser(userId, effectiveBotToken);
      await updateBotPresenceForUser(userId, {
        status: next.bot_status || 'online',
        activity_type: next.bot_activity_type || 'Playing',
        activity_text: next.bot_activity_text || '',
      });
      if (turningOn) {
        appendLog(db, userId, 'success', 'Bot started.');
      } else if (tokenChanged) {
        appendLog(db, userId, 'info', 'Bot reconnected with new token.');
      }
    } catch (error) {
      next.is_online = false;
      db.settingsByUser[userId] = next;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      appendLog(db, userId, 'error', `Bot start failed: ${msg}`);
      await writeDb(db);
      return res.status(400).json({ error: `Bot could not be started: ${msg}` });
    }
  } else if (turningOff) {
    await stopBotForUser(userId);
    appendLog(db, userId, 'warn', 'Bot stopped.');
  } else if (next.is_online && hasActiveBot) {
    // Bot is already running with same token — just update presence
    try {
      await updateBotPresenceForUser(userId, {
        status: next.bot_status || 'online',
        activity_type: next.bot_activity_type || 'Playing',
        activity_text: next.bot_activity_text || '',
      });
    } catch {
      // ignore presence update failures
    }
  }

  await writeDb(db);
  return res.json(next);
});

router.patch('/branding', requireAuth, requirePermission('admin'), async (req, res) => {
  const { appName, iconDataUrl } = req.body || {};
  const current = await readBranding();
  const next = { ...current };

  if (appName !== undefined) {
    const normalizedName = String(appName).trim();
    if (!normalizedName) {
      return res.status(400).json({ error: 'App name must not be empty.' });
    }
    next.app_name = normalizedName;
  }

  if (iconDataUrl !== undefined) {
    const normalizedIcon = String(iconDataUrl || '').trim();
    if (normalizedIcon.length > 1_500_000) {
      return res.status(400).json({ error: 'App icon is too large. Please use an image under 1 MB.' });
    }

    if (normalizedIcon) {
      const iconFile = await writeBrandingIcon(normalizedIcon);
      if (!iconFile) {
        return res.status(400).json({ error: 'App icon must be an image in data URL format.' });
      }
      next.app_icon_file = iconFile;
    } else {
      await deleteBrandingIcon();
      next.app_icon_file = null;
    }
  }

  next.updated_at = new Date().toISOString();
  await writeBranding(next);

  return res.json({
    app_name: next.app_name,
    icon_url: next.app_icon_file ? `/api/settings/branding/icon?v=${encodeURIComponent(next.updated_at)}` : null,
    updated_at: next.updated_at,
  });
});

module.exports = {
  settingsRoutes: router,
};
