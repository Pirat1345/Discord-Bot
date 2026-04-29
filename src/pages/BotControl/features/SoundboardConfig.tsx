import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Phone, PhoneOff, Play, Pencil, Trash } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import * as botApi from '@/lib/botApi';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  showCopyableError: (title: string, message: string) => void;
}

export function SoundboardConfig({ showCopyableError }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

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
          Voice-Status:{' '}
          <span className={cn('font-semibold', voiceConnected ? 'text-success' : 'text-foreground')}>
            {voiceConnected
              ? `Verbunden mit ${soundboardStatus?.channelName || 'Channel'} (${soundboardStatus?.guildName || 'Server'})`
              : 'Nicht verbunden'}
          </span>
        </p>
        <p className="text-xs">Audio-Dateien sind benutzerübergreifend für alle Server gleich.</p>
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
                toast({ title: 'Voice getrennt' });
              } catch (error) {
                const msg = error instanceof Error ? error.message : 'Trennen fehlgeschlagen.';
                showCopyableError('Fehler', msg);
              }
            }}
          >
            {soundboardLeave.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
            Trennen
          </Button>
        ) : (
          <Button
            className="gap-2"
            disabled={soundboardJoin.isPending}
            onClick={async () => {
              try {
                const result = await soundboardJoin.mutateAsync();
                toast({
                  title: 'Voice verbunden',
                  description: result.channelName
                    ? `Bot ist in ${result.channelName} (${result.guildName}).`
                    : 'Bot ist in einem Voice-Channel.',
                });
              } catch (error) {
                const msg = error instanceof Error ? error.message : 'Beitreten fehlgeschlagen.';
                showCopyableError('Fehler', msg);
              }
            }}
          >
            {soundboardJoin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
            Voice beitreten
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-foreground">Audio hochladen (.mp3 / .wav, max. 8 MB)</Label>
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
                toast({ title: 'Hochgeladen', description: `${file.name} wurde gespeichert.` });
                e.target.value = '';
              } catch (error) {
                const msg = error instanceof Error ? error.message : 'Upload fehlgeschlagen.';
                showCopyableError('Fehler', msg);
              }
            }}
          />
        </div>
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Audio-Dateien hochgeladen.</p>
      ) : (
        <div className="space-y-2">
          <Label className="text-foreground">Sounds ({files.length})</Label>
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
                    title="Umbenennen"
                    disabled={soundboardRename.isPending}
                    onClick={async () => {
                      const ext = file.name.slice(file.name.lastIndexOf('.'));
                      const baseName = file.name.slice(0, file.name.lastIndexOf('.'));
                      const input = window.prompt('Neuer Name (ohne Endung):', baseName);
                      if (input === null || input.trim() === '' || input.trim() === baseName) return;
                      const newName = `${input.trim()}${ext}`;
                      try {
                        await soundboardRename.mutateAsync({ oldName: file.name, newName });
                        toast({ title: 'Umbenannt', description: `${file.name} → ${newName}` });
                      } catch (error) {
                        const msg = error instanceof Error ? error.message : 'Umbenennen fehlgeschlagen.';
                        showCopyableError('Fehler', msg);
                      }
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    disabled={soundboardPlay.isPending || !voiceConnected}
                    title={voiceConnected ? 'Abspielen' : 'Zuerst Voice beitreten'}
                    onClick={async () => {
                      try {
                        await soundboardPlay.mutateAsync(file.name);
                        toast({ title: 'Abgespielt', description: file.name });
                      } catch (error) {
                        const msg = error instanceof Error ? error.message : 'Wiedergabe fehlgeschlagen.';
                        showCopyableError('Fehler', msg);
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
                        toast({ title: 'Gelöscht', description: `${file.name} wurde entfernt.` });
                      } catch (error) {
                        const msg = error instanceof Error ? error.message : 'Löschen fehlgeschlagen.';
                        showCopyableError('Fehler', msg);
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
