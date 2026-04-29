import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import * as botApi from '@/lib/botApi';
import type { FeatureConfigProps } from '../types';

export function WelcomeMessagesConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig, selectedGuildId, showCopyableError }: FeatureConfigProps) {
  const { toast } = useToast();

  const sendWelcomeTest = useMutation({
    mutationFn: (guildId: string) => botApi.sendWelcomeTest(guildId),
  });

  const welcomeBots = String(config.welcomeBots ?? 'false') === 'true';
  const bannerEnabled = String(config.bannerEnabled ?? 'true') === 'true';

  return (
    <>
      <div className="space-y-2">
        <Label className="text-foreground">Willkommens-Channel ID</Label>
        <Input
          placeholder="Channel ID"
          value={config.channelId || ''}
          onChange={(e) => setLocalConfig('welcome-messages', 'channelId', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">Willkommensnachricht</Label>
        <Textarea
          placeholder="Willkommen {mention}! 🎉"
          value={config.message || ''}
          onChange={(e) => setLocalConfig('welcome-messages', 'message', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">Platzhalter: {'{user}'}, {'{username}'}, {'{mention}'}, {'{server}'}, {'{memberCount}'}</p>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
        <div>
          <p className="text-sm font-medium text-foreground">Bots begrüßen</p>
          <p className="text-xs text-muted-foreground">Wenn aktiv, werden auch Bot-Accounts bei Join begrüßt.</p>
        </div>
        <Switch
          checked={welcomeBots}
          onCheckedChange={(v) => setLocalConfig('welcome-messages', 'welcomeBots', String(v))}
        />
      </div>

      <div className="rounded-md border border-border bg-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">Banner aktiv</Label>
          <Switch
            checked={bannerEnabled}
            onCheckedChange={(v) => setLocalConfig('welcome-messages', 'bannerEnabled', String(v))}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-foreground">Banner Titel</Label>
            <Input
              placeholder="Willkommen, {user}!"
              value={config.bannerTitle || ''}
              onChange={(e) => setLocalConfig('welcome-messages', 'bannerTitle', e.target.value)}
              className="bg-secondary border-border text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Banner Untertitel</Label>
            <Input
              placeholder="Du bist jetzt Teil von {server}!"
              value={config.bannerSubtitle || ''}
              onChange={(e) => setLocalConfig('welcome-messages', 'bannerSubtitle', e.target.value)}
              className="bg-secondary border-border text-foreground"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-foreground">Banner Fußzeile (kleiner Text unten)</Label>
            <Input
              placeholder="{server}"
              value={config.bannerFooter || ''}
              onChange={(e) => setLocalConfig('welcome-messages', 'bannerFooter', e.target.value)}
              className="bg-secondary border-border text-foreground"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-foreground">Hintergrund Start</Label>
            <Input
              type="color"
              value={String(config.backgroundFrom || '#1e3a8a')}
              onChange={(e) => setLocalConfig('welcome-messages', 'backgroundFrom', e.target.value)}
              className="h-10 bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Hintergrund Ende</Label>
            <Input
              type="color"
              value={String(config.backgroundTo || '#4f46e5')}
              onChange={(e) => setLocalConfig('welcome-messages', 'backgroundTo', e.target.value)}
              className="h-10 bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Akzent</Label>
            <Input
              type="color"
              value={String(config.accentColor || '#22d3ee')}
              onChange={(e) => setLocalConfig('welcome-messages', 'accentColor', e.target.value)}
              className="h-10 bg-secondary border-border"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-foreground">Titel-Farbe</Label>
            <Input
              type="color"
              value={String(config.textColor || '#ffffff')}
              onChange={(e) => setLocalConfig('welcome-messages', 'textColor', e.target.value)}
              className="h-10 bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Untertitel-Farbe</Label>
            <Input
              type="color"
              value={String(config.subtitleColor || '#dbeafe')}
              onChange={(e) => setLocalConfig('welcome-messages', 'subtitleColor', e.target.value)}
              className="h-10 bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Avatar-Ring</Label>
            <Input
              type="color"
              value={String(config.avatarRingColor || '#22d3ee')}
              onChange={(e) => setLocalConfig('welcome-messages', 'avatarRingColor', e.target.value)}
              className="h-10 bg-secondary border-border"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => saveConfig(featureId, 'welcome-messages', featureConfig)} variant="secondary">
          Speichern
        </Button>
        <Button
          variant="secondary"
          disabled={sendWelcomeTest.isPending}
          onClick={async () => {
            if (!selectedGuildId) return;

            try {
              await sendWelcomeTest.mutateAsync(selectedGuildId);
              toast({ title: 'Welcome-Test gesendet' });
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Welcome-Test konnte nicht gesendet werden.';
              showCopyableError('Fehler', msg);
            }
          }}
        >
          {sendWelcomeTest.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Welcome testen
        </Button>
      </div>
    </>
  );
}
