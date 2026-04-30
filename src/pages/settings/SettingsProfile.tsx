import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, Trash2 } from 'lucide-react';
import type { LocalUser } from '@/types/api';
import { avatarInfo, PageShell } from './_shared';

export function SettingsProfile() {
  const { t } = useTranslation();
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
      toast({ title: t('common.error'), description: t('settingsProfile.imageOnly'), variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setAvatarDataUrl(result);
      setAvatarPreview(result);
    };
    reader.onerror = () => {
      toast({ title: t('common.error'), description: t('settingsProfile.imageReadError'), variant: 'destructive' });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;

    setSavingUsername(true);
    const { error } = await updateAccount({ avatarDataUrl: '' });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      setSavingUsername(false);
      return;
    }

    setAvatarDataUrl('');
    setAvatarPreview(null);
    toast({ title: t('settingsProfile.saved'), description: t('settingsProfile.profilePictureRemoved') });
    setSavingUsername(false);
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    if (!accountUsername.trim() || !displayName.trim()) {
      toast({ title: t('common.error'), description: t('settingsProfile.nameRequired'), variant: 'destructive' });
      return;
    }

    if (
      accountUsername.trim() === user.username &&
      displayName.trim() === (user.display_name || user.username) &&
      !avatarDataUrl
    ) {
      toast({ title: t('settingsProfile.noChanges') });
      return;
    }

    setSavingUsername(true);
    const { error } = await updateAccount({
      username: accountUsername.trim(),
      displayName: displayName.trim(),
      ...(avatarDataUrl ? { avatarDataUrl } : {}),
    });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      setSavingUsername(false);
      return;
    }

    setAvatarDataUrl('');
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
    const { error } = await updateAccount({ currentPassword, newPassword });

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

  const showProfileCard =
    !normalizedSearch ||
    ['profil', 'profile', 'avatar', 'anzeigename', 'display', 'login', 'benutzername', 'username', 'passwort', 'account', 'rolle', 'admin', 'benutzer']
      .join(' ')
      .includes(normalizedSearch);

  const handleDeleteOwnAccount = async () => {
    if (!user) return;

    if (user.role === 'admin') {
      toast({ title: t('common.error'), description: t('settingsProfile.deleteNotAllowed'), variant: 'destructive' });
      return;
    }

    const confirmed = window.confirm(t('settingsProfile.deleteConfirm'));
    if (!confirmed) return;

    setDeletingSelf(true);
    try {
      await apiFetch<void>('/account/self', { method: 'DELETE' });
      await signOut();
      toast({ title: t('settingsProfile.accountDeleted'), description: t('settingsProfile.accountDeleted') });
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknownError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
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
      const msg = error instanceof Error ? error.message : t('common.unknownError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
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
      toast({ title: t('settingsProfile.twoFa.activated'), description: t('settingsProfile.twoFa.activatedDescription') });
      // Refresh user state
      window.location.reload();
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknownError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
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
      toast({ title: t('settingsProfile.twoFa.deactivated'), description: t('settingsProfile.twoFa.deactivatedDescription') });
      window.location.reload();
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknownError');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setDisableTwoFaLoading(false);
    }
  };

  return (
    <PageShell
      title={t('settingsProfile.title')}
      description={t('settingsProfile.description')}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('settingsProfile.searchPlaceholder')}
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
              {user?.username} · {user?.role === 'admin' ? t('settingsProfile.roleAdmin') : t('settingsProfile.roleUser')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-foreground">{t('settingsProfile.loginName')}</Label>
              <Input value={accountUsername} onChange={(e) => setAccountUsername(e.target.value)} className="bg-secondary border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{t('settingsProfile.displayName')}</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-secondary border-border text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{t('settingsProfile.accountId')}</Label>
              <Input value={user?.id || ''} disabled className="bg-secondary border-border font-mono text-xs text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{t('settingsProfile.role')}</Label>
              <Input value={user?.role || ''} disabled className="bg-secondary border-border text-muted-foreground" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-foreground">{t('settingsProfile.profilePicture')}</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => handleAvatarFileChange(e.target.files?.[0] || null)}
                className="bg-secondary border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">{t('settingsProfile.profilePictureHint')}</p>
              <Button type="button" variant="secondary" onClick={handleRemoveAvatar} disabled={savingUsername || (!avatarPreview && !user?.avatar_url)}>
                <Trash2 className="h-4 w-4" />
                {t('settingsProfile.removeProfilePicture')}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSaveProfile} disabled={savingUsername}>
              {savingUsername && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settingsProfile.saveProfile')}
            </Button>
            <Button onClick={() => setChangePasswordOpen(true)} variant="secondary" className="gap-2">
              <KeyRound className="h-4 w-4" />
              {t('settingsProfile.changePassword')}
            </Button>
            {user?.role !== 'admin' && (
              <Button onClick={handleDeleteOwnAccount} variant="destructive" className="gap-2" disabled={deletingSelf}>
                {deletingSelf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t('settingsProfile.deleteOwnAccount')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="py-8 text-sm text-muted-foreground">{t('settingsProfile.noProfileResults')}</CardContent>
        </Card>
      )}

      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settingsProfile.passwordDialog.title')}</DialogTitle>
            <DialogDescription>{t('settingsProfile.passwordDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t('settingsProfile.passwordDialog.oldPassword')}</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('settingsProfile.passwordDialog.newPassword')}</Label>
              <Input type="password" minLength={5} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('settingsProfile.passwordDialog.confirmPassword')}</Label>
              <Input type="password" minLength={5} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
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

      {/* 2FA Section */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">{t('settingsProfile.twoFa.title')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('settingsProfile.twoFa.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user?.totp_enabled ? (
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <KeyRound className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t('settingsProfile.twoFa.enabled')}</p>
                <p className="text-xs text-muted-foreground">{t('settingsProfile.twoFa.enabledDescription')}</p>
              </div>
              <Button variant="destructive" onClick={() => { setDisableTwoFaPassword(''); setDisableTwoFaOpen(true); }}>
                {t('settingsProfile.twoFa.disable')}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <KeyRound className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t('settingsProfile.twoFa.disabled')}</p>
                <p className="text-xs text-muted-foreground">{t('settingsProfile.twoFa.disabledDescription')}</p>
              </div>
              <Button onClick={handleSetup2fa} disabled={twoFaLoading}>
                {twoFaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('settingsProfile.twoFa.setup')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2FA Setup Dialog */}
      <Dialog open={twoFaSetupOpen} onOpenChange={setTwoFaSetupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settingsProfile.twoFa.setupDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('settingsProfile.twoFa.setupDialog.description')}
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
                <Label className="text-xs text-muted-foreground">{t('settingsProfile.twoFa.setupDialog.manualEntry')}</Label>
                <Input value={twoFaSecretText} readOnly className="bg-secondary border-border font-mono text-xs text-foreground" onClick={(e) => (e.target as HTMLInputElement).select()} />
              </div>
            )}
            <div className="space-y-2">
              <Label>{t('settingsProfile.twoFa.setupDialog.codeLabel')}</Label>
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
              {t('settingsProfile.twoFa.setupDialog.activate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Disable Dialog */}
      <Dialog open={disableTwoFaOpen} onOpenChange={setDisableTwoFaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settingsProfile.twoFa.disableDialog.title')}</DialogTitle>
            <DialogDescription>{t('settingsProfile.twoFa.disableDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('settingsProfile.twoFa.disableDialog.password')}</Label>
            <Input type="password" value={disableTwoFaPassword} onChange={(e) => setDisableTwoFaPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDisable2fa} disabled={disableTwoFaLoading || !disableTwoFaPassword.trim()}>
              {disableTwoFaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settingsProfile.twoFa.disableDialog.deactivate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
