import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import * as botApi from '@/lib/botApi';
import type { FeatureConfigProps } from '../types';

export function FreeGamesConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig, selectedGuildId, showCopyableError }: FeatureConfigProps) {
  const { toast } = useToast();

  const sendFreeGamesTest = useMutation({
    mutationFn: (guildId: string) => botApi.sendFreeGamesTest(guildId),
  });

  return (
    <>
      <div className="space-y-2">
        <Label className="text-foreground">Channel ID</Label>
        <Input
          placeholder="z.B. 123456789012345678"
          value={config.channelId || ''}
          onChange={(e) => setLocalConfig('free-games', 'channelId', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">
          Der Channel, in den kostenlose Spiele automatisch gepostet werden.
        </p>
      </div>
      <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
        <p>Automatische Prüfung alle <span className="font-semibold text-foreground">30 Minuten</span>.</p>
        <p>Neue kostenlose Spiele von <span className="font-semibold text-foreground">Epic Games</span> und <span className="font-semibold text-foreground">Steam</span> werden automatisch gepostet.</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => saveConfig(featureId, 'free-games', featureConfig)} variant="secondary">
          Speichern
        </Button>
        <Button
          variant="secondary"
          disabled={sendFreeGamesTest.isPending}
          onClick={async () => {
            if (!selectedGuildId) return;

            try {
              const result = await sendFreeGamesTest.mutateAsync(selectedGuildId);
              toast({ title: 'Free Games gepostet', description: `${result.count} Deals wurden gesendet.` });
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Free Games konnten nicht gesendet werden.';
              showCopyableError('Fehler', msg);
            }
          }}
        >
          {sendFreeGamesTest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Test senden
        </Button>
      </div>
    </>
  );
}
