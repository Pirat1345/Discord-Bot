import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Search } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import * as botApi from '@/lib/botApi';
import type { FeatureConfigProps } from '../types';

export function MinecraftStatusConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig, selectedGuildId, showCopyableError }: FeatureConfigProps) {
  const { toast } = useToast();

  const sendMinecraftStatusTest = useMutation({
    mutationFn: (guildId: string) => botApi.sendMinecraftStatusTest(guildId),
  });

  const mcPreview = useMutation({
    mutationFn: (params: { serverAddress: string; serverPort: string; edition: string }) =>
      botApi.getMinecraftStatusPreview(params.serverAddress, params.serverPort, params.edition),
  });

  return (
    <>
      <div className="space-y-2">
        <Label className="text-foreground">Channel ID</Label>
        <Input
          placeholder="z.B. 123456789012345678"
          value={config.channelId || ''}
          onChange={(e) => setLocalConfig('minecraft-status', 'channelId', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">
          Der Channel, in den der Minecraft Server Status gepostet wird.
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">Server Adresse</Label>
        <Input
          placeholder="z.B. mc.hypixel.net oder 192.168.1.100"
          value={config.serverAddress || ''}
          onChange={(e) => setLocalConfig('minecraft-status', 'serverAddress', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-foreground">Port (optional)</Label>
          <Input
            placeholder="25565"
            value={config.serverPort || ''}
            onChange={(e) => setLocalConfig('minecraft-status', 'serverPort', e.target.value)}
            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-foreground">Edition</Label>
          <Select
            value={config.edition || 'java'}
            onValueChange={(v) => setLocalConfig('minecraft-status', 'edition', v)}
          >
            <SelectTrigger className="bg-secondary border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="java">Java Edition</SelectItem>
              <SelectItem value="bedrock">Bedrock Edition</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          checked={config.autoPost === 'true'}
          onCheckedChange={(checked) => setLocalConfig('minecraft-status', 'autoPost', checked ? 'true' : 'false')}
        />
        <Label className="text-foreground">Automatisch posten</Label>
      </div>
      {config.autoPost === 'true' && (
        <div className="space-y-2">
          <Label className="text-foreground">Intervall (Minuten)</Label>
          <Input
            type="number"
            min={1}
            max={1440}
            step={1}
            placeholder="5"
            value={config.autoPostInterval || ''}
            onChange={(e) => setLocalConfig('minecraft-status', 'autoPostInterval', e.target.value)}
            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground w-32"
          />
          <p className="text-xs text-muted-foreground">
            Wie oft der Status automatisch gepostet wird (1–1440 Minuten).
          </p>
        </div>
      )}

      {mcPreview.data && (
        <div className="rounded-md border border-border bg-card p-3 text-sm space-y-1">
          <p className="font-semibold text-foreground">
            {mcPreview.data.online ? '🟩 Server Online' : '🟥 Server Offline'}
          </p>
          {mcPreview.data.online && (
            <>
              <p className="text-muted-foreground">
                Version: <span className="font-semibold text-foreground">{mcPreview.data.version?.name_clean || 'Unbekannt'}</span>
              </p>
              <p className="text-muted-foreground">
                Spieler: <span className="font-semibold text-foreground">{mcPreview.data.players?.online ?? 0} / {mcPreview.data.players?.max ?? 0}</span>
              </p>
              {mcPreview.data.motd?.clean && (
                <p className="text-muted-foreground">
                  MOTD: <span className="text-foreground">{mcPreview.data.motd.clean}</span>
                </p>
              )}
              {(mcPreview.data.players?.list?.length ?? 0) > 0 && (
                <p className="text-muted-foreground">
                  Online: <span className="text-foreground">{mcPreview.data.players!.list!.map((p) => p.name_clean || p.name_raw).join(', ')}</span>
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => saveConfig(featureId, 'minecraft-status', featureConfig)} variant="secondary">
          Speichern
        </Button>
        <Button
          variant="secondary"
          disabled={mcPreview.isPending || !config.serverAddress?.trim()}
          onClick={async () => {
            try {
              await mcPreview.mutateAsync({
                serverAddress: config.serverAddress || '',
                serverPort: config.serverPort || '',
                edition: config.edition || 'java',
              });
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Server konnte nicht erreicht werden.';
              showCopyableError('Fehler', msg);
            }
          }}
        >
          {mcPreview.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
          Vorschau
        </Button>
        <Button
          variant="secondary"
          disabled={sendMinecraftStatusTest.isPending}
          onClick={async () => {
            if (!selectedGuildId) return;
            try {
              await sendMinecraftStatusTest.mutateAsync(selectedGuildId);
              toast({ title: 'Minecraft Status gepostet' });
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Status konnte nicht gesendet werden.';
              showCopyableError('Fehler', msg);
            }
          }}
        >
          {sendMinecraftStatusTest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Test senden
        </Button>
      </div>
    </>
  );
}
