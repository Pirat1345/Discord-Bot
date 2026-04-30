import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const { t } = useTranslation();
  const { user, loading, needsInitialSetup } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signIn, initializeAdmin } = useAuth();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (needsInitialSetup && password !== confirmPassword) {
      toast({ title: t('common.error'), description: t('auth.passwordMismatch'), variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    if (needsInitialSetup) {
      const { error } = await initializeAdmin(username, password);
      if (error) {
        toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      } else {
        toast({ title: t('auth.adminCreated'), description: t('auth.adminCreatedDescription') });
      }
    } else {
      const result = await signIn(username, password, requires2fa ? totpCode : undefined);
      if (result.requires2fa) {
        setRequires2fa(true);
        setTotpCode('');
      } else if (result.error) {
        toast({ title: t('common.error'), description: result.error.message, variant: 'destructive' });
      }
    }

    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 glow-primary">
            {requires2fa ? <ShieldCheck className="h-8 w-8 text-primary" /> : <Bot className="h-8 w-8 text-primary" />}
          </div>
          <CardTitle className="text-2xl text-foreground">
            {requires2fa ? t('auth.twoFaEnterCode') : needsInitialSetup ? t('auth.initialSetupTitle') : t('auth.welcomeBack')}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {requires2fa
              ? t('auth.twoFaEnterDescription')
              : needsInitialSetup
              ? t('auth.initialSetupDescription')
              : t('auth.welcomeDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!requires2fa && (
              <>
                <Input
                  placeholder={t('auth.username')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
                <Input
                  type="password"
                  placeholder={needsInitialSetup ? t('auth.passwordSetPlaceholder') : t('auth.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={5}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
                {needsInitialSetup && (
                  <Input
                    type="password"
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={5}
                    className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                  />
                )}
              </>
            )}
            {requires2fa && (
              <Input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                required
                autoFocus
                className="bg-secondary border-border text-center text-lg font-mono tracking-widest text-foreground placeholder:text-muted-foreground"
              />
            )}
            <Button type="submit" className="w-full" disabled={submitting || (requires2fa && totpCode.length !== 6)}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {requires2fa ? t('auth.confirm') : needsInitialSetup ? t('auth.createAdmin') : t('auth.signIn')}
            </Button>
            {requires2fa && (
              <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={() => { setRequires2fa(false); setTotpCode(''); }}>
                {t('auth.twoFaBackToLogin')}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
