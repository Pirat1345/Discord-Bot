import { useBotSettings, useUpdateSettings } from '@/hooks/useBotData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Globe, Bot, Loader2, KeyRound, UserPlus, Trash2, Settings2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createAvatarDataUrl } from '@/lib/avatar';
import type { LocalUser } from '@/types/api';

export default function Settings() {
  const { user, updateAccount, signOut } = useAuth();
  const { data: settings, isLoading } = useBotSettings();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();

  const [botToken, setBotToken] = useState('');
  const [prefix, setPrefix] = useState('!');
  const [notifications, setNotifications] = useState(true);
  const [accountUsername, setAccountUsername] = useState('');

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [newAccountUsername, setNewAccountUsername] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountPasswordConfirm, setNewAccountPasswordConfirm] = useState('');
  const [newAccountRole, setNewAccountRole] = useState('read');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [deletingSelf, setDeletingSelf] = useState(false);
  const [accounts, setAccounts] = useState<LocalUser[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const avatarSrc = createAvatarDataUrl(user?.username ?? 'User');
  const avatarFallback = (user?.username ?? 'U')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (settings) {
      setBotToken(settings.bot_token || '');
      setPrefix(settings.command_prefix);
      setNotifications(settings.notifications_enabled);
    }
  }, [settings]);

  useEffect(() => {
    setAccountUsername(user?.username || '');
  }, [user?.username]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSaveGeneral = async () => {
    try {
      await updateSettings.mutateAsync({ notifications_enabled: notifications });
      toast({ title: 'Gespeichert' });
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    }
  };

  const handleSaveBot = async () => {
    try {
      await updateSettings.mutateAsync({ bot_token: botToken, command_prefix: prefix });
      toast({ title: 'Gespeichert', description: 'Bot-Einstellungen wurden aktualisiert.' });
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    }
  };

  const handleSaveUsername = async () => {
    if (!user) return;

    if (!accountUsername.trim() || accountUsername.trim() === user.username) {
      toast({ title: 'Keine Änderungen' });
      return;
    }

    setSavingUsername(true);
    const { error } = await updateAccount({ username: accountUsername.trim() });

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      setSavingUsername(false);
      return;
    }

    toast({ title: 'Gespeichert', description: 'Benutzername wurde aktualisiert.' });
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
    const { error } = await updateAccount({
      currentPassword,
      newPassword,
    });

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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">Verwalte dein Profil, Benutzer und die Bot-Konfiguration an einem Ort.</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <Avatar className="h-14 w-14 border border-border">
            <AvatarImage src={avatarSrc} alt={user?.username ?? 'User'} />
            <AvatarFallback className="bg-secondary text-base font-semibold text-foreground">{avatarFallback}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-foreground">Mein Profil</CardTitle>
            <CardDescription className="text-muted-foreground">
              {user?.username ?? 'User'} · {user?.role === 'admin' ? 'Administrator' : 'Benutzer'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-foreground">Benutzername</Label>
              <Input
                value={accountUsername}
                onChange={(e) => setAccountUsername(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Account ID</Label>
              <Input value={user?.id || ''} disabled className="bg-secondary border-border text-muted-foreground font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Rolle</Label>
              <Input value={user?.role || ''} disabled className="bg-secondary border-border text-muted-foreground" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSaveUsername} disabled={savingUsername}>
              {savingUsername && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Benutzernamen speichern
            </Button>
            <Button onClick={() => setChangePasswordOpen(true)} variant="secondary" className="gap-2">
              <KeyRound className="h-4 w-4" />
              Passwort ändern
            </Button>
            {user?.role !== 'admin' && (
              <Button
                onClick={handleDeleteOwnAccount}
                variant="destructive"
                className="gap-2"
                disabled={deletingSelf}
              >
                {deletingSelf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Eigenen Account löschen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {user?.role === 'admin' && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Benutzerverwaltung</CardTitle>
            <CardDescription className="text-muted-foreground">Verwalte vorhandene Accounts und lege neue Benutzer an.</CardDescription>
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
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2"
                    >
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
                            {deletingAccountId === account.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
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
      )}

      <Card className="border-border bg-card">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Konfigurieren</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">Hier findest du die allgemeinen und Discord-spezifischen Einstellungen.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="bg-secondary border border-border">
              <TabsTrigger value="general" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Globe className="h-4 w-4" />
                Allgemein
              </TabsTrigger>
              <TabsTrigger value="discord" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Bot className="h-4 w-4" />
                Discord
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 space-y-4">
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
            </TabsContent>

            <TabsContent value="discord" className="mt-4 space-y-4">
              <div className="space-y-4 rounded-md border border-border bg-secondary p-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Bot Token</Label>
                  <Input
                    type="password"
                    placeholder="Dein Discord Bot Token"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Finde deinen Token im Discord Developer Portal unter Bot → Token
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Command Prefix</Label>
                  <Input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="bg-card border-border text-foreground placeholder:text-muted-foreground w-20"
                  />
                </div>
                <Button onClick={handleSaveBot} disabled={updateSettings.isPending}>
                  {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Speichern
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passwort ändern</DialogTitle>
            <DialogDescription>
              Gib dein altes Passwort und anschließend zweimal dein neues Passwort ein.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Altes Passwort</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Neues Passwort</Label>
              <Input
                type="password"
                minLength={5}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Neues Passwort wiederholen</Label>
              <Input
                type="password"
                minLength={5}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
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

      <Dialog open={createAccountOpen} onOpenChange={setCreateAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Account anlegen</DialogTitle>
            <DialogDescription>
              Erstelle einen weiteren Benutzer und weise ihm eine Rolle zu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Benutzername</Label>
              <Input
                value={newAccountUsername}
                onChange={(e) => setNewAccountUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Passwort</Label>
              <Input
                type="password"
                minLength={5}
                value={newAccountPassword}
                onChange={(e) => setNewAccountPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Passwort wiederholen</Label>
              <Input
                type="password"
                minLength={5}
                value={newAccountPasswordConfirm}
                onChange={(e) => setNewAccountPasswordConfirm(e.target.value)}
              />
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
    </div>
  );
}
