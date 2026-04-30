import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { useBotSettings, useUpdateSettings } from '@/hooks/useBotData';
import { useToast } from '@/hooks/use-toast';
import { getAppBranding, updateAppBranding } from '@/lib/botApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Bot, Globe, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { includesSearch, PageShell } from './_shared';

export function SettingsConfigurationGeneral() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useBotSettings();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(true);
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: branding } = useQuery({
    queryKey: ['app-branding'],
    queryFn: getAppBranding,
  });
  const [appName, setAppName] = useState('BotPanel');
  const [appIconDataUrl, setAppIconDataUrl] = useState('');
  const [appIconPreview, setAppIconPreview] = useState<string | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);

  const generalMatches = includesSearch(normalizedSearch, ['benachrichtigung', 'allgemein', 'notifications', 'notification']);
  const brandingMatches = includesSearch(normalizedSearch, ['branding', 'icon', 'app name', 'app icon', 'logo', 'name']);
  const discordMatches = includesSearch(normalizedSearch, ['token', 'discord', 'bot', 'prefix']);
  const showSearchResults = Boolean(normalizedSearch);

  useEffect(() => {
    if (settings) {
      setNotifications(settings.notifications_enabled);
    }
  }, [settings]);

  useEffect(() => {
    if (branding) {
      setAppName(branding.app_name || 'BotPanel');
      setAppIconPreview(branding.icon_url || null);
      setAppIconDataUrl('');
    }
  }, [branding]);

  const handleSaveGeneral = async () => {
    try {
      await updateSettings.mutateAsync({ notifications_enabled: notifications });
      toast({ title: t('common.success') });
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' });
    }
  };

  const handleAppIconChange = async (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: t('common.error'), description: t('settingsProfile.imageOnly'), variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setAppIconDataUrl(result);
      setAppIconPreview(result);
    };
    reader.onerror = () => {
      toast({ title: t('common.error'), description: t('settingsProfile.imageReadError'), variant: 'destructive' });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async () => {
    if (!isAdmin) return;

    if (!appName.trim()) {
      toast({ title: t('common.error'), description: t('settingsGeneral.branding.appNameRequired'), variant: 'destructive' });
      return;
    }

    setSavingBranding(true);
    try {
      await updateAppBranding({
        appName: appName.trim(),
        ...(appIconDataUrl ? { iconDataUrl: appIconDataUrl } : {}),
      });
      setAppIconDataUrl('');
      toast({ title: t('common.success'), description: t('settingsGeneral.branding.brandingUpdated') });
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.error');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setSavingBranding(false);
    }
  };

  const handleRemoveAppIcon = async () => {
    if (!isAdmin) return;

    setSavingBranding(true);
    try {
      await updateAppBranding({ iconDataUrl: '' });
      setAppIconPreview(null);
      setAppIconDataUrl('');
      toast({ title: t('common.success'), description: t('settingsGeneral.branding.iconRemoved') });
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.error');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setSavingBranding(false);
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
      title={t('settingsGeneral.title')}
      description={t('settingsGeneral.description')}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('settingsGeneral.searchPlaceholder')}
    >
      <div className="space-y-4">
        {showSearchResults ? (
          <div className="space-y-3">
            {generalMatches && (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start rounded-xl border-border bg-card px-4 py-5 text-left"
                onClick={() => document.getElementById('general-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold text-foreground">{t('settingsGeneral.generalTitle')}</div>
                    <div className="text-sm text-muted-foreground">{t('settingsGeneral.notificationsWeb')}</div>
                  </div>
                </div>
              </Button>
            )}

            {brandingMatches && isAdmin && (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start rounded-xl border-border bg-card px-4 py-5 text-left"
                onClick={() => document.getElementById('app-branding')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold text-foreground">{t('settingsGeneral.branding.title')}</div>
                    <div className="text-sm text-muted-foreground">{t('settingsGeneral.branding.searchLabel')}</div>
                  </div>
                </div>
              </Button>
            )}

            {discordMatches && (
              <Button asChild type="button" variant="outline" className="w-full justify-start rounded-xl border-border bg-card px-4 py-5 text-left">
                <NavLink to="/settings/configuration/discord" className="flex items-center gap-3">
                  <Bot className="h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold text-foreground">{t('settingsGeneral.discordSearch.title')}</div>
                    <div className="text-sm text-muted-foreground">{t('settingsGeneral.discordSearch.description')}</div>
                  </div>
                </NavLink>
              </Button>
            )}

            {!generalMatches && !brandingMatches && !discordMatches && (
              <Card className="border-border bg-card">
                <CardContent className="py-8 text-sm text-muted-foreground">{t('settingsGeneral.noResults')}</CardContent>
              </Card>
            )}
          </div>
        ) : null}

        <Card id="general-settings" className="scroll-mt-24 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">{t('settingsGeneral.generalTitle')}</CardTitle>
            <CardDescription className="text-muted-foreground">{t('settingsGeneral.generalDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary p-4">
              <div>
                <Label className="text-foreground">{t('settingsGeneral.notifications')}</Label>
                <p className="text-sm text-muted-foreground">{t('settingsGeneral.notificationsDescription')}</p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <Button onClick={handleSaveGeneral} disabled={updateSettings.isPending}>
              {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card id="app-branding" className="scroll-mt-24 border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">{t('settingsGeneral.branding.title')}</CardTitle>
              <CardDescription className="text-muted-foreground">{t('settingsGeneral.branding.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 rounded-md border border-border bg-secondary p-4">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
                  {appIconPreview ? <img src={appIconPreview} alt={appName} className="h-full w-full object-cover" /> : <Bot className="h-6 w-6 text-primary" />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{appName || 'BotPanel'}</p>
                  <p className="text-xs text-muted-foreground">{t('settingsGeneral.branding.preview')}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">{t('settingsGeneral.branding.appName')}</Label>
                <Input value={appName} onChange={(e) => setAppName(e.target.value)} className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">{t('settingsGeneral.branding.appIcon')}</Label>
                <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => handleAppIconChange(e.target.files?.[0] || null)} className="bg-secondary border-border text-foreground" />
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={handleSaveBranding} disabled={savingBranding}>
                    {savingBranding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('settingsGeneral.branding.saveBranding')}
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleRemoveAppIcon} disabled={savingBranding || (!appIconPreview && !branding?.icon_url)}>
                    <Trash2 className="h-4 w-4" />
                    {t('settingsGeneral.branding.removeIcon')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

      </div>
    </PageShell>
  );
}
