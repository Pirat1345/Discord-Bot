import { useEffect, useMemo, useState } from 'react';
import { NavLink } from '@/components/NavLink';
import { apiFetch } from '@/lib/apiClient';
import { createAvatarDataUrl } from '@/lib/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useBotSettings, useUpdateSettings } from '@/hooks/useBotData';
import { useToast } from '@/hooks/use-toast';
import { getAppBranding, getDiscordBotProfile, updateAppBranding, updateDiscordBotPresence, updateDiscordBotProfile } from '@/lib/botApi';
import { createManagedBotProfile, getManagedBotProfiles, type ManagedBotProfile } from '@/lib/botProfiles';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Bot, Globe, KeyRound, Plus, Search, Settings2, Trash2, User, UserPlus, Users, RotateCcw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import type { DiscordBotProfile, LocalUser } from '@/types/api';

function avatarInfo(username?: string | null) {
  const name = username?.trim() || 'User';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return {
    src: createAvatarDataUrl(name),
    initials,
    name,
  };
}

function includesSearch(search: string, values: string[]) {
  if (!search) return true;
  return values.some((value) => value.toLowerCase().includes(search));
}

function PageShell({
  title,
  description,
  children,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Einstellungen suchen...',
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        {onSearchChange && (
          <div className="relative max-w-xl pt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="bg-card border-border pl-9 text-foreground"
            />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export function SettingsHome() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();

  const cards = [
    {
      title: 'Mein Profil',
      description: 'Benutzername, Passwort, Anzeigename und Avatar',
      icon: User,
      url: '/settings/profile',
      aliases: ['profil', 'profile', 'avatar', 'anzeigename', 'display name', 'login', 'benutzername', 'passwort', 'account'],
      show: true,
    },
    {
      title: 'Benutzerverwaltung',
      description: 'Accounts anlegen, löschen und Rollen verwalten',
      icon: Users,
      url: '/settings/users',
      aliases: ['benutzer', 'user', 'accounts', 'rollen', 'admin'],
      show: isAdmin,
    },
    {
      title: 'Konfiguration',
      description: 'Allgemein und Discord Bot konfigurieren',
      icon: Settings2,
      url: '/settings/configuration/general',
      aliases: ['konfiguration', 'allgemein', 'branding', 'app icon', 'app name'],
      show: true,
    },
    {
      title: 'Discord Bot',
      description: 'Bot-Token und Prefix verwalten',
      icon: Bot,
      url: '/settings/configuration/discord',
      state: { highlight: 'discord-token' },
      aliases: ['discord', 'bot', 'token', 'prefix', 'bot token'],
      show: true,
    },
  ].filter((card) => card.show && (!normalizedSearch || includesSearch(normalizedSearch, [card.title, card.description, ...card.aliases])));

  return (
    <PageShell
      title="Einstellungen"
      description="Wähle einen Bereich aus. Die eigentlichen Einstellungen findest du danach in der Seitenleiste als eigene Unterpunkte."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Alle Einstellungen durchsuchen..."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.length ? (
          cards.map((card) => (
            <Button
              key={card.title}
              asChild
              variant="outline"
              className="h-36 flex-col items-center justify-center gap-3 rounded-xl border-border bg-card px-4 py-6 text-center shadow-sm transition-transform hover:-translate-y-0.5 hover:border-primary/40"
            >
              <NavLink to={card.url} state={card.state} className="flex h-full w-full flex-col items-center justify-center gap-3">
                <card.icon className="h-8 w-8" />
                <div className="space-y-1">
                  <div className="text-base font-semibold">{card.title}</div>
                  <div className="text-xs text-muted-foreground">{card.description}</div>
                </div>
              </NavLink>
            </Button>
          ))
        ) : (
          <div className="space-y-3 sm:col-span-2 xl:col-span-3">
            <Card className="border-border bg-card">
              <CardContent className="py-8 text-sm text-muted-foreground">Keine Einstellungen gefunden.</CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  );
}

export function SettingsProfile() {
  const { user, updateAccount, signOut } = useAuth();
  const { toast } = useToast();
  const [accountUsername, setAccountUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingSelf, setDeletingSelf] = useState(false);
  const [search, setSearch] = useState('');
  const [twoFaSetupOpen, setTwoFaSetupOpen] = useState(false);
  const [twoFaQr, setTwoFaQr] = useState('');
  const [twoFaSecretText, setTwoFaSecretText] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [disableTwoFaOpen, setDisableTwoFaOpen] = useState(false);
  const [disableTwoFaPassword, setDisableTwoFaPassword] = useState('');
  const [disableTwoFaLoading, setDisableTwoFaLoading] = useState(false);
  const normalizedSearch = search.trim().toLowerCase();

  useEffect(() => {
    setAccountUsername(user?.username || '');
    setDisplayName(user?.display_name || user?.username || '');
    setAvatarPreview(user?.avatar_url || null);
    setAvatarDataUrl('');
  }, [user?.username, user?.display_name, user?.avatar_url]);

  const avatar = useMemo(() => avatarInfo(user?.display_name || user?.username), [user?.username, user?.display_name]);

  const handleAvatarFileChange = async (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Fehler', description: 'Bitte nur Bilddateien hochladen.', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setAvatarDataUrl(result);
      setAvatarPreview(result);
    };
    reader.onerror = () => {
      toast({ title: 'Fehler', description: 'Bild konnte nicht gelesen werden.', variant: 'destructive' });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;

    setSavingUsername(true);
    const { error } = await updateAccount({ avatarDataUrl: '' });

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      setSavingUsername(false);
      return;
    }

    setAvatarDataUrl('');
    setAvatarPreview(null);
    toast({ title: 'Gespeichert', description: 'Profilbild wurde entfernt.' });
    setSavingUsername(false);
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    if (!accountUsername.trim() || !displayName.trim()) {
      toast({ title: 'Fehler', description: 'Login-Name und Anzeigename dürfen nicht leer sein.', variant: 'destructive' });
      return;
    }

    if (
      accountUsername.trim() === user.username &&
      displayName.trim() === (user.display_name || user.username) &&
      !avatarDataUrl
    ) {
      toast({ title: 'Keine Änderungen' });
      return;
    }

    setSavingUsername(true);
    const { error } = await updateAccount({
      username: accountUsername.trim(),
      displayName: displayName.trim(),
      ...(avatarDataUrl ? { avatarDataUrl } : {}),
    });

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      setSavingUsername(false);
      return;
    }

    setAvatarDataUrl('');
    toast({ title: 'Gespeichert', description: 'Profil wurde aktualisiert.' });
    setSavingUsername(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      toast({ title: 'Fehler', description: 'Die neuen Passwörter stimmen nicht überein.', variant: 'destructive' });
      return;
    }

    if (!currentPassword || !newPassword) {
      toast({ title: 'Fehler', description: 'Bitte alle Passwortfelder ausfüllen.', variant: 'destructive' });
      return;
    }

    setSavingPassword(true);
    const { error } = await updateAccount({ currentPassword, newPassword });

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      setSavingPassword(false);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setChangePasswordOpen(false);
    toast({ title: 'Passwort erneuert', description: 'Dein Passwort wurde erfolgreich geändert.' });
    setSavingPassword(false);
  };

  const showProfileCard =
    !normalizedSearch ||
    ['profil', 'profile', 'avatar', 'anzeigename', 'display', 'login', 'benutzername', 'username', 'passwort', 'account', 'rolle', 'admin', 'benutzer']
      .join(' ')
      .includes(normalizedSearch);

  const handleDeleteOwnAccount = async () => {
    if (!user) return;

    if (user.role === 'admin') {
      toast({ title: 'Nicht erlaubt', description: 'Admin-Accounts dürfen nicht gelöscht werden.', variant: 'destructive' });
      return;
    }

    const confirmed = window.confirm('Deinen eigenen Account wirklich löschen? Dieser Schritt kann nicht rückgängig gemacht werden.');
    if (!confirmed) return;

    setDeletingSelf(true);
    try {
      await apiFetch<void>('/account/self', { method: 'DELETE' });
      await signOut();
      toast({ title: 'Account gelöscht', description: 'Dein Account wurde gelöscht.' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler', description: msg, variant: 'destructive' });
    } finally {
      setDeletingSelf(false);
    }
  };

  const handleSetup2fa = async () => {
    setTwoFaLoading(true);
    try {
      const data = await apiFetch<{ qr: string; secret: string }>('/account/2fa/setup', { method: 'POST' });
      setTwoFaQr(data.qr);
      setTwoFaSecretText(data.secret);
      setTwoFaCode('');
      setTwoFaSetupOpen(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler', description: msg, variant: 'destructive' });
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleVerify2fa = async () => {
    if (!twoFaCode.trim()) return;
    setTwoFaLoading(true);
    try {
      const data = await apiFetch<{ user: LocalUser }>('/account/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ code: twoFaCode.trim() }),
      });
      setTwoFaSetupOpen(false);
      setTwoFaQr('');
      setTwoFaSecretText('');
      setTwoFaCode('');
      toast({ title: '2FA aktiviert', description: 'Zwei-Faktor-Authentifizierung wurde erfolgreich eingerichtet.' });
      // Refresh user state
      window.location.reload();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler', description: msg, variant: 'destructive' });
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleDisable2fa = async () => {
    if (!disableTwoFaPassword.trim()) return;
    setDisableTwoFaLoading(true);
    try {
      await apiFetch<{ user: LocalUser }>('/account/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ password: disableTwoFaPassword }),
      });
      setDisableTwoFaOpen(false);
      setDisableTwoFaPassword('');
      toast({ title: '2FA deaktiviert', description: 'Zwei-Faktor-Authentifizierung wurde deaktiviert.' });
      window.location.reload();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler', description: msg, variant: 'destructive' });
    } finally {
      setDisableTwoFaLoading(false);
    }
  };

  return (
    <PageShell
      title="Mein Profil"
      description="Ändere Benutzernamen, Passwort und Account-Details."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="In Mein Profil suchen..."
    >
      {showProfileCard ? (
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <Avatar className="h-14 w-14 border border-border">
            <AvatarImage src={avatarPreview || avatar.src} alt={avatar.name} />
            <AvatarFallback className="bg-secondary text-base font-semibold text-foreground">{avatar.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-foreground">{displayName || avatar.name}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {user?.username} · {user?.role === 'admin' ? 'Administrator' : 'Benutzer'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-foreground">Login-Name</Label>
              <Input value={accountUsername} onChange={(e) => setAccountUsername(e.target.value)} className="bg-secondary border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Anzeigename</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-secondary border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Account ID</Label>
              <Input value={user?.id || ''} disabled className="bg-secondary border-border font-mono text-xs text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Rolle</Label>
              <Input value={user?.role || ''} disabled className="bg-secondary border-border text-muted-foreground" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-foreground">Profilbild</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => handleAvatarFileChange(e.target.files?.[0] || null)}
                className="bg-secondary border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP oder GIF.</p>
              <Button type="button" variant="secondary" onClick={handleRemoveAvatar} disabled={savingUsername || (!avatarPreview && !user?.avatar_url)}>
                <Trash2 className="h-4 w-4" />
                Profilbild entfernen
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSaveProfile} disabled={savingUsername}>
              {savingUsername && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Profil speichern
            </Button>
            <Button onClick={() => setChangePasswordOpen(true)} variant="secondary" className="gap-2">
              <KeyRound className="h-4 w-4" />
              Passwort ändern
            </Button>
            {user?.role !== 'admin' && (
              <Button onClick={handleDeleteOwnAccount} variant="destructive" className="gap-2" disabled={deletingSelf}>
                {deletingSelf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Eigenen Account löschen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="py-8 text-sm text-muted-foreground">Keine passenden Profil-Einstellungen gefunden.</CardContent>
        </Card>
      )}

      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passwort ändern</DialogTitle>
            <DialogDescription>Gib dein altes Passwort und anschließend zweimal dein neues Passwort ein.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Altes Passwort</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Neues Passwort</Label>
              <Input type="password" minLength={5} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Neues Passwort wiederholen</Label>
              <Input type="password" minLength={5} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleChangePassword} disabled={savingPassword}>
              {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Section */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Zwei-Faktor-Authentifizierung (2FA)</CardTitle>
          <CardDescription className="text-muted-foreground">
            Schütze deinen Account mit einem zusätzlichen Code aus einer Authenticator-App (z.B. Google Authenticator).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user?.totp_enabled ? (
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <KeyRound className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">2FA ist aktiviert</p>
                <p className="text-xs text-muted-foreground">Dein Account ist mit einer Authenticator-App geschützt.</p>
              </div>
              <Button variant="destructive" onClick={() => { setDisableTwoFaPassword(''); setDisableTwoFaOpen(true); }}>
                2FA deaktivieren
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <KeyRound className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">2FA ist nicht aktiviert</p>
                <p className="text-xs text-muted-foreground">Aktiviere 2FA für zusätzliche Sicherheit beim Login.</p>
              </div>
              <Button onClick={handleSetup2fa} disabled={twoFaLoading}>
                {twoFaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                2FA einrichten
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2FA Setup Dialog */}
      <Dialog open={twoFaSetupOpen} onOpenChange={setTwoFaSetupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>2FA einrichten</DialogTitle>
            <DialogDescription>
              Scanne den QR-Code mit deiner Authenticator-App und gib den 6-stelligen Code ein um 2FA zu aktivieren.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {twoFaQr && (
              <div className="flex justify-center">
                <img src={twoFaQr} alt="2FA QR Code" className="h-48 w-48 rounded-lg border border-border" />
              </div>
            )}
            {twoFaSecretText && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Oder manuell eingeben:</Label>
                <Input value={twoFaSecretText} readOnly className="bg-secondary border-border font-mono text-xs text-foreground" onClick={(e) => (e.target as HTMLInputElement).select()} />
              </div>
            )}
            <div className="space-y-2">
              <Label>6-stelliger Code</Label>
              <Input
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="bg-secondary border-border text-center text-lg font-mono tracking-widest text-foreground"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleVerify2fa} disabled={twoFaLoading || twoFaCode.length !== 6}>
              {twoFaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aktivieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Disable Dialog */}
      <Dialog open={disableTwoFaOpen} onOpenChange={setDisableTwoFaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>2FA deaktivieren</DialogTitle>
            <DialogDescription>Gib dein Passwort ein um die Zwei-Faktor-Authentifizierung zu deaktivieren.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Passwort</Label>
            <Input type="password" value={disableTwoFaPassword} onChange={(e) => setDisableTwoFaPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDisable2fa} disabled={disableTwoFaLoading || !disableTwoFaPassword.trim()}>
              {disableTwoFaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deaktivieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

export function SettingsUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [newAccountUsername, setNewAccountUsername] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountPasswordConfirm, setNewAccountPasswordConfirm] = useState('');
  const [newAccountRole, setNewAccountRole] = useState('read');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<LocalUser[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();

  useEffect(() => {
    if (user?.role !== 'admin') {
      setAccounts([]);
      return;
    }

    let mounted = true;
    setLoadingAccounts(true);

    apiFetch<{ users: LocalUser[] }>('/account/users')
      .then((data) => {
        if (!mounted) return;
        setAccounts(data.users);
      })
      .catch((error) => {
        if (!mounted) return;
        const msg = error instanceof Error ? error.message : 'Konten konnten nicht geladen werden.';
        toast({ title: 'Fehler', description: msg, variant: 'destructive' });
      })
      .finally(() => {
        if (mounted) setLoadingAccounts(false);
      });

    return () => {
      mounted = false;
    };
  }, [user?.role, toast]);

  const handleCreateAccount = async () => {
    if (!newAccountUsername.trim()) {
      toast({ title: 'Fehler', description: 'Bitte Benutzernamen eingeben.', variant: 'destructive' });
      return;
    }

    if (newAccountPassword.length < 5) {
      toast({ title: 'Fehler', description: 'Passwort muss mindestens 5 Zeichen haben.', variant: 'destructive' });
      return;
    }

    if (newAccountPassword !== newAccountPasswordConfirm) {
      toast({ title: 'Fehler', description: 'Die Passwörter stimmen nicht überein.', variant: 'destructive' });
      return;
    }

    setCreatingAccount(true);

    try {
      const created = await apiFetch<{ user: LocalUser }>('/account/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newAccountUsername.trim(),
          password: newAccountPassword,
          role: newAccountRole,
        }),
      });

      setAccounts((prev) => [created.user, ...prev]);
      setNewAccountUsername('');
      setNewAccountPassword('');
      setNewAccountPasswordConfirm('');
      setNewAccountRole('read');
      setCreateAccountOpen(false);
      toast({ title: 'Account erstellt', description: `Benutzer ${created.user.username} wurde angelegt.` });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler', description: msg, variant: 'destructive' });
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleDeleteManagedAccount = async (account: LocalUser) => {
    if (account.role === 'admin') {
      toast({ title: 'Nicht erlaubt', description: 'Admin-Accounts dürfen nicht gelöscht werden.', variant: 'destructive' });
      return;
    }

    const confirmed = window.confirm(`Account ${account.username} wirklich löschen?`);
    if (!confirmed) return;

    setDeletingAccountId(account.id);
    try {
      await apiFetch<void>(`/account/users/${account.id}`, { method: 'DELETE' });
      setAccounts((prev) => prev.filter((entry) => entry.id !== account.id));
      toast({ title: 'Account gelöscht', description: `Benutzer ${account.username} wurde entfernt.` });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler', description: msg, variant: 'destructive' });
    } finally {
      setDeletingAccountId(null);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <PageShell title="Benutzerverwaltung" description="Dieser Bereich ist nur für Administratoren verfügbar.">
        <Card className="border-border bg-card">
          <CardContent className="py-8 text-sm text-muted-foreground">Du hast keinen Zugriff auf diese Seite.</CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Benutzerverwaltung"
      description="Verwalte vorhandene Accounts und lege neue Benutzer an."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Benutzer durchsuchen..."
    >
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Accounts</CardTitle>
          <CardDescription className="text-muted-foreground">Hier kannst du Benutzer anlegen oder löschen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => setCreateAccountOpen(true)} className="gap-2 self-start">
            <UserPlus className="h-4 w-4" />
            Weiteren Account anlegen
          </Button>

          <div className="space-y-2 border-t border-border pt-4">
            <Label className="text-foreground">Vorhandene Accounts</Label>
            {loadingAccounts ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="space-y-2">
                {accounts.filter((account) => {
                  if (!normalizedSearch) return true;
                  return `${account.username} ${account.display_name || ''} ${account.role}`.toLowerCase().includes(normalizedSearch);
                }).map((account) => (
                  <div key={account.id} className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2">
                    <span className="text-foreground">{account.username}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs uppercase text-muted-foreground">{account.role}</span>
                      {account.role !== 'admin' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteManagedAccount(account)}
                          disabled={deletingAccountId === account.id}
                          className="h-8 gap-1"
                        >
                          {deletingAccountId === account.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Löschen
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={createAccountOpen} onOpenChange={setCreateAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Account anlegen</DialogTitle>
            <DialogDescription>Erstelle einen weiteren Benutzer und weise ihm eine Rolle zu.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Benutzername</Label>
              <Input value={newAccountUsername} onChange={(e) => setNewAccountUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Passwort</Label>
              <Input type="password" minLength={5} value={newAccountPassword} onChange={(e) => setNewAccountPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Passwort wiederholen</Label>
              <Input type="password" minLength={5} value={newAccountPasswordConfirm} onChange={(e) => setNewAccountPasswordConfirm(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select value={newAccountRole} onValueChange={setNewAccountRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Rolle auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">read</SelectItem>
                  <SelectItem value="write">write</SelectItem>
                  <SelectItem value="use">use</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateAccount} disabled={creatingAccount}>
              {creatingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Account erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

export function SettingsConfigurationGeneral() {
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
      toast({ title: 'Gespeichert' });
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    }
  };

  const handleAppIconChange = async (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Fehler', description: 'Bitte nur Bilddateien hochladen.', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setAppIconDataUrl(result);
      setAppIconPreview(result);
    };
    reader.onerror = () => {
      toast({ title: 'Fehler', description: 'Bild konnte nicht gelesen werden.', variant: 'destructive' });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async () => {
    if (!isAdmin) return;

    if (!appName.trim()) {
      toast({ title: 'Fehler', description: 'App-Name darf nicht leer sein.', variant: 'destructive' });
      return;
    }

    setSavingBranding(true);
    try {
      await updateAppBranding({
        appName: appName.trim(),
        ...(appIconDataUrl ? { iconDataUrl: appIconDataUrl } : {}),
      });
      setAppIconDataUrl('');
      toast({ title: 'Gespeichert', description: 'App-Branding wurde aktualisiert.' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler', description: msg, variant: 'destructive' });
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
      toast({ title: 'Gespeichert', description: 'App-Icon wurde entfernt.' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler', description: msg, variant: 'destructive' });
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
      title="Allgemein"
      description="Globale Optionen für die Webseite."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Allgemeine Einstellungen suchen..."
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
                    <div className="font-semibold text-foreground">Allgemeine Einstellungen</div>
                    <div className="text-sm text-muted-foreground">Benachrichtigungen und Web-Optionen</div>
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
                    <div className="font-semibold text-foreground">App Branding</div>
                    <div className="text-sm text-muted-foreground">App-Name und Icon</div>
                  </div>
                </div>
              </Button>
            )}

            {discordMatches && (
              <Button asChild type="button" variant="outline" className="w-full justify-start rounded-xl border-border bg-card px-4 py-5 text-left">
                <NavLink to="/settings/configuration/discord" className="flex items-center gap-3">
                  <Bot className="h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold text-foreground">Discord Bot</div>
                    <div className="text-sm text-muted-foreground">Token und Prefix</div>
                  </div>
                </NavLink>
              </Button>
            )}

            {!generalMatches && !brandingMatches && !discordMatches && (
              <Card className="border-border bg-card">
                <CardContent className="py-8 text-sm text-muted-foreground">Keine passenden Einstellungen gefunden.</CardContent>
              </Card>
            )}
          </div>
        ) : null}

        <Card id="general-settings" className="scroll-mt-24 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Allgemeine Einstellungen</CardTitle>
            <CardDescription className="text-muted-foreground">Einstellungen für die Webseite</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary p-4">
              <div>
                <Label className="text-foreground">Benachrichtigungen</Label>
                <p className="text-sm text-muted-foreground">Desktop-Benachrichtigungen aktivieren</p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <Button onClick={handleSaveGeneral} disabled={updateSettings.isPending}>
              {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card id="app-branding" className="scroll-mt-24 border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">App Branding</CardTitle>
              <CardDescription className="text-muted-foreground">App-Name und Icon werden in der oberen Leiste angezeigt.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 rounded-md border border-border bg-secondary p-4">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
                  {appIconPreview ? <img src={appIconPreview} alt={appName} className="h-full w-full object-cover" /> : <Bot className="h-6 w-6 text-primary" />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{appName || 'BotPanel'}</p>
                  <p className="text-xs text-muted-foreground">Vorschau des App-Headers</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">App-Name</Label>
                <Input value={appName} onChange={(e) => setAppName(e.target.value)} className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">App-Icon</Label>
                <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => handleAppIconChange(e.target.files?.[0] || null)} className="bg-secondary border-border text-foreground" />
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={handleSaveBranding} disabled={savingBranding}>
                    {savingBranding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Branding speichern
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleRemoveAppIcon} disabled={savingBranding || (!appIconPreview && !branding?.icon_url)}>
                    <Trash2 className="h-4 w-4" />
                    App-Icon entfernen
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

export function SettingsConfigurationDiscord() {
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
      toast({ title: 'Fehler', description: 'Bitte nur Bilddateien hochladen.', variant: 'destructive' });
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
      toast({ title: 'Fehler', description: 'Bild konnte nicht gelesen werden.', variant: 'destructive' });
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
      toast({ title: 'Bot hinzugefügt', description: `${nextProfile.name} wurde angelegt.` });
    } catch {
      toast({ title: 'Fehler', description: 'Bot konnte nicht hinzugefügt werden.', variant: 'destructive' });
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (profiles.length <= 1) {
      toast({ title: 'Nicht möglich', description: 'Mindestens ein Bot-Profil muss vorhanden bleiben.', variant: 'destructive' });
      return;
    }

    const target = profiles.find((profile) => profile.id === profileId);
    if (!target) return;

    const confirmed = window.confirm(`Bot ${target.name} wirklich löschen?`);
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
      toast({ title: 'Bot gelöscht', description: `${target.name} wurde entfernt.` });
    } catch {
      toast({ title: 'Fehler', description: 'Bot konnte nicht gelöscht werden.', variant: 'destructive' });
    }
  };

  const handleToggleOnline = async (profileId: string, checked: boolean) => {
    const nextActiveId = profileId;
    try {
      await persistProfiles(profiles, nextActiveId, checked);
      setActiveProfileId(nextActiveId);
      toast({
        title: checked ? 'Bot gestartet' : 'Bot gestoppt',
        description: checked ? 'Bot wurde aktiviert.' : 'Bot wurde deaktiviert.',
      });
    } catch {
      toast({ title: 'Fehler', description: 'Status konnte nicht geändert werden.', variant: 'destructive' });
    }
  };

  const handleSaveBot = async () => {
    if (!selectedProfile) return;

    if (!selectedProfile.name.trim()) {
      toast({ title: 'Fehler', description: 'Bot-Name darf nicht leer sein.', variant: 'destructive' });
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
          discordSyncError = err instanceof Error ? err.message : 'Discord-Profil konnte nicht synchronisiert werden.';
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
          discordSyncError = err instanceof Error ? err.message : 'Discord-Profil konnte nicht synchronisiert werden.';
        }
      }

      setAvatarDataByProfile((prev) => {
        const next = { ...prev };
        delete next[selectedProfile.id];
        return next;
      });

      if (discordSyncError) {
        toast({ title: 'Gespeichert', description: `Einstellungen gespeichert. Discord-Sync fehlgeschlagen: ${discordSyncError}` });
      } else {
        toast({ title: 'Gespeichert', description: 'Bot-Einstellungen wurden aktualisiert.' });
      }
    } catch {
      toast({ title: 'Fehler', description: 'Bot-Einstellungen konnten nicht gespeichert werden.', variant: 'destructive' });
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
      title="Discord Bot"
      description="Lege mehrere Bots an und konfiguriere Name, Token und Status jeweils separat."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Bots oder Einstellungen suchen..."
    >
      <div className="space-y-4">
        {showSearchResults && !visibleProfiles.length ? (
          <Card className="border-border bg-card">
            <CardContent className="py-8 text-sm text-muted-foreground">Keine passenden Bots gefunden.</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <Card className="border-border bg-card">
            <CardHeader className="space-y-3">
              <CardTitle className="text-foreground">Bots</CardTitle>
              <CardDescription className="text-muted-foreground">Wähle einen Bot aus oder lege einen neuen an.</CardDescription>
              <Button type="button" onClick={handleAddProfile} className="gap-2" disabled={updateSettings.isPending}>
                <Plus className="h-4 w-4" />
                Neuen Bot hinzufügen
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
                        <p className="text-xs text-muted-foreground">{isOnline ? 'Aktiv' : 'Nicht aktiv'}</p>
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
              <CardTitle className="text-foreground">Bot Einstellungen</CardTitle>
              <CardDescription className="text-muted-foreground">Konfiguriere den ausgewählten Bot. Alle Details liegen hier zentral.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedProfile ? (
                <p className="text-sm text-muted-foreground">Bitte links einen Bot auswählen.</p>
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
                      <p className="text-xs text-muted-foreground">{activeProfileId === selectedProfile.id ? 'Aktives Profil' : 'Inaktives Profil'}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-foreground">Bot Name</Label>
                      <Input
                        value={selectedProfile.name}
                        onChange={(e) => updateProfileField('name', e.target.value)}
                        className="bg-secondary border-border text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Command Prefix</Label>
                      <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground">/ (fest)</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">Bot Token</Label>
                    <Input
                      type="password"
                      placeholder="Dein Discord Bot Token"
                      value={selectedProfile.bot_token}
                      onChange={(e) => updateProfileField('bot_token', e.target.value)}
                      className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">Finde deinen Token im Discord Developer Portal unter Bot → Token.</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">Profilbild ändern</Label>
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
                          title="Profilbild zurücksetzen"
                          onClick={handleAvatarReset}
                          className="shrink-0"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">Beschreibung</Label>
                    <Input
                      value={selectedProfile.description}
                      onChange={(e) => updateProfileField('description', e.target.value)}
                      className="bg-secondary border-border text-foreground"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-foreground">Status</Label>
                      <Select value={selectedProfile.status} onValueChange={(value: ManagedBotProfile['status']) => updateProfileField('status', value)}>
                        <SelectTrigger className="bg-secondary border-border text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="idle">Abwesend</SelectItem>
                          <SelectItem value="dnd">Nicht stören</SelectItem>
                          <SelectItem value="invisible">Unsichtbar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground">Aktivitätstyp</Label>
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
                      <Label className="text-foreground">Aktivitätstext</Label>
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
                      Bot speichern
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => handleDeleteProfile(selectedProfile.id)}
                      disabled={updateSettings.isPending || savingProfile}
                    >
                      <Trash2 className="h-4 w-4" />
                      Bot löschen
                    </Button>
                    {profiles.length <= 1 ? (
                      <p className="self-center text-xs text-muted-foreground">
                        Der letzte Bot kann nicht gelöscht werden. Lege zuerst einen zweiten Bot an.
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