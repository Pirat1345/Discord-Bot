const { EmbedBuilder } = require('discord.js');
const { readDb } = require('../../services/dbService');
const { getDeals } = require('../../services/gameDealsService');
const { createDefaultGuildConfig, defaultFeatures } = require('../../utils/defaults');

const FEATURE_KEY = 'free-games';

const PLATFORM_COLORS = {
  epic: 0x000000,
  steam: 0x1b2838,
};

const PLATFORM_LOGOS = {
  epic: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Epic_Games_logo.svg/120px-Epic_Games_logo.svg.png',
  steam: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/120px-Steam_icon_logo.svg.png',
};

const PLATFORM_NAMES = {
  epic: 'Epic Games Store',
  steam: 'Steam',
};

function ensureGuildConfigAndFeature(db, userId, guildId) {
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

function formatEndDate(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

function formatTimeRemaining(iso) {
  if (!iso) return null;
  try {
    const end = new Date(iso);
    const now = new Date();
    const diffMs = end - now;
    if (diffMs <= 0) return 'Abgelaufen';

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `Noch ${days}d ${hours}h`;
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `Noch ${hours}h ${minutes}min`;
  } catch {
    return null;
  }
}

function buildDealEmbed(deal) {
  const platform = deal.platform || 'epic';
  const color = PLATFORM_COLORS[platform] || 0x5865f2;
  const platformName = PLATFORM_NAMES[platform] || platform;
  const platformLogo = PLATFORM_LOGOS[platform] || '';

  // Build description like: €4,99 **Free** until 23.04.2026
  const descParts = [];
  if (deal.originalPrice) {
    descParts.push(`~~${deal.originalPrice}~~`);
  }
  descParts.push('**Free**');

  const endFormatted = formatEndDate(deal.endDate);
  if (endFormatted) {
    descParts.push(`until ${endFormatted}`);
  }

  const remaining = formatTimeRemaining(deal.endDate);

  let description = descParts.join(' ');
  description += `\n\n[Open in browser](${deal.url}) ↗`;

  if (remaining) {
    description += `\n\n⏳ ${remaining}`;
  }

  const now = new Date();
  const timeStr = now.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(deal.title)
    .setURL(deal.url)
    .setDescription(description)
    .setFooter({ text: `Kostenlos auf ${platformName} • ${timeStr}`, iconURL: platformLogo });

  if (deal.image) {
    embed.setImage(deal.image);
  }

  // Platform logo as thumbnail (top-right)
  if (platformLogo) {
    embed.setThumbnail(platformLogo);
  }

  return embed;
}

async function postFreeGamesToChannel(guild, channelId, deals) {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || typeof channel.send !== 'function') {
    return { sent: false, reason: 'Channel could not be found or is not writable.' };
  }

  if (deals.length === 0) {
    return { sent: false, reason: 'Keine kostenlosen Spiele gefunden.' };
  }

  const headerEmbed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🎮 Kostenlose Spiele entdeckt!')
    .setDescription(`Es gibt aktuell **${deals.length}** kostenlose Spiele!`)
    .setTimestamp();

  await channel.send({ embeds: [headerEmbed] });

  for (const deal of deals) {
    const embed = buildDealEmbed(deal);
    await channel.send({ embeds: [embed] });
  }

  return { sent: true, count: deals.length, channelId };
}

async function postFreeGamesForGuild({ userId, guild }) {
  const guildId = String(guild?.id || '').trim();
  if (!guildId) {
    return { sent: false, reason: 'Invalid server context.' };
  }

  const db = await readDb();
  const feature = ensureGuildConfigAndFeature(db, userId, guildId);
  if (!feature || !feature.enabled) {
    return { sent: false, reason: 'Feature ist nicht aktiviert.' };
  }

  const config = feature.config && typeof feature.config === 'object' ? feature.config : {};
  const channelId = String(config.channelId || '').trim();
  if (!channelId) {
    return { sent: false, reason: 'No channel set for Free Games.' };
  }

  const data = await getDeals();
  const allDeals = [...(data.epic || []), ...(data.steam || [])];

  return postFreeGamesToChannel(guild, channelId, allDeals);
}

// ── Auto-posting logic ──────────────────────────────────────────────
// Track which deal IDs have already been posted per guild to avoid duplicates.
const postedDealsByGuild = new Map();
let autoPostTimer = null;

function getDealKey(deal) {
  return `${deal.platform || 'unknown'}:${deal.id}`;
}

async function autoPostNewDeals(getActiveClientsCallback) {
  let data;
  try {
    data = await getDeals(true);
  } catch (err) {
    console.error('[free-games] Auto-post: Error fetching deals:', err);
    return;
  }

  const allDeals = [...(data.epic || []), ...(data.steam || [])];
  if (allDeals.length === 0) return;

  const activeClients = getActiveClientsCallback();

  for (const { userId, client } of activeClients) {
    let db;
    try {
      db = await readDb();
    } catch {
      continue;
    }

    const guildConfigs = db.guildConfigsByUser?.[userId];
    if (!guildConfigs || typeof guildConfigs !== 'object') continue;

    for (const [guildId, guildConfig] of Object.entries(guildConfigs)) {
      const features = Array.isArray(guildConfig?.features) ? guildConfig.features : [];
      const feature = features.find((f) => f?.feature_key === FEATURE_KEY);
      if (!feature || !feature.enabled) continue;

      const config = feature.config && typeof feature.config === 'object' ? feature.config : {};
      const channelId = String(config.channelId || '').trim();
      if (!channelId) continue;

      const guildKey = `${userId}:${guildId}`;
      if (!postedDealsByGuild.has(guildKey)) {
        // First run: remember current deals without posting to avoid spamming on startup.
        postedDealsByGuild.set(guildKey, new Set(allDeals.map(getDealKey)));
        continue;
      }

      const posted = postedDealsByGuild.get(guildKey);
      const newDeals = allDeals.filter((deal) => !posted.has(getDealKey(deal)));
      if (newDeals.length === 0) continue;

      let guild;
      try {
        guild = await client.guilds.fetch(guildId);
      } catch {
        continue;
      }

      try {
        await postFreeGamesToChannel(guild, channelId, newDeals);
        for (const deal of newDeals) {
          posted.add(getDealKey(deal));
        }
        console.log(`[free-games] Auto-Post: ${newDeals.length} neue Deals an ${guildId} gesendet.`);
      } catch (err) {
        console.error(`[free-games] Auto-post error for guild ${guildId}:`, err);
      }
    }
  }
}

function startAutoPostInterval(getActiveClientsCallback, intervalMs = 30 * 60 * 1000) {
  stopAutoPostInterval();
  // Run once after a short delay so the bot is fully connected.
  setTimeout(() => {
    autoPostNewDeals(getActiveClientsCallback).catch(() => {});
  }, 10_000);
  autoPostTimer = setInterval(() => {
    autoPostNewDeals(getActiveClientsCallback).catch(() => {});
  }, intervalMs);
}

function stopAutoPostInterval() {
  if (autoPostTimer) {
    clearInterval(autoPostTimer);
    autoPostTimer = null;
  }
}

module.exports = {
  postFreeGamesForGuild,
  startAutoPostInterval,
  stopAutoPostInterval,
  FEATURE_KEY,
};
