import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { FeatureConfigProps } from '../types';

export function MinesweeperConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig }: FeatureConfigProps) {
  const safeCells = Math.max(0, parseInt(String(config.safeCells || '0'), 10) || 0);
  const totalSafe = Math.max(0, parseInt(String(config.totalSafe || '0'), 10) || 0);
  const lastUsername = String(config.lastUsername || '').trim();
  const hasGame = Boolean(config.board);
  const allowSameUser = config.allowSameUser === 'true';

  return (
    <>
      <div className="space-y-2">
        <Label className="text-foreground">Minesweeper Channel ID</Label>
        <Input
          placeholder="z.B. 123456789012345678"
          value={config.channelId || ''}
          onChange={(e) => setLocalConfig('minesweeper', 'channelId', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">
          Der Channel, in dem Minesweeper gespielt wird.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
        <div>
          <p className="text-sm font-medium text-foreground">Mehrfach hintereinander raten</p>
          <p className="text-xs text-muted-foreground">Erlaubt einem Spieler, mehrfach hintereinander zu spielen.</p>
        </div>
        <Switch
          checked={allowSameUser}
          onCheckedChange={(checked) => setLocalConfig('minesweeper', 'allowSameUser', checked ? 'true' : 'false')}
        />
      </div>
      <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
        <p>Spielstatus: <span className="font-semibold text-foreground">{hasGame ? 'Aktiv' : 'Kein Spiel'}</span></p>
        {hasGame && (
          <>
            <p>Aufgedeckt: <span className="font-semibold text-foreground">{safeCells}/{totalSafe}</span></p>
            <p>Letzter Spieler: <span className="font-semibold text-foreground">{lastUsername || 'Keiner'}</span></p>
          </>
        )}
        <p className="mt-1">Neues Spiel starten: <code className="text-foreground">/set game minesweeper</code></p>
        <p>Alles zurücksetzen: <code className="text-foreground">/reset minesweeper</code></p>
        <p>Koordinaten wie <code className="text-foreground">A1</code>, <code className="text-foreground">C3</code> decken Felder auf.</p>
        {!allowSameUser && <p>Jeder Spieler darf nur einmal hintereinander – danach ist jemand anderes dran.</p>}
      </div>
      <Button onClick={() => saveConfig(featureId, 'minesweeper', featureConfig)} variant="secondary">
        Speichern
      </Button>
    </>
  );
}
