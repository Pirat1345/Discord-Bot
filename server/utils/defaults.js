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
      name: 'Test Nachricht',
      description: 'Sendet eine Testnachricht in einen Discord Channel.',
      enabled: true,
      config: { channelId: '', message: '' },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'cleaner',
      name: 'Cleaner',
      description: 'Loescht alle Kanaele, Kategorien und loeschbaren Rollen auf dem Server.',
      enabled: false,
      config: {},
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'auto-moderation',
      name: 'Auto Moderation',
      description: 'Filtert Spam, Links und Schimpfwoerter.',
      enabled: false,
      config: {
        filterSpam: 'true',
        filterLinks: 'false',
        filterProfanity: 'false',
        warnMessage: 'Bitte halte dich an die Regeln.',
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'welcome-messages',
      name: 'Willkommensnachrichten',
      description: 'Begruesst neue Mitglieder im Server.',
      enabled: false,
      config: {
        channelId: '',
        message: 'Willkommen {mention}! 🎉',
        welcomeBots: 'false',
        bannerEnabled: 'true',
        bannerTitle: 'Willkommen, {user}!',
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
      description: 'Alle zählen im gleichen Channel nacheinander hoch. Fehler setzen auf 1 zurück.',
      enabled: false,
      config: { channelId: '', currentCount: '0', lastUserId: '', lastUsername: '' },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'free-games',
      name: 'Free Games',
      description: 'Postet kostenlose Spiele von Epic und Steam in einen Channel.',
      enabled: false,
      config: { channelId: '' },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'soundboard',
      name: 'Soundboard',
      description: 'Spielt Audio-Dateien ueber den Bot in einem Voice-Channel ab.',
      enabled: false,
      config: {},
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      feature_key: 'music-player',
      name: 'Music Player',
      description: 'Spielt YouTube-Audio in einem Voice-Channel ab. Unterstuetzt Playlists und Warteschlange.',
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
      description: 'Pingt einen Minecraft Server und postet Status, Spieler, Version und MOTD in einen Channel.',
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
