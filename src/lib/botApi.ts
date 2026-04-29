import { apiFetch } from '@/lib/apiClient';
import type {
  BotFeature,
  BotLog,
  DiscordBotProfile,
  BotSettings,
  AppBranding,
  DiscordServer,
  DiscordServerStats,
  GuildBotConfig,
  Json,
} from '@/types/api';

export async function getOrCreateSettings(): Promise<BotSettings> {
  return apiFetch<BotSettings>('/settings');
}

export async function updateSettings(
  updates: Partial<Pick<
    BotSettings,
    'bot_token' | 'command_prefix' | 'is_online' | 'notifications_enabled' | 'bot_description' | 'bot_status' | 'bot_activity_type' | 'bot_activity_text' | 'bot_profiles' | 'active_bot_profile_id'
  >>
) {
  return apiFetch<BotSettings>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function getFeatures(): Promise<BotFeature[]> {
  return apiFetch<BotFeature[]>('/features');
}

export async function updateFeature(featureId: string, updates: { enabled?: boolean; config?: Json }) {
  return apiFetch<BotFeature>(`/features/${featureId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function getLogs(limit = 100): Promise<BotLog[]> {
  return apiFetch<BotLog[]>(`/logs?limit=${limit}`);
}

export async function addLog(level: string, message: string) {
  return apiFetch<BotLog>('/logs', {
    method: 'POST',
    body: JSON.stringify({ level, message }),
  });
}

export async function sendDiscordMessage(channelId: string, message: string, repeatCount = 1, respectRateLimit = false) {
  return apiFetch<{ ok: boolean; ids: string[]; sent_count: number }>('/discord/send-message', {
    method: 'POST',
    body: JSON.stringify({ channelId, message, repeatCount, respectRateLimit }),
  });
}

export async function sendDiscordDm(userId: string, message: string, repeatCount = 1, respectRateLimit = false) {
  return apiFetch<{ ok: boolean; ids: string[]; sent_count: number }>('/discord/send-dm', {
    method: 'POST',
    body: JSON.stringify({ userId, message, repeatCount, respectRateLimit }),
  });
}

// ── DM Chat API ──

export interface DmRecipient {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export interface DmChannel {
  id: string;
  recipients: DmRecipient[];
  last_message_id: string | null;
}

export interface DmMessageAuthor {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_bot: boolean;
}

export interface DmMessage {
  id: string;
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  author: DmMessageAuthor;
  is_own: boolean;
  attachments: { id: string; filename: string; url: string; size: number; content_type?: string }[];
  embeds: number;
}

export interface DmUserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  banner_color: string | null;
}

export async function getDmChannels() {
  const data = await apiFetch<{ channels: DmChannel[] }>('/discord/dm/channels');
  return data.channels;
}

export async function openDmChannel(recipientId: string) {
  const data = await apiFetch<{ channel: { id: string; recipient: DmRecipient | null } }>('/discord/dm/open', {
    method: 'POST',
    body: JSON.stringify({ recipientId }),
  });
  return data.channel;
}

export async function deleteDmChannel(channelId: string) {
  return apiFetch<{ ok: boolean }>(`/discord/dm/channels/${channelId}`, {
    method: 'DELETE',
  });
}

export async function getDmMessages(channelId: string, before?: string) {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  const data = await apiFetch<{ messages: DmMessage[]; bot_user_id: string | null }>(
    `/discord/dm/channels/${channelId}/messages?${params}`
  );
  return data;
}

export async function getDmUser(userId: string) {
  const data = await apiFetch<{ user: DmUserProfile }>(`/discord/dm/user/${userId}`);
  return data.user;
}

export async function getDiscordServers() {
  const data = await apiFetch<{ servers: DiscordServer[] }>('/discord/servers');
  return data.servers;
}

export async function getGuildConfig(guildId: string) {
  return apiFetch<GuildBotConfig>(`/discord/servers/${guildId}/config`);
}

export async function getGuildStats(guildId: string) {
  return apiFetch<DiscordServerStats>(`/discord/servers/${guildId}/stats`);
}

export async function updateGuildSettings(
  guildId: string,
  updates: Partial<{ command_prefix: string; notifications_enabled: boolean; bot_profile_id: string | null }>
) {
  return apiFetch<GuildBotConfig['settings']>(`/discord/servers/${guildId}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function updateGuildFeature(
  guildId: string,
  featureId: string,
  updates: { enabled?: boolean; config?: Json }
) {
  return apiFetch<BotFeature>(`/discord/servers/${guildId}/features/${featureId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function cleanupGuild(guildId: string) {
  return apiFetch<{ ok: boolean; deleted_channels: number; deleted_roles: number }>(`/discord/servers/${guildId}/cleanup`, {
    method: 'POST',
  });
}

export async function sendWelcomeTest(guildId: string) {
  return apiFetch<{ ok: boolean; channel_id: string | null }>(`/discord/servers/${guildId}/welcome-test`, {
    method: 'POST',
  });
}

export async function sendFreeGamesTest(guildId: string) {
  return apiFetch<{ ok: boolean; count: number; channel_id: string | null }>(`/discord/servers/${guildId}/free-games-test`, {
    method: 'POST',
  });
}

export async function sendMinecraftStatusTest(guildId: string) {
  return apiFetch<{ ok: boolean }>(`/discord/servers/${guildId}/minecraft-status-test`, {
    method: 'POST',
  });
}

export interface MinecraftServerStatus {
  online: boolean;
  host: string;
  port: number;
  version?: { name_clean?: string; name_raw?: string; protocol?: number };
  players?: { online: number; max: number; list?: Array<{ name_clean?: string; name_raw?: string; uuid?: string }> };
  motd?: { clean?: string; raw?: string };
  icon?: string | null;
  software?: string;
  gamemode?: string;
  edition?: string;
  eula_blocked?: boolean;
}

export async function getMinecraftStatusPreview(serverAddress: string, serverPort: string, edition: string) {
  return apiFetch<MinecraftServerStatus>('/discord/minecraft-status-preview', {
    method: 'POST',
    body: JSON.stringify({ serverAddress, serverPort, edition }),
  });
}

export async function getDiscordBotProfile() {
  return apiFetch<DiscordBotProfile>('/discord/bot/profile');
}

export async function updateDiscordBotProfile(updates: Partial<{ username: string; avatarDataUrl: string; description: string; botToken: string }>) {
  return apiFetch<DiscordBotProfile>('/discord/bot/profile', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function updateDiscordBotPresence(
  updates: Partial<{ status: 'online' | 'idle' | 'dnd' | 'invisible'; activity_type: 'Playing' | 'Streaming' | 'Listening' | 'Watching' | 'Competing'; activity_text: string }>
) {
  return apiFetch<DiscordBotProfile>('/discord/bot/presence', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function getAppBranding() {
  return apiFetch<AppBranding>('/settings/branding');
}

export async function updateAppBranding(updates: Partial<{ appName: string; iconDataUrl: string }>) {
  return apiFetch<AppBranding>('/settings/branding', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export interface GameDeal {
  id: string;
  title: string;
  image: string;
  originalPrice: string;
  endDate: string | null;
  url: string;
  platform: 'epic' | 'steam';
}

export interface GameDealsResponse {
  epic: GameDeal[];
  steam: GameDeal[];
  fetchedAt: string;
  errors?: { epic?: string; steam?: string };
}

export async function getGameDeals(): Promise<GameDealsResponse> {
  return apiFetch<GameDealsResponse>('/games/deals');
}

export async function refreshGameDeals(): Promise<GameDealsResponse> {
  return apiFetch<GameDealsResponse>('/games/deals/refresh', { method: 'POST' });
}

export async function postGameDealsToGuild(guildId: string) {
  return apiFetch<{ ok: boolean; count: number; channelId: string }>(`/games/deals/post/${guildId}`, {
    method: 'POST',
  });
}

// --- Soundboard ---

export interface SoundboardFile {
  name: string;
  size: number;
}

export interface SoundboardVoiceStatus {
  connected: boolean;
  guildId?: string;
  guildName?: string;
  channelId?: string;
  channelName?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function getSoundboardFiles(): Promise<{ files: SoundboardFile[] }> {
  return apiFetch<{ files: SoundboardFile[] }>('/soundboard/files');
}

export async function uploadSoundboardFile(file: File): Promise<{ ok: boolean; name: string; size: number }> {
  const response = await fetch(`${API_BASE}/soundboard/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': file.name,
    },
    body: file,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  return response.json();
}

export async function deleteSoundboardFile(fileName: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/soundboard/files/${encodeURIComponent(fileName)}`, {
    method: 'DELETE',
  });
}

export async function renameSoundboardFile(fileName: string, newName: string): Promise<{ ok: boolean; name: string }> {
  return apiFetch<{ ok: boolean; name: string }>(`/soundboard/files/${encodeURIComponent(fileName)}`, {
    method: 'PATCH',
    body: JSON.stringify({ newName }),
  });
}

export async function getSoundboardStatus(): Promise<SoundboardVoiceStatus> {
  return apiFetch<SoundboardVoiceStatus>('/soundboard/status');
}

export async function joinSoundboardVoice(): Promise<{ ok: boolean; channelName?: string; guildName?: string }> {
  return apiFetch<{ ok: boolean; channelName?: string; guildName?: string }>('/soundboard/join', {
    method: 'POST',
  });
}

export async function leaveSoundboardVoice(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/soundboard/leave', {
    method: 'POST',
  });
}

export async function playSoundboardSound(fileName: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/soundboard/play/${encodeURIComponent(fileName)}`, {
    method: 'POST',
  });
}

// --- Music Player ---

export interface MusicStatus {
  playing: boolean;
  nowPlaying: { title: string; url: string } | null;
  queueLength: number;
  channelName: string | null;
}

export interface MusicQueueItem {
  position: number;
  title: string;
  url: string;
  isPlaying: boolean;
}

export interface MusicQueueResponse {
  queue: MusicQueueItem[];
  nowPlaying: { title: string; url: string } | null;
  channelName: string | null;
}

export async function getMusicStatus(guildId: string): Promise<MusicStatus> {
  return apiFetch<MusicStatus>(`/discord/servers/${guildId}/music/status`);
}

export async function getMusicQueue(guildId: string): Promise<MusicQueueResponse> {
  return apiFetch<MusicQueueResponse>(`/discord/servers/${guildId}/music/queue`);
}

export async function musicPlay(guildId: string, url: string): Promise<{ ok: boolean; added: number; songs: string[]; queueLength: number }> {
  return apiFetch<{ ok: boolean; added: number; songs: string[]; queueLength: number }>(`/discord/servers/${guildId}/music/play`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function musicSkip(guildId: string): Promise<{ ok: boolean; skipped: string }> {
  return apiFetch<{ ok: boolean; skipped: string }>(`/discord/servers/${guildId}/music/skip`, {
    method: 'POST',
  });
}

export async function musicStop(guildId: string): Promise<{ ok: boolean; stopped: boolean; wasPlaying: string | null }> {
  return apiFetch<{ ok: boolean; stopped: boolean; wasPlaying: string | null }>(`/discord/servers/${guildId}/music/stop`, {
    method: 'POST',
  });
}
