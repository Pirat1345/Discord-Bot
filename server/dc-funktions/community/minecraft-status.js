const net = require('net');
const dgram = require('dgram');
const dns = require('dns');
const { EmbedBuilder } = require('discord.js');
const { readDb } = require('../../services/dbService');
const { createDefaultGuildConfig, defaultFeatures } = require('../../utils/defaults');

const FEATURE_KEY = 'minecraft-status';
const DEFAULT_JAVA_PORT = 25565;
const DEFAULT_BEDROCK_PORT = 19132;
const PING_TIMEOUT = 10_000;

// ── Per-guild auto-post timers ─────────────────────────────────────
// Key: "userId:guildId" → { timer, intervalMs }
const autoPostTimers = new Map();
let checkTimer = null;

// ── Guild config helper ────────────────────────────────────────────

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

// ── Minecraft Java Edition Server List Ping (SLP) ──────────────────
// Protocol: https://wiki.vg/Server_List_Ping

function writeVarInt(value) {
  const parts = [];
  while (true) {
    if ((value & ~0x7f) === 0) {
      parts.push(value);
      break;
    }
    parts.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  return Buffer.from(parts);
}

function readVarInt(buffer, offset) {
  let value = 0;
  let length = 0;
  let currentByte;

  do {
    if (offset + length >= buffer.length) {
      throw new Error('VarInt zu kurz');
    }
    currentByte = buffer[offset + length];
    value |= (currentByte & 0x7f) << (length * 7);
    length++;
    if (length > 5) throw new Error('VarInt zu lang');
  } while ((currentByte & 0x80) !== 0);

  return { value, length };
}

function buildHandshakePacket(host, port) {
  const protocolVersion = writeVarInt(-1); // -1 = let server decide
  const hostBuf = Buffer.from(host, 'utf8');
  const hostLen = writeVarInt(hostBuf.length);
  const portBuf = Buffer.alloc(2);
  portBuf.writeUInt16BE(port);
  const nextState = writeVarInt(1); // 1 = status

  const packetId = writeVarInt(0x00);
  const data = Buffer.concat([packetId, protocolVersion, hostLen, hostBuf, portBuf, nextState]);
  const packetLength = writeVarInt(data.length);
  return Buffer.concat([packetLength, data]);
}

function buildStatusRequestPacket() {
  const packetId = writeVarInt(0x00);
  const packetLength = writeVarInt(packetId.length);
  return Buffer.concat([packetLength, packetId]);
}

function pingJavaServer(host, port) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({ online: false });
      }
    }, PING_TIMEOUT);

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        socket.destroy();
        resolve({ online: false });
      }
    });

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      tryParse();
    });

    function tryParse() {
      try {
        let offset = 0;
        const packetLen = readVarInt(buffer, offset);
        offset += packetLen.length;

        if (buffer.length < offset + packetLen.value) return; // wait for more data

        const packetId = readVarInt(buffer, offset);
        offset += packetId.length;

        if (packetId.value !== 0x00) return;

        const strLen = readVarInt(buffer, offset);
        offset += strLen.length;

        if (buffer.length < offset + strLen.value) return; // wait for more data

        const jsonStr = buffer.subarray(offset, offset + strLen.value).toString('utf8');

        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.destroy();

          try {
            const data = JSON.parse(jsonStr);
            resolve(normalizeJavaResponse(data, host, port));
          } catch {
            resolve({ online: false });
          }
        }
      } catch {
        // not enough data yet, wait
      }
    }

    socket.connect(port, host, () => {
      const handshake = buildHandshakePacket(host, port);
      const statusRequest = buildStatusRequestPacket();
      socket.write(handshake);
      socket.write(statusRequest);
    });
  });
}

function normalizeJavaResponse(raw, host, port) {
  // raw is the JSON from Minecraft SLP:
  // { version: { name, protocol }, players: { max, online, sample: [{name, id}] }, description, favicon, ... }

  const description = raw.description;
  let motdClean = '';
  let motdRaw = '';

  if (typeof description === 'string') {
    motdRaw = description;
    motdClean = stripMinecraftFormatting(description);
  } else if (description && typeof description === 'object') {
    // Chat component format
    motdRaw = chatComponentToString(description);
    motdClean = stripMinecraftFormatting(motdRaw);
  }

  const playerList = (raw.players?.sample || []).map((p) => ({
    name_clean: p.name || 'Unbekannt',
    name_raw: p.name || 'Unbekannt',
    uuid: p.id || '',
  }));

  return {
    online: true,
    host,
    port,
    version: {
      name_clean: stripMinecraftFormatting(raw.version?.name || ''),
      name_raw: raw.version?.name || '',
      protocol: raw.version?.protocol ?? null,
    },
    players: {
      online: raw.players?.online ?? 0,
      max: raw.players?.max ?? 0,
      list: playerList,
    },
    motd: {
      clean: motdClean,
      raw: motdRaw,
    },
    favicon: raw.favicon || null,
    software: raw.modinfo?.type || raw.forgeData ? 'Modded' : null,
  };
}

function chatComponentToString(component) {
  if (typeof component === 'string') return component;
  let text = component.text || '';
  if (Array.isArray(component.extra)) {
    for (const part of component.extra) {
      text += chatComponentToString(part);
    }
  }
  return text;
}

// ── Minecraft Bedrock Edition Ping (Unconnected Ping) ──────────────

function pingBedrockServer(host, port) {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        client.close();
        resolve({ online: false });
      }
    }, PING_TIMEOUT);

    client.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        client.close();
        resolve({ online: false });
      }
    });

    client.on('message', (msg) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      client.close();

      try {
        resolve(parseBedrockResponse(msg, host, port));
      } catch {
        resolve({ online: false });
      }
    });

    // Build Unconnected Ping packet
    const pingBuf = Buffer.alloc(33);
    pingBuf[0] = 0x01; // Packet ID: Unconnected Ping
    // Time (8 bytes) - just use 0
    pingBuf.writeBigInt64BE(BigInt(Date.now()), 1);
    // Magic bytes (16 bytes)
    const magic = Buffer.from('00ffff00fefefefefdfdfdfd12345678', 'hex');
    magic.copy(pingBuf, 9);
    // Client GUID (8 bytes)
    pingBuf.writeBigInt64BE(BigInt(2), 25);

    client.send(pingBuf, 0, pingBuf.length, port, host);
  });
}

function parseBedrockResponse(buffer, host, port) {
  // Response starts at byte 35 (1 + 8 + 8 + 16 + 2 = 35)
  // Then a UTF-8 string with semicolons
  // Format: Edition;MOTD;Protocol;Version;Online;Max;ServerID;LevelName;Gamemode;...

  if (buffer.length < 35) return { online: false };

  const strData = buffer.subarray(35).toString('utf8');
  const parts = strData.split(';');

  if (parts.length < 6) return { online: false };

  const [edition, motdLine1, protocol, version, online, max, , levelName, gamemode] = parts;

  return {
    online: true,
    host,
    port,
    version: {
      name_clean: version || 'Unbekannt',
      name_raw: version || 'Unbekannt',
      protocol: parseInt(protocol, 10) || null,
    },
    players: {
      online: parseInt(online, 10) || 0,
      max: parseInt(max, 10) || 0,
      list: [],
    },
    motd: {
      clean: stripMinecraftFormatting(motdLine1 || ''),
      raw: motdLine1 || '',
    },
    edition: edition || 'MCPE',
    gamemode: gamemode || null,
    levelName: levelName || null,
    favicon: null,
    software: null,
  };
}

// ── Unified fetch ──────────────────────────────────────────────────

async function resolveHost(host) {
  // If it's already an IP, return directly
  if (net.isIP(host)) return host;

  // Try SRV record for Java Edition
  try {
    const srvRecords = await dns.promises.resolveSrv(`_minecraft._tcp.${host}`);
    if (srvRecords?.length > 0) {
      return { host: srvRecords[0].name, port: srvRecords[0].port };
    }
  } catch {
    // No SRV record, fall through
  }

  return host;
}

async function fetchServerStatus(address, port, edition) {
  const defaultPort = edition === 'bedrock' ? DEFAULT_BEDROCK_PORT : DEFAULT_JAVA_PORT;
  let resolvedHost = address;
  let resolvedPort = port ? parseInt(port, 10) : defaultPort;

  if (edition !== 'bedrock') {
    const srv = await resolveHost(address);
    if (typeof srv === 'object') {
      resolvedHost = srv.host;
      resolvedPort = port ? parseInt(port, 10) : srv.port;
    } else {
      resolvedHost = srv;
    }
  }

  if (edition === 'bedrock') {
    return pingBedrockServer(resolvedHost, resolvedPort);
  }

  return pingJavaServer(resolvedHost, resolvedPort);
}

// ── Helpers ────────────────────────────────────────────────────────

function stripMinecraftFormatting(text) {
  if (!text) return '';
  return text.replace(/§[0-9a-fk-or]/gi, '');
}

function buildStatusEmbed(data, address, port, edition) {
  const defaultPort = edition === 'bedrock' ? String(DEFAULT_BEDROCK_PORT) : String(DEFAULT_JAVA_PORT);
  const displayAddress = port && port !== defaultPort ? `${address}:${port}` : address;

  if (!data.online) {
    return new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🟥 Server Offline')
      .setDescription(`**${displayAddress}** ist derzeit nicht erreichbar.`)
      .setTimestamp();
  }

  const version = data.version?.name_clean || data.version?.name_raw || 'Unbekannt';
  const protocol = data.version?.protocol ?? '–';
  const playersOnline = data.players?.online ?? 0;
  const playersMax = data.players?.max ?? 0;
  const playerList = (data.players?.list || [])
    .map((p) => p.name_clean || p.name_raw || 'Unbekannt')
    .filter(Boolean);

  let motd = '';
  if (data.motd?.clean) {
    motd = data.motd.clean;
  } else if (data.motd?.raw) {
    motd = stripMinecraftFormatting(data.motd.raw);
  }

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🟩 Minecraft Server Status')
    .setTimestamp();

  const fields = [
    { name: '🌐 Adresse', value: `\`${displayAddress}\``, inline: true },
    { name: '📦 Version', value: `\`${version}\``, inline: true },
    { name: '📡 Protokoll', value: `\`${protocol}\``, inline: true },
    { name: '👥 Spieler', value: `**${playersOnline}** / **${playersMax}**`, inline: true },
    { name: '🎮 Edition', value: edition === 'bedrock' ? 'Bedrock' : 'Java', inline: true },
  ];

  if (motd) {
    fields.push({ name: '📝 MOTD', value: motd.length > 1024 ? motd.slice(0, 1021) + '...' : motd, inline: false });
  }

  if (playerList.length > 0) {
    const listText = playerList.length <= 20
      ? playerList.map((n) => `\`${n}\``).join(', ')
      : playerList.slice(0, 20).map((n) => `\`${n}\``).join(', ') + ` … und ${playerList.length - 20} weitere`;
    fields.push({ name: '🎮 Online Spieler', value: listText, inline: false });
  }

  if (edition === 'bedrock') {
    if (data.gamemode) {
      fields.push({ name: '🕹️ Spielmodus', value: data.gamemode, inline: true });
    }
    if (data.levelName) {
      fields.push({ name: '🗺️ Welt', value: data.levelName, inline: true });
    }
  }

  if (data.software) {
    fields.push({ name: '⚙️ Software', value: `\`${data.software}\``, inline: true });
  }

  embed.addFields(fields);
  embed.setFooter({ text: `Minecraft ${edition === 'bedrock' ? 'Bedrock' : 'Java'} • Lokaler Ping` });

  return embed;
}

async function postStatusToChannel(guild, channelId, data, address, port, edition) {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || typeof channel.send !== 'function') {
    return { sent: false, reason: 'Channel konnte nicht gefunden werden oder ist nicht beschreibbar.' };
  }

  const embed = buildStatusEmbed(data, address, port, edition);
  await channel.send({ embeds: [embed], flags: [4096] });
  return { sent: true };
}

async function postMinecraftStatusForGuild({ userId, guild }) {
  const guildId = String(guild?.id || '').trim();
  if (!guildId) {
    return { sent: false, reason: 'Ungültiger Serverkontext.' };
  }

  const db = await readDb();
  const feature = ensureGuildConfigAndFeature(db, userId, guildId);
  if (!feature || !feature.enabled) {
    return { sent: false, reason: 'Feature ist nicht aktiviert.' };
  }

  const config = feature.config && typeof feature.config === 'object' ? feature.config : {};
  const channelId = String(config.channelId || '').trim();
  const serverAddress = String(config.serverAddress || '').trim();
  const serverPort = String(config.serverPort || '').trim();
  const edition = String(config.edition || 'java').trim();

  if (!channelId) {
    return { sent: false, reason: 'Kein Channel für Minecraft Status gesetzt.' };
  }
  if (!serverAddress) {
    return { sent: false, reason: 'Keine Server-Adresse gesetzt.' };
  }

  const data = await fetchServerStatus(serverAddress, serverPort, edition);
  return postStatusToChannel(guild, channelId, data, serverAddress, serverPort, edition);
}

// ── Per-guild auto-post logic ───────────────────────────────────────

function getGuildKey(userId, guildId) {
  return `${userId}:${guildId}`;
}

function parseIntervalMinutes(value) {
  const minutes = parseInt(String(value || ''), 10);
  if (!Number.isFinite(minutes) || minutes < 1) return 0;
  return Math.max(1, Math.min(1440, minutes)); // clamp 1 min – 24 h
}

async function autoPostForGuild(getActiveClientsCallback, userId, guildId) {
  const activeClients = getActiveClientsCallback();
  const entry = activeClients.find((c) => c.userId === userId);
  if (!entry) return;

  let db;
  try {
    db = await readDb();
  } catch {
    return;
  }

  const guildConfig = db.guildConfigsByUser?.[userId]?.[guildId];
  if (!guildConfig) return;

  const features = Array.isArray(guildConfig.features) ? guildConfig.features : [];
  const feature = features.find((f) => f?.feature_key === FEATURE_KEY);
  if (!feature || !feature.enabled) return;

  const config = feature.config && typeof feature.config === 'object' ? feature.config : {};
  const channelId = String(config.channelId || '').trim();
  const serverAddress = String(config.serverAddress || '').trim();
  const autoPost = String(config.autoPost || 'false').trim();

  if (!channelId || !serverAddress || autoPost !== 'true') return;

  const serverPort = String(config.serverPort || '').trim();
  const edition = String(config.edition || 'java').trim();

  let guild;
  try {
    guild = await entry.client.guilds.fetch(guildId);
  } catch {
    return;
  }

  try {
    const data = await fetchServerStatus(serverAddress, serverPort, edition);
    await postStatusToChannel(guild, channelId, data, serverAddress, serverPort, edition);
    console.log(`[minecraft-status] Auto-Post: Status an ${guildId} gesendet.`);
  } catch (err) {
    console.error(`[minecraft-status] Auto-Post Fehler für Guild ${guildId}:`, err);
  }
}

async function syncAutoPostTimers(getActiveClientsCallback) {
  const activeClients = getActiveClientsCallback();

  // Collect which guild keys should have timers and at what interval.
  const wanted = new Map(); // key → intervalMs

  for (const { userId } of activeClients) {
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
      const autoPost = String(config.autoPost || 'false').trim();
      if (autoPost !== 'true') continue;

      const intervalMinutes = parseIntervalMinutes(config.autoPostInterval);
      if (intervalMinutes <= 0) continue;

      const key = getGuildKey(userId, guildId);
      wanted.set(key, { intervalMs: intervalMinutes * 60_000, userId, guildId });
    }
  }

  // Remove timers for guilds that no longer want auto-post.
  for (const [key, entry] of autoPostTimers.entries()) {
    if (!wanted.has(key)) {
      clearInterval(entry.timer);
      autoPostTimers.delete(key);
      console.log(`[minecraft-status] Auto-Post Timer gestoppt: ${key}`);
    }
  }

  // Create/update timers for guilds that want auto-post.
  for (const [key, { intervalMs, userId, guildId }] of wanted.entries()) {
    const existing = autoPostTimers.get(key);

    if (existing && existing.intervalMs === intervalMs) {
      continue; // same interval, keep running
    }

    // Stop old timer if interval changed
    if (existing) {
      clearInterval(existing.timer);
    }

    const timer = setInterval(() => {
      autoPostForGuild(getActiveClientsCallback, userId, guildId).catch(() => {});
    }, intervalMs);

    autoPostTimers.set(key, { timer, intervalMs });
    console.log(`[minecraft-status] Auto-Post Timer gestartet: ${key} (alle ${intervalMs / 60000} min)`);
  }
}

function startAutoPostInterval(getActiveClientsCallback) {
  stopAutoPostInterval();
  // Check every 30 seconds for config changes and sync timers accordingly.
  setTimeout(() => {
    syncAutoPostTimers(getActiveClientsCallback).catch(() => {});
  }, 15_000);
  checkTimer = setInterval(() => {
    syncAutoPostTimers(getActiveClientsCallback).catch(() => {});
  }, 30_000);
}

function stopAutoPostInterval() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
  for (const [key, entry] of autoPostTimers.entries()) {
    clearInterval(entry.timer);
  }
  autoPostTimers.clear();
}

module.exports = {
  postMinecraftStatusForGuild,
  fetchServerStatus,
  buildStatusEmbed,
  startAutoPostInterval,
  stopAutoPostInterval,
  FEATURE_KEY,
};
