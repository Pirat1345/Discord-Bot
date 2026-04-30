import { useBotSettings, useUpdateSettings } from '@/hooks/useBotData';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        const msg = error instanceof Error ? error.message : t('common.accountsLoadError');
        toast({ title: t('common.error'), description: msg, variant: 'destructive' });
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
      toast({ title: t('common.success') });
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' });
    }
  };

  const handleSaveBot = async () => {
    try {
      await updateSettings.mutateAsync({ bot_token: botToken, command_prefix: prefix });
      toast({ title: t('common.success'), description: t('settingsDiscord.botSaved') });
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' });
    }
  };

  const handleSaveUsername = async () => {
    if (!user) return;

    if (!accountUsername.trim() || accountUsername.trim() === user.username) {
      toast({ title: t('settingsProfile.noChanges') });
      return;
    }

    setSavingUsername(true);
    const { error } = await updateAccount({ username: accountUsername.trim() });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      setSavingUsername(false);
      return;
    }

    toast({ title: t('settingsProfile.saved'), description: t('settingsProfile.profileUpdated') });
    setSavingUsername(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      toast({ title: t('common.error'), description: t('settingsProfile.passwordDialog.mismatch'), variant: 'destructive' });
      return;
    }

    if (!currentPassword || !newPassword) {
      toast({ title: t('common.error'), description: t('settingsProfile.passwordDialog.allRequired'), variant: 'destructive' });
      return;
    }

    setSavingPassword(true);
    const { error } = await updateAccount({
      currentPassword,
      newPassword,
    });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      setSavingPassword(false);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setChangePasswordOpen(false);
    toast({ title: t('settingsProfile.passwordDialog.changed'), description: t('settingsProfile.passwordDialog.changedDescription') });
    setSavingPassword(false);
  };

  const handleCreateAccount = async () => {
    if (!newAccountUsername.trim()) {
      toast({ title: t('common.error'), description: t('settingsUsers.createDialog.usernameRequired'), variant: 'destructive' });
      return;
    }

    if (newAccountPassword.length < 5) {
      toast({ title: t('common.error'), description: t('settingsUsers.createDialog.passwordMin'), variant: 'destructive' });
      return;
    }

    if (newAccountPassword !== newAccountPasswordConfirm) {
      toast({ title: t('common.error'), description: t('settingsUsers.createDialog.passwordMismatch'), variant: 'destructive' });
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
      toast({ title: t('settingsUsers.createDialog.created'), description: t('settingsUsers.createDialog.createdDescription', { username: created.user.username }) });
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknownError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleDeleteManagedAccount = async (account: LocalUser) => {
    if (account.role === 'admin') {
      toast({ title: t('settingsUsers.deleteNotAllowed'), description: t('settingsUsers.deleteNotAllowed'), variant: 'destructive' });
      return;
    }

    const confirmed = window.confirm(t('settingsUsers.deleteConfirm', { username: account.username }));
    if (!confirmed) return;

    setDeletingAccountId(account.id);
    try {
      await apiFetch<void>(`/account/users/${account.id}`, { method: 'DELETE' });
      setAccounts((prev) => prev.filter((entry) => entry.id !== account.id));
      toast({ title: t('settingsUsers.accountDeleted'), description: t('settingsUsers.accountDeletedDescription', { username: account.username }) });
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknownError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setDeletingAccountId(null);
    }
  };

  const handleDeleteOwnAccount = async () => {
    if (!user) return;

    if (user.role === 'admin') {
      toast({ title: t('settingsProfile.deleteNotAllowed'), description: t('settingsProfile.deleteNotAllowed'), variant: 'destructive' });
      return;
    }

    const confirmed = window.confirm(t('settingsProfile.deleteConfirm'));
    if (!confirmed) return;

    setDeletingSelf(true);
    try {
      await apiFetch<void>('/account/self', { method: 'DELETE' });
      await signOut();
      toast({ title: t('settingsUsers.accountDeleted'), description: t('settingsProfile.accountDeleted') });
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknownError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setDeletingSelf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.description')}</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <Avatar className="h-14 w-14 border border-border">
            <AvatarImage src={avatarSrc} alt={user?.username ?? 'User'} />
            <AvatarFallback className="bg-secondary text-base font-semibold text-foreground">{avatarFallback}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-foreground">{t('settingsProfile.title')}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {user?.username ?? 'User'} · {user?.role === 'admin' ? t('settingsProfile.roleAdmin') : t('settingsProfile.roleUser')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-foreground">{t('settingsProfile.loginName')}</Label>
                onChange={(e) => setAccountUsername(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{t('settingsProfile.accountId')}</Label>
              <Input value={user?.id || ''} disabled className="bg-secondary border-border text-muted-foreground font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{t('settingsProfile.role')}</Label>
              <Input value={user?.role || ''} disabled className="bg-secondary border-border text-muted-foreground" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSaveUsername} disabled={savingUsername}>
              {savingUsername && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settingsProfile.saveProfile')}
            </Button>
            <Button onClick={() => setChangePasswordOpen(true)} variant="secondary" className="gap-2">
              <KeyRound className="h-4 w-4" />
              {t('settingsProfile.changePassword')}
            </Button>
            {user?.role !== 'admin' && (
              <Button
                onClick={handleDeleteOwnAccount}
                variant="destructive"
                className="gap-2"
                disabled={deletingSelf}
              >
                {deletingSelf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t('settingsProfile.deleteOwnAccount')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {user?.role === 'admin' && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">{t('settingsUsers.title')}</CardTitle>
            <CardDescription className="text-muted-foreground">{t('settingsUsers.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => setCreateAccountOpen(true)} className="gap-2 self-start">
              <UserPlus className="h-4 w-4" />
              {t('settingsUsers.addAccount')}
            </Button>
            <div className="space-y-2 border-t border-border pt-4">
              <Label className="text-foreground">{t('settingsUsers.existingAccounts')}</Label>
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
                            {t('settingsUsers.deleteAccount')}
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
            <CardTitle className="text-foreground">{t('settings.cards.configuration.title')}</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">{t('settings.cards.configuration.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="bg-secondary border border-border">
              <TabsTrigger value="general" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Globe className="h-4 w-4" />
                {t('settingsGeneral.title')}
              </TabsTrigger>
              <TabsTrigger value="discord" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Bot className="h-4 w-4" />
                {t('settingsDiscord.title')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 space-y-4">
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
            </TabsContent>

            <TabsContent value="discord" className="mt-4 space-y-4">
              <div className="space-y-4 rounded-md border border-border bg-secondary p-4">
                <div className="space-y-2">
                  <Label className="text-foreground">{t('settingsDiscord.botToken')}</Label>
                  <Input
                    type="password"
                    placeholder={t('settingsDiscord.botTokenPlaceholder')}
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('settingsDiscord.botTokenHint')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">{t('settingsDiscord.commandPrefix')}</Label>
                  <Input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="bg-card border-border text-foreground placeholder:text-muted-foreground w-20"
                  />
                </div>
                <Button onClick={handleSaveBot} disabled={updateSettings.isPending}>
                  {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('common.save')}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settingsProfile.passwordDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('settingsProfile.passwordDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t('settingsProfile.passwordDialog.oldPassword')}</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settingsProfile.passwordDialog.newPassword')}</Label>
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settingsProfile.passwordDialog.confirmPassword')}</Label>
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
              {t('settingsProfile.passwordDialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createAccountOpen} onOpenChange={setCreateAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settingsUsers.createDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('settingsUsers.createDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t('settingsUsers.createDialog.username')}</Label>
              <Input
                value={newAccountUsername}
                onChange={(e) => setNewAccountUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settingsUsers.createDialog.password')}</Label>
                onChange={(e) => setNewAccountPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settingsUsers.createDialog.confirmPassword')}</Label>
              <Input
                type="password"
                minLength={5}
                value={newAccountPasswordConfirm}
                onChange={(e) => setNewAccountPasswordConfirm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settingsUsers.createDialog.role')}</Label>
              <Select value={newAccountRole} onValueChange={setNewAccountRole}>
                <SelectTrigger>
                  <SelectValue placeholder={t('settingsUsers.createDialog.rolePlaceholder')} />
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
              {t('settingsUsers.createDialog.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
