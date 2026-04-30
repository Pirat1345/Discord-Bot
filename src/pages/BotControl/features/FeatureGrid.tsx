import type { ElementType } from 'react';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Terminal, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { BotFeature, Json } from '@/types/api';
import { featureIcons } from '../types';

import { CleanerConfig } from './CleanerConfig';
import { TestMessageConfig } from './TestMessageConfig';
import { AutoModerationConfig } from './AutoModerationConfig';
import { WelcomeMessagesConfig } from './WelcomeMessagesConfig';
import { CustomCommandsConfig } from './CustomCommandsConfig';
import { CountingConfig } from './CountingConfig';
import { FreeGamesConfig } from './FreeGamesConfig';
import { MinecraftStatusConfig } from './MinecraftStatusConfig';
import { SoundboardConfig } from './SoundboardConfig';
import { MusicPlayerConfig } from './MusicPlayerConfig';
import { MinesweeperConfig } from './MinesweeperConfig';

interface FeatureGridProps {
  categorizedFeatures: Array<{ category: string; features: BotFeature[] }>;
  expandedFeatures: Set<string>;
  toggleFeatureExpanded: (featureId: string) => void;
  handleToggleFeature: (featureId: string, currentEnabled: boolean) => void;
  getConfig: (featureKey: string, dbConfig: Json) => Record<string, string>;
  setLocalConfig: (featureKey: string, key: string, value: string) => void;
  saveConfig: (featureId: string, featureKey: string, dbConfig: unknown) => Promise<void>;
  selectedGuildId: string | null;
  guildName: string;
  isOnline: boolean;
  showCopyableError: (title: string, message: string) => void;
  scopedFeatureKey: (featureKey: string) => string;
  setLocalConfigs: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
}

export function FeatureGrid({
  categorizedFeatures,
  expandedFeatures,
  toggleFeatureExpanded,
  handleToggleFeature,
  getConfig,
  setLocalConfig,
  saveConfig,
  selectedGuildId,
  guildName,
  isOnline,
  showCopyableError,
  scopedFeatureKey,
  setLocalConfigs,
}: FeatureGridProps) {
  const { t } = useTranslation();
  const renderFeatureContent = (feature: BotFeature, config: Record<string, string>) => {
    const commonProps = {
      config,
      setLocalConfig,
      saveConfig: async (fId: string, fKey: string, fCfg: unknown) => saveConfig(fId, fKey, fCfg),
      featureId: feature.id,
      featureConfig: feature.config,
      selectedGuildId,
      showCopyableError,
    };

    switch (feature.feature_key) {
      case 'cleaner':
        return <CleanerConfig selectedGuildId={selectedGuildId} guildName={guildName} showCopyableError={showCopyableError} />;
      case 'test-message':
        return <TestMessageConfig {...commonProps} isOnline={isOnline} />;
      case 'auto-moderation':
        return <AutoModerationConfig {...commonProps} />;
      case 'welcome-messages':
        return <WelcomeMessagesConfig {...commonProps} />;
      case 'custom-commands':
        return <CustomCommandsConfig {...commonProps} />;
      case 'counting':
        return <CountingConfig {...commonProps} getConfig={getConfig} scopedFeatureKey={scopedFeatureKey} setLocalConfigs={setLocalConfigs} />;
      case 'free-games':
        return <FreeGamesConfig {...commonProps} />;
      case 'minesweeper':
        return <MinesweeperConfig {...commonProps} />;
      case 'minecraft-status':
        return <MinecraftStatusConfig {...commonProps} />;
      case 'soundboard':
        return <SoundboardConfig showCopyableError={showCopyableError} />;
      case 'music-player':
        return <MusicPlayerConfig {...commonProps} />;
      default:
        return null;
    }
  };

  if (!categorizedFeatures.length) {
    return <p className="text-sm text-muted-foreground">{t('botControl.features.noToolsFound')}</p>;
  }

  return (
    <Accordion
      key={categorizedFeatures.map((entry) => entry.category).join('|')}
      type="multiple"
      defaultValue={[]}
      className="w-full"
    >
      {categorizedFeatures.map((categoryEntry) => (
        <AccordionItem key={categoryEntry.category} value={categoryEntry.category}>
          <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:no-underline">
            <span>{categoryEntry.category}</span>
            <span className="text-xs text-muted-foreground">{categoryEntry.features.length} {t('botControl.features.tools')}</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-1">
              {categoryEntry.features.map((feature) => {
                const Icon: ElementType = featureIcons[feature.feature_key] || Terminal;
                const config = getConfig(feature.feature_key, feature.config);
                const isExpanded = expandedFeatures.has(feature.id);

                return (
                  <div key={feature.id} className="rounded-lg border border-border bg-secondary/30">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Icon className="h-5 w-5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{feature.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{feature.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={feature.enabled}
                          onCheckedChange={() => handleToggleFeature(feature.id, feature.enabled)}
                        />
                        {feature.enabled && (
                          <button
                            type="button"
                            onClick={() => toggleFeatureExpanded(feature.id)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
                          </button>
                        )}
                      </div>
                    </div>

                    {feature.enabled && isExpanded && (
                      <div className="space-y-4 border-t border-border/70 px-4 pb-4 pt-4">
                        {renderFeatureContent(feature, config)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
