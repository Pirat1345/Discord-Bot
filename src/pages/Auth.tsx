import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
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
      toast({ title: 'Fehler', description: 'Die Passwörter stimmen nicht überein.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    if (needsInitialSetup) {
      const { error } = await initializeAdmin(username, password);
      if (error) {
        toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Erfolg', description: 'Admin wurde angelegt und eingeloggt.' });
      }
    } else {
      const result = await signIn(username, password, requires2fa ? totpCode : undefined);
      if (result.requires2fa) {
        setRequires2fa(true);
        setTotpCode('');
      } else if (result.error) {
        toast({ title: 'Fehler', description: result.error.message, variant: 'destructive' });
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
            {requires2fa ? '2FA-Code eingeben' : needsInitialSetup ? 'Erstkonfiguration' : 'Willkommen zurück'}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {requires2fa
              ? 'Gib den 6-stelligen Code aus deiner Authenticator-App ein.'
              : needsInitialSetup
              ? 'Lege jetzt direkt deinen Admin-Benutzernamen und dein Passwort fest.'
              : 'Melde dich mit Benutzername und Passwort an.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!requires2fa && (
              <>
                <Input
                  placeholder="Benutzername"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
                <Input
                  type="password"
                  placeholder={needsInitialSetup ? 'Passwort festlegen' : 'Passwort'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={5}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
                {needsInitialSetup && (
                  <Input
                    type="password"
                    placeholder="Passwort wiederholen"
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
              {requires2fa ? 'Bestätigen' : needsInitialSetup ? 'Admin erstellen' : 'Anmelden'}
            </Button>
            {requires2fa && (
              <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={() => { setRequires2fa(false); setTotpCode(''); }}>
                Zurück zum Login
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
