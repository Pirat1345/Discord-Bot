const { readDb, writeDb } = require('../../services/dbService');
const { createDefaultGuildConfig, defaultFeatures } = require('../../utils/defaults');

const FEATURE_KEY = 'counting';

function ensureGuildConfigAndCountingFeature(db, userId, guildId) {
  if (!db.guildConfigsByUser[userId]) {
    db.guildConfigsByUser[userId] = {};
  }

  if (!db.guildConfigsByUser[userId][guildId]) {
    db.guildConfigsByUser[userId][guildId] = createDefaultGuildConfig(userId, guildId);
  }

  const guildConfig = db.guildConfigsByUser[userId][guildId];
  if (!Array.isArray(guildConfig.features)) {
    guildConfig.features = [];
  }

  let feature = guildConfig.features.find((entry) => entry?.feature_key === FEATURE_KEY);
  if (!feature) {
    const fallback = defaultFeatures().find((entry) => entry.feature_key === FEATURE_KEY);
    if (!fallback) {
      return null;
    }
    guildConfig.features.push(fallback);
    feature = fallback;
  }

  return feature;
}

function normalizeConfig(config) {
  const raw = config && typeof config === 'object' && !Array.isArray(config) ? config : {};

  return {
    channelId: String(raw.channelId || '').trim(),
    currentCount: Math.max(0, Number.parseInt(String(raw.currentCount || '0'), 10) || 0),
    lastUserId: String(raw.lastUserId || '').trim(),
    lastUsername: String(raw.lastUsername || '').trim(),
  };
}

function withNormalizedFeatureConfig(feature) {
  const config = normalizeConfig(feature?.config);
  return {
    ...feature,
    config: {
      ...feature?.config,
      channelId: config.channelId,
      currentCount: String(config.currentCount),
      lastUserId: config.lastUserId,
      lastUsername: config.lastUsername,
    },
  };
}

async function announceCountingStarted(channel) {
  if (!channel || typeof channel.send !== 'function') {
    return;
  }

  await channel.send('🎯 Counting ist jetzt aktiv! Start bei 1 und dann immer sauber hochzählen: 1, 2, 3, ...');
}

async function setCountingChannelForGuild({ userId, guildId, channelId, enable = true }) {
  const db = await readDb();
  const feature = ensureGuildConfigAndCountingFeature(db, userId, guildId);
  if (!feature) {
    return { changed: false, feature: null };
  }

  const nextChannelId = String(channelId || '').trim();
  const current = normalizeConfig(feature.config);
  const channelChanged = current.channelId !== nextChannelId;

  feature.enabled = enable;
  feature.config = {
    ...feature.config,
    channelId: nextChannelId,
    currentCount: '0',
    lastUserId: '',
    lastUsername: '',
  };
  feature.updated_at = new Date().toISOString();

  await writeDb(db);

  return {
    changed: channelChanged,
    feature: withNormalizedFeatureConfig(feature),
  };
}

async function clearCountingForGuild({ userId, guildId }) {
  const db = await readDb();
  const feature = ensureGuildConfigAndCountingFeature(db, userId, guildId);
  if (!feature) {
    return { changed: false, feature: null };
  }

  const current = normalizeConfig(feature.config);
  const hadState = Boolean(current.channelId) || current.currentCount > 0 || Boolean(current.lastUserId) || feature.enabled;

  feature.enabled = false;
  feature.config = {
    ...feature.config,
    channelId: '',
    currentCount: '0',
    lastUserId: '',
    lastUsername: '',
  };
  feature.updated_at = new Date().toISOString();

  await writeDb(db);

  return {
    changed: hadState,
    feature: withNormalizedFeatureConfig(feature),
  };
}

async function notifyReset(channel, reason) {
  if (!channel || typeof channel.send !== 'function') {
    return;
  }

  if (reason === 'same-user') {
    await channel.send('Nicht zweimal hintereinander zählen. Neustart bei 1.');
    return;
  }

  await channel.send('Falsche Zahl. Neustart bei 1.');
}

async function reactSafe(message, emoji) {
  if (!message || typeof message.react !== 'function') {
    return;
  }

  try {
    await message.react(emoji);
  } catch {
    // ignore missing permissions or unknown emoji
  }
}

async function handleMessageCreate({ userId, message }) {
  const guildId = String(message?.guildId || '').trim();
  if (!guildId || !message?.author || message.author.bot) {
    return;
  }

  const db = await readDb();
  const feature = ensureGuildConfigAndCountingFeature(db, userId, guildId);
  if (!feature || !feature.enabled) {
    return;
  }

  const config = normalizeConfig(feature.config);
  if (!config.channelId || config.channelId !== String(message.channelId || '').trim()) {
    return;
  }

  const content = String(message.content || '').trim();
  const parsed = Number.parseInt(content, 10);
  const isNaturalNumber = /^\d+$/.test(content);
  const expected = config.currentCount + 1;

  let changed = false;
  let resetReason = null;

  if (config.lastUserId && config.lastUserId === message.author.id) {
    config.currentCount = 0;
    config.lastUserId = '';
    config.lastUsername = '';
    changed = true;
    resetReason = 'same-user';
  } else if (!isNaturalNumber || parsed !== expected) {
    config.currentCount = 0;
    config.lastUserId = '';
    config.lastUsername = '';
    changed = true;
    resetReason = 'wrong-number';
  } else {
    config.currentCount = parsed;
    config.lastUserId = message.author.id;
    config.lastUsername = String(message.member?.displayName || message.author.username || '').trim();
    changed = true;
  }

  if (!changed) {
    return;
  }

  feature.config = {
    ...feature.config,
    channelId: config.channelId,
    currentCount: String(config.currentCount),
    lastUserId: config.lastUserId,
    lastUsername: config.lastUsername,
  };
  feature.updated_at = new Date().toISOString();

  await writeDb(db);

  if (resetReason) {
    await reactSafe(message, '🔴');
    try {
      await notifyReset(message.channel, resetReason);
    } catch {
      // ignore chat feedback errors
    }
    return;
  }

  await reactSafe(message, '🟢');
}

module.exports = {
  handleMessageCreate,
  setCountingChannelForGuild,
  clearCountingForGuild,
  announceCountingStarted,
  normalizeConfig,
};
