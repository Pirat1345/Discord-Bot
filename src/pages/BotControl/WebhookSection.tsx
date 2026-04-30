import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Webhook, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function WebhookSection() {
  const { t } = useTranslation();

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Webhook className="h-5 w-5" />
          {t('botControl.webhook.title')}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {t('botControl.webhook.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-8 text-center">
          <Webhook className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">{t('botControl.webhook.empty')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('botControl.webhook.emptyHint')}
          </p>
          <Button className="mt-4 gap-2" disabled>
            <Plus className="h-4 w-4" />
            {t('botControl.webhook.add')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
