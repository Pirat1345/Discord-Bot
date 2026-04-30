import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';
import type { FeatureConfigProps } from '../types';

export function MinesweeperConfig({ config, setLocalConfig, saveConfig, featureId, featureConfig }: FeatureConfigProps) {
  const { t } = useTranslation();
  const safeCells = Math.max(0, parseInt(String(config.safeCells || '0'), 10) || 0);
  const totalSafe = Math.max(0, parseInt(String(config.totalSafe || '0'), 10) || 0);
  const lastUsername = String(config.lastUsername || '').trim();
  const hasGame = Boolean(config.board);
  const allowSameUser = config.allowSameUser === 'true';

  return (
    <>
      <div className="space-y-2">
        <Label className="text-foreground">{t('botControl.features.minesweeper.channelLabel')}</Label>
        <Input
          placeholder="z.B. 123456789012345678"
          value={config.channelId || ''}
          onChange={(e) => setLocalConfig('minesweeper', 'channelId', e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">
          {t('botControl.features.minesweeper.channelHint')}
        </p>
      </div>
      <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
        <div>
          <p className="text-sm font-medium text-foreground">{t('botControl.features.minesweeper.allowSameUser')}</p>
          <p className="text-xs text-muted-foreground">{t('botControl.features.minesweeper.allowSameUserHint')}</p>
        </div>
        <Switch
          checked={allowSameUser}
          onCheckedChange={(checked) => setLocalConfig('minesweeper', 'allowSameUser', checked ? 'true' : 'false')}
        />
      </div>
      <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
        <p>{t('botControl.features.minesweeper.gameStatus')} <span className="font-semibold text-foreground">{hasGame ? t('botControl.features.minesweeper.active') : t('botControl.features.minesweeper.noGame')}</span></p>
        {hasGame && (
          <>
            <p>{t('botControl.features.minesweeper.revealed')} <span className="font-semibold text-foreground">{safeCells}/{totalSafe}</span></p>
            <p>{t('botControl.features.minesweeper.lastPlayer')} <span className="font-semibold text-foreground">{lastUsername || t('botControl.features.minesweeper.noPlayer')}</span></p>
          </>
        )}
        <p className="mt-1">{t('botControl.features.minesweeper.newGame')} <code className="text-foreground">/set game minesweeper</code></p>
        <p>{t('botControl.features.minesweeper.reset')} <code className="text-foreground">/reset minesweeper</code></p>
        <p>{t('botControl.features.minesweeper.coordHint')}</p>
        {!allowSameUser && <p>{t('botControl.features.minesweeper.turnRule')}</p>}
      </div>
      <Button onClick={() => saveConfig(featureId, 'minesweeper', featureConfig)} variant="secondary">
        {t('botControl.features.save')}
      </Button>
    </>
  );
}
