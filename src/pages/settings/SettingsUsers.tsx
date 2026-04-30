import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, UserPlus } from 'lucide-react';
import type { LocalUser } from '@/types/api';
import { PageShell } from './_shared';

export function SettingsUsers() {
  const { t } = useTranslation();
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
      toast({ title: t('common.error'), description: t('settingsUsers.deleteNotAllowed'), variant: 'destructive' });
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

  if (user?.role !== 'admin') {
    return (
      <PageShell title={t('settingsUsers.title')} description={t('settingsUsers.noAccess')}>
        <Card className="border-border bg-card">
          <CardContent className="py-8 text-sm text-muted-foreground">{t('settingsUsers.noAccessDetail')}</CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={t('settingsUsers.title')}
      description={t('settingsUsers.description')}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('settingsUsers.searchPlaceholder')}
    >
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">{t('settingsUsers.accountsTitle')}</CardTitle>
          <CardDescription className="text-muted-foreground">{t('settingsUsers.accountsDescription')}</CardDescription>
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

      <Dialog open={createAccountOpen} onOpenChange={setCreateAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settingsUsers.createDialog.title')}</DialogTitle>
            <DialogDescription>{t('settingsUsers.createDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t('settingsUsers.createDialog.username')}</Label>
              <Input value={newAccountUsername} onChange={(e) => setNewAccountUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('settingsUsers.createDialog.password')}</Label>
              <Input type="password" minLength={5} value={newAccountPassword} onChange={(e) => setNewAccountPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('settingsUsers.createDialog.confirmPassword')}</Label>
              <Input type="password" minLength={5} value={newAccountPasswordConfirm} onChange={(e) => setNewAccountPasswordConfirm(e.target.value)} />
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
    </PageShell>
  );
}
