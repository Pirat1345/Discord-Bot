import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useBotSettings, useUpdateSettings } from '@/hooks/useBotData';
import { useToast } from '@/hooks/use-toast';
import { getDiscordBotProfile, updateDiscordBotPresence, updateDiscordBotProfile } from '@/lib/botApi';
import { createManagedBotProfile, getManagedBotProfiles, type ManagedBotProfile } from '@/lib/botProfiles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Bot, Plus, Trash2, RotateCcw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import type { DiscordBotProfile } from '@/types/api';
import { includesSearch, PageShell } from './_shared';

export function SettingsConfigurationDiscord() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: settings, isLoading } = useBotSettings();
  const updateSettings = useUpdateSettings();
  const qc = useQueryClient();
  const { toast } = useToast();
  const location = useLocation() as { state?: { highlight?: string; profileId?: string } };
  const { data: runtimeProfile } = useQuery({
    queryKey: ['discord-bot-profile', user?.id],
    queryFn: () => getDiscordBotProfile(),
    enabled: !!user,
    staleTime: 15000,
  });

  const [profiles, setProfiles] = useState<ManagedBotProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [activeProfileId, setActiveProfileId] = useState('');
  const [avatarDataByProfile, setAvatarDataByProfile] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [search, setSearch] = useState('');

  const normalizedSearch = search.trim().toLowerCase();
  const showSearchResults = Boolean(normalizedSearch);
  const [highlightToken, setHighlightToken] = useState(false);

  useEffect(() => {
    if (!settings) return;

    const { profiles: nextProfiles, activeBotProfileId } = getManagedBotProfiles(settings, (runtimeProfile as DiscordBotProfile | undefined) || null);
    const requestedProfileId = String(location.state?.profileId || '').trim();
    const selectedFromRequest = requestedProfileId && nextProfiles.some((profile) => profile.id === requestedProfileId)
      ? requestedProfileId
      : null;

    setProfiles(nextProfiles);
    setActiveProfileId(activeBotProfileId);
    setSelectedProfileId((prev) => {
      if (selectedFromRequest) return selectedFromRequest;
      if (prev && nextProfiles.some((profile) => profile.id === prev)) return prev;
      return activeBotProfileId;
    });
  }, [settings, runtimeProfile, location.state?.profileId]);

  useEffect(() => {
    const highlight = location.state?.highlight;
    if (highlight !== 'discord-token') {
      setHighlightToken(false);
      return;
    }

    setHighlightToken(true);
    const element = document.getElementById('discord-token');
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const timeoutId = window.setTimeout(() => {
      setHighlightToken(false);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [location]);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) || null;

  const visibleProfiles = useMemo(() => {
    if (!showSearchResults) return profiles;

    return profiles.filter((profile) =>
      includesSearch(normalizedSearch, [
        profile.name,
        profile.description,
        profile.bot_token,
      ])
    );
  }, [profiles, showSearchResults, normalizedSearch]);

  const updateProfileField = <K extends keyof ManagedBotProfile>(key: K, value: ManagedBotProfile[K]) => {
    if (!selectedProfileId) return;
    setProfiles((prev) => prev.map((profile) => (profile.id === selectedProfileId ? { ...profile, [key]: value } : profile)));
  };

  const persistProfiles = async (nextProfiles: ManagedBotProfile[], nextActiveId: string, online: boolean) => {
    const activeProfile = nextProfiles.find((profile) => profile.id === nextActiveId);

    await updateSettings.mutateAsync({
      bot_profiles: nextProfiles,
      active_bot_profile_id: nextActiveId,
      ...(activeProfile
        ? {
            bot_token: activeProfile.bot_token,
            command_prefix: '/',
            bot_description: activeProfile.description,
            bot_status: activeProfile.status,
            bot_activity_type: activeProfile.activity_type,
            bot_activity_text: activeProfile.activity_text,
          }
        : {}),
      is_online: online,
    });
  };

  const handleAvatarChange = async (file: File | null) => {
    if (!file || !selectedProfileId) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: t('common.error'), description: t('settingsProfile.imageOnly'), variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;

      updateProfileField('avatar_url', result);
      setAvatarDataByProfile((prev) => ({ ...prev, [selectedProfileId]: result }));
    };
    reader.onerror = () => {
      toast({ title: t('common.error'), description: t('settingsProfile.imageReadError'), variant: 'destructive' });
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarReset = () => {
    if (!selectedProfileId) return;
    updateProfileField('avatar_url', null);
    // Use empty string as marker to send null avatar to Discord API
    setAvatarDataByProfile((prev) => ({ ...prev, [selectedProfileId]: '' }));
  };

  const handleAddProfile = async () => {
    const nextProfile = createManagedBotProfile({ name: `Bot ${profiles.length + 1}` });
    const nextProfiles = [...profiles, nextProfile];

    try {
      await updateSettings.mutateAsync({
        bot_profiles: nextProfiles,
        active_bot_profile_id: activeProfileId || nextProfile.id,
      });
      setSelectedProfileId(nextProfile.id);
      toast({ title: t('settingsDiscord.botAdded'), description: t('settingsDiscord.botAddedDescription', { name: nextProfile.name }) });
    } catch {
      toast({ title: t('common.error'), description: t('settingsDiscord.botAddError'), variant: 'destructive' });
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (profiles.length <= 1) {
      toast({ title: t('settingsDiscord.botDeleteMin'), description: t('settingsDiscord.botDeleteMin'), variant: 'destructive' });
      return;
    }

    const target = profiles.find((profile) => profile.id === profileId);
    if (!target) return;

    const confirmed = window.confirm(t('settingsDiscord.botDeleteConfirm', { name: target.name }));
    if (!confirmed) return;

    const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
    const nextActiveId = activeProfileId === profileId ? nextProfiles[0].id : activeProfileId;
    const online = Boolean(settings?.is_online) && activeProfileId !== profileId;

    try {
      await persistProfiles(nextProfiles, nextActiveId, online);
      setAvatarDataByProfile((prev) => {
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
      if (selectedProfileId === profileId) {
        setSelectedProfileId(nextProfiles[0].id);
      }
      setActiveProfileId(nextActiveId);
      toast({ title: t('settingsDiscord.botDeleted'), description: t('settingsDiscord.botDeletedDescription', { name: target.name }) });
    } catch {
      toast({ title: t('common.error'), description: t('settingsDiscord.botDeleteError'), variant: 'destructive' });
    }
  };

  const handleToggleOnline = async (profileId: string, checked: boolean) => {
    const nextActiveId = profileId;
    try {
      await persistProfiles(profiles, nextActiveId, checked);
      setActiveProfileId(nextActiveId);
      toast({
        title: checked ? t('settingsDiscord.botStarted') : t('settingsDiscord.botStopped'),
        description: checked ? t('settingsDiscord.botStartedDescription') : t('settingsDiscord.botStoppedDescription'),
      });
    } catch {
      toast({ title: t('common.error'), description: t('settingsDiscord.statusChangeError'), variant: 'destructive' });
    }
  };

  const handleSaveBot = async () => {
    if (!selectedProfile) return;

    if (!selectedProfile.name.trim()) {
      toast({ title: t('common.error'), description: t('settingsDiscord.botNameRequired'), variant: 'destructive' });
      return;
    }

    const nextProfiles = profiles.map((profile) =>
      profile.id === selectedProfile.id
        ? {
            ...profile,
            name: selectedProfile.name.trim(),
            command_prefix: '/',
          }
        : profile
    );

    setSavingProfile(true);
    try {
      const isActiveProfile = activeProfileId === selectedProfile.id;

      // Step 1: Save settings to database (always)
      if (isActiveProfile) {
        await persistProfiles(nextProfiles, activeProfileId || selectedProfile.id, Boolean(settings?.is_online));
      } else {
        await updateSettings.mutateAsync({
          bot_profiles: nextProfiles,
          active_bot_profile_id: activeProfileId,
        });
      }

      // Step 2: Sync with Discord API (best-effort — failures don't undo the save)
      let discordSyncError = '';

      if (isActiveProfile) {
        try {
          const avatarData = avatarDataByProfile[selectedProfile.id];
          const hasAvatarChange = avatarData !== undefined;
          const currentName = (runtimeProfile as DiscordBotProfile | undefined)?.username || '';
          const hasNameChange = selectedProfile.name.trim() !== currentName;
          const hasDescriptionChange = selectedProfile.description !== ((runtimeProfile as DiscordBotProfile | undefined)?.description || '');

          if (hasNameChange || hasAvatarChange || hasDescriptionChange) {
            await updateDiscordBotProfile({
              ...(hasNameChange ? { username: selectedProfile.name.trim() } : {}),
              ...(hasDescriptionChange ? { description: selectedProfile.description } : {}),
              ...(hasAvatarChange ? { avatarDataUrl: avatarData || '' } : {}),
            });
          }

          if (settings?.is_online) {
            await updateDiscordBotPresence({
              status: selectedProfile.status,
              activity_type: selectedProfile.activity_type,
              activity_text: selectedProfile.activity_text,
            });
          }

          await qc.invalidateQueries({ queryKey: ['discord-bot-profile'] });
        } catch (err: unknown) {
          discordSyncError = err instanceof Error ? err.message : t('settingsDiscord.discordSyncFailed', { error: '' });
        }
      } else if (selectedProfile.bot_token) {
        try {
          const avatarData = avatarDataByProfile[selectedProfile.id];
          const hasAvatarChange = avatarData !== undefined;

          await updateDiscordBotProfile({
            botToken: selectedProfile.bot_token,
            username: selectedProfile.name.trim(),
            description: selectedProfile.description,
            ...(hasAvatarChange ? { avatarDataUrl: avatarData || '' } : {}),
          });
        } catch (err: unknown) {
          discordSyncError = err instanceof Error ? err.message : t('settingsDiscord.discordSyncFailed', { error: '' });
        }
      }

      setAvatarDataByProfile((prev) => {
        const next = { ...prev };
        delete next[selectedProfile.id];
        return next;
      });

      if (discordSyncError) {
        toast({ title: t('common.success'), description: t('settingsDiscord.discordSyncFailed', { error: discordSyncError }) });
      } else {
        toast({ title: t('common.success'), description: t('settingsDiscord.botSaved') });
      }
    } catch {
      toast({ title: t('common.error'), description: t('settingsDiscord.botSaveError'), variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell
      title={t('settingsDiscord.title')}
      description={t('settingsDiscord.description')}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('settingsDiscord.searchPlaceholder')}
    >
      <div className="space-y-4">
        {showSearchResults && !visibleProfiles.length ? (
          <Card className="border-border bg-card">
            <CardContent className="py-8 text-sm text-muted-foreground">{t('settingsDiscord.noResults')}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <Card className="border-border bg-card">
            <CardHeader className="space-y-3">
              <CardTitle className="text-foreground">{t('settingsDiscord.botsTitle')}</CardTitle>
              <CardDescription className="text-muted-foreground">{t('settingsDiscord.botsDescription')}</CardDescription>
              <Button type="button" onClick={handleAddProfile} className="gap-2" disabled={updateSettings.isPending}>
                <Plus className="h-4 w-4" />
                {t('settingsDiscord.addBot')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {visibleProfiles.map((profile) => {
                const selected = selectedProfileId === profile.id;
                const isOnline = Boolean(settings?.is_online) && activeProfileId === profile.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setSelectedProfileId(profile.id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${selected ? 'border-primary bg-primary/10' : 'border-border bg-secondary/30 hover:bg-secondary/50'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{profile.name}</p>
                        <p className="text-xs text-muted-foreground">{isOnline ? t('settingsDiscord.active') : t('settingsDiscord.inactive')}</p>
                      </div>
                      <Switch
                        checked={isOnline}
                        onCheckedChange={(checked) => handleToggleOnline(profile.id, checked)}
                        onClick={(event) => event.stopPropagation()}
                        disabled={updateSettings.isPending}
                      />
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card
            id="discord-token"
            className={`scroll-mt-24 border-border bg-card transition-all duration-300 ${
              highlightToken ? 'border-primary/30 bg-primary/5 shadow-md shadow-primary/10' : ''
            }`}
          >
            <CardHeader>
              <CardTitle className="text-foreground">{t('settingsDiscord.settingsTitle')}</CardTitle>
              <CardDescription className="text-muted-foreground">{t('settingsDiscord.settingsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedProfile ? (
                <p className="text-sm text-muted-foreground">{t('settingsDiscord.selectBot')}</p>
              ) : (
                <>
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                    {selectedProfile.avatar_url ? (
                      <img src={selectedProfile.avatar_url} alt={selectedProfile.name} className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
                        <Bot className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{selectedProfile.name}</p>
                      <p className="text-xs text-muted-foreground">{activeProfileId === selectedProfile.id ? t('settingsDiscord.activeProfile') : t('settingsDiscord.inactiveProfile')}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-foreground">{t('settingsDiscord.botName')}</Label>
                      <Input
                        value={selectedProfile.name}
                        onChange={(e) => updateProfileField('name', e.target.value)}
                        className="bg-secondary border-border text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">{t('settingsDiscord.commandPrefix')}</Label>
                      <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground">{t('settingsDiscord.commandPrefixFixed')}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">{t('settingsDiscord.botToken')}</Label>
                    <Input
                      type="password"
                      placeholder={t('settingsDiscord.botTokenPlaceholder')}
                      value={selectedProfile.bot_token}
                      onChange={(e) => updateProfileField('bot_token', e.target.value)}
                      className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">{t('settingsDiscord.botTokenHint')}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">{t('settingsDiscord.changeAvatar')}</Label>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)}
                        className="bg-secondary border-border text-foreground flex-1"
                      />
                      {selectedProfile.avatar_url && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title={t('settingsDiscord.resetAvatar')}
                          onClick={handleAvatarReset}
                          className="shrink-0"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">{t('settingsDiscord.descriptionLabel')}</Label>
                    <Input
                      value={selectedProfile.description}
                      onChange={(e) => updateProfileField('description', e.target.value)}
                      className="bg-secondary border-border text-foreground"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-foreground">{t('settingsDiscord.status')}</Label>
                      <Select value={selectedProfile.status} onValueChange={(value: ManagedBotProfile['status']) => updateProfileField('status', value)}>
                        <SelectTrigger className="bg-secondary border-border text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="idle">{t('settingsDiscord.statusIdle')}</SelectItem>
                          <SelectItem value="dnd">{t('settingsDiscord.statusDnd')}</SelectItem>
                          <SelectItem value="invisible">{t('settingsDiscord.statusInvisible')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">{t('settingsDiscord.activityType')}</Label>
                      <Select value={selectedProfile.activity_type} onValueChange={(value: ManagedBotProfile['activity_type']) => updateProfileField('activity_type', value)}>
                        <SelectTrigger className="bg-secondary border-border text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Playing">Playing</SelectItem>
                          <SelectItem value="Streaming">Streaming</SelectItem>
                          <SelectItem value="Listening">Listening</SelectItem>
                          <SelectItem value="Watching">Watching</SelectItem>
                          <SelectItem value="Competing">Competing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2" id="discord-prefix">
                      <Label className="text-foreground">{t('settingsDiscord.activityText')}</Label>
                      <Input
                        value={selectedProfile.activity_text}
                        onChange={(e) => updateProfileField('activity_text', e.target.value)}
                        className="bg-secondary border-border text-foreground"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleSaveBot} disabled={updateSettings.isPending || savingProfile}>
                      {(updateSettings.isPending || savingProfile) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('settingsDiscord.saveBot')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => handleDeleteProfile(selectedProfile.id)}
                      disabled={updateSettings.isPending || savingProfile}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('settingsDiscord.deleteBot')}
                    </Button>
                    {profiles.length <= 1 ? (
                      <p className="self-center text-xs text-muted-foreground">
                        {t('settingsDiscord.lastBotHint')}
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
