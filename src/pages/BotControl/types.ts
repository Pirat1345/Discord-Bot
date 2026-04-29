import type { ElementType } from 'react';
import { Send, Trash2, Shield, MessageCircle, Terminal, Server, Hash, Gamepad2, Volume2, Music, Newspaper, Bomb } from 'lucide-react';

export const featureIcons: Record<string, ElementType> = {
  'test-message': Send,
  cleaner: Trash2,
  'auto-moderation': Shield,
  'welcome-messages': MessageCircle,
  'custom-commands': Terminal,
  counting: Hash,
  'free-games': Newspaper,
  soundboard: Volume2,
  'music-player': Music,
  'minecraft-status': Server,
  minesweeper: Bomb,
};

export const featureCategories: Record<string, string> = {
  'test-message': 'Debug',
  cleaner: 'Debug',
  soundboard: 'Debug',
  'auto-moderation': 'Moderation',
  'welcome-messages': 'Community',
  'music-player': 'Community',
  'minecraft-status': 'Community',
  'custom-commands': 'Commands',
  counting: 'Games',
  minesweeper: 'Games',
  'free-games': 'News',
};

export const categoryOrder = ['Debug', 'Moderation', 'Community', 'Commands', 'Games', 'News', 'Sonstiges'];

export type ActiveSection = 'bot' | 'webhook' | 'account' | 'server' | 'dm';

export interface FeatureConfigProps {
  config: Record<string, string>;
  setLocalConfig: (featureKey: string, key: string, value: string) => void;
  saveConfig: (featureId: string, featureKey: string, dbConfig: unknown) => Promise<void>;
  featureId: string;
  featureConfig: unknown;
  selectedGuildId: string | null;
  showCopyableError: (title: string, message: string) => void;
}
