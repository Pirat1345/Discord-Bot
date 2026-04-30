import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import type { FeatureConfigProps } from '../types';

export function CustomCommandsConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig }: FeatureConfigProps) {
  const { t } = useTranslation();

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {t('botControl.features.customCommands.description')}
      </p>
      <div className="space-y-2">
        <Label className="text-foreground">{t('botControl.features.customCommands.commandsLabel')}</Label>
        <Textarea
          placeholder='[{"command":"ping","response":"Pong! 🏓"}]'
          value={typeof config.commands === 'string' ? config.commands : JSON.stringify(config.commands || [], null, 2)}
          onChange={(e) => setLocalConfig('custom-commands', 'commands', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
          rows={4}
        />
      </div>
      <Button onClick={() => saveConfig(featureId, 'custom-commands', featureConfig)} variant="secondary">
        {t('botControl.features.save')}
      </Button>
    </>
  );
}
