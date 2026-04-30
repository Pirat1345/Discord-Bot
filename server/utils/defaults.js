const crypto = require('crypto');

const baseDb = {
  users: [],
  settingsByUser: {},
  featuresByUser: {},
  logsByUser: {},
  guildConfigsByUser: {},
  guildCacheByUser: {},
};

function defaultFeatures() {
  const now = new Date().toISOString();

  return [
    {
      id: crypto.randomUUID(),
      feature_key: 'test-message',
      name: 'Test Message',
      description: 'Sends a test message to a Discord channel.',
      enabled: true,
      config: { channelId: '', message: '' },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'cleaner',
      name: 'Cleaner',
      description: 'Deletes all channels, categories and deletable roles on the server.',
      enabled: false,
      config: {},
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'auto-moderation',
      name: 'Auto Moderation',
      description: 'Filters spam, links and profanity.',
      enabled: false,
      config: {
        filterSpam: 'true',
        filterLinks: 'false',
        filterProfanity: 'false',
        warnMessage: 'Please follow the rules.',
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'welcome-messages',
      name: 'Welcome Messages',
      description: 'Greets new members in the server.',
      enabled: false,
      config: {
        channelId: '',
        message: 'Welcome {mention}! ??�',
        welcomeBots: 'false',
        bannerEnabled: 'true',
        bannerTitle: 'Welcome, {user}!',
        bannerSubtitle: 'Du bist jetzt Teil von {server}!',
        bannerFooter: '{server}',
        backgroundFrom: '#1e3a8a',
        backgroundTo: '#4f46e5',
        accentColor: '#22d3ee',
        textColor: '#ffffff',
        subtitleColor: '#dbeafe',
        avatarRingColor: '#22d3ee',
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'custom-commands',
      name: 'Custom Commands',
      description: 'Eigene Textbefehle fuer deinen Bot.',
      enabled: false,
      config: { commands: '[]' },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'counting',
      name: 'Counting Game',
      description: 'Everyone counts up in the same channel one by one. Mistakes reset to 1.',
      enabled: false,
      config: { channelId: '', currentCount: '0', lastUserId: '', lastUsername: '' },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'free-games',
      name: 'Free Games',
      description: 'Posts free games from Epic and Steam to a channel.',
      enabled: false,
      config: { channelId: '' },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'soundboard',
      name: 'Soundboard',
      description: 'Plays audio files via the bot in a voice channel.',
      enabled: false,
      config: {},
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'music-player',
      name: 'Music Player',
      description: 'Plays YouTube audio in a voice channel. Supports playlists and queue.',
      enabled: false,
      config: {
        prefix: '!',
        cmdPlay: 'play',
        cmdSkip: 'skip',
        cmdStop: 'stop',
        cmdQueue: 'queue',
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'minecraft-status',
      name: 'Minecraft Server Status',
      description: 'Pings a Minecraft server and posts status, players, version and MOTD to a channel.',
      enabled: false,
      config: {
        channelId: '',
        serverAddress: '',
        serverPort: '',
        edition: 'java',
        autoPost: 'false',
        autoPostInterval: '5',
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'minesweeper',
      name: 'Minesweeper',
      description: 'Minesweeper im Discord Channel. Spieler decken abwechselnd Felder auf – wer eine Mine trifft, startet das Spiel neu.',
      enabled: false,
      config: {
        channelId: '',
        board: '',
        revealed: '',
        safeCells: '0',
        totalSafe: '0',
        lastUserId: '',
        lastUsername: '',
        allowSameUser: 'false',
      },
      created_at: now,
      updated_at: now,
    },
  ];
}

function createDefaultSettings(userId) {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    user_id: userId,
    bot_token: '',
    bot_description: '',
    command_prefix: '/',
    is_online: false,
    bot_status: 'online',
    bot_activity_type: 'Playing',
    bot_activity_text: '',
    notifications_enabled: true,
    created_at: now,
    updated_at: now,
  };
}

function createDefaultGuildSettings(userId, guildId) {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    user_id: userId,
    guild_id: guildId,
    bot_profile_id: null,
    command_prefix: '/',
    notifications_enabled: true,
    created_at: now,
    updated_at: now,
  };
}

function createDefaultGuildConfig(userId, guildId) {
  return {
    settings: createDefaultGuildSettings(userId, guildId),
    features: defaultFeatures(),
  };
}

module.exports = {
  baseDb,
  defaultFeatures,
  createDefaultSettings,
  createDefaultGuildSettings,
  createDefaultGuildConfig,
};
