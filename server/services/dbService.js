const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { dataDir, dbPath, usersDir } = require('../config');
const { baseDb, createDefaultSettings } = require('../utils/defaults');

const ACCOUNT_FILE = 'account.json';
const GENERAL_FILE = 'general.json';
const BOT_FILE = 'bot.json';
const FEATURES_FILE = 'features.json';
const LOGS_FILE = 'logs.json';
const DMS_FILE = 'dms.json';
const DISCORD_SERVERS_DIR = path.join('server', 'Discord');
const DISCORD_CACHE_FILE = 'cache.json';

function normalizeLegacyDbShape(rawDb) {
  const db = {
    users: Array.isArray(rawDb?.users)
      ? rawDb.users.map((u) => ({
          ...u,
          role: u?.role || 'admin',
          must_change_password: Boolean(u?.must_change_password),
          username: String(u?.username || '').trim().toLowerCase(),
        }))
      : [],
    settingsByUser:
      rawDb?.settingsByUser && typeof rawDb.settingsByUser === 'object'
        ? { ...rawDb.settingsByUser }
        : {},
    featuresByUser:
      rawDb?.featuresByUser && typeof rawDb.featuresByUser === 'object'
        ? { ...rawDb.featuresByUser }
        : {},
    logsByUser:
      rawDb?.logsByUser && typeof rawDb.logsByUser === 'object'
        ? { ...rawDb.logsByUser }
        : {},
    guildConfigsByUser:
      rawDb?.guildConfigsByUser && typeof rawDb.guildConfigsByUser === 'object'
        ? { ...rawDb.guildConfigsByUser }
        : {},
    guildCacheByUser:
      rawDb?.guildCacheByUser && typeof rawDb.guildCacheByUser === 'object'
        ? { ...rawDb.guildCacheByUser }
        : {},
  };

  const hasLegacyUsers = db.users.some((u) => !u.username);
  if (hasLegacyUsers) {
    db.users = [];
    db.settingsByUser = {};
    db.featuresByUser = {};
    db.logsByUser = {};
    db.guildConfigsByUser = {};
    db.guildCacheByUser = {};
  }

  return db;
}

function createDefaultDb() {
  return {
    ...baseDb,
    users: [],
    settingsByUser: {},
    featuresByUser: {},
    logsByUser: {},
    guildConfigsByUser: {},
    guildCacheByUser: {},
  };
}

async function ensureStorageDirs() {
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.mkdir(usersDir, { recursive: true });
}

function getUserDir(userId) {
  return path.join(usersDir, userId);
}

function getUserDiscordServersDir(userId) {
  return path.join(getUserDir(userId), DISCORD_SERVERS_DIR);
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

async function writeJsonFile(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function listSubDirectories(dirPath) {
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

function normalizeUserRecord(user, fallbackId) {
  const userId = String(user?.id || fallbackId || '').trim();
  if (!userId) {
    return null;
  }

  const username = String(user?.username || '').trim().toLowerCase();
  if (!username) {
    return null;
  }

  return {
    id: userId,
    username,
    display_name: String(user?.display_name || '').trim() || username,
    avatar_file: String(user?.avatar_file || '').trim() || null,
    avatar_updated_at: String(user?.avatar_updated_at || '').trim() || null,
    avatar_url: String(user?.avatar_url || '').trim() || null,
    password_hash: String(user?.password_hash || ''),
    role: String(user?.role || 'admin').trim().toLowerCase() || 'admin',
    must_change_password: Boolean(user?.must_change_password),
    totp_enabled: Boolean(user?.totp_enabled),
    totp_secret: user?.totp_secret || null,
    totp_secret_pending: user?.totp_secret_pending || null,
    language: String(user?.language || 'de').trim().toLowerCase(),
    created_at: String(user?.created_at || new Date().toISOString()),
  };
}

function normalizeSettingsForUser(userId, accountData, botData, generalData) {
  const fallback = createDefaultSettings(userId);
  const normalizedBotProfiles = Array.isArray(botData?.bot_profiles)
    ? botData.bot_profiles
        .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
        .map((entry) => {
          const raw = entry;
          return {
            id: String(raw.id || ''),
            name: String(raw.name || 'Discord Bot'),
            avatar_url: raw.avatar_url ? String(raw.avatar_url) : null,
            bot_token: String(raw.bot_token || ''),
            command_prefix: '/',
            description: String(raw.description || ''),
            status: String(raw.status || 'online'),
            activity_type: String(raw.activity_type || 'Playing'),
            activity_text: String(raw.activity_text || ''),
          };
        })
        .filter((entry) => entry.id)
    : [];

  return {
    id: String(botData?.id || fallback.id),
    user_id: userId,
    bot_token: String(accountData?.bot_token || ''),
    bot_description: String(botData?.bot_description || fallback.bot_description || ''),
    command_prefix: '/',
    is_online: Boolean(botData?.is_online),
    bot_status: String(botData?.bot_status || fallback.bot_status || 'online'),
    bot_activity_type: String(botData?.bot_activity_type || fallback.bot_activity_type || 'Playing'),
    bot_activity_text: String(botData?.bot_activity_text || fallback.bot_activity_text || ''),
    bot_profiles: normalizedBotProfiles,
    active_bot_profile_id: String(botData?.active_bot_profile_id || '').trim() || null,
    notifications_enabled:
      typeof generalData?.notifications_enabled === 'boolean'
        ? generalData.notifications_enabled
        : fallback.notifications_enabled,
    created_at: String(botData?.created_at || fallback.created_at),
    updated_at: String(botData?.updated_at || fallback.updated_at),
  };
}

async function migrateLegacyDbIfNeeded() {
  const userDirs = await listSubDirectories(usersDir);
  if (userDirs.length > 0 || !fs.existsSync(dbPath)) {
    return;
  }

  const raw = await fsp.readFile(dbPath, 'utf8');
  const parsed = JSON.parse(raw);
  const normalized = normalizeLegacyDbShape(parsed);
  await writeDb(normalized);
}

async function readDb() {
  await ensureStorageDirs();
  await migrateLegacyDbIfNeeded();

  const db = createDefaultDb();
  const userIds = await listSubDirectories(usersDir);

  for (const userId of userIds) {
    const userDir = getUserDir(userId);
    const accountData = await readJsonFile(path.join(userDir, ACCOUNT_FILE), null);
    const user = normalizeUserRecord(accountData, userId);

    if (!user) {
      continue;
    }

    db.users.push(user);

    const botData = await readJsonFile(path.join(userDir, BOT_FILE), null);
    const generalData = await readJsonFile(path.join(userDir, GENERAL_FILE), null);
    db.settingsByUser[userId] = normalizeSettingsForUser(userId, accountData, botData, generalData);

    const features = await readJsonFile(path.join(userDir, FEATURES_FILE), null);
    if (Array.isArray(features)) {
      db.featuresByUser[userId] = features;
    }

    const logs = await readJsonFile(path.join(userDir, LOGS_FILE), null);
    if (Array.isArray(logs)) {
      db.logsByUser[userId] = logs;
    }

    const discordServersDir = getUserDiscordServersDir(userId);
    const cache = await readJsonFile(path.join(discordServersDir, DISCORD_CACHE_FILE), null);
    if (cache && typeof cache === 'object') {
      db.guildCacheByUser[userId] = cache;
    }

    const guildIds = await listSubDirectories(discordServersDir);
    for (const guildId of guildIds) {
      const config = await readJsonFile(path.join(discordServersDir, guildId, 'config.json'), null);
      if (config && typeof config === 'object') {
        if (!db.guildConfigsByUser[userId]) {
          db.guildConfigsByUser[userId] = {};
        }
        db.guildConfigsByUser[userId][guildId] = config;
      }
    }
  }

  return db;
}

async function removeUnknownUserDirs(validUserIds) {
  const existingUserIds = await listSubDirectories(usersDir);
  await Promise.all(
    existingUserIds
      .filter((entryUserId) => !validUserIds.has(entryUserId))
      .map((entryUserId) => fsp.rm(getUserDir(entryUserId), { recursive: true, force: true }))
  );
}

async function writeGuildConfigs(userId, guildConfigsById) {
  const discordServersDir = getUserDiscordServersDir(userId);
  await fsp.mkdir(discordServersDir, { recursive: true });

  const guildIds = Object.keys(guildConfigsById || {});
  const existingGuildDirs = await listSubDirectories(discordServersDir);

  await Promise.all(
    existingGuildDirs
      .filter((existingGuildId) => !guildIds.includes(existingGuildId))
      .map((existingGuildId) =>
        fsp.rm(path.join(discordServersDir, existingGuildId), {
          recursive: true,
          force: true,
        })
      )
  );

  await Promise.all(
    guildIds.map((guildId) =>
      writeJsonFile(
        path.join(discordServersDir, guildId, 'config.json'),
        guildConfigsById[guildId]
      )
    )
  );
}

async function writeDb(db) {
  await ensureStorageDirs();

  const normalized = normalizeLegacyDbShape(db);
  const validUserIds = new Set(normalized.users.map((user) => user.id));
  await removeUnknownUserDirs(validUserIds);

  for (const user of normalized.users) {
    const userId = user.id;
    const userDir = getUserDir(userId);
    await fsp.mkdir(userDir, { recursive: true });

    const settings = normalized.settingsByUser[userId] || createDefaultSettings(userId);
    const accountData = {
      id: userId,
      username: String(user.username || '').trim().toLowerCase(),
      display_name: String(user.display_name || '').trim() || String(user.username || '').trim().toLowerCase(),
      avatar_file: String(user.avatar_file || '').trim() || null,
      avatar_updated_at: String(user.avatar_updated_at || '').trim() || null,
      avatar_url: String(user.avatar_url || '').trim() || null,
      password_hash: String(user.password_hash || ''),
      role: String(user.role || 'admin').trim().toLowerCase() || 'admin',
      must_change_password: Boolean(user.must_change_password),
      totp_enabled: Boolean(user.totp_enabled),
      totp_secret: user.totp_secret || null,
      totp_secret_pending: user.totp_secret_pending || null,
      language: String(user.language || 'de').trim().toLowerCase(),
      bot_token: String(settings.bot_token || ''),
      created_at: String(user.created_at || new Date().toISOString()),
    };

    const botData = {
      id: String(settings.id || createDefaultSettings(userId).id),
      user_id: userId,
      bot_description: String(settings.bot_description || ''),
      command_prefix: '/',
      is_online: Boolean(settings.is_online),
      bot_status: String(settings.bot_status || 'online'),
      bot_activity_type: String(settings.bot_activity_type || 'Playing'),
      bot_activity_text: String(settings.bot_activity_text || ''),
      bot_profiles: Array.isArray(settings.bot_profiles) ? settings.bot_profiles : [],
      active_bot_profile_id: String(settings.active_bot_profile_id || '').trim() || null,
      created_at: String(settings.created_at || new Date().toISOString()),
      updated_at: String(settings.updated_at || new Date().toISOString()),
    };

    const generalData = {
      notifications_enabled:
        typeof settings.notifications_enabled === 'boolean'
          ? settings.notifications_enabled
          : true,
    };

    await writeJsonFile(path.join(userDir, ACCOUNT_FILE), accountData);
    await writeJsonFile(path.join(userDir, BOT_FILE), botData);
    await writeJsonFile(path.join(userDir, GENERAL_FILE), generalData);
    await writeJsonFile(path.join(userDir, FEATURES_FILE), normalized.featuresByUser[userId] || []);
    await writeJsonFile(path.join(userDir, LOGS_FILE), normalized.logsByUser[userId] || []);

    const discordServersDir = getUserDiscordServersDir(userId);
    await writeJsonFile(
      path.join(discordServersDir, DISCORD_CACHE_FILE),
      normalized.guildCacheByUser[userId] || {}
    );
    await writeGuildConfigs(userId, normalized.guildConfigsByUser[userId] || {});
  }
}

async function readUserDms(userId, botProfileId) {
  const filePath = path.join(getUserDir(userId), DMS_FILE);
  const allDms = await readJsonFile(filePath, {});
  const key = String(botProfileId || '_default').trim() || '_default';

  // Auto-migrate old flat format (channels at top level) into per-bot structure
  const topKeys = Object.keys(allDms);
  if (topKeys.length > 0 && topKeys.some((k) => allDms[k]?.id)) {
    // Old flat format detected — move everything under _legacy
    const migrated = { _legacy: { ...allDms } };
    await writeJsonFile(filePath, migrated);
    return key === '_legacy' ? migrated._legacy : {};
  }

  return allDms[key] || {};
}

async function writeUserDms(userId, botProfileId, dms) {
  const filePath = path.join(getUserDir(userId), DMS_FILE);
  const allDms = await readJsonFile(filePath, {});
  const key = String(botProfileId || '_default').trim() || '_default';

  // Auto-migrate old flat format before writing
  const topKeys = Object.keys(allDms);
  if (topKeys.length > 0 && topKeys.some((k) => allDms[k]?.id)) {
    const migrated = { _legacy: { ...allDms } };
    migrated[key] = dms;
    await writeJsonFile(filePath, migrated);
    return;
  }

  allDms[key] = dms;
  await writeJsonFile(filePath, allDms);
}

module.exports = {
  readDb,
  writeDb,
  readUserDms,
  writeUserDms,
};
