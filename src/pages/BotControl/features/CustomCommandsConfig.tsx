import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { FeatureConfigProps } from '../types';

export function CustomCommandsConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig }: FeatureConfigProps) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Custom Commands laufen als Slash-Commands.
        Konfiguriere die Antworten in den Bot-Einstellungen.
      </p>
      <div className="space-y-2">
        <Label className="text-foreground">Befehle (JSON Format)</Label>
        <Textarea
          placeholder='[{"command":"ping","response":"Pong! 🏓"}]'
          value={typeof config.commands === 'string' ? config.commands : JSON.stringify(config.commands || [], null, 2)}
          onChange={(e) => setLocalConfig('custom-commands', 'commands', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
          rows={4}
        />
      </div>
      <Button onClick={() => saveConfig(featureId, 'custom-commands', featureConfig)} variant="secondary">
        Speichern
      </Button>
    </>
  );
}
