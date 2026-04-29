import { Button } from '@/components/ui/button';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import * as botApi from '@/lib/botApi';
import type { FeatureConfigProps } from '../types';

interface Props extends Pick<FeatureConfigProps, 'selectedGuildId' | 'showCopyableError'> {
  guildName: string;
}

export function CleanerConfig({ selectedGuildId, guildName, showCopyableError }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const cleanupGuild = useMutation({
    mutationFn: (guildId: string) => botApi.cleanupGuild(guildId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guild-config'] });
      qc.invalidateQueries({ queryKey: ['guild-stats'] });
      qc.invalidateQueries({ queryKey: ['discord-servers'] });
    },
  });

  return (
    <>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="space-y-1">
            <p className="font-semibold">Achtung: Destruktive Aktion</p>
            <p className="text-muted-foreground">
              Dieser Cleaner löscht alle Kanäle, Kategorien und löschbaren Rollen auf dem ausgewählten Server.
              Die Standardrolle @everyone bleibt bestehen.
            </p>
          </div>
        </div>
      </div>
      <Button
        variant="destructive"
        className="gap-2"
        onClick={async () => {
          if (!selectedGuildId) return;

          const confirmed = window.confirm(
            `Wirklich ALLES auf ${guildName} löschen? Kanäle, Kategorien und Rollen werden entfernt.`
          );
          if (!confirmed) return;

          const typed = window.prompt(`Zur Bestätigung tippe den Servernamen exakt ein: ${guildName}`);
          if ((typed || '').trim() !== guildName.trim()) {
            toast({ title: 'Abgebrochen', description: 'Servername stimmt nicht überein.', variant: 'destructive' });
            return;
          }

          try {
            await cleanupGuild.mutateAsync(selectedGuildId);
            toast({ title: 'Gelöscht', description: 'Der Server wurde geleert.' });
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Cleaner fehlgeschlagen.';
            showCopyableError('Fehler', msg);
          }
        }}
        disabled={cleanupGuild.isPending}
      >
        {cleanupGuild.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Server leeren
      </Button>
    </>
  );
}
