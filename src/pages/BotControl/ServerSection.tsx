import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Server, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { BotFeature, Json } from '@/types/api';
import * as botApi from '@/lib/botApi';
import { useAuth } from '@/hooks/useAuth';
import { FeatureGrid } from './features/FeatureGrid';
import { featureCategories, categoryOrder } from './types';

interface BotProfile {
  id: string;
  name: string;
  avatar_url?: string;
}

interface ServerSectionProps {
  servers: Array<{ id: string; name: string; icon_url?: string; bot_profile_id?: string }> | undefined;
  serversLoading: boolean;
  profiles: BotProfile[];
  selectedGuildId: string | null;
  setSelectedGuildId: (id: string | null) => void;
  isOnline: boolean;
  showCopyableError: (title: string, message: string) => void;
  localConfigs: Record<string, Record<string, string>>;
  setLocalConfigs: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
}

export function ServerSection({
  servers,
  serversLoading,
  profiles,
  selectedGuildId,
  setSelectedGuildId,
  isOnline,
  showCopyableError,
  localConfigs,
  setLocalConfigs,
}: ServerSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [toolSearch, setToolSearch] = useState('');

  const {
    data: selectedConfig,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['guild-config', user?.id, selectedGuildId],
    queryFn: () => botApi.getGuildConfig(selectedGuildId as string),
    enabled: !!user && !!selectedGuildId,
    retry: 1,
    staleTime: 30000,
    refetchInterval: 5000,
  });

  const { data: selectedStats, isLoading: statsLoading } = useQuery({
    queryKey: ['guild-stats', user?.id, selectedGuildId],
    queryFn: () => botApi.getGuildStats(selectedGuildId as string),
    enabled: !!user && !!selectedGuildId,
    refetchInterval: 10000,
  });

  const updateGuildSettings = useMutation({
    mutationFn: ({ guildId, updates }: { guildId: string; updates: Partial<{ command_prefix: string; notifications_enabled: boolean; bot_profile_id: string | null }> }) =>
      botApi.updateGuildSettings(guildId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guild-config'] });
    },
  });

  const updateGuildFeature = useMutation({
    mutationFn: ({ guildId, featureId, updates }: { guildId: string; featureId: string; updates: { enabled?: boolean; config?: Json } }) =>
      botApi.updateGuildFeature(guildId, featureId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guild-config'] });
    },
  });

  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());

  const toggleFeatureExpanded = (featureId: string) => {
    setExpandedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      return next;
    });
  };

  const scopedFeatureKey = (featureKey: string) => `${selectedGuildId || 'none'}:${featureKey}`;

  const getConfig = (featureKey: string, dbConfig: Json) => {
    const db = (dbConfig && typeof dbConfig === 'object' && !Array.isArray(dbConfig)) ? dbConfig as Record<string, string> : {};
    return { ...db, ...localConfigs[scopedFeatureKey(featureKey)] };
  };

  const setLocalConfig = (featureKey: string, key: string, value: string) => {
    const scope = scopedFeatureKey(featureKey);
    setLocalConfigs((prev) => ({
      ...prev,
      [scope]: { ...prev[scope], [key]: value },
    }));
  };

  const saveConfig = async (featureId: string, featureKey: string, dbConfig: unknown) => {
    if (!selectedGuildId) return;

    const merged = getConfig(featureKey, dbConfig as Json);
    try {
      await updateGuildFeature.mutateAsync({
        guildId: selectedGuildId,
        featureId,
        updates: { config: merged as unknown as Json },
      });
      setLocalConfigs((prev) => {
        const next = { ...prev };
        delete next[scopedFeatureKey(featureKey)];
        return next;
      });
      toast({ title: 'Gespeichert' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Konfiguration konnte nicht gespeichert werden.';
      showCopyableError('Fehler', msg);
    }
  };

  const handleToggleFeature = async (featureId: string, currentEnabled: boolean) => {
    if (!selectedGuildId) return;
    try {
      await updateGuildFeature.mutateAsync({
        guildId: selectedGuildId,
        featureId,
        updates: { enabled: !currentEnabled },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Feature konnte nicht geändert werden.';
      showCopyableError('Fehler', msg);
    }
  };

  const handleSaveGuildSettings = async () => {
    if (!selectedGuildId || !selectedConfig) return;
    try {
      await updateGuildSettings.mutateAsync({
        guildId: selectedGuildId,
        updates: {
          notifications_enabled: selectedConfig.settings.notifications_enabled,
          bot_profile_id: selectedConfig.settings.bot_profile_id || null,
        },
      });
      toast({ title: 'Gespeichert', description: 'Server-Einstellungen wurden aktualisiert.' });
      await refetchConfig();
    } catch {
      toast({ title: 'Fehler', description: 'Server-Einstellungen konnten nicht gespeichert werden.', variant: 'destructive' });
    }
  };

  const updateLocalGuildSetting = (key: 'notifications_enabled', value: boolean) => {
    if (!selectedConfig) return;
    qc.setQueryData(['guild-config', user?.id, selectedGuildId], {
      ...selectedConfig,
      settings: { ...selectedConfig.settings, [key]: value },
    });
  };

  const updateLocalGuildBotAssignment = (botProfileId: string) => {
    if (!selectedConfig) return;
    qc.setQueryData(['guild-config', user?.id, selectedGuildId], {
      ...selectedConfig,
      settings: { ...selectedConfig.settings, bot_profile_id: botProfileId || null },
    });
  };

  const activeFeatures = useMemo<BotFeature[]>(() => selectedConfig?.features || [], [selectedConfig]);

  const categorizedFeatures = useMemo(() => {
    const search = toolSearch.trim().toLowerCase();
    const filtered = activeFeatures.filter((feature) => {
      if (!search) return true;
      const category = featureCategories[feature.feature_key] || 'Sonstiges';
      const haystack = [feature.name, feature.description, feature.feature_key, category].join(' ').toLowerCase();
      return haystack.includes(search);
    });

    const grouped = filtered.reduce<Record<string, BotFeature[]>>((acc, feature) => {
      const category = featureCategories[feature.feature_key] || 'Sonstiges';
      if (!acc[category]) acc[category] = [];
      acc[category].push(feature);
      return acc;
    }, {});

    return Object.keys(grouped)
      .sort((a, b) => {
        const aIndex = categoryOrder.indexOf(a);
        const bIndex = categoryOrder.indexOf(b);
        const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
        const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
        return safeA - safeB || a.localeCompare(b, 'de');
      })
      .map((category) => ({
        category,
        features: grouped[category].sort((a, b) => a.name.localeCompare(b.name, 'de')),
      }));
  }, [activeFeatures, toolSearch]);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Serverliste</CardTitle>
            <CardDescription className="text-muted-foreground">
              Wähle einen Discord-Server, um ihn separat zu konfigurieren.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {serversLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : !servers?.length ? (
              <p className="text-sm text-muted-foreground">
                Keine Server gefunden. Starte den Bot, damit die Serverliste geladen werden kann.
              </p>
            ) : (
              servers.map((server) => (
                <button
                  key={server.id}
                  type="button"
                  onClick={() => setSelectedGuildId(server.id)}
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-left transition-colors',
                    selectedGuildId === server.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-secondary text-foreground hover:bg-secondary/70'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {server.icon_url ? (
                      <img
                        src={server.icon_url}
                        alt={`Icon von ${server.name}`}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
                        {server.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{server.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {server.bot_profile_id ? (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                            Bot: {profiles.find((profile) => profile.id === server.bot_profile_id)?.name || 'Unbekannt'}
                          </span>
                        ) : (
                          <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                            Kein Bot zugewiesen
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">ID: {server.id}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!selectedGuildId ? (
            <Card className="bg-card border-border">
              <CardContent className="py-8">
                <p className="text-sm text-muted-foreground">Bitte links einen Server auswählen.</p>
              </CardContent>
            </Card>
          ) : configLoading || !selectedConfig ? (
            <Card className="bg-card border-border">
              <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Lade Server-Konfiguration...
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Server-Einstellungen</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Diese Einstellungen gelten nur für {selectedConfig.guild.name}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border/70 bg-secondary/40 p-4">
                    {statsLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Lade Server-Statistiken...
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          {selectedStats?.icon_url ? (
                            <img
                              src={selectedStats.icon_url}
                              alt={`Icon von ${selectedStats.name}`}
                              className="h-20 w-20 rounded-2xl object-cover"
                            />
                          ) : (
                            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/20 text-2xl font-bold text-primary">
                              {(selectedStats?.name || selectedConfig.guild.name).slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-lg font-semibold text-foreground">
                              {selectedStats?.name || selectedConfig.guild.name}
                            </p>
                            <p className="text-xs text-muted-foreground">Server-ID: {selectedConfig.guild.id}</p>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="rounded-md border border-border bg-card px-3 py-2">
                            <p className="text-xs uppercase text-muted-foreground">Online</p>
                            <p className="text-xl font-bold text-foreground">
                              {selectedStats?.online_members ?? '—'}
                            </p>
                          </div>
                          <div className="rounded-md border border-border bg-card px-3 py-2">
                            <p className="text-xs uppercase text-muted-foreground">Offline</p>
                            <p className="text-xl font-bold text-foreground">
                              {selectedStats?.offline_members ?? '—'}
                            </p>
                          </div>
                          <div className="rounded-md border border-border bg-card px-3 py-2">
                            <p className="text-xs uppercase text-muted-foreground">Gesamt</p>
                            <p className="text-xl font-bold text-foreground">
                              {selectedStats?.total_members ?? '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                    Command Prefix ist global fest auf <span className="font-semibold text-foreground">/</span> gesetzt.
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Zugewiesener Bot</Label>
                    <Select
                      value={selectedConfig.settings.bot_profile_id || 'none'}
                      onValueChange={(value) => updateLocalGuildBotAssignment(value === 'none' ? '' : value)}
                    >
                      <SelectTrigger className="bg-secondary border-border text-foreground">
                        <SelectValue placeholder="Bot auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Kein Bot</SelectItem>
                        {profiles.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground">Benachrichtigungen</Label>
                    <Switch
                      checked={Boolean(selectedConfig.settings.notifications_enabled)}
                      onCheckedChange={(v) => updateLocalGuildSetting('notifications_enabled', v)}
                    />
                  </div>
                  <Button onClick={handleSaveGuildSettings} disabled={updateGuildSettings.isPending}>
                    {updateGuildSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Server-Einstellungen speichern
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground">Tools für {selectedConfig.guild.name}</h2>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={toolSearch}
                    onChange={(e) => setToolSearch(e.target.value)}
                    placeholder="Tools suchen (z.B. Test, Moderation, Debug)..."
                    className="bg-secondary border-border pl-9 text-foreground"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedGuildId && selectedConfig && (
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <FeatureGrid
              categorizedFeatures={categorizedFeatures}
              expandedFeatures={expandedFeatures}
              toggleFeatureExpanded={toggleFeatureExpanded}
              handleToggleFeature={handleToggleFeature}
              getConfig={getConfig}
              setLocalConfig={setLocalConfig}
              saveConfig={saveConfig}
              selectedGuildId={selectedGuildId}
              guildName={selectedConfig.guild.name}
              isOnline={isOnline}
              showCopyableError={showCopyableError}
              scopedFeatureKey={scopedFeatureKey}
              setLocalConfigs={setLocalConfigs}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
