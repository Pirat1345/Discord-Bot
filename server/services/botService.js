const { ActivityType, Client, GatewayIntentBits, ApplicationCommandOptionType } = require('discord.js');
const { handleMessageCreate, handleInteractionCreate, handleGuildMemberAdd } = require('../dc-funktions');
const { startAutoPostInterval, stopAutoPostInterval } = require('../dc-funktions/news/free-games');
const { startAutoPostInterval: startMcAutoPost, stopAutoPostInterval: stopMcAutoPost } = require('../dc-funktions/community/minecraft-status');

const activeBots = new Map();
const botClientsByUser = new Map();

const BASE_INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates];
const PRIVILEGED_INTENTS = [GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent];
const FULL_INTENTS = [...BASE_INTENTS, ...PRIVILEGED_INTENTS];

const SET_GAME_COUNTING_COMMAND = {
  name: 'set',
  description: 'Setzt Bot-Funktionen fuer den aktuellen Channel.',
  options: [
    {
      type: ApplicationCommandOptionType.SubcommandGroup,
      name: 'game',
      description: 'Spiel-Funktionen',
      options: [
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: 'counting',
          description: 'Aktiviert Counting in diesem Channel.',
        },
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: 'counting-clear',
          description: 'Löscht Counting vollständig in diesem Server.',
        },
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: 'minesweeper',
          description: 'Startet ein neues Minesweeper-Spiel in diesem Channel.',
        },
      ],
    },
  ],
};

const RESET_COMMAND = {
  name: 'reset',
  description: 'Setzt Bot-Funktionen zurück.',
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: 'minesweeper',
      description: 'Setzt Minesweeper vollständig zurück (Spiel, Channel, alles).',
    },
  ],
};

const MC_COMMAND = {
  name: 'mc',
  description: 'Minecraft Server Tools.',
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: 'scan',
      description: 'Pingt einen Minecraft Server und zeigt den Status an.',
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: 'ip',
          description: 'Server-Adresse (z.B. mc.hypixel.net oder 192.168.1.100:25565)',
          required: true,
        },
        {
          type: ApplicationCommandOptionType.String,
          name: 'edition',
          description: 'Java oder Bedrock (Standard: Java)',
          required: false,
          choices: [
            { name: 'Java', value: 'java' },
            { name: 'Bedrock', value: 'bedrock' },
          ],
        },
      ],
    },
  ],
};

async function upsertCommandForGuild(guild, commandDef) {
  try {
    const commands = await guild.commands.fetch();
    const existing = commands.find((entry) => entry.name === commandDef.name);
    if (!existing) {
      await guild.commands.create(commandDef);
      return;
    }

    const existingShape = JSON.stringify({
      description: existing.description,
      options: existing.options,
    });
    const nextShape = JSON.stringify({
      description: commandDef.description,
      options: commandDef.options,
    });

    if (existingShape !== nextShape) {
      await existing.edit(commandDef);
    }
  } catch {
    // ignore registration problems to avoid blocking bot startup
  }
}

async function registerGuildSlashCommands(client) {
  const guilds = await client.guilds.fetch();
  for (const guildEntry of guilds.values()) {
    try {
      const guild = await client.guilds.fetch(guildEntry.id);
      await upsertCommandForGuild(guild, SET_GAME_COUNTING_COMMAND);
      await upsertCommandForGuild(guild, RESET_COMMAND);
      await upsertCommandForGuild(guild, MC_COMMAND);
    } catch {
      // ignore individual guild errors
    }
  }
}

function createConfiguredClient(userId, intents) {
  const client = new Client({ intents });

  client.on('messageCreate', async (message) => {
    try {
      await handleMessageCreate({ userId, message });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error(`[dc-funktions] messageCreate Fehler fuer User ${userId}: ${msg}`);
    }
  });

  client.on('interactionCreate', async (interaction) => {
    try {
      await handleInteractionCreate({ userId, interaction });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error(`[dc-funktions] interactionCreate Fehler fuer User ${userId}: ${msg}`);
    }
  });

  client.on('guildCreate', async (guild) => {
    await upsertCommandForGuild(guild, SET_GAME_COUNTING_COMMAND);
    await upsertCommandForGuild(guild, MC_COMMAND);
  });

  client.on('guildMemberAdd', async (member) => {
    try {
      await handleGuildMemberAdd({ userId, member });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error(`[dc-funktions] guildMemberAdd Fehler fuer User ${userId}: ${msg}`);
    }
  });

  return client;
}

function isDisallowedIntentsError(error) {
  const msg = String(error instanceof Error ? error.message : error || '').toLowerCase();
  return msg.includes('disallowed intents');
}

function registerClient(userId, client) {
  if (!botClientsByUser.has(userId)) {
    botClientsByUser.set(userId, new Set());
  }
  botClientsByUser.get(userId).add(client);
}

function unregisterClient(userId, client) {
  const clients = botClientsByUser.get(userId);
  if (!clients) return;

  clients.delete(client);
  if (clients.size === 0) {
    botClientsByUser.delete(userId);
  }
}

async function setInvisibleAndDestroy(client) {
  try {
    if (client.user) {
      await client.user.setPresence({ status: 'invisible' });
      // Give Discord a short moment to process the presence update.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } catch {
    // ignore presence update errors and continue with shutdown
  }

  try {
    client.destroy();
  } catch {
    // ignore shutdown errors while cleaning up
  }
}

function mapGuild(guild) {
  return {
    id: guild.id,
    name: guild.name,
    icon_url: guild.iconURL({ extension: 'png', size: 64, forceStatic: true }) || null,
  };
}

async function resolveGuild(client, guildId) {
  let guild = client.guilds.cache.get(guildId);
  if (guild) return guild;

  try {
    guild = await client.guilds.fetch(guildId);
    return guild || null;
  } catch {
    return null;
  }
}

async function stopBotForUser(userId) {
  const trackedClients = botClientsByUser.get(userId);
  const existing = activeBots.get(userId);

  const clients = new Set();
  if (trackedClients) {
    for (const client of trackedClients) {
      clients.add(client);
    }
  }
  if (existing) {
    clients.add(existing);
  }

  if (clients.size === 0) return;

  for (const client of clients) {
    await setInvisibleAndDestroy(client);
    unregisterClient(userId, client);
  }

  activeBots.delete(userId);
}

async function startBotForUser(userId, token) {
  await stopBotForUser(userId);

  let client = createConfiguredClient(userId, FULL_INTENTS);

  try {
    await client.login(token);
  } catch (error) {
    unregisterClient(userId, client);
    try {
      client.destroy();
    } catch {
      // ignore cleanup errors when login failed
    }

    if (!isDisallowedIntentsError(error)) {
      throw error;
    }

    console.warn(`[botService] User ${userId}: Privilegierte Intents nicht erlaubt, starte mit Basis-Intents.`);
    client = createConfiguredClient(userId, BASE_INTENTS);
    await client.login(token);
  }

  activeBots.set(userId, client);
  registerClient(userId, client);

  // Prime guild cache once after login so UI can render faster.
  try {
    await client.guilds.fetch();
    await registerGuildSlashCommands(client);
  } catch {
    // ignore cache priming errors, guild cache still fills over gateway events
  }

  // Start the free-games auto-post interval if not already running.
  startAutoPostInterval(() => getAllActiveClients());
  // Start the minecraft-status auto-post interval if not already running.
  startMcAutoPost(() => getAllActiveClients());
}

async function shutdownAllBots() {
  stopAutoPostInterval();
  stopMcAutoPost();
  for (const userId of activeBots.keys()) {
    await stopBotForUser(userId);
  }
}

function hasActiveBotForUser(userId) {
  return activeBots.has(userId);
}

function getActiveClientForUser(userId) {
  return activeBots.get(userId) || null;
}

function getAllActiveClients() {
  const result = [];
  for (const [userId, client] of activeBots.entries()) {
    if (client?.user) {
      result.push({ userId, client });
    }
  }
  return result;
}

function mapActivityType(type) {
  switch (String(type || 'Playing')) {
    case 'Streaming':
      return ActivityType.Streaming;
    case 'Listening':
      return ActivityType.Listening;
    case 'Watching':
      return ActivityType.Watching;
    case 'Competing':
      return ActivityType.Competing;
    case 'Playing':
    default:
      return ActivityType.Playing;
  }
}

function getActivityTypeLabel(type) {
  switch (type) {
    case ActivityType.Streaming:
      return 'Streaming';
    case ActivityType.Listening:
      return 'Listening';
    case ActivityType.Watching:
      return 'Watching';
    case ActivityType.Competing:
      return 'Competing';
    case ActivityType.Playing:
    default:
      return 'Playing';
  }
}

function getBotRuntimeProfileForUser(userId) {
  const client = activeBots.get(userId);
  if (!client || !client.user) {
    return null;
  }

  const activity = client.user.presence?.activities?.[0];
  const status = client.user.presence?.status || 'online';

  return {
    username: client.user.username,
    avatar_url: client.user.displayAvatarURL({ extension: 'png', size: 256 }) || null,
    status,
    activity_type: getActivityTypeLabel(activity?.type),
    activity_text: activity?.name || '',
  };
}

async function updateBotPresenceForUser(userId, presence) {
  const client = activeBots.get(userId);
  if (!client || !client.user) {
    return false;
  }

  const status = String(presence?.status || 'online');
  const activityText = String(presence?.activity_text || '').trim();
  const activityType = mapActivityType(presence?.activity_type);

  await client.user.setPresence({
    status,
    activities: activityText ? [{ name: activityText, type: activityType }] : [],
  });

  return true;
}

async function getGuildsForUser(userId) {
  const client = activeBots.get(userId);
  if (!client) {
    return [];
  }

  if (client.guilds.cache.size === 0) {
    try {
      await client.guilds.fetch();
    } catch {
      // ignore fetch failures and return whatever is available locally
    }
  }

  return client.guilds.cache.map(mapGuild).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

async function getGuildStatsForUser(userId, guildId) {
  const client = activeBots.get(userId);
  if (!client) {
    return null;
  }

  const guild = await resolveGuild(client, guildId);
  if (!guild) {
    return null;
  }

  try {
    await guild.fetch({ withCounts: true });
  } catch {
    // Ignore if Discord doesn't return counts in this request.
  }

  const totalMembers = typeof guild.memberCount === 'number' ? guild.memberCount : null;
  const onlineMembers = typeof guild.approximatePresenceCount === 'number'
    ? guild.approximatePresenceCount
    : null;
  const offlineMembers =
    typeof totalMembers === 'number' && typeof onlineMembers === 'number'
      ? Math.max(0, totalMembers - onlineMembers)
      : null;

  return {
    ...mapGuild(guild),
    total_members: totalMembers,
    online_members: onlineMembers,
    offline_members: offlineMembers,
  };
}

module.exports = {
  stopBotForUser,
  startBotForUser,
  shutdownAllBots,
  hasActiveBotForUser,
  getActiveClientForUser,
  getAllActiveClients,
  getBotRuntimeProfileForUser,
  updateBotPresenceForUser,
  getGuildsForUser,
  getGuildStatsForUser,
};
