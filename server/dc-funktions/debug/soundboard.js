const path = require('path');
const fs = require('fs');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');

const { usersDir } = require('../../config');

const activeConnections = new Map();

function getAudioDir(userId) {
  return path.join(usersDir, userId, 'audio');
}

function ensureAudioDir(userId) {
  const dir = getAudioDir(userId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function listAudioFiles(userId) {
  const dir = getAudioDir(userId);
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => /\.(mp3|wav)$/i.test(file))
    .map((file) => ({
      name: file,
      path: path.join(dir, file),
      size: fs.statSync(path.join(dir, file)).size,
    }));
}

function deleteAudioFile(userId, fileName) {
  const sanitized = path.basename(fileName);
  const filePath = path.join(getAudioDir(userId), sanitized);

  if (!fs.existsSync(filePath)) {
    throw new Error('Datei nicht gefunden.');
  }

  fs.unlinkSync(filePath);
}

function renameAudioFile(userId, oldName, newName) {
  const sanitizedOld = path.basename(oldName);
  const sanitizedNew = path.basename(newName);
  const ext = path.extname(sanitizedNew).toLowerCase();

  if (!/\.(mp3|wav)$/i.test(ext)) {
    throw new Error('Nur .mp3 und .wav Dateien sind erlaubt.');
  }

  const dir = getAudioDir(userId);
  const oldPath = path.join(dir, sanitizedOld);
  const newPath = path.join(dir, sanitizedNew);

  if (!fs.existsSync(oldPath)) {
    throw new Error('Datei nicht gefunden.');
  }

  if (fs.existsSync(newPath)) {
    throw new Error('Eine Datei mit diesem Namen existiert bereits.');
  }

  fs.renameSync(oldPath, newPath);
}

async function joinVoiceChannelForUser(userId, client) {
  const existingConnection = activeConnections.get(userId);
  if (existingConnection) {
    return { alreadyConnected: true, guildId: existingConnection.guildId, channelId: existingConnection.channelId };
  }

  const guilds = await client.guilds.fetch();
  let targetChannel = null;
  let targetGuild = null;

  for (const oauthGuild of guilds.values()) {
    let guild;
    try {
      guild = await client.guilds.fetch(oauthGuild.id);
    } catch {
      continue;
    }

    const voiceChannels = guild.channels.cache.filter(
      (ch) => ch.isVoiceBased() && ch.members && ch.members.size > 0
    );

    for (const channel of voiceChannels.values()) {
      const nonBotMembers = channel.members.filter((m) => !m.user.bot);
      if (nonBotMembers.size > 0) {
        targetChannel = channel;
        targetGuild = guild;
        break;
      }
    }

    if (targetChannel) break;
  }

  if (!targetChannel || !targetGuild) {
    throw new Error('Kein Voice-Channel mit Mitgliedern gefunden.');
  }

  const connection = joinVoiceChannel({
    channelId: targetChannel.id,
    guildId: targetGuild.id,
    adapterCreator: targetGuild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();
  connection.subscribe(player);

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
  } catch {
    connection.destroy();
    throw new Error('Voice-Verbindung konnte nicht hergestellt werden.');
  }

  activeConnections.set(userId, {
    connection,
    player,
    guildId: targetGuild.id,
    channelId: targetChannel.id,
    channelName: targetChannel.name,
    guildName: targetGuild.name,
  });

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    activeConnections.delete(userId);
    try {
      connection.destroy();
    } catch {
      // ignore cleanup errors
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    activeConnections.delete(userId);
  });

  return {
    alreadyConnected: false,
    guildId: targetGuild.id,
    guildName: targetGuild.name,
    channelId: targetChannel.id,
    channelName: targetChannel.name,
  };
}

function leaveVoiceChannelForUser(userId) {
  const entry = activeConnections.get(userId);
  if (!entry) {
    return false;
  }

  try {
    entry.connection.destroy();
  } catch {
    // ignore
  }

  activeConnections.delete(userId);
  return true;
}

async function playSoundForUser(userId, fileName) {
  const entry = activeConnections.get(userId);
  if (!entry) {
    throw new Error('Bot ist in keinem Voice-Channel. Bitte zuerst verbinden.');
  }

  const sanitized = path.basename(fileName);
  const filePath = path.join(getAudioDir(userId), sanitized);

  if (!fs.existsSync(filePath)) {
    throw new Error('Audio-Datei nicht gefunden.');
  }

  const resource = createAudioResource(filePath);
  entry.player.play(resource);

  return new Promise((resolve, reject) => {
    entry.player.once(AudioPlayerStatus.Idle, () => {
      resolve({ played: true, fileName: sanitized });
    });

    entry.player.once('error', (error) => {
      reject(new Error(`Wiedergabe fehlgeschlagen: ${error.message}`));
    });
  });
}

function getVoiceStatus(userId) {
  const entry = activeConnections.get(userId);
  if (!entry) {
    return { connected: false };
  }

  return {
    connected: true,
    guildId: entry.guildId,
    guildName: entry.guildName,
    channelId: entry.channelId,
    channelName: entry.channelName,
  };
}

module.exports = {
  ensureAudioDir,
  listAudioFiles,
  deleteAudioFile,
  renameAudioFile,
  joinVoiceChannelForUser,
  leaveVoiceChannelForUser,
  playSoundForUser,
  getVoiceStatus,
};
