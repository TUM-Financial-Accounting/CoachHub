import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Repeat, Trash2 } from 'lucide-react';
import { MatchService } from '../services';
import type { MatchDetails, MatchSubstitution, Player } from '../types/models';
import { DEFAULT_MATCH_MINUTES, minutesPlayed } from '../lib/minutes';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

interface Props {
  match: MatchDetails;
  starterIds: string[];
  players: Player[];
  onRatePlayer: (player: Player) => void;
}

export default function MatchSubstitutions({ match, starterIds, players, onRatePlayer }: Props) {
  const { t } = useTranslation();
  const [subs, setSubs] = useState<MatchSubstitution[]>([]);
  const [playerIn, setPlayerIn] = useState('');
  const [playerOut, setPlayerOut] = useState('');
  const [minute, setMinute] = useState('');
  const duration = match.duration || DEFAULT_MATCH_MINUTES;

  useEffect(() => {
    let cancelled = false;
    MatchService.getSubstitutions(match.id)
      .then(data => { if (!cancelled) setSubs(data); })
      .catch(() => { if (!cancelled) toast.error(t('substitutions.loadFailed')); });
    return () => { cancelled = true; };
  }, [match.id, t]);

  const name = (id: string | null) => {
    const p = players.find(x => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : t('substitutions.unknownPlayer');
  };
  const minutes = useMemo(() => minutesPlayed(starterIds, subs, duration), [starterIds, subs, duration]);
  const onPitch = useMemo(() => {
    const on = new Set(starterIds);
    for (const s of [...subs].sort((a, b) => a.minute - b.minute)) {
      if (s.playerOutId) on.delete(s.playerOutId);
      on.add(s.playerInId);
    }
    return [...on];
  }, [starterIds, subs]);
  const inOptions = players.filter(p => !onPitch.includes(p.id));

  const add = async () => {
    const m = Number(minute);
    if (!playerIn || minute === '' || !Number.isInteger(m) || m < 0 || m > duration) {
      return toast.error(t('substitutions.invalid', { max: duration }));
    }
    try {
      const created = await MatchService.addSubstitution(match.id, { playerInId: playerIn, playerOutId: playerOut || null, minute: m });
      setSubs(prev => [...prev, created].sort((a, b) => a.minute - b.minute));
      setPlayerIn('');
      setPlayerOut('');
      setMinute('');
      toast.success(t('substitutions.added'));
    } catch {
      toast.error(t('substitutions.saveFailed'));
    }
  };

  const remove = async (id: string) => {
    const before = subs;
    setSubs(prev => prev.filter(s => s.id !== id));
    try {
      await MatchService.deleteSubstitution(id);
    } catch {
      setSubs(before);
      toast.error(t('substitutions.saveFailed'));
    }
  };

  return (
    <Card className="p-5 space-y-4" data-testid="match-substitutions">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-muted uppercase tracking-widest flex items-center gap-2">
          <Repeat size={14} /> {t('substitutions.title')}
        </h3>
        <span className="text-xs text-muted">{t('substitutions.duration', { minutes: duration })}</span>
      </div>

      {subs.length === 0 ? (
        <p className="text-xs text-muted italic">{t('substitutions.none')}</p>
      ) : (
        <ul className="space-y-2">
          {subs.map(s => (
            <li key={s.id} className="flex items-center gap-3 bg-surface-hover border border-border-subtle rounded-xl px-3 py-2 text-sm">
              <span className="font-mono font-bold text-foreground w-10">{s.minute}'</span>
              <button type="button" onClick={() => { const p = players.find(x => x.id === s.playerInId); if (p) onRatePlayer(p); }}
                className="flex items-center gap-1 text-emerald-500 font-semibold hover:underline" title={t('substitutions.rate')}>
                <ArrowUp size={14} /> {name(s.playerInId)}
              </button>
              {s.playerOutId && <span className="flex items-center gap-1 text-rose-500"><ArrowDown size={14} /> {name(s.playerOutId)}</span>}
              <button type="button" onClick={() => remove(s.id)} className="ml-auto text-muted hover:text-rose-500" aria-label={t('common.delete')}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <Select label={t('substitutions.playerIn')} value={playerIn} placeholder={t('substitutions.choose')}
          onChange={v => setPlayerIn(String(v))}
          options={inOptions.map(p => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} />
        <Select label={t('substitutions.playerOut')} value={playerOut} placeholder={t('substitutions.nobody')}
          onChange={v => setPlayerOut(String(v))}
          options={[{ value: '', label: t('substitutions.nobody') }, ...onPitch.map(id => ({ value: id, label: name(id) }))]} />
        <Input label={t('substitutions.minute')} type="number" min={0} max={duration} value={minute} onChange={e => setMinute(e.target.value)} />
        <Button onClick={add}>{t('substitutions.add')}</Button>
      </div>

      {minutes.size > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">{t('substitutions.minutesPlayed')}</p>
          <div className="flex flex-wrap gap-2">
            {[...minutes.entries()].sort((a, b) => b[1] - a[1]).map(([id, m]) => (
              <span key={id} className="px-2.5 py-1 rounded-lg text-xs bg-surface-hover border border-border-subtle text-foreground">
                {name(id)} <span className="font-bold">{m}'</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
