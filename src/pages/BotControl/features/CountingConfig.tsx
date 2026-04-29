import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import * as botApi from '@/lib/botApi';
import type { Json } from '@/types/api';
import type { FeatureConfigProps } from '../types';

interface Props extends FeatureConfigProps {
  getConfig: (featureKey: string, dbConfig: Json) => Record<string, string>;
  scopedFeatureKey: (featureKey: string) => string;
  setLocalConfigs: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
}

export function CountingConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig, selectedGuildId, showCopyableError, getConfig, scopedFeatureKey, setLocalConfigs }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const updateGuildFeature = useMutation({
    mutationFn: ({ guildId, featureId, updates }: { guildId: string; featureId: string; updates: { enabled?: boolean; config?: Json } }) =>
      botApi.updateGuildFeature(guildId, featureId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guild-config'] });
    },
  });

  const currentCount = Math.max(0, Number.parseInt(String(config.currentCount || '0'), 10) || 0);
  const lastUserId = String(config.lastUserId || '').trim();
  const lastUsername = String(config.lastUsername || '').trim();
  const hasLastUser = Boolean(lastUserId);
  const channelId = String(config.channelId || '').trim();
  const lastUserLabel = hasLastUser
    ? `${lastUsername || 'Unbekannt'} (${lastUserId})`
    : 'Keiner';

  return (
    <>
      <div className="space-y-2">
        <Label className="text-foreground">Counting Channel ID</Label>
        <Input
          placeholder="z.B. 123456789012345678"
          value={config.channelId || ''}
          onChange={(e) => setLocalConfig('counting', 'channelId', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
        <p>Aktiver Channel: <span className="font-semibold text-foreground">{channelId ? `#${channelId}` : 'Nicht gesetzt'}</span></p>
        <p>Aktueller Count: <span className="font-semibold text-foreground">{currentCount}</span></p>
        <p>Letzter User: <span className="font-semibold text-foreground">{lastUserLabel}</span></p>
      </div>
      <p className="text-xs text-muted-foreground">
        Discord Commands: /set game counting und /set game counting-clear
      </p>
      <div className="flex gap-2">
        <Button onClick={() => saveConfig(featureId, 'counting', featureConfig)} variant="secondary">
          Speichern
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            if (!selectedGuildId) return;

            const merged = getConfig('counting', featureConfig as Json);
            try {
              await updateGuildFeature.mutateAsync({
                guildId: selectedGuildId,
                featureId,
                updates: {
                  enabled: false,
                  config: {
                    ...merged,
                    channelId: '',
                    currentCount: '0',
                    lastUserId: '',
                    lastUsername: '',
                  } as unknown as Json,
                },
              });
              setLocalConfigs((prev) => {
                const next = { ...prev };
                delete next[scopedFeatureKey('counting')];
                return next;
              });
              toast({ title: 'Counting wurde gelöscht' });
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Counting konnte nicht gelöscht werden.';
              showCopyableError('Fehler', msg);
            }
          }}
        >
          Spiel löschen
        </Button>
      </div>
    </>
  );
}
