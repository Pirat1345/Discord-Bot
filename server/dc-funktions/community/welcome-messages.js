const { AttachmentBuilder } = require('discord.js');
const sharp = require('sharp');
const { readDb } = require('../../services/dbService');
const { createDefaultGuildConfig, defaultFeatures } = require('../../utils/defaults');

const FEATURE_KEY = 'welcome-messages';

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

function sanitizeHexColor(value, fallback) {
  const raw = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw;
  }
  return fallback;
}

function asBool(value, fallback) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

function asText(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value).trim();
}

function normalizeConfig(config) {
  const raw = config && typeof config === 'object' && !Array.isArray(config) ? config : {};

  return {
    channelId: String(raw.channelId || '').trim(),
    message: asText(raw.message, 'Willkommen {user}!'),
    welcomeBots: asBool(raw.welcomeBots, false),
    bannerEnabled: asBool(raw.bannerEnabled, true),
    bannerTitle: String(raw.bannerTitle || 'Willkommen, {user}!').trim(),
    bannerSubtitle: String(raw.bannerSubtitle || 'Glad to have you at {server}.').trim(),
    bannerFooter: String(raw.bannerFooter || '{server}').trim(),
    backgroundFrom: sanitizeHexColor(raw.backgroundFrom, '#1e3a8a'),
    backgroundTo: sanitizeHexColor(raw.backgroundTo, '#4f46e5'),
    accentColor: sanitizeHexColor(raw.accentColor, '#22d3ee'),
    textColor: sanitizeHexColor(raw.textColor, '#ffffff'),
    subtitleColor: sanitizeHexColor(raw.subtitleColor, '#dbeafe'),
    avatarRingColor: sanitizeHexColor(raw.avatarRingColor, '#22d3ee'),
  };
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function applyPlaceholders(template, member) {
  const username = member?.user?.username || 'User';
  const displayName = member?.displayName || username;
  const serverName = member?.guild?.name || 'Server';
  const mention = member?.toString?.() || username;
  const memberCount = String(member?.guild?.memberCount || '');

  return String(template || '')
    .replaceAll('{user}', displayName)
    .replaceAll('{username}', username)
    .replaceAll('{mention}', mention)
    .replaceAll('{server}', serverName)
    .replaceAll('{memberCount}', memberCount);
}

async function getAvatarDataUri(member) {
  const avatarUrl = member?.user?.displayAvatarURL?.({ extension: 'png', size: 256 }) || null;
  if (!avatarUrl) {
    return null;
  }

  try {
    const response = await fetch(avatarUrl);
    if (!response.ok) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

function buildWelcomeBannerSvg(config, member, avatarDataUri) {
  const title = escapeXml(applyPlaceholders(config.bannerTitle, member));
  const subtitle = escapeXml(applyPlaceholders(config.bannerSubtitle, member));
  const footerText = escapeXml(applyPlaceholders(config.bannerFooter, member));
  const avatarSrc = escapeXml(avatarDataUri || '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="360" viewBox="0 0 1100 360" role="img" aria-label="Welcome Banner">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${config.backgroundFrom}" />
      <stop offset="100%" stop-color="${config.backgroundTo}" />
    </linearGradient>
    <clipPath id="avatarClip">
      <circle cx="180" cy="180" r="92" />
    </clipPath>
  </defs>

  <rect width="1100" height="360" rx="28" fill="url(#bg)" />
  <circle cx="180" cy="180" r="98" fill="none" stroke="${config.avatarRingColor}" stroke-width="8" />
  ${avatarSrc ? `<image x="88" y="88" width="184" height="184" href="${avatarSrc}" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice" />` : ''}

  <rect x="320" y="82" width="6" height="196" rx="3" fill="${config.accentColor}" />
  <text x="350" y="150" fill="${config.textColor}" font-size="52" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${title}</text>
  <text x="350" y="210" fill="${config.subtitleColor}" font-size="30" font-family="Segoe UI, Arial, sans-serif">${subtitle}</text>
  <text x="350" y="262" fill="${config.subtitleColor}" fill-opacity="0.9" font-size="22" font-family="Segoe UI, Arial, sans-serif">${footerText}</text>
</svg>`;
}

async function renderBannerPngBuffer(svgMarkup) {
  return sharp(Buffer.from(svgMarkup, 'utf8'))
    .png({ quality: 95, compressionLevel: 8 })
    .toBuffer();
}

async function sendWelcomeToMember({ userId, guild, member }) {
  const guildId = String(guild?.id || '').trim();
  if (!guildId || !member?.user) {
    return { sent: false, reason: 'Invalid test context.' };
  }

  const db = await readDb();
  const feature = ensureGuildConfigAndFeature(db, userId, guildId);
  if (!feature || !feature.enabled) {
    return { sent: false, reason: 'Feature is not enabled.' };
  }

  const config = normalizeConfig(feature.config);
  if (member.user.bot && !config.welcomeBots) {
    return { sent: false, reason: 'Greeting bots is disabled.' };
  }

  const channelId = String(config.channelId || '').trim();
  if (!channelId) {
    return { sent: false, reason: 'No welcome channel set.' };
  }

  let channel = null;
  try {
    channel = await guild.channels.fetch(channelId);
  } catch {
    return { sent: false, reason: 'Welcome channel could not be loaded.' };
  }

  if (!channel || typeof channel.send !== 'function') {
    return { sent: false, reason: 'Welcome channel is not writable.' };
  }

  const content = applyPlaceholders(config.message, member).trim();

  if (!config.bannerEnabled) {
    if (!content) {
      return { sent: false, reason: 'Willkommensnachricht ist leer und Banner ist deaktiviert.' };
    }
    await channel.send({ content });
    return { sent: true, channelId };
  }

  const avatarDataUri = await getAvatarDataUri(member);
  const svg = buildWelcomeBannerSvg(config, member, avatarDataUri);
  const pngBuffer = await renderBannerPngBuffer(svg);
  const banner = new AttachmentBuilder(pngBuffer, { name: 'welcome-banner.png' });

  await channel.send(
    content
      ? { content, files: [banner] }
      : { files: [banner] }
  );

  return { sent: true, channelId };
}

async function handleGuildMemberAdd({ userId, member }) {
  const guildId = String(member?.guild?.id || '').trim();
  if (!guildId || !member?.user) {
    return;
  }

  await sendWelcomeToMember({ userId, guild: member.guild, member });
}

async function sendWelcomeTestForGuild({ userId, guild }) {
  let member = null;

  try {
    const owner = await guild.fetchOwner();
    member = owner;
  } catch {
    member = null;
  }

  if (!member) {
    try {
      member = await guild.members.fetchMe();
    } catch {
      member = null;
    }
  }

  if (!member) {
    return { sent: false, reason: 'No test member available.' };
  }

  return sendWelcomeToMember({ userId, guild, member });
}

module.exports = {
  handleGuildMemberAdd,
  sendWelcomeTestForGuild,
};
