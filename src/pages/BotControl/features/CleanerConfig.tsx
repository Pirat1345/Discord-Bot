import { Button } from '@/components/ui/button';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import * as botApi from '@/lib/botApi';
import type { FeatureConfigProps } from '../types';

interface Props extends Pick<FeatureConfigProps, 'selectedGuildId' | 'showCopyableError'> {
  guildName: string;
}

export function CleanerConfig({ selectedGuildId, guildName, showCopyableError }: Props) {
  const { toast } = useToast();
  const { t } = useTranslation();
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
            <p className="font-semibold">{t('botControl.features.cleaner.warningTitle')}</p>
            <p className="text-muted-foreground">
              {t('botControl.features.cleaner.warningText')}
            </p>
          </div>
        </div>
      </div>
      <Button
        variant="destructive"
        className="gap-2"
        onClick={async () => {
          if (!selectedGuildId) return;

          const confirmed = window.confirm(t('botControl.features.cleaner.confirmDelete', { name: guildName }));
          if (!confirmed) return;

          const typed = window.prompt(t('botControl.features.cleaner.confirmPrompt', { name: guildName }));
          if ((typed || '').trim() !== guildName.trim()) {
            toast({ title: t('botControl.features.cleaner.cancelled'), description: t('botControl.features.cleaner.nameMismatch'), variant: 'destructive' });
            return;
          }

          try {
            await cleanupGuild.mutateAsync(selectedGuildId);
            toast({ title: t('botControl.features.cleaner.deleted'), description: t('botControl.features.cleaner.deletedDesc') });
          } catch (error) {
            const msg = error instanceof Error ? error.message : t('botControl.features.cleaner.deleteError');
            showCopyableError(t('common.error'), msg);
          }
        }}
        disabled={cleanupGuild.isPending}
      >
        {cleanupGuild.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        {t('botControl.features.cleaner.cleanButton')}
      </Button>
    </>
  );
}
