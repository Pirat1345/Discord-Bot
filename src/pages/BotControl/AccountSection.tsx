import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserCircle, AlertTriangle, Plus } from 'lucide-react';

export function AccountSection() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <UserCircle className="h-5 w-5" />
          Account (User-Token)
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Verwende einen Discord User-Token, um einen Account als Bot zu hosten. Achtung: Dies verstößt gegen die Discord ToS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="space-y-1">
              <p className="font-semibold">Warnung: Nutzung auf eigene Gefahr</p>
              <p className="text-muted-foreground">
                Das Verwenden von User-Tokens für Automatisierung verstößt gegen die Discord Terms of Service.
                Dein Account kann gesperrt werden. Nutze diese Funktion nur, wenn du dir der Risiken bewusst bist.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-8 text-center">
          <UserCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">Noch keine Accounts eingerichtet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Füge einen Discord User-Token hinzu, um einen Account fernzusteuern.
          </p>
          <Button className="mt-4 gap-2" disabled>
            <Plus className="h-4 w-4" />
            Account hinzufügen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
