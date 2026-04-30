export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface LocalUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  must_change_password: boolean;
  totp_enabled: boolean;
  language: string;
  created_at: string;
}

export interface BotSettings {
  id: string;
  user_id: string;
  bot_token: string;
  command_prefix: string;
  is_online: boolean;
  notifications_enabled: boolean;
  bot_description?: string;
  bot_status?: 'online' | 'idle' | 'dnd' | 'invisible';
  bot_activity_type?: 'Playing' | 'Streaming' | 'Listening' | 'Watching' | 'Competing';
  bot_activity_text?: string;
  bot_profiles?: Array<{
    id: string;
    name: string;
    avatar_url: string | null;
    bot_token: string;
    command_prefix: string;
    description: string;
    status: 'online' | 'idle' | 'dnd' | 'invisible';
    activity_type: 'Playing' | 'Streaming' | 'Listening' | 'Watching' | 'Competing';
    activity_text: string;
  }>;
  active_bot_profile_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppBranding {
  app_name: string;
  icon_url: string | null;
  updated_at: string;
}

export interface DiscordBotProfile {
  username: string;
  avatar_url: string | null;
  description: string;
  status: 'online' | 'idle' | 'dnd' | 'invisible';
  activity_type: 'Playing' | 'Streaming' | 'Listening' | 'Watching' | 'Competing';
  activity_text: string;
  is_online: boolean;
}

export interface BotFeature {
  id: string;
  feature_key: string;
  name: string;
  description: string;
  enabled: boolean;
  config: Json;
  created_at: string;
  updated_at: string;
}

export interface DiscordServer {
  id: string;
  name: string;
  icon_url: string | null;
  bot_profile_id?: string | null;
}

export interface DiscordServerStats extends DiscordServer {
  total_members: number | null;
  online_members: number | null;
  offline_members: number | null;
}

export interface GuildBotSettings {
  id: string;
  user_id: string;
  guild_id: string;
  bot_profile_id?: string | null;
  command_prefix: string;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuildBotConfig {
  guild: DiscordServer;
  settings: GuildBotSettings;
  features: BotFeature[];
}

export interface BotLog {
  id: string;
  user_id: string;
  level: string;
  message: string;
  created_at: string;
}
