const { spawn } = require('child_process');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const { readDb } = require('../../services/dbService');
const { createDefaultGuildConfig, defaultFeatures } = require('../../utils/defaults');

// Per-guild music state: Map<`${userId}:${guildId}`, MusicState>
const musicStates = new Map();

function getStateKey(userId, guildId) {
  return `${userId}:${guildId}`;
}

function getState(userId, guildId) {
  return musicStates.get(getStateKey(userId, guildId)) || null;
}

function createState(userId, guildId) {
  const state = {
    userId,
    guildId,
    queue: [],
    currentFFmpeg: null,
    currentPlayer: null,
    voiceConnection: null,
    channelId: null,
    channelName: null,
    nowPlaying: null,
  };
  musicStates.set(getStateKey(userId, guildId), state);
  return state;
}

function deleteState(userId, guildId) {
  const state = getState(userId, guildId);
  if (state) {
    killFFmpeg(state);
    if (state.currentPlayer) {
      try { state.currentPlayer.stop(true); } catch {}
    }
    if (state.voiceConnection) {
      try { state.voiceConnection.destroy(); } catch {}
    }
  }
  musicStates.delete(getStateKey(userId, guildId));
}

function killFFmpeg(state) {
  if (state.currentFFmpeg) {
    try { state.currentFFmpeg.kill(); } catch {}
    state.currentFFmpeg = null;
  }
}

// ── Get song info via yt-dlp ──
function getSongInfo(url, isPlaylist = false) {
  return new Promise((resolve, reject) => {
    const args = [
      '--print', '%(title)s\t%(webpage_url)s',
      '--no-warnings',
      '-f', 'bestaudio',
    ];

    if (isPlaylist) {
      args.push('--flat-playlist');
    } else {
      args.push('--no-playlist');
    }

    args.push(url);

    const proc = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || 'yt-dlp failed'));
      }

      const songs = stdout.trim().split('\n')
        .filter(Boolean)
        .map((line) => {
          const [title, songUrl] = line.split('\t');
          return { title: title || 'Unknown', url: songUrl || url };
        });

      resolve(songs);
    });

    proc.on('error', () => {
      reject(new Error('yt-dlp not found! Please install yt-dlp: https://github.com/yt-dlp/yt-dlp'));
    });
  });
}

// ── Get direct audio URL via yt-dlp ──
function getDirectUrl(url) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '-g',
      '--no-playlist',
      '-f', 'bestaudio[ext=webm]/bestaudio/best',
      '--no-warnings',
      url,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim().split('\n')[0]);
      } else {
        reject(new Error(stderr || 'yt-dlp failed'));
      }
    });

    proc.on('error', () => {
      reject(new Error('yt-dlp not found!'));
    });
  });
}

// ── Play next song from queue ──
async function playNext(state, voiceChannel) {
  if (state.queue.length === 0) {
    state.nowPlaying = null;
    killFFmpeg(state);
    if (state.currentPlayer) {
      try { state.currentPlayer.stop(true); } catch {}
      state.currentPlayer = null;
    }
    if (state.voiceConnection) {
      try { state.voiceConnection.destroy(); } catch {}
      state.voiceConnection = null;
    }
    return;
  }

  const song = state.queue[0];
  state.nowPlaying = song;

  try {
    const audioUrl = await getDirectUrl(song.url);

    // Build or reuse voice connection
    if (!state.voiceConnection || state.voiceConnection.state.status === VoiceConnectionStatus.Destroyed) {
      // Disconnect soundboard if it's using the voice connection
      try {
        const { leaveVoiceChannelForUser } = require('../debug/soundboard');
        leaveVoiceChannelForUser(state.userId);
      } catch {}

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      state.voiceConnection = connection;
      state.channelId = voiceChannel.id;
      state.channelName = voiceChannel.name;

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          state.queue.length = 0;
          deleteState(state.userId, state.guildId);
        }
      });

      if (connection.state.status !== VoiceConnectionStatus.Ready) {
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      }
    }

    // Start FFmpeg
    const ffmpeg = spawn('ffmpeg', [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-i', audioUrl,
      '-analyzeduration', '0',
      '-loglevel', 'error',
      '-ar', '48000',
      '-ac', '2',
      '-f', 's16le',
      'pipe:1',
    ]);

    state.currentFFmpeg = ffmpeg;

    ffmpeg.stderr.on('data', (data) => {
      console.error('[music-player] FFmpeg:', data.toString());
    });

    // Create or reuse player
    if (!state.currentPlayer) {
      state.currentPlayer = createAudioPlayer();

      state.currentPlayer.on(AudioPlayerStatus.Idle, () => {
        state.queue.shift();
        killFFmpeg(state);
        playNext(state, voiceChannel);
      });

      state.currentPlayer.on('error', (err) => {
        console.error('[music-player] Audio Player Error:', err.message);
        state.queue.shift();
        killFFmpeg(state);
        playNext(state, voiceChannel);
      });

      state.voiceConnection.subscribe(state.currentPlayer);
    }

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
    });

    state.currentPlayer.play(resource);
  } catch (error) {
    console.error(`[music-player] Error playing ${song.title}:`, error.message);
    state.queue.shift();
    playNext(state, voiceChannel);
  }
}

// ── Public API ──

async function addToQueue(userId, guildId, url) {
  const { getActiveClientForUser } = require('../../services/botService');
  const client = getActiveClientForUser(userId);
  if (!client) {
    throw new Error('Bot is offline. Start the bot first.');
  }

  const guild = await client.guilds.fetch(guildId);
  if (!guild) {
    throw new Error('Server not found.');
  }

  // Find a voice channel with non-bot members
  const channels = guild.channels.cache.filter((ch) => ch.isVoiceBased());
  let targetChannel = null;
  for (const channel of channels.values()) {
    const nonBotMembers = channel.members.filter((m) => !m.user.bot);
    if (nonBotMembers.size > 0) {
      targetChannel = channel;
      break;
    }
  }

  if (!targetChannel) {
    throw new Error('No voice channel with members found. Someone must be in a voice channel.');
  }

  const isPlaylist = url.includes('list=');
  const songs = await getSongInfo(url, isPlaylist);

  if (songs.length === 0) {
    throw new Error('No songs found.');
  }

  let state = getState(userId, guildId);
  if (!state) {
    state = createState(userId, guildId);
  }

  for (const song of songs) {
    state.queue.push(song);
  }

  // If nothing is playing, start
  if (!state.currentPlayer || state.currentPlayer.state.status === AudioPlayerStatus.Idle) {
    await playNext(state, targetChannel);
  }

  return {
    added: songs.length,
    songs: songs.map((s) => s.title),
    queueLength: state.queue.length,
  };
}

function skipSong(userId, guildId) {
  const state = getState(userId, guildId);
  if (!state || !state.currentPlayer || state.currentPlayer.state.status === AudioPlayerStatus.Idle) {
    throw new Error('Nothing is playing.');
  }

  const skipped = state.nowPlaying?.title || 'Unknown';
  state.currentPlayer.stop(); // triggers Idle → playNext()
  return { skipped };
}

function stopPlayback(userId, guildId) {
  const state = getState(userId, guildId);
  if (!state) {
    throw new Error('Nothing is playing.');
  }

  const wasPlaying = state.nowPlaying?.title || null;
  state.queue.length = 0;
  deleteState(userId, guildId);
  return { stopped: true, wasPlaying };
}

function getQueue(userId, guildId) {
  const state = getState(userId, guildId);
  if (!state || state.queue.length === 0) {
    return { queue: [], nowPlaying: null, channelName: null };
  }

  return {
    queue: state.queue.map((s, i) => ({
      position: i,
      title: s.title,
      url: s.url,
      isPlaying: i === 0,
    })),
    nowPlaying: state.nowPlaying ? { title: state.nowPlaying.title, url: state.nowPlaying.url } : null,
    channelName: state.channelName || null,
  };
}

function getMusicStatusForGuild(userId, guildId) {
  const state = getState(userId, guildId);
  if (!state) {
    return {
      playing: false,
      nowPlaying: null,
      queueLength: 0,
      channelName: null,
    };
  }

  const isPlaying = state.currentPlayer?.state?.status === AudioPlayerStatus.Playing;

  return {
    playing: isPlaying,
    nowPlaying: state.nowPlaying ? { title: state.nowPlaying.title, url: state.nowPlaying.url } : null,
    queueLength: state.queue.length,
    channelName: state.channelName || null,
  };
}

const FEATURE_KEY = 'music-player';

function getMusicFeatureConfig(db, userId, guildId) {
  if (!db.guildConfigsByUser?.[userId]?.[guildId]) return null;
  const guildConfig = db.guildConfigsByUser[userId][guildId];
  if (!Array.isArray(guildConfig.features)) return null;
  const feature = guildConfig.features.find((f) => f?.feature_key === FEATURE_KEY);
  if (!feature || !feature.enabled) return null;
  const cfg = feature.config && typeof feature.config === 'object' && !Array.isArray(feature.config) ? feature.config : {};
  return {
    prefix: String(cfg.prefix ?? '!').trim() || '!',
    cmdPlay: String(cfg.cmdPlay ?? 'play').trim().toLowerCase(),
    cmdSkip: String(cfg.cmdSkip ?? 'skip').trim().toLowerCase(),
    cmdStop: String(cfg.cmdStop ?? 'stop').trim().toLowerCase(),
    cmdQueue: String(cfg.cmdQueue ?? 'queue').trim().toLowerCase(),
  };
}

async function handleMessageCreate({ userId, message }) {
  try {
    await _handleMessageCreateInner(userId, message);
  } catch (error) {
    console.error('[music-player] handleMessageCreate error:', error instanceof Error ? error.message : error);
  }
}

async function _handleMessageCreateInner(userId, message) {
  if (!message || message.author?.bot) return;

  const guildId = message.guildId;
  if (!guildId) return;

  const content = (message.content || '').trim();
  if (!content) return;

  const db = await readDb();
  const cfg = getMusicFeatureConfig(db, userId, guildId);
  if (!cfg) return;

  const prefix = cfg.prefix;
  if (!content.startsWith(prefix)) return;

  const withoutPrefix = content.slice(prefix.length).trim();
  const args = withoutPrefix.split(/\s+/);
  const command = (args[0] || '').toLowerCase();

  // ── play ──
  if (cfg.cmdPlay && command === cfg.cmdPlay) {
    const url = args[1];
    if (!url) {
      await message.reply(`❌ Please provide a URL!\nExample: \`${prefix}${cfg.cmdPlay} https://www.youtube.com/watch?v=dQw4w9WgXcQ\``);
      return;
    }

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply('❌ You must be in a voice channel!');
      return;
    }

    const isPlaylist = url.includes('list=');
    const statusMsg = await message.reply(isPlaylist ? '⏳ Loading playlist...' : '⏳ Loading song...');

    try {
      const songs = await getSongInfo(url, isPlaylist);
      if (songs.length === 0) {
        await statusMsg.edit('❌ No songs found.');
        return;
      }

      let state = getState(userId, guildId);
      if (!state) {
        state = createState(userId, guildId);
      }

      for (const song of songs) {
        state.queue.push(song);
      }

      if (songs.length === 1) {
        await statusMsg.edit(`🎵 **${songs[0].title}** added to queue. (Position: ${state.queue.length})`);
      } else {
        await statusMsg.edit(`📋 **${songs.length} songs** added from playlist.`);
      }

      if (!state.currentPlayer || state.currentPlayer.state.status === AudioPlayerStatus.Idle) {
        await playNext(state, voiceChannel);
      }
    } catch (error) {
      await statusMsg.edit(`❌ Error: ${error.message}`);
    }
    return;
  }

  // ── skip ──
  if (cfg.cmdSkip && command === cfg.cmdSkip) {
    const state = getState(userId, guildId);
    if (!state || !state.currentPlayer || state.currentPlayer.state.status === AudioPlayerStatus.Idle) {
      await message.reply('❌ Nothing is playing.');
      return;
    }
    await message.reply('⏭ Song skipping...');
    state.currentPlayer.stop();
    return;
  }

  // ── stop ──
  if (cfg.cmdStop && command === cfg.cmdStop) {
    const state = getState(userId, guildId);
    if (!state && !getState(userId, guildId)) {
      await message.reply('❌ Nothing is playing.');
      return;
    }
    if (state) {
      state.queue.length = 0;
      deleteState(userId, guildId);
    }
    await message.reply('⏹ Playback stopped and queue cleared.');
    return;
  }

  // ── queue ──
  if (cfg.cmdQueue && (command === cfg.cmdQueue || command === 'q')) {
    const state = getState(userId, guildId);
    if (!state || state.queue.length === 0) {
      await message.reply('📋 The queue is empty.');
      return;
    }
    const list = state.queue
      .slice(0, 15)
      .map((s, i) => `${i === 0 ? '▶' : `${i}.`} ${s.title}`)
      .join('\n');
    const extra = state.queue.length > 15 ? `\n... and ${state.queue.length - 15} more` : '';
    await message.reply(`📋 **Queue** (${state.queue.length} songs):\n${list}${extra}`);
    return;
  }
}

module.exports = {
  addToQueue,
  skipSong,
  stopPlayback,
  getQueue,
  getMusicStatusForGuild,
  handleMessageCreate,
};
