import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const { user, loading, needsInitialSetup } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    const { error } = needsInitialSetup
      ? await initializeAdmin(username, password)
      : await signIn(username, password);

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else if (needsInitialSetup) {
      toast({ title: 'Erfolg', description: 'Admin wurde angelegt und eingeloggt.' });
    }
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 glow-primary">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-foreground">
            {needsInitialSetup ? 'Erstkonfiguration' : 'Willkommen zurück'}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {needsInitialSetup
              ? 'Lege jetzt direkt deinen Admin-Benutzernamen und dein Passwort fest.'
              : 'Melde dich mit Benutzername und Passwort an.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {needsInitialSetup ? 'Admin erstellen' : 'Anmelden'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
