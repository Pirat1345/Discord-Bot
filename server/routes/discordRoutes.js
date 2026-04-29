const express = require('express');
const { DISCORD_BOT_TOKEN } = require('../config');
const { readDb, writeDb, readUserDms, writeUserDms } = require('../services/dbService');
const { appendLog } = require('../services/logService');
const {
  getGuildsForUser,
  getGuildStatsForUser,
  getBotRuntimeProfileForUser,
  updateBotPresenceForUser,
  hasActiveBotForUser,
  getActiveClientForUser,
} = require('../services/botService');
const { createDefaultGuildConfig, defaultFeatures } = require('../utils/defaults');
const { cleanupGuildByRest } = require('../dc-funktions/debug/cleaner');
const { sendDiscordMessageViaRest, sendDiscordDmViaRest } = require('../dc-funktions/debug/test-message');
const { setCountingChannelForGuild, announceCountingStarted, normalizeConfig: normalizeCountingConfig } = require('../dc-funktions/games/counting');
const { sendWelcomeTestForGuild } = require('../dc-funktions/community/welcome-messages');
const { postFreeGamesForGuild } = require('../dc-funktions/news/free-games');
const { postMinecraftStatusForGuild, fetchServerStatus, buildStatusEmbed } = require('../dc-funktions/community/minecraft-status');
const { addToQueue, skipSong, stopPlayback, getQueue, getMusicStatusForGuild } = require('../dc-funktions/community/music-player');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = express.Router();

function ensureGuildConfig(db, userId, guildId) {
  let created = false;
  let updated = false;

  if (!db.guildConfigsByUser[userId]) {
    db.guildConfigsByUser[userId] = {};
  }

  if (!db.guildConfigsByUser[userId][guildId]) {
    db.guildConfigsByUser[userId][guildId] = createDefaultGuildConfig(userId, guildId);
    created = true;
  } else {
    const existingConfig = db.guildConfigsByUser[userId][guildId];
    const existingFeatures = Array.isArray(existingConfig.features) ? existingConfig.features : [];
    const defaults = defaultFeatures();

    const mergedFeatures = defaults.map((defaultFeature) => {
      const existingFeature = existingFeatures.find((entry) => entry?.feature_key === defaultFeature.feature_key);
      if (!existingFeature) {
        return defaultFeature;
      }

      return {
        ...existingFeature,
        name: defaultFeature.name,
        description: defaultFeature.description,
      };
    });

    const existingFeatureKeys = new Set(existingFeatures.map((entry) => entry?.feature_key));
    const hasNewFeatures =
      mergedFeatures.length !== existingFeatures.length
      || defaults.some((feature) => !existingFeatureKeys.has(feature.feature_key))
      || mergedFeatures.some((feature) => {
        const current = existingFeatures.find((entry) => entry?.feature_key === feature.feature_key);
        return current && (current.name !== feature.name || current.description !== feature.description);
      });

    if (hasNewFeatures) {
      existingConfig.features = mergedFeatures;
      updated = true;
    }
  }

  return {
    config: db.guildConfigsByUser[userId][guildId],
    created,
    updated,
  };
}

function getCachedServersForUser(db, userId) {
  if (!Array.isArray(db.guildCacheByUser?.[userId]?.servers)) {
    return [];
  }

  return db.guildCacheByUser[userId].servers;
}

async function resolveServerForUser(db, userId, guildId) {
  const cached = getCachedServersForUser(db, userId).find((entry) => entry.id === guildId);
  if (cached) {
    return cached;
  }

  const liveServers = await getGuildsForUser(userId);
  if (liveServers.length > 0) {
    db.guildCacheByUser[userId] = {
      servers: liveServers,
      updated_at: new Date().toISOString(),
    };
    const liveTarget = liveServers.find((entry) => entry.id === guildId);
    if (liveTarget) {
      return liveTarget;
    }
  }

  return null;
}

function resolveKnownServerFallback(db, userId, guildId) {
  const cached = getCachedServersForUser(db, userId).find((entry) => entry.id === guildId);
  if (cached) {
    return cached;
  }

  const hasStoredConfig = Boolean(db.guildConfigsByUser?.[userId]?.[guildId]);
  if (hasStoredConfig) {
    return {
      id: guildId,
      name: `Server ${guildId}`,
      icon_url: null,
    };
  }

  return null;
}

async function resolveServerForUserLenient(db, userId, guildId) {
  const target = await resolveServerForUser(db, userId, guildId);
  if (target) {
    return target;
  }

  return resolveKnownServerFallback(db, userId, guildId);
}

function getEffectiveBotToken(settings) {
  return String(settings?.bot_token || '').trim() || DISCORD_BOT_TOKEN;
}

function sanitizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (['online', 'idle', 'dnd', 'invisible'].includes(status)) {
    return status;
  }
  return 'online';
}

function sanitizeActivityType(value) {
  const normalized = String(value || '').trim();
  const allowed = ['Playing', 'Streaming', 'Listening', 'Watching', 'Competing'];
  return allowed.includes(normalized) ? normalized : 'Playing';
}

function buildBotProfileResponse(settings, runtimeProfile) {
  return {
    username: runtimeProfile?.username || '',
    avatar_url: runtimeProfile?.avatar_url || null,
    description: String(runtimeProfile?.description || settings?.bot_description || ''),
    status: sanitizeStatus(runtimeProfile?.status || settings?.bot_status || 'online'),
    activity_type: sanitizeActivityType(runtimeProfile?.activity_type || settings?.bot_activity_type || 'Playing'),
    activity_text: String(runtimeProfile?.activity_text || settings?.bot_activity_text || ''),
    is_online: Boolean(settings?.is_online),
  };
}

router.get('/bot/profile', requireAuth, requirePermission('read'), async (req, res) => {
  const userId = req.session.userId;
  const db = await readDb();
  const settings = db.settingsByUser[userId];

  if (!settings) {
    return res.status(404).json({ error: 'Bot-Einstellungen nicht gefunden.' });
  }

  const runtimeProfile = getBotRuntimeProfileForUser(userId);
  const effectiveToken = getEffectiveBotToken(settings);

  let username = runtimeProfile?.username;
  let avatarUrl = runtimeProfile?.avatar_url;
  let remoteDescription = '';

  if (!username && effectiveToken) {
    try {
      const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bot ${effectiveToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const body = await response.json();
        username = body?.username || username || '';
        avatarUrl = body?.avatar
          ? `https://cdn.discordapp.com/avatars/${body.id}/${body.avatar}.png?size=256`
          : avatarUrl || null;
        remoteDescription = String(body?.bio || '').trim();
      }
    } catch {
      // ignore remote profile fetch failures
    }

    // Fallback: for many bots the visible profile text is the application description.
    if (!remoteDescription) {
      try {
        const appResponse = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
          headers: {
            Authorization: `Bot ${effectiveToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (appResponse.ok) {
          const appBody = await appResponse.json();
          remoteDescription = String(appBody?.description || '').trim();
        }
      } catch {
        // ignore app profile fetch failures
      }
    }
  }

  return res.json({
    ...buildBotProfileResponse(settings, { ...runtimeProfile, description: remoteDescription }),
    username: username || 'Unbekannt',
    avatar_url: avatarUrl || null,
  });
});

router.patch('/bot/profile', requireAuth, requirePermission('write'), async (req, res) => {
  const userId = req.session.userId;
  const { username, avatarDataUrl, description, botToken: explicitBotToken } = req.body || {};
  const db = await readDb();
  const settings = db.settingsByUser[userId];

  if (!settings) {
    return res.status(404).json({ error: 'Bot-Einstellungen nicht gefunden.' });
  }

  if (description !== undefined) {
    settings.bot_description = String(description || '');
    settings.updated_at = new Date().toISOString();
  }

  // Use explicit token if provided (for inactive bot profiles), otherwise use active bot token
  const effectiveBotToken = String(explicitBotToken || '').trim() || getEffectiveBotToken(settings);
  const hasRemoteProfileUpdate = username !== undefined || avatarDataUrl !== undefined;

  if (hasRemoteProfileUpdate) {
    if (!effectiveBotToken) {
      return res.status(400).json({ error: 'Kein Bot-Token gesetzt.' });
    }

    const payload = {};
    if (username !== undefined) {
      const nextUsername = String(username || '').trim();
      if (nextUsername.length < 2 || nextUsername.length > 32) {
        return res.status(400).json({ error: 'Bot-Name muss zwischen 2 und 32 Zeichen lang sein.' });
      }
      payload.username = nextUsername;
    }
    if (avatarDataUrl !== undefined) {
      payload.avatar = String(avatarDataUrl || '').trim() || null;
    }
    if (description !== undefined) {
      payload.bio = String(description || '').trim();
    }

    const response = await fetch('https://discord.com/api/v10/users/@me', {
      method: 'PATCH',
      headers: {
        Authorization: `Bot ${effectiveBotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `Discord API Fehler: ${text}` });
    }
  }

  await writeDb(db);
  const runtimeProfile = getBotRuntimeProfileForUser(userId);
  return res.json(buildBotProfileResponse(settings, runtimeProfile));
});

router.patch('/bot/presence', requireAuth, requirePermission('write'), async (req, res) => {
  const userId = req.session.userId;
  const { status, activity_type, activity_text } = req.body || {};
  const db = await readDb();
  const settings = db.settingsByUser[userId];

  if (!settings) {
    return res.status(404).json({ error: 'Bot-Einstellungen nicht gefunden.' });
  }

  settings.bot_status = sanitizeStatus(status || settings.bot_status || 'online');
  settings.bot_activity_type = sanitizeActivityType(activity_type || settings.bot_activity_type || 'Playing');
  settings.bot_activity_text = String(activity_text || '');
  settings.updated_at = new Date().toISOString();

  if (hasActiveBotForUser(userId)) {
    try {
      await updateBotPresenceForUser(userId, {
        status: settings.bot_status,
        activity_type: settings.bot_activity_type,
        activity_text: settings.bot_activity_text,
      });
    } catch (error) {
      await writeDb(db);
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Status konnte nicht gesetzt werden.',
      });
    }
  }

  await writeDb(db);
  const runtimeProfile = getBotRuntimeProfileForUser(userId);
  return res.json(buildBotProfileResponse(settings, runtimeProfile));
});

router.get('/servers', requireAuth, requirePermission('read'), async (req, res) => {
  const userId = req.session.userId;
  const db = await readDb();
  const liveServers = await getGuildsForUser(userId);

  const attachAssignment = (server) => ({
    ...server,
    bot_profile_id: String(db.guildConfigsByUser?.[userId]?.[server.id]?.settings?.bot_profile_id || '').trim() || null,
  });

  if (liveServers.length > 0) {
    const decoratedServers = liveServers.map(attachAssignment);
    db.guildCacheByUser[userId] = {
      servers: liveServers,
      updated_at: new Date().toISOString(),
    };
    await writeDb(db);
    return res.json({ servers: decoratedServers, source: 'live' });
  }

  const cachedServers = Array.isArray(db.guildCacheByUser?.[userId]?.servers)
    ? db.guildCacheByUser[userId].servers
    : [];

  const servers = cachedServers.map(attachAssignment);
  return res.json({ servers });
});

router.get('/servers/:guildId/config', requireAuth, requirePermission('read'), async (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();

  if (!guildId) {
    return res.status(400).json({ error: 'Ungültige Server-ID.' });
  }

  const db = await readDb();
  const target = await resolveServerForUserLenient(db, userId, guildId);

  if (!target) {
    return res.status(404).json({ error: 'Server nicht gefunden. Stelle sicher, dass der Bot online ist.' });
  }

  const { config: guildConfig, created, updated } = ensureGuildConfig(db, userId, guildId);
  if (created || updated) {
    await writeDb(db);
  }

  return res.json({
    guild: target,
    settings: guildConfig.settings,
    features: guildConfig.features,
  });
});

router.get('/servers/:guildId/stats', requireAuth, requirePermission('read'), async (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();

  if (!guildId) {
    return res.status(400).json({ error: 'Ungültige Server-ID.' });
  }

  const stats = await getGuildStatsForUser(userId, guildId);
  if (!stats) {
    return res.status(404).json({ error: 'Server nicht gefunden. Stelle sicher, dass der Bot online ist.' });
  }

  return res.json(stats);
});

router.patch('/servers/:guildId/settings', requireAuth, requirePermission('write'), async (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();
  const updates = req.body || {};

  if (!guildId) {
    return res.status(400).json({ error: 'Ungültige Server-ID.' });
  }

  const db = await readDb();
  const target = await resolveServerForUserLenient(db, userId, guildId);

  if (!target) {
    return res.status(404).json({ error: 'Server nicht gefunden. Stelle sicher, dass der Bot online ist.' });
  }

  const { config: guildConfig } = ensureGuildConfig(db, userId, guildId);
  guildConfig.settings = {
    ...guildConfig.settings,
    ...updates,
    command_prefix: '/',
    user_id: userId,
    guild_id: guildId,
    updated_at: new Date().toISOString(),
  };

  await writeDb(db);
  return res.json(guildConfig.settings);
});

router.patch('/servers/:guildId/features/:featureId', requireAuth, requirePermission('write'), async (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();
  const featureId = String(req.params.featureId || '').trim();
  const updates = req.body || {};

  if (!guildId || !featureId) {
    return res.status(400).json({ error: 'Ungültige Anfrage.' });
  }

  const db = await readDb();
  const target = await resolveServerForUserLenient(db, userId, guildId);

  if (!target) {
    return res.status(404).json({ error: 'Server nicht gefunden. Stelle sicher, dass der Bot online ist.' });
  }

  const { config: guildConfig } = ensureGuildConfig(db, userId, guildId);
  const feature = guildConfig.features.find((entry) => entry.id === featureId);

  if (!feature) {
    return res.status(404).json({ error: 'Feature nicht gefunden.' });
  }

  const beforeConfig = feature.feature_key === 'counting' ? normalizeCountingConfig(feature.config) : null;

  Object.assign(feature, updates, { updated_at: new Date().toISOString() });

  if (feature.feature_key === 'counting') {
    const nextConfig = normalizeCountingConfig(feature.config);
    const nextChannelId = String(nextConfig.channelId || '').trim();
    const channelChanged = beforeConfig?.channelId !== nextChannelId;

    if (nextChannelId && channelChanged) {
      const result = await setCountingChannelForGuild({
        userId,
        guildId,
        channelId: nextChannelId,
        enable: true,
      });

      const activeClient = getActiveClientForUser(userId);
      if (activeClient) {
        try {
          const channel = await activeClient.channels.fetch(nextChannelId);
          await announceCountingStarted(channel);
        } catch {
          // ignore start announcement errors
        }
      }

      return res.json(result.feature || feature);
    }
  }

  await writeDb(db);

  return res.json(feature);
});

router.post('/servers/:guildId/cleanup', requireAuth, requirePermission('write'), async (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();
  const db = await readDb();
  const settings = db.settingsByUser[userId];

  if (!guildId) {
    return res.status(400).json({ error: 'Ungültige Server-ID.' });
  }

  if (!settings) {
    return res.status(404).json({ error: 'Bot-Einstellungen nicht gefunden.' });
  }

  const target = await resolveServerForUserLenient(db, userId, guildId);
  if (!target) {
    return res.status(404).json({ error: 'Server nicht gefunden.' });
  }

  const token = getEffectiveBotToken(settings);
  if (!token) {
    return res.status(400).json({ error: 'Kein Bot-Token gesetzt.' });
  }

  try {
    const result = await cleanupGuildByRest(guildId, token);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Cleanup fehlgeschlagen.' });
  }
});

router.post('/servers/:guildId/welcome-test', requireAuth, requirePermission('use'), async (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();

  if (!guildId) {
    return res.status(400).json({ error: 'Ungültige Server-ID.' });
  }

  const db = await readDb();
  const target = await resolveServerForUserLenient(db, userId, guildId);
  if (!target) {
    return res.status(404).json({ error: 'Server nicht gefunden.' });
  }

  const activeClient = getActiveClientForUser(userId);
  if (!activeClient) {
    return res.status(400).json({ error: 'Bot ist offline. Starte zuerst den Bot.' });
  }

  try {
    const guild = await activeClient.guilds.fetch(guildId);
    const result = await sendWelcomeTestForGuild({ userId, guild });

    if (!result?.sent) {
      return res.status(400).json({ error: result?.reason || 'Welcome-Test konnte nicht gesendet werden.' });
    }

    return res.json({ ok: true, channel_id: result.channelId || null });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Welcome-Test konnte nicht gesendet werden.',
    });
  }
});

router.post('/servers/:guildId/free-games-test', requireAuth, requirePermission('use'), async (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();

  if (!guildId) {
    return res.status(400).json({ error: 'Ungültige Server-ID.' });
  }

  const db = await readDb();
  const target = await resolveServerForUserLenient(db, userId, guildId);
  if (!target) {
    return res.status(404).json({ error: 'Server nicht gefunden.' });
  }

  const activeClient = getActiveClientForUser(userId);
  if (!activeClient) {
    return res.status(400).json({ error: 'Bot ist offline. Starte zuerst den Bot.' });
  }

  try {
    const guild = await activeClient.guilds.fetch(guildId);
    const result = await postFreeGamesForGuild({ userId, guild });

    if (!result?.sent) {
      return res.status(400).json({ error: result?.reason || 'Free Games konnten nicht gesendet werden.' });
    }

    return res.json({ ok: true, count: result.count, channel_id: result.channelId || null });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Free Games konnten nicht gesendet werden.',
    });
  }
});

router.post('/servers/:guildId/minecraft-status-test', requireAuth, requirePermission('use'), async (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();

  if (!guildId) {
    return res.status(400).json({ error: 'Ungültige Server-ID.' });
  }

  const db = await readDb();
  const target = await resolveServerForUserLenient(db, userId, guildId);
  if (!target) {
    return res.status(404).json({ error: 'Server nicht gefunden.' });
  }

  const activeClient = getActiveClientForUser(userId);
  if (!activeClient) {
    return res.status(400).json({ error: 'Bot ist offline. Starte zuerst den Bot.' });
  }

  try {
    const guild = await activeClient.guilds.fetch(guildId);
    const result = await postMinecraftStatusForGuild({ userId, guild });

    if (!result?.sent) {
      return res.status(400).json({ error: result?.reason || 'Minecraft Status konnte nicht gesendet werden.' });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Minecraft Status konnte nicht gesendet werden.',
    });
  }
});

router.post('/minecraft-status-preview', requireAuth, requirePermission('read'), async (req, res) => {
  const { serverAddress, serverPort, edition } = req.body || {};
  const address = String(serverAddress || '').trim();
  const port = String(serverPort || '').trim();
  const ed = String(edition || 'java').trim();

  if (!address) {
    return res.status(400).json({ error: 'Server-Adresse ist erforderlich.' });
  }

  try {
    const data = await fetchServerStatus(address, port, ed);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Server konnte nicht erreicht werden.',
    });
  }
});

router.post('/send-message', requireAuth, requirePermission('use'), async (req, res) => {
  const { channelId, message, repeatCount, respectRateLimit } = req.body || {};
  const userId = req.session.userId;

  if (!channelId || !message) {
    return res.status(400).json({ error: 'channelId und message sind erforderlich.' });
  }

  const db = await readDb();
  const userSettings = db.settingsByUser[userId];
  const effectiveBotToken = String(userSettings?.bot_token || '').trim() || DISCORD_BOT_TOKEN;

  if (!effectiveBotToken) {
    return res.status(400).json({ error: 'Kein Bot-Token gesetzt (Einstellungen oder DISCORD_BOT_TOKEN).' });
  }

  try {
    const result = await sendDiscordMessageViaRest(
      effectiveBotToken,
      channelId,
      message,
      repeatCount,
      respectRateLimit
    );
    appendLog(
      db,
      userId,
      'success',
      `Testnachricht ${result.sentCount}x an Channel ${channelId} gesendet${respectRateLimit ? ' (Rate-Limit respektiert)' : ''}.`
    );
    await writeDb(db);

    return res.json({ ok: true, ids: result.sentIds, sent_count: result.sentCount });
  } catch (error) {
    const statusCode = Number(error?.statusCode);
    return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      error: error instanceof Error ? error.message : 'Unbekannter Serverfehler',
    });
  }
});

router.post('/send-dm', requireAuth, requirePermission('use'), async (req, res) => {
  const { userId: targetUserId, message, repeatCount, respectRateLimit } = req.body || {};
  const userId = req.session.userId;

  if (!targetUserId || !message) {
    return res.status(400).json({ error: 'userId und message sind erforderlich.' });
  }

  const db = await readDb();
  const userSettings = db.settingsByUser[userId];
  const effectiveBotToken = getEffectiveBotToken(userSettings);

  if (!effectiveBotToken) {
    return res.status(400).json({ error: 'Kein Bot-Token gesetzt (Einstellungen oder DISCORD_BOT_TOKEN).' });
  }

  try {
    const result = await sendDiscordDmViaRest(
      effectiveBotToken,
      targetUserId,
      message,
      repeatCount,
      respectRateLimit
    );
    appendLog(
      db,
      userId,
      'success',
      `DM ${result.sentCount}x an User ${targetUserId} gesendet${respectRateLimit ? ' (Rate-Limit respektiert)' : ''}.`
    );
    await writeDb(db);

    return res.json({ ok: true, ids: result.sentIds, sent_count: result.sentCount });
  } catch (error) {
    const statusCode = Number(error?.statusCode);
    return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      error: error instanceof Error ? error.message : 'Unbekannter Serverfehler',
    });
  }
});

// ── DM Chat Endpoints ──

function formatRecipientAvatar(recipient) {
  if (!recipient?.avatar) return null;
  const ext = recipient.avatar.startsWith('a_') ? 'gif' : 'webp';
  return `https://cdn.discordapp.com/avatars/${recipient.id}/${recipient.avatar}.${ext}?size=64`;
}

router.get('/dm/channels', requireAuth, requirePermission('read'), async (req, res) => {
  const userId = req.session.userId;
  const db = await readDb();
  const userSettings = db.settingsByUser[userId];
  const botProfileId = String(userSettings?.active_bot_profile_id || '').trim() || null;
  const savedChannels = await readUserDms(userId, botProfileId);

  const dmChannels = Object.values(savedChannels).map((ch) => ({
    id: ch.id,
    recipients: [{
      id: ch.recipient_id,
      username: ch.username,
      display_name: ch.display_name,
      avatar_url: ch.avatar_url,
    }],
    last_message_id: ch.last_message_id || null,
  }));

  return res.json({ channels: dmChannels });
});

router.post('/dm/open', requireAuth, requirePermission('use'), async (req, res) => {
  const userId = req.session.userId;
  const { recipientId } = req.body || {};

  if (!recipientId) {
    return res.status(400).json({ error: 'recipientId ist erforderlich.' });
  }

  const db = await readDb();
  const userSettings = db.settingsByUser[userId];
  const effectiveBotToken = getEffectiveBotToken(userSettings);

  if (!effectiveBotToken) {
    return res.status(400).json({ error: 'Kein Bot-Token gesetzt.' });
  }

  try {
    const response = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: { Authorization: `Bot ${effectiveBotToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_id: recipientId }),
    });
    if (!response.ok) {
      const raw = await response.text();
      return res.status(response.status).json({ error: `Discord API: ${raw}` });
    }
    const channel = await response.json();
    const recipient = (channel.recipients || [])[0];

    // Persist channel in user's dms.json (per bot profile)
    const botProfileId = String(userSettings?.active_bot_profile_id || '').trim() || null;
    const savedChannels = await readUserDms(userId, botProfileId);
    savedChannels[channel.id] = {
      id: channel.id,
      recipient_id: recipient?.id || recipientId,
      username: recipient?.username || recipientId,
      display_name: recipient?.global_name || recipient?.username || recipientId,
      avatar_url: formatRecipientAvatar(recipient),
      last_message_id: channel.last_message_id || null,
      opened_at: new Date().toISOString(),
    };
    await writeUserDms(userId, botProfileId, savedChannels);

    return res.json({
      channel: {
        id: channel.id,
        recipient: recipient ? {
          id: recipient.id,
          username: recipient.username,
          display_name: recipient.global_name || recipient.username,
          avatar_url: formatRecipientAvatar(recipient),
        } : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unbekannter Fehler' });
  }
});

router.delete('/dm/channels/:channelId', requireAuth, requirePermission('use'), async (req, res) => {
  const userId = req.session.userId;
  const channelId = String(req.params.channelId || '').trim();

  if (!channelId) {
    return res.status(400).json({ error: 'Ungültige Channel-ID.' });
  }

  const db = await readDb();
  const userSettings = db.settingsByUser[userId];
  const botProfileId = String(userSettings?.active_bot_profile_id || '').trim() || null;
  const savedChannels = await readUserDms(userId, botProfileId);
  if (savedChannels[channelId]) {
    delete savedChannels[channelId];
    await writeUserDms(userId, botProfileId, savedChannels);
  }

  return res.json({ ok: true });
});

router.get('/dm/channels/:channelId/messages', requireAuth, requirePermission('read'), async (req, res) => {
  const userId = req.session.userId;
  const channelId = String(req.params.channelId || '').trim();
  const before = String(req.query.before || '').trim() || undefined;
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 50));

  if (!channelId) {
    return res.status(400).json({ error: 'Ungültige Channel-ID.' });
  }

  const db = await readDb();
  const userSettings = db.settingsByUser[userId];
  const effectiveBotToken = getEffectiveBotToken(userSettings);

  if (!effectiveBotToken) {
    return res.status(400).json({ error: 'Kein Bot-Token gesetzt.' });
  }

  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?${params}`, {
      headers: { Authorization: `Bot ${effectiveBotToken}` },
    });
    if (!response.ok) {
      const raw = await response.text();
      return res.status(response.status).json({ error: `Discord API: ${raw}` });
    }
    const messages = await response.json();

    // Get bot's own user ID for identification
    const meResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${effectiveBotToken}` },
    });
    const botUser = meResponse.ok ? await meResponse.json() : null;

    const mapped = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      timestamp: msg.timestamp,
      edited_timestamp: msg.edited_timestamp,
      author: {
        id: msg.author.id,
        username: msg.author.username,
        display_name: msg.author.global_name || msg.author.username,
        avatar_url: msg.author.avatar
          ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.${msg.author.avatar.startsWith('a_') ? 'gif' : 'webp'}?size=64`
          : null,
        is_bot: Boolean(msg.author.bot),
      },
      is_own: botUser ? msg.author.id === botUser.id : Boolean(msg.author.bot),
      attachments: (msg.attachments || []).map((a) => ({
        id: a.id,
        filename: a.filename,
        url: a.url,
        size: a.size,
        content_type: a.content_type,
      })),
      embeds: (msg.embeds || []).length,
    }));

    return res.json({ messages: mapped, bot_user_id: botUser?.id || null });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unbekannter Fehler' });
  }
});

router.get('/dm/user/:userId', requireAuth, requirePermission('read'), async (req, res) => {
  const sessionUserId = req.session.userId;
  const targetUserId = String(req.params.userId || '').trim();

  if (!targetUserId) {
    return res.status(400).json({ error: 'Ungültige User-ID.' });
  }

  const db = await readDb();
  const userSettings = db.settingsByUser[sessionUserId];
  const effectiveBotToken = getEffectiveBotToken(userSettings);

  if (!effectiveBotToken) {
    return res.status(400).json({ error: 'Kein Bot-Token gesetzt.' });
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/users/${encodeURIComponent(targetUserId)}`, {
      headers: { Authorization: `Bot ${effectiveBotToken}` },
    });
    if (!response.ok) {
      const raw = await response.text();
      return res.status(response.status).json({ error: `Discord API: ${raw}` });
    }
    const user = await response.json();
    return res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.global_name || user.username,
        avatar_url: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'webp'}?size=64`
          : null,
        banner_color: user.banner_color || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unbekannter Fehler' });
  }
});

// ── Music Player Routes ──

router.get('/servers/:guildId/music/status', requireAuth, requirePermission('read'), (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();

  if (!guildId) {
    return res.status(400).json({ error: 'Ungültige Server-ID.' });
  }

  const status = getMusicStatusForGuild(userId, guildId);
  return res.json(status);
});

router.get('/servers/:guildId/music/queue', requireAuth, requirePermission('read'), (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();

  if (!guildId) {
    return res.status(400).json({ error: 'Ungültige Server-ID.' });
  }

  const queue = getQueue(userId, guildId);
  return res.json(queue);
});

router.post('/servers/:guildId/music/play', requireAuth, requirePermission('use'), async (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();
  const { url } = req.body || {};

  if (!guildId) {
    return res.status(400).json({ error: 'Ungültige Server-ID.' });
  }

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Bitte gib eine URL an.' });
  }

  try {
    const result = await addToQueue(userId, guildId, url.trim());
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Fehler beim Hinzufügen zur Warteschlange.' });
  }
});

router.post('/servers/:guildId/music/skip', requireAuth, requirePermission('use'), (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();

  if (!guildId) {
    return res.status(400).json({ error: 'Ungültige Server-ID.' });
  }

  try {
    const result = skipSong(userId, guildId);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Skip fehlgeschlagen.' });
  }
});

router.post('/servers/:guildId/music/stop', requireAuth, requirePermission('use'), (req, res) => {
  const userId = req.session.userId;
  const guildId = String(req.params.guildId || '').trim();

  if (!guildId) {
    return res.status(400).json({ error: 'Ungültige Server-ID.' });
  }

  try {
    const result = stopPlayback(userId, guildId);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Stoppen fehlgeschlagen.' });
  }
});

module.exports = {
  discordRoutes: router,
};
