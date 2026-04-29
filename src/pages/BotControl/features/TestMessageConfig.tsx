import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { useSendDiscordMessage } from '@/hooks/useBotData';
import { useToast } from '@/hooks/use-toast';
import type { FeatureConfigProps } from '../types';

interface Props extends FeatureConfigProps {
  isOnline: boolean;
}

export function TestMessageConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig, isOnline, showCopyableError }: Props) {
  const sendMessage = useSendDiscordMessage();
  const { toast } = useToast();

  const handleSend = async (respectRateLimit: boolean) => {
    const channelId = config.channelId?.trim();
    const message = config.message?.trim();
    const repeatCount = Math.max(1, Number.parseInt(String(config.repeatCount ?? ''), 10) || 1);

    if (!channelId || !message) {
      toast({ title: 'Fehler', description: 'Bitte Channel-ID und Nachricht eingeben.', variant: 'destructive' });
      return;
    }
    if (!isOnline) {
      toast({ title: 'Fehler', description: 'Bot muss online sein.', variant: 'destructive' });
      return;
    }

    try {
      const result = await sendMessage.mutateAsync({ channelId, message, repeatCount, respectRateLimit });
      const sentCount = Math.max(1, Number(result?.sent_count) || repeatCount || 1);
      toast({
        title: 'Gesendet!',
        description: respectRateLimit
          ? `Nachricht wurde ${sentCount}x gesendet (Rate-Limit respektiert).`
          : `Nachricht wurde ${sentCount}x über Discord gesendet.`,
      });
      setLocalConfig('test-message', 'message', '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler', description: msg, variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="space-y-2">
        <Label className="text-foreground">Channel ID</Label>
        <Input
          placeholder="z.B. 123456789012345678"
          value={config.channelId || ''}
          onChange={(e) => setLocalConfig('test-message', 'channelId', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">Nachricht</Label>
        <Textarea
          placeholder="Deine Testnachricht..."
          value={config.message || ''}
          onChange={(e) => setLocalConfig('test-message', 'message', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">Häufigkeit (Anzahl)</Label>
        <Input
          type="number"
          min={1}
          step={1}
          placeholder="1"
          value={config.repeatCount ?? ''}
          onChange={(e) => setLocalConfig('test-message', 'repeatCount', e.target.value)}
          className="bg-secondary border-border text-foreground"
        />
        <p className="text-xs text-muted-foreground">Leer oder kleiner als 1 wird beim Senden automatisch als 1 behandelt.</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => saveConfig(featureId, 'test-message', featureConfig)} variant="secondary">
          Speichern
        </Button>
        <Button onClick={() => handleSend(false)} disabled={sendMessage.isPending} className="gap-2">
          {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Senden
        </Button>
        <Button onClick={() => handleSend(true)} disabled={sendMessage.isPending} variant="secondary" className="gap-2">
          {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Rate-Limit senden
        </Button>
      </div>
    </>
  );
}
