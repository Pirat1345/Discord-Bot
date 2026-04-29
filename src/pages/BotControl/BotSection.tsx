import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Power, Bot, Loader2, Plus, Settings2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface BotProfile {
  id: string;
  name: string;
  avatar_url?: string;
  bot_token?: string;
  command_prefix?: string;
  description?: string;
  status?: string;
  activity_type?: string;
  activity_text?: string;
}

interface BotSectionProps {
  profiles: BotProfile[];
  activeBotProfileId: string;
  isOnline: boolean;
  botProfileLoading: boolean;
  serverSummary: string;
  updateSettingsPending: boolean;
  handleToggleProfile: (profileId: string, enabled: boolean) => void;
  handleAddBot: () => void;
  handleDeleteBot: (profileId: string) => void;
}

export function BotSection({
  profiles,
  activeBotProfileId,
  isOnline,
  botProfileLoading,
  serverSummary,
  updateSettingsPending,
  handleToggleProfile,
  handleAddBot,
  handleDeleteBot,
}: BotSectionProps) {
  const navigate = useNavigate();

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-foreground">Bot Verwaltung</CardTitle>
          <Button type="button" size="sm" onClick={handleAddBot} disabled={updateSettingsPending} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Bot hinzufügen
          </Button>
        </div>
        <CardDescription className="text-muted-foreground">
          Jeder Bot hat eine eigene Karte. Einstellungen bearbeitest du per Zahnrad in den Bot-Einstellungen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {botProfileLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Lade Bot-Daten...
          </div>
        ) : (
          profiles.map((profile) => {
            const isProfileActive = activeBotProfileId === profile.id;
            const isProfileOnline = isProfileActive && isOnline;

            return (
              <div key={profile.id} className="grid gap-4 rounded-xl border border-border bg-secondary/30 p-4 md:grid-cols-[1.3fr_1fr_auto] md:items-center">
                <div className="flex items-center gap-3">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.name} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <Bot className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-foreground">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">{isProfileOnline ? 'Aktiv und online' : 'Nicht aktiv'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">Server</p>
                  <p className="text-xs text-muted-foreground">
                    {isProfileOnline ? serverSummary : 'Wird angezeigt, sobald dieser Bot aktiv ist.'}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant={isProfileOnline ? 'default' : 'secondary'}
                    className={cn(
                      'gap-2 min-w-[100px]',
                      isProfileOnline
                        ? 'bg-success hover:bg-success/90 text-success-foreground'
                        : ''
                    )}
                    disabled={updateSettingsPending}
                    onClick={() => handleToggleProfile(profile.id, !isProfileOnline)}
                  >
                    <Power className="h-4 w-4" />
                    {isProfileOnline ? 'Online' : 'Offline'}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={() => navigate('/settings/configuration/discord', { state: { profileId: profile.id } })}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    onClick={() => handleDeleteBot(profile.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
