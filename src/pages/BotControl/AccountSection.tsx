import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserCircle, AlertTriangle, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AccountSection() {
  const { t } = useTranslation();

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <UserCircle className="h-5 w-5" />
          {t('botControl.account.title')}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {t('botControl.account.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="space-y-1">
              <p className="font-semibold">{t('botControl.account.warningTitle')}</p>
              <p className="text-muted-foreground">
                {t('botControl.account.warningText')}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-8 text-center">
          <UserCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">{t('botControl.account.empty')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('botControl.account.emptyHint')}
          </p>
          <Button className="mt-4 gap-2" disabled>
            <Plus className="h-4 w-4" />
            {t('botControl.account.add')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
