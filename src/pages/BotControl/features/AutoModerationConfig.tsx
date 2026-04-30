import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import type { FeatureConfigProps } from '../types';

export function AutoModerationConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig }: FeatureConfigProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-center justify-between">
        <Label className="text-foreground">{t('botControl.features.autoModeration.filterSpam')}</Label>
        <Switch
          checked={String(config.filterSpam) === 'true'}
          onCheckedChange={(v) => setLocalConfig('auto-moderation', 'filterSpam', String(v))}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-foreground">{t('botControl.features.autoModeration.filterLinks')}</Label>
        <Switch
          checked={String(config.filterLinks) === 'true'}
          onCheckedChange={(v) => setLocalConfig('auto-moderation', 'filterLinks', String(v))}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-foreground">{t('botControl.features.autoModeration.filterProfanity')}</Label>
        <Switch
          checked={String(config.filterProfanity) === 'true'}
          onCheckedChange={(v) => setLocalConfig('auto-moderation', 'filterProfanity', String(v))}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">{t('botControl.features.autoModeration.warnMessage')}</Label>
        <Input
          value={config.warnMessage || ''}
          onChange={(e) => setLocalConfig('auto-moderation', 'warnMessage', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <Button onClick={() => saveConfig(featureId, 'auto-moderation', featureConfig)} variant="secondary">
        {t('botControl.features.save')}
      </Button>
    </>
  );
}
