import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGameDeals, refreshGameDeals } from '@/lib/botApi';
import type { GameDeal } from '@/lib/botApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ExternalLink, Clock, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

function formatEndDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

function formatTimeRemaining(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const end = new Date(iso);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    if (diffMs <= 0) return 'Abgelaufen';
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `Noch ${days}d ${hours}h`;
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `Noch ${hours}h ${minutes}min`;
  } catch {
    return null;
  }
}

function DealCard({ deal }: { deal: GameDeal }) {
  const endDate = formatEndDate(deal.endDate);
  const remaining = formatTimeRemaining(deal.endDate);
  const isEpic = deal.platform === 'epic';

  return (
    <a
      href={deal.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {deal.image ? (
          <img
            src={deal.image}
            alt={deal.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <Gamepad2 className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />

        <Badge
          className={cn(
            'absolute left-3 top-3 font-bold tracking-wider',
            isEpic ? 'bg-black text-white hover:bg-black' : 'bg-[#1b2838] text-white hover:bg-[#1b2838]',
          )}
        >
          {isEpic ? 'EPIC' : 'STEAM'}
        </Badge>

        <Badge className="absolute right-3 top-3 bg-green-600 text-white hover:bg-green-600">
          KOSTENLOS
        </Badge>

        <ExternalLink
          className="absolute right-3 bottom-3 h-4 w-4 text-foreground/70 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-foreground">
          {deal.title}
        </h3>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            {deal.originalPrice ? (
              <span className="text-sm text-muted-foreground line-through">{deal.originalPrice}</span>
            ) : null}
            <span className="text-lg font-bold text-green-500">0,00 €</span>
          </div>

          {(endDate || remaining) && (
            <div className="flex flex-col items-end gap-0.5 text-right">
              {endDate && (
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden />
                  <span>{endDate}</span>
                </div>
              )}
              {remaining && (
                <span className="text-xs font-medium text-orange-400">{remaining}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

function DealSection({
  title,
  platform,
  deals,
  loading,
  error,
}: {
  title: string;
  platform: 'epic' | 'steam';
  deals: GameDeal[];
  loading: boolean;
  error?: string;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              platform === 'epic' ? 'bg-white shadow-md' : 'bg-blue-500 shadow-md',
              loading && 'animate-pulse',
            )}
            aria-hidden
          />
          <h2 className="text-lg font-bold tracking-wide text-foreground sm:text-xl">{title}</h2>
          <span className="text-xs text-muted-foreground">[{deals.length}]</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && deals.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[16/11] animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">Keine Deals gefunden</p>
          <p className="mt-2 text-xs text-muted-foreground">Schau später nochmal vorbei oder klicke auf „Jetzt scannen".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {deals.map((deal) => (
            <DealCard key={`${platform}-${deal.id}`} deal={deal} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Games() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: dealsData, isLoading: dealsLoading } = useQuery({
    queryKey: ['game-deals'],
    queryFn: getGameDeals,
    refetchInterval: 30 * 60 * 1000,
  });

  const refreshMutation = useMutation({
    mutationFn: refreshGameDeals,
    onSuccess: (data) => {
      qc.setQueryData(['game-deals'], data);
      toast({ title: 'Deals aktualisiert', description: `${(data.epic?.length || 0) + (data.steam?.length || 0)} Deals gefunden.` });
    },
    onError: (err) => {
      toast({ title: 'Fehler', description: err instanceof Error ? err.message : 'Unbekannter Fehler', variant: 'destructive' });
    },
  });

  const epic = dealsData?.epic ?? [];
  const steam = dealsData?.steam ?? [];
  const loading = dealsLoading || refreshMutation.isPending;
  const lastUpdated = dealsData?.fetchedAt ? new Date(dealsData.fetchedAt) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary">
            <Gamepad2 className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
            <span>Game Deals Scanner</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Kostenlose Spiele</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Live-Tracker für kostenlose Spiele auf Epic Games und Steam. Auto-Refresh alle 30 Minuten.
          </p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Zuletzt aktualisiert: {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        <Button
          onClick={() => refreshMutation.mutate()}
          disabled={loading}
          className="gap-2 self-start"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
          {loading ? 'Scanne...' : 'Jetzt scannen'}
        </Button>
      </div>

      {/* Deal Sections */}
      <div className="space-y-12">
        <DealSection
          title="Epic – Kostenlos"
          platform="epic"
          deals={epic}
          loading={loading}
          error={dealsData?.errors?.epic}
        />
        <DealSection
          title="Steam – 100% Rabatt"
          platform="steam"
          deals={steam}
          loading={loading}
          error={dealsData?.errors?.steam}
        />
      </div>
    </div>
  );
}
