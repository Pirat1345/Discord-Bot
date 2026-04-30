import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { useSendDiscordMessage } from '@/hooks/useBotData';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import type { FeatureConfigProps } from '../types';

interface Props extends FeatureConfigProps {
  isOnline: boolean;
}

export function TestMessageConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig, isOnline, showCopyableError }: Props) {
  const sendMessage = useSendDiscordMessage();
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSend = async (respectRateLimit: boolean) => {
    const channelId = config.channelId?.trim();
    const message = config.message?.trim();
    const repeatCount = Math.max(1, Number.parseInt(String(config.repeatCount ?? ''), 10) || 1);

    if (!channelId || !message) {
      toast({ title: t('common.error'), description: t('botControl.features.testMessage.missingFields'), variant: 'destructive' });
      return;
    }
    if (!isOnline) {
      toast({ title: t('common.error'), description: t('botControl.features.testMessage.botOffline'), variant: 'destructive' });
      return;
    }

    try {
      const result = await sendMessage.mutateAsync({ channelId, message, repeatCount, respectRateLimit });
      const sentCount = Math.max(1, Number(result?.sent_count) || repeatCount || 1);
      toast({
        title: t('botControl.features.testMessage.sent'),
        description: respectRateLimit
          ? t('botControl.features.testMessage.sentRateLimit', { count: sentCount })
          : t('botControl.features.testMessage.sentNormal', { count: sentCount }),
      });
      setLocalConfig('test-message', 'message', '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('botControl.features.testMessage.unknownError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="space-y-2">
        <Label className="text-foreground">{t('botControl.features.testMessage.channelLabel')}</Label>
        <Input
          placeholder="z.B. 123456789012345678"
          value={config.channelId || ''}
          onChange={(e) => setLocalConfig('test-message', 'channelId', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">{t('botControl.features.testMessage.messageLabel')}</Label>
        <Textarea
          placeholder={t('botControl.features.testMessage.messagePlaceholder')}
          value={config.message || ''}
          onChange={(e) => setLocalConfig('test-message', 'message', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">{t('botControl.features.testMessage.repeatLabel')}</Label>
        <Input
          type="number"
          min={1}
          step={1}
          placeholder="1"
          value={config.repeatCount ?? ''}
          onChange={(e) => setLocalConfig('test-message', 'repeatCount', e.target.value)}
          className="bg-secondary border-border text-foreground"
        />
        <p className="text-xs text-muted-foreground">{t('botControl.features.testMessage.repeatHint')}</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => saveConfig(featureId, 'test-message', featureConfig)} variant="secondary">
          {t('botControl.features.save')}
        </Button>
        <Button onClick={() => handleSend(false)} disabled={sendMessage.isPending} className="gap-2">
          {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t('botControl.features.testMessage.send')}
        </Button>
        <Button onClick={() => handleSend(true)} disabled={sendMessage.isPending} variant="secondary" className="gap-2">
          {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t('botControl.features.testMessage.sendRateLimit')}
        </Button>
      </div>
    </>
  );
}
