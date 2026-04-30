import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Play, SkipForward, Square, ListMusic, Terminal } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import * as botApi from '@/lib/botApi';
import { useAuth } from '@/hooks/useAuth';
import type { FeatureConfigProps } from '../types';

export function MusicPlayerConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig, selectedGuildId, showCopyableError }: FeatureConfigProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [musicUrl, setMusicUrl] = useState('');

  const { data: musicStatus, refetch: refetchMusicStatus } = useQuery({
    queryKey: ['music-status', user?.id, selectedGuildId],
    queryFn: () => botApi.getMusicStatus(selectedGuildId as string),
    enabled: !!user && !!selectedGuildId,
    refetchInterval: 3000,
  });

  const { data: musicQueue, refetch: refetchMusicQueue } = useQuery({
    queryKey: ['music-queue', user?.id, selectedGuildId],
    queryFn: () => botApi.getMusicQueue(selectedGuildId as string),
    enabled: !!user && !!selectedGuildId,
    refetchInterval: 3000,
  });

  const musicPlayMutation = useMutation({
    mutationFn: ({ guildId, url }: { guildId: string; url: string }) => botApi.musicPlay(guildId, url),
    onSuccess: () => { refetchMusicStatus(); refetchMusicQueue(); },
  });

  const musicSkipMutation = useMutation({
    mutationFn: (guildId: string) => botApi.musicSkip(guildId),
    onSuccess: () => { refetchMusicStatus(); refetchMusicQueue(); },
  });

  const musicStopMutation = useMutation({
    mutationFn: (guildId: string) => botApi.musicStop(guildId),
    onSuccess: () => { refetchMusicStatus(); refetchMusicQueue(); },
  });

  const isPlaying = musicStatus?.playing ?? false;
  const nowPlaying = musicStatus?.nowPlaying || null;
  const queueItems = musicQueue?.queue || [];
  const channelName = musicStatus?.channelName || null;
  const cmdPrefix = config.prefix ?? '!';
  const cmdPlay = config.cmdPlay ?? 'play';
  const cmdSkip = config.cmdSkip ?? 'skip';
  const cmdStop = config.cmdStop ?? 'stop';
  const cmdQueue = config.cmdQueue ?? 'queue';

  return (
    <>
      <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground space-y-1">
        <p>
          Status:{' '}
          <span className={cn('font-semibold', isPlaying ? 'text-success' : 'text-foreground')}>
            {isPlaying ? t('botControl.features.musicPlayer.playing') : t('botControl.features.musicPlayer.stopped')}
          </span>
          {channelName && (
            <span className="text-muted-foreground"> in {channelName}</span>
          )}
        </p>
        {nowPlaying && (
          <p>
            {t('botControl.features.musicPlayer.currentSong')}{' '}
            <span className="font-semibold text-foreground">{nowPlaying.title}</span>
          </p>
        )}
        <p>{t('botControl.features.musicPlayer.queue')} <span className="font-semibold text-foreground">{queueItems.length} {t('botControl.features.musicPlayer.songs')}</span></p>
        <p className="text-xs">{t('botControl.features.musicPlayer.requirements')}</p>
      </div>

      {/* Discord Command Configuration */}
      <div className="rounded-md border border-border bg-card p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <Label className="text-foreground font-semibold">{t('botControl.features.musicPlayer.discordCommands')}</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('botControl.features.musicPlayer.discordCommandsHint')}
        </p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-foreground text-xs">{t('botControl.features.musicPlayer.prefix')}</Label>
            <Input
              placeholder="!"
              value={cmdPrefix}
              onChange={(e) => setLocalConfig('music-player', 'prefix', e.target.value)}
              className="bg-secondary border-border text-foreground font-mono h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground text-xs">{t('botControl.features.musicPlayer.playCmd')}</Label>
            <Input
              placeholder="play"
              value={cmdPlay}
              onChange={(e) => setLocalConfig('music-player', 'cmdPlay', e.target.value)}
              className="bg-secondary border-border text-foreground font-mono h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground text-xs">{t('botControl.features.musicPlayer.skipCmd')}</Label>
            <Input
              placeholder="skip"
              value={cmdSkip}
              onChange={(e) => setLocalConfig('music-player', 'cmdSkip', e.target.value)}
              className="bg-secondary border-border text-foreground font-mono h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground text-xs">{t('botControl.features.musicPlayer.stopCmd')}</Label>
            <Input
              placeholder="stop"
              value={cmdStop}
              onChange={(e) => setLocalConfig('music-player', 'cmdStop', e.target.value)}
              className="bg-secondary border-border text-foreground font-mono h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground text-xs">{t('botControl.features.musicPlayer.queueCmd')}</Label>
            <Input
              placeholder="queue"
              value={cmdQueue}
              onChange={(e) => setLocalConfig('music-player', 'cmdQueue', e.target.value)}
              className="bg-secondary border-border text-foreground font-mono h-8 text-sm"
            />
          </div>
        </div>
        <div className="rounded-md border border-dashed border-border bg-secondary/40 px-3 py-2">
          <p className="text-xs text-muted-foreground font-mono">
            <span className="text-foreground">{cmdPrefix}{cmdPlay}</span> &lt;url&gt; · <span className="text-foreground">{cmdPrefix}{cmdSkip}</span> · <span className="text-foreground">{cmdPrefix}{cmdStop}</span> · <span className="text-foreground">{cmdPrefix}{cmdQueue}</span>
          </p>
        </div>
        <Button onClick={() => saveConfig(featureId, 'music-player', featureConfig)} variant="secondary" size="sm">
          {t('botControl.features.musicPlayer.saveCommands')}
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-foreground">{t('botControl.features.musicPlayer.urlLabel')}</Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://www.youtube.com/watch?v=..."
            value={musicUrl}
            onChange={(e) => setMusicUrl(e.target.value)}
            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && musicUrl.trim() && selectedGuildId) {
                musicPlayMutation.mutate({ guildId: selectedGuildId, url: musicUrl.trim() });
                setMusicUrl('');
              }
            }}
          />
          <Button
            disabled={musicPlayMutation.isPending || !musicUrl.trim()}
            onClick={() => {
              if (!selectedGuildId || !musicUrl.trim()) return;
              musicPlayMutation.mutate(
                { guildId: selectedGuildId, url: musicUrl.trim() },
                {
                  onSuccess: (data) => {
                    setMusicUrl('');
                    toast({
                      title: t('botControl.features.musicPlayer.added'),
                      description: data.added === 1
                        ? t('botControl.features.musicPlayer.addedSingle', { title: data.songs[0] })
                        : t('botControl.features.musicPlayer.addedMultiple', { count: data.added }),
                    });
                  },
                  onError: (err) => {
                    const msg = err instanceof Error ? err.message : t('common.error');
                    showCopyableError(t('common.error'), msg);
                  },
                }
              );
            }}
            className="gap-2 shrink-0"
          >
            {musicPlayMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {t('botControl.features.musicPlayer.play')}
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="gap-2"
          disabled={musicSkipMutation.isPending || !isPlaying}
          onClick={() => {
            if (!selectedGuildId) return;
            musicSkipMutation.mutate(selectedGuildId, {
              onSuccess: (data) => {
                toast({ title: t('botControl.features.musicPlayer.skipped'), description: t('botControl.features.musicPlayer.skippedDesc', { title: data.skipped }) });
              },
              onError: (err) => {
                const msg = err instanceof Error ? err.message : t('botControl.features.musicPlayer.skipError');
                showCopyableError(t('common.error'), msg);
              },
            });
          }}
        >
          {musicSkipMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />}
          {t('botControl.features.musicPlayer.skip')}
        </Button>
        <Button
          variant="destructive"
          className="gap-2"
          disabled={musicStopMutation.isPending || (!isPlaying && queueItems.length === 0)}
          onClick={() => {
            if (!selectedGuildId) return;
            musicStopMutation.mutate(selectedGuildId, {
              onSuccess: () => {
                toast({ title: t('botControl.features.musicPlayer.stoppedTitle'), description: t('botControl.features.musicPlayer.stoppedDesc') });
              },
              onError: (err) => {
                const msg = err instanceof Error ? err.message : t('botControl.features.musicPlayer.stopError');
                showCopyableError(t('common.error'), msg);
              },
            });
          }}
        >
          {musicStopMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
          {t('botControl.features.musicPlayer.stop')}
        </Button>
      </div>

      {queueItems.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-foreground">
            <ListMusic className="h-4 w-4" />
            {t('botControl.features.musicPlayer.queueLabel')} ({queueItems.length})
          </Label>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border bg-card p-2">
            {queueItems.slice(0, 20).map((item) => (
              <div
                key={item.position}
                className={cn(
                  'flex items-center gap-2 rounded px-2 py-1.5 text-sm',
                  item.isPlaying ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                )}
              >
                <span className="w-6 text-right text-xs text-muted-foreground">
                  {item.isPlaying ? '▶' : `${item.position}.`}
                </span>
                <span className="truncate">{item.title}</span>
              </div>
            ))}
            {queueItems.length > 20 && (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                ... {t('botControl.features.musicPlayer.moreItems', { count: queueItems.length - 20 })}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
