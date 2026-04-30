import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import * as botApi from '@/lib/botApi';
import type { FeatureConfigProps } from '../types';

export function WelcomeMessagesConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig, selectedGuildId, showCopyableError }: FeatureConfigProps) {
  const { toast } = useToast();
  const { t } = useTranslation();

  const sendWelcomeTest = useMutation({
    mutationFn: (guildId: string) => botApi.sendWelcomeTest(guildId),
  });

  const welcomeBots = String(config.welcomeBots ?? 'false') === 'true';
  const bannerEnabled = String(config.bannerEnabled ?? 'true') === 'true';

  return (
    <>
      <div className="space-y-2">
        <Label className="text-foreground">{t('botControl.features.welcomeMessages.channelLabel')}</Label>
        <Input
          placeholder="Channel ID"
          value={config.channelId || ''}
          onChange={(e) => setLocalConfig('welcome-messages', 'channelId', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">{t('botControl.features.welcomeMessages.messageLabel')}</Label>
        <Textarea
          placeholder={t('botControl.features.welcomeMessages.messagePlaceholder')}
          value={config.message || ''}
          onChange={(e) => setLocalConfig('welcome-messages', 'message', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">{t('botControl.features.welcomeMessages.placeholders')}</p>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
        <div>
          <p className="text-sm font-medium text-foreground">{t('botControl.features.welcomeMessages.welcomeBots')}</p>
          <p className="text-xs text-muted-foreground">{t('botControl.features.welcomeMessages.welcomeBotsHint')}</p>
        </div>
        <Switch
          checked={welcomeBots}
          onCheckedChange={(v) => setLocalConfig('welcome-messages', 'welcomeBots', String(v))}
        />
      </div>

      <div className="rounded-md border border-border bg-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-foreground">{t('botControl.features.welcomeMessages.bannerActive')}</Label>
          <Switch
            checked={bannerEnabled}
            onCheckedChange={(v) => setLocalConfig('welcome-messages', 'bannerEnabled', String(v))}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-foreground">{t('botControl.features.welcomeMessages.bannerTitle')}</Label>
            <Input
              placeholder={t('botControl.features.welcomeMessages.bannerTitlePlaceholder')}
              value={config.bannerTitle || ''}
              onChange={(e) => setLocalConfig('welcome-messages', 'bannerTitle', e.target.value)}
              className="bg-secondary border-border text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">{t('botControl.features.welcomeMessages.bannerSubtitle')}</Label>
            <Input
              placeholder={t('botControl.features.welcomeMessages.bannerSubtitlePlaceholder')}
              value={config.bannerSubtitle || ''}
              onChange={(e) => setLocalConfig('welcome-messages', 'bannerSubtitle', e.target.value)}
              className="bg-secondary border-border text-foreground"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-foreground">{t('botControl.features.welcomeMessages.bannerFooter')}</Label>
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
            <Label className="text-foreground">{t('botControl.features.welcomeMessages.bgStart')}</Label>
            <Input
              type="color"
              value={String(config.backgroundFrom || '#1e3a8a')}
              onChange={(e) => setLocalConfig('welcome-messages', 'backgroundFrom', e.target.value)}
              className="h-10 bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">{t('botControl.features.welcomeMessages.bgEnd')}</Label>
            <Input
              type="color"
              value={String(config.backgroundTo || '#4f46e5')}
              onChange={(e) => setLocalConfig('welcome-messages', 'backgroundTo', e.target.value)}
              className="h-10 bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">{t('botControl.features.welcomeMessages.accent')}</Label>
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
            <Label className="text-foreground">{t('botControl.features.welcomeMessages.titleColor')}</Label>
            <Input
              type="color"
              value={String(config.textColor || '#ffffff')}
              onChange={(e) => setLocalConfig('welcome-messages', 'textColor', e.target.value)}
              className="h-10 bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">{t('botControl.features.welcomeMessages.subtitleColor')}</Label>
            <Input
              type="color"
              value={String(config.subtitleColor || '#dbeafe')}
              onChange={(e) => setLocalConfig('welcome-messages', 'subtitleColor', e.target.value)}
              className="h-10 bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">{t('botControl.features.welcomeMessages.avatarRing')}</Label>
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
          {t('botControl.features.save')}
        </Button>
        <Button
          variant="secondary"
          disabled={sendWelcomeTest.isPending}
          onClick={async () => {
            if (!selectedGuildId) return;

            try {
              await sendWelcomeTest.mutateAsync(selectedGuildId);
              toast({ title: t('botControl.features.welcomeMessages.testSent') });
            } catch (error) {
              const msg = error instanceof Error ? error.message : t('botControl.features.welcomeMessages.testError');
              showCopyableError(t('common.error'), msg);
            }
          }}
        >
          {sendWelcomeTest.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {t('botControl.features.welcomeMessages.testButton')}
        </Button>
      </div>
    </>
  );
}
