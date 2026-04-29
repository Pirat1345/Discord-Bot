import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBotSettings, useUpdateSettings, useAddLog } from '@/hooks/useBotData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToastAction } from '@/components/ui/toast';
import { Power, Server, Bot, Loader2, Webhook, UserCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { DiscordBotProfile } from '@/types/api';
import * as botApi from '@/lib/botApi';
import { useAuth } from '@/hooks/useAuth';
import { createManagedBotProfile, getManagedBotProfiles } from '@/lib/botProfiles';
import { DmChat } from '@/components/DmChat';

import type { ActiveSection } from './types';
import { BotSection } from './BotSection';
import { WebhookSection } from './WebhookSection';
import { AccountSection } from './AccountSection';
import { ServerSection } from './ServerSection';

export default function BotControl() {
  const { user } = useAuth();
  const { data: settings, isLoading } = useBotSettings();
  const updateSettings = useUpdateSettings();
  const addLog = useAddLog();
  const { toast } = useToast();

  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [localConfigs, setLocalConfigs] = useState<Record<string, Record<string, string>>>({});
  const [activeSection, setActiveSection] = useState<ActiveSection>('server');

  // --- Clipboard helper ---
  const copyTextToClipboard = async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fallback below */ }
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(el);
      return copied;
    } catch {
      return false;
    }
  };

  const showCopyableError = (title: string, message: string) => {
    toast({
      title,
      description: message,
      variant: 'destructive',
      action: (
        <ToastAction
          altText="Fehler kopieren"
          className="border-border/70 bg-background/90 text-foreground hover:bg-secondary"
          onClick={async (event) => {
            event.preventDefault();
            const ok = await copyTextToClipboard(message);
            if (!ok) {
              toast({
                title: 'Kopieren fehlgeschlagen',
                description: 'Bitte markiere den Text manuell.',
                variant: 'destructive',
              });
            }
          }}
        >
          Copy
        </ToastAction>
      ),
    });
  };

  // --- Bot profile / servers queries ---
  const { data: botProfile, isLoading: botProfileLoading, refetch: refetchBotProfile, error: botProfileError } = useQuery({
    queryKey: ['discord-bot-profile', user?.id],
    queryFn: () => botApi.getDiscordBotProfile(),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: servers, isLoading: serversLoading, error: serversError } = useQuery({
    queryKey: ['discord-servers', user?.id],
    queryFn: () => botApi.getDiscordServers(),
    enabled: !!user,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!servers?.length) {
      setSelectedGuildId(null);
      return;
    }
    if (!selectedGuildId || !servers.some((entry) => entry.id === selectedGuildId)) {
      setSelectedGuildId(servers[0].id);
    }
  }, [servers, selectedGuildId]);

  // --- Loading / error states ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Discord</h1>
        <Card className="bg-card border-border">
          <CardContent className="space-y-3 py-8">
            <p className="text-sm text-muted-foreground">
              Die Bot-Einstellungen konnten nicht geladen werden. Das passiert meistens, wenn die API nicht läuft oder die Verbindung zur App fehlt.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => window.location.reload()}>
                Neu laden
              </Button>
              <Button type="button" variant="secondary" onClick={() => refetchBotProfile()}>
                Bot-Daten erneut laden
              </Button>
            </div>
            {botProfileError || serversError ? (
              <p className="text-xs text-muted-foreground">
                {String((botProfileError as Error | undefined)?.message || (serversError as Error | undefined)?.message || '')}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Derived data ---
  const { profiles, activeBotProfileId } = getManagedBotProfiles(settings, (botProfile as DiscordBotProfile | undefined) || null);
  const isOnline = settings.is_online;

  const persistProfiles = async (nextProfiles: typeof profiles, activeId: string, online: boolean) => {
    const activeProfile = nextProfiles.find((profile) => profile.id === activeId);
    await updateSettings.mutateAsync({
      bot_profiles: nextProfiles,
      active_bot_profile_id: activeId,
      ...(activeProfile
        ? {
            bot_token: activeProfile.bot_token,
            command_prefix: activeProfile.command_prefix,
            bot_description: activeProfile.description,
            bot_status: activeProfile.status,
            bot_activity_type: activeProfile.activity_type,
            bot_activity_text: activeProfile.activity_text,
          }
        : {}),
      is_online: online,
    });
  };

  const handleToggleProfile = async (profileId: string, enabled: boolean) => {
    const target = profiles.find((profile) => profile.id === profileId);
    if (!target) return;
    try {
      await persistProfiles(profiles, profileId, enabled);
      await addLog.mutateAsync({
        level: enabled ? 'success' : 'warn',
        message: enabled ? `Bot ${target.name} wurde gestartet.` : `Bot ${target.name} wurde gestoppt.`,
      });
      await refetchBotProfile();
      toast({
        title: enabled ? 'Bot gestartet' : 'Bot gestoppt',
        description: enabled ? `${target.name} ist jetzt aktiv.` : `${target.name} wurde deaktiviert.`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Status konnte nicht geändert werden.';
      showCopyableError('Fehler', msg);
    }
  };

  const handleAddBot = async () => {
    const nextBot = createManagedBotProfile({ name: `Bot ${profiles.length + 1}` });
    const nextProfiles = [...profiles, nextBot];
    try {
      await updateSettings.mutateAsync({
        bot_profiles: nextProfiles,
        active_bot_profile_id: activeBotProfileId || nextBot.id,
      });
      toast({ title: 'Bot hinzugefügt', description: `${nextBot.name} wurde angelegt.` });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bot konnte nicht angelegt werden.';
      showCopyableError('Fehler', msg);
    }
  };

  const handleDeleteBot = async (profileId: string) => {
    if (profiles.length <= 1) {
      toast({ title: 'Nicht möglich', description: 'Mindestens ein Bot-Profil muss vorhanden bleiben.', variant: 'destructive' });
      return;
    }
    const target = profiles.find((profile) => profile.id === profileId);
    if (!target) return;
    const confirmed = window.confirm(`Bot ${target.name} wirklich löschen?`);
    if (!confirmed) return;

    const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
    const nextActiveId = activeBotProfileId === profileId ? nextProfiles[0].id : activeBotProfileId;
    const shouldStayOnline = isOnline && activeBotProfileId !== profileId;

    try {
      await persistProfiles(nextProfiles, nextActiveId, shouldStayOnline);
      toast({ title: 'Bot gelöscht', description: `${target.name} wurde entfernt.` });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Bot konnte nicht gelöscht werden.';
      showCopyableError('Fehler', msg);
    }
  };

  const activeProfile = profiles.find((profile) => profile.id === activeBotProfileId) || profiles[0];
  const serverSummary = useMemo(() => {
    if (!servers?.length) return 'Noch keine Server verbunden';
    if (servers.length === 1) return servers[0].name;
    const firstTwo = servers.slice(0, 2).map((server) => server.name).join(', ');
    const remainder = servers.length - 2;
    return remainder > 0 ? `${firstTwo} +${remainder}` : firstTwo;
  }, [servers]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Discord</h1>

      {/* Status Bar */}
      <Card className="bg-card border-border">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl transition-colors',
                isOnline ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
              )}
            >
              <Power className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {isOnline ? `${activeProfile?.name || 'Bot'} ist aktiv` : 'Kein Bot ist aktiv'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isOnline ? `Server: ${serverSummary}` : 'Aktiviere einen Bot in der Bot-Liste unten.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Navigation */}
      <Card className="bg-card border-border">
        <CardContent className="py-4 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Quellen</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button type="button" variant={activeSection === 'bot' ? 'default' : 'secondary'} className="justify-start gap-2" onClick={() => setActiveSection('bot')}>
                <Bot className="h-4 w-4" /> Bot
              </Button>
              <Button type="button" variant={activeSection === 'webhook' ? 'default' : 'secondary'} className="justify-start gap-2" onClick={() => setActiveSection('webhook')}>
                <Webhook className="h-4 w-4" /> Webhook
              </Button>
              <Button type="button" variant={activeSection === 'account' ? 'default' : 'secondary'} className="justify-start gap-2" onClick={() => setActiveSection('account')}>
                <UserCircle className="h-4 w-4" /> Account
              </Button>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Ziele</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant={activeSection === 'server' ? 'default' : 'secondary'} className="justify-start gap-2" onClick={() => setActiveSection('server')}>
                <Server className="h-4 w-4" /> Server
              </Button>
              <Button type="button" variant={activeSection === 'dm' ? 'default' : 'secondary'} className="justify-start gap-2" onClick={() => setActiveSection('dm')}>
                <Mail className="h-4 w-4" /> DM
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Section */}
      {activeSection === 'bot' && (
        <BotSection
          profiles={profiles}
          activeBotProfileId={activeBotProfileId}
          isOnline={isOnline}
          botProfileLoading={botProfileLoading}
          serverSummary={serverSummary}
          updateSettingsPending={updateSettings.isPending}
          handleToggleProfile={handleToggleProfile}
          handleAddBot={handleAddBot}
          handleDeleteBot={handleDeleteBot}
        />
      )}

      {activeSection === 'webhook' && <WebhookSection />}
      {activeSection === 'account' && <AccountSection />}

      {activeSection === 'server' && (
        <ServerSection
          servers={servers}
          serversLoading={serversLoading}
          profiles={profiles}
          selectedGuildId={selectedGuildId}
          setSelectedGuildId={setSelectedGuildId}
          isOnline={isOnline}
          showCopyableError={showCopyableError}
          localConfigs={localConfigs}
          setLocalConfigs={setLocalConfigs}
        />
      )}

      {activeSection === 'dm' && (
        <DmChat activeBotProfileId={activeBotProfileId} />
      )}
    </div>
  );
}
