import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Webhook, Plus } from 'lucide-react';

export function WebhookSection() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Webhook className="h-5 w-5" />
          Webhooks
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Erstelle und verwalte Discord Webhooks, um Nachrichten in Channels zu senden – ohne Bot-Token.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-8 text-center">
          <Webhook className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">Noch keine Webhooks eingerichtet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Webhooks erlauben es dir, Nachrichten in Discord-Channels zu senden, ohne einen Bot laufen zu lassen.
          </p>
          <Button className="mt-4 gap-2" disabled>
            <Plus className="h-4 w-4" />
            Webhook hinzufügen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
