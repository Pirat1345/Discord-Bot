import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield } from 'lucide-react';

export default function InitialSetup() {
  const { user, loading, completeInitialSetup } = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!user.must_change_password) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({ title: 'Fehler', description: 'Die Passwörter stimmen nicht überein.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const { error } = await completeInitialSetup(username, newPassword);

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: 'Admin-Account wurde aktualisiert.' });
    }

    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 glow-primary">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-foreground">Erstkonfiguration</CardTitle>
          <CardDescription className="text-muted-foreground">
            Bitte ändere jetzt den Standard-Admin auf deinen eigenen Benutzernamen und dein eigenes Passwort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              placeholder="Neuer Benutzername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            <Input
              type="password"
              placeholder="Neues Passwort"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={5}
              required
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            <Input
              type="password"
              placeholder="Passwort wiederholen"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={5}
              required
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
