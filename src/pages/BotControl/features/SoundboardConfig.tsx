import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Phone, PhoneOff, Play, Pencil, Trash } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import * as botApi from '@/lib/botApi';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  showCopyableError: (title: string, message: string) => void;
}

export function SoundboardConfig({ showCopyableError }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: soundboardFiles, refetch: refetchSoundboardFiles } = useQuery({
    queryKey: ['soundboard-files', user?.id],
    queryFn: () => botApi.getSoundboardFiles(),
    enabled: !!user,
  });

  const { data: soundboardStatus } = useQuery({
    queryKey: ['soundboard-status', user?.id],
    queryFn: () => botApi.getSoundboardStatus(),
    enabled: !!user,
    refetchInterval: 5000,
  });

  const soundboardJoin = useMutation({
    mutationFn: () => botApi.joinSoundboardVoice(),
    onSuccess: () => { /* status refetches automatically */ },
  });

  const soundboardLeave = useMutation({
    mutationFn: () => botApi.leaveSoundboardVoice(),
  });

  const soundboardPlay = useMutation({
    mutationFn: (fileName: string) => botApi.playSoundboardSound(fileName),
  });

  const soundboardUpload = useMutation({
    mutationFn: (file: File) => botApi.uploadSoundboardFile(file),
    onSuccess: () => { refetchSoundboardFiles(); },
  });

  const soundboardDelete = useMutation({
    mutationFn: (fileName: string) => botApi.deleteSoundboardFile(fileName),
    onSuccess: () => { refetchSoundboardFiles(); },
  });

  const soundboardRename = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) => botApi.renameSoundboardFile(oldName, newName),
    onSuccess: () => { refetchSoundboardFiles(); },
  });

  const voiceConnected = soundboardStatus?.connected ?? false;
  const files = soundboardFiles?.files ?? [];

  return (
    <>
      <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground space-y-1">
        <p>
          {t('botControl.features.soundboard.voiceStatus')}{' '}
          <span className={cn('font-semibold', voiceConnected ? 'text-success' : 'text-foreground')}>
            {voiceConnected
              ? t('botControl.features.soundboard.connected', { channel: soundboardStatus?.channelName || 'Channel', guild: soundboardStatus?.guildName || 'Server' })
              : t('botControl.features.soundboard.notConnected')}
          </span>
        </p>
        <p className="text-xs">{t('botControl.features.soundboard.filesShared')}</p>
      </div>

      <div className="flex gap-2">
        {voiceConnected ? (
          <Button
            variant="destructive"
            className="gap-2"
            disabled={soundboardLeave.isPending}
            onClick={async () => {
              try {
                await soundboardLeave.mutateAsync();
                toast({ title: t('botControl.features.soundboard.disconnected') });
              } catch (error) {
                const msg = error instanceof Error ? error.message : t('botControl.features.soundboard.disconnectError');
                showCopyableError(t('common.error'), msg);
              }
            }}
          >
            {soundboardLeave.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
            {t('botControl.features.soundboard.disconnect')}
          </Button>
        ) : (
          <Button
            className="gap-2"
            disabled={soundboardJoin.isPending}
            onClick={async () => {
              try {
                const result = await soundboardJoin.mutateAsync();
                toast({
                  title: t('botControl.features.soundboard.voiceConnected'),
                  description: result.channelName
                    ? t('botControl.features.soundboard.voiceConnectedDesc', { channel: result.channelName, guild: result.guildName })
                    : t('botControl.features.soundboard.voiceConnectedGeneric'),
                });
              } catch (error) {
                const msg = error instanceof Error ? error.message : t('botControl.features.soundboard.joinError');
                showCopyableError(t('common.error'), msg);
              }
            }}
          >
            {soundboardJoin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
            {t('botControl.features.soundboard.join')}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-foreground">{t('botControl.features.soundboard.uploadLabel')}</Label>
        <div className="flex gap-2">
          <Input
            type="file"
            accept=".mp3,.wav,audio/mpeg,audio/wav"
            className="bg-secondary border-border text-foreground"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              try {
                await soundboardUpload.mutateAsync(file);
                toast({ title: t('botControl.features.soundboard.uploaded'), description: t('botControl.features.soundboard.uploadedDesc', { name: file.name }) });
                e.target.value = '';
              } catch (error) {
                const msg = error instanceof Error ? error.message : t('botControl.features.soundboard.uploadError');
                showCopyableError(t('common.error'), msg);
              }
            }}
          />
        </div>
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('botControl.features.soundboard.noFiles')}</p>
      ) : (
        <div className="space-y-2">
          <Label className="text-foreground">{t('botControl.features.soundboard.soundsLabel')} ({files.length})</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {files.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    title={t('botControl.features.soundboard.renameTitle')}
                    disabled={soundboardRename.isPending}
                    onClick={async () => {
                      const ext = file.name.slice(file.name.lastIndexOf('.'));
                      const baseName = file.name.slice(0, file.name.lastIndexOf('.'));
                      const input = window.prompt(t('botControl.features.soundboard.renamePrompt'), baseName);
                      if (input === null || input.trim() === '' || input.trim() === baseName) return;
                      const newName = `${input.trim()}${ext}`;
                      try {
                        await soundboardRename.mutateAsync({ oldName: file.name, newName });
                        toast({ title: t('botControl.features.soundboard.renamed'), description: t('botControl.features.soundboard.renamedDesc', { oldName: file.name, newName }) });
                      } catch (error) {
                        const msg = error instanceof Error ? error.message : t('botControl.features.soundboard.renameError');
                        showCopyableError(t('common.error'), msg);
                      }
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    disabled={soundboardPlay.isPending || !voiceConnected}
                    title={voiceConnected ? t('botControl.features.soundboard.playTitle') : t('botControl.features.soundboard.playDisabledTitle')}
                    onClick={async () => {
                      try {
                        await soundboardPlay.mutateAsync(file.name);
                        toast({ title: t('botControl.features.soundboard.played'), description: file.name });
                      } catch (error) {
                        const msg = error instanceof Error ? error.message : t('botControl.features.soundboard.playError');
                        showCopyableError(t('common.error'), msg);
                      }
                    }}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    disabled={soundboardDelete.isPending}
                    onClick={async () => {
                      try {
                        await soundboardDelete.mutateAsync(file.name);
                        toast({ title: t('botControl.features.soundboard.deleted'), description: t('botControl.features.soundboard.deletedDesc', { name: file.name }) });
                      } catch (error) {
                        const msg = error instanceof Error ? error.message : t('botControl.features.soundboard.deleteError');
                        showCopyableError(t('common.error'), msg);
                      }
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
