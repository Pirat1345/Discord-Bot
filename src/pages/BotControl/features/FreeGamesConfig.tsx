import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import * as botApi from '@/lib/botApi';
import type { FeatureConfigProps } from '../types';

export function FreeGamesConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig, selectedGuildId, showCopyableError }: FeatureConfigProps) {
  const { toast } = useToast();
  const { t } = useTranslation();

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
          {t('botControl.features.freeGames.channelHint')}
        </p>
      </div>
      <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
        <p>{t('botControl.features.freeGames.autoCheck')} <span className="font-semibold text-foreground">{t('botControl.features.freeGames.interval')}</span>.</p>
        <p>{t('botControl.features.freeGames.autoPostHint')}</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => saveConfig(featureId, 'free-games', featureConfig)} variant="secondary">
          {t('botControl.features.save')}
        </Button>
        <Button
          variant="secondary"
          disabled={sendFreeGamesTest.isPending}
          onClick={async () => {
            if (!selectedGuildId) return;

            try {
              const result = await sendFreeGamesTest.mutateAsync(selectedGuildId);
              toast({ title: t('botControl.features.freeGames.posted'), description: t('botControl.features.freeGames.postedDesc', { count: result.count }) });
            } catch (error) {
              const msg = error instanceof Error ? error.message : t('botControl.features.freeGames.postError');
              showCopyableError(t('common.error'), msg);
            }
          }}
        >
          {sendFreeGamesTest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          {t('botControl.features.freeGames.testSend')}
        </Button>
      </div>
    </>
  );
}
