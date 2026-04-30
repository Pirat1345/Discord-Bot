import { useBotSettings, useBotFeatures, useBotLogs } from '@/hooks/useBotData';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, Cpu, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function LogLine({ log }: { log: { created_at: string; level: string; message: string }; key?: string }) {
  const colors: Record<string, string> = {
    info: 'text-muted-foreground',
    warn: 'text-warning',
    error: 'text-destructive',
    success: 'text-success',
  };

  return (
    <div className="flex gap-3 py-1.5 text-sm font-mono border-b border-border/50 last:border-0">
      <span className="text-muted-foreground shrink-0">
        {new Date(log.created_at).toLocaleTimeString(undefined)}
      </span>
      <span className={cn('uppercase text-xs font-bold w-12 shrink-0 pt-0.5', colors[log.level] || 'text-muted-foreground')}>
        {log.level}
      </span>
      <span className="text-foreground">{log.message}</span>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: settings, isLoading: settingsLoading } = useBotSettings();
  const { data: features } = useBotFeatures();
  const { data: logs, isLoading: logsLoading } = useBotLogs();

  const isOnline = settings?.is_online ?? false;
  const enabledFeatures = features?.filter((f) => f.enabled).length ?? 0;
  const totalFeatures = features?.length ?? 0;

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.status')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={isOnline ? 'default' : 'secondary'} className={cn(isOnline && 'bg-success text-success-foreground')}>
              {isOnline ? t('dashboard.online') : t('dashboard.offline')}
            </Badge>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.features')}</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{enabledFeatures}/{totalFeatures}</p>
            <p className="text-xs text-muted-foreground">{t('dashboard.active')}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.logs')}</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{logs?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">{t('dashboard.entries')}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.uptime')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{isOnline ? t('dashboard.active') : '—'}</p>
            <p className="text-xs text-muted-foreground">{isOnline ? t('dashboard.running') : t('dashboard.stopped')}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t('dashboard.logs')}</CardTitle>
        </CardHeader>
        <CardContent className="max-h-96 overflow-auto">
          {logsLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : !logs?.length ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.noLogs')}</p>
          ) : (
            logs.map((log) => <LogLine key={log.id} log={log} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
