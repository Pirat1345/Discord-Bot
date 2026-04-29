import type { BotSettings, DiscordBotProfile } from '@/types/api';

export interface ManagedBotProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  bot_token: string;
  command_prefix: string;
  description: string;
  status: 'online' | 'idle' | 'dnd' | 'invisible';
  activity_type: 'Playing' | 'Streaming' | 'Listening' | 'Watching' | 'Competing';
  activity_text: string;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asStatus(value: unknown): ManagedBotProfile['status'] {
  return ['online', 'idle', 'dnd', 'invisible'].includes(String(value))
    ? (value as ManagedBotProfile['status'])
    : 'online';
}

function asActivityType(value: unknown): ManagedBotProfile['activity_type'] {
  return ['Playing', 'Streaming', 'Listening', 'Watching', 'Competing'].includes(String(value))
    ? (value as ManagedBotProfile['activity_type'])
    : 'Playing';
}

export function createProfileId() {
  return globalThis.crypto?.randomUUID?.() || `bot-${Date.now()}`;
}

export function createManagedBotProfile(seed?: Partial<ManagedBotProfile>): ManagedBotProfile {
  return {
    id: seed?.id || createProfileId(),
    name: seed?.name || 'Neuer Bot',
    avatar_url: seed?.avatar_url || null,
    bot_token: seed?.bot_token || '',
    command_prefix: '/',
    description: seed?.description || '',
    status: seed?.status || 'online',
    activity_type: seed?.activity_type || 'Playing',
    activity_text: seed?.activity_text || '',
  };
}

function profileFromUnknown(value: unknown): ManagedBotProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const id = asString(raw.id).trim() || createProfileId();

  return createManagedBotProfile({
    id,
    name: asString(raw.name).trim() || 'Discord Bot',
    avatar_url: asString(raw.avatar_url).trim() || null,
    bot_token: asString(raw.bot_token),
    command_prefix: '/',
    description: asString(raw.description),
    status: asStatus(raw.status),
    activity_type: asActivityType(raw.activity_type),
    activity_text: asString(raw.activity_text),
  });
}

export function getManagedBotProfiles(settings: BotSettings, runtimeProfile?: DiscordBotProfile | null) {
  const rawProfiles = Array.isArray((settings as BotSettings & { bot_profiles?: unknown }).bot_profiles)
    ? ((settings as BotSettings & { bot_profiles?: unknown }).bot_profiles as unknown[])
    : [];

  const parsedProfiles = rawProfiles
    .map(profileFromUnknown)
    .filter((entry): entry is ManagedBotProfile => Boolean(entry));

  const fallbackProfile = createManagedBotProfile({
    id: 'default-bot',
    name: runtimeProfile?.username || 'Discord Bot',
    avatar_url: runtimeProfile?.avatar_url || null,
    bot_token: settings.bot_token || '',
    command_prefix: '/',
    description: settings.bot_description || runtimeProfile?.description || '',
    status: settings.bot_status || runtimeProfile?.status || 'online',
    activity_type: settings.bot_activity_type || runtimeProfile?.activity_type || 'Playing',
    activity_text: settings.bot_activity_text || runtimeProfile?.activity_text || '',
  });

  const profiles = parsedProfiles.length ? parsedProfiles : [fallbackProfile];

  const explicitActiveId = asString((settings as BotSettings & { active_bot_profile_id?: unknown }).active_bot_profile_id).trim();
  const activeBotProfileId = profiles.some((profile) => profile.id === explicitActiveId)
    ? explicitActiveId
    : profiles[0].id;

  const mergedProfiles = profiles.map((profile) => {
    if (profile.id !== activeBotProfileId) {
      return profile;
    }

    // Only merge runtime profile if it actually belongs to this bot's token
    // (prevents stale data from a previously active bot leaking in)
    const runtimeMatchesToken = runtimeProfile && settings.bot_token && profile.bot_token === settings.bot_token;

    return {
      ...profile,
      // Stored profile name is the source of truth; runtime name only as fallback for empty/new profiles
      name: profile.name || (runtimeMatchesToken && runtimeProfile?.username ? runtimeProfile.username : '') || 'Discord Bot',
      avatar_url: (runtimeMatchesToken && runtimeProfile?.avatar_url) ? runtimeProfile.avatar_url : profile.avatar_url,
      bot_token: settings.bot_token || profile.bot_token,
      command_prefix: '/',
      description: profile.description ?? settings.bot_description ?? '',
      status: profile.status || settings.bot_status || 'online',
      activity_type: profile.activity_type || settings.bot_activity_type || 'Playing',
      activity_text: profile.activity_text ?? settings.bot_activity_text ?? '',
    };
  });

  return {
    profiles: mergedProfiles,
    activeBotProfileId,
  };
}
