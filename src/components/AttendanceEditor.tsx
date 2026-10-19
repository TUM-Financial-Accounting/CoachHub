import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { TrainingService } from '../services';
import type { AbsenceReason, Player, TrainingAttendance, TrainingSession } from '../types/models';
import { ABSENCE_REASONS } from '../lib/attendance';
import { splitCsv } from '../lib/csv';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

type Row = Pick<TrainingAttendance, 'playerId' | 'status' | 'reason'>;

export default function AttendanceEditor({ session, allPlayers }: { session: TrainingSession; allPlayers: Player[] }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [recorded, setRecorded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    TrainingService.getAttendance(session.id)
      .then(records => {
        if (cancelled) return;
        setRecorded(records.length > 0);
        // Not recorded yet: start from the planned squad, everyone present.
        setRows(records.length > 0
          ? records.map(({ playerId, status, reason }) => ({ playerId, status, reason }))
          : splitCsv(session.selectedPlayers).map(playerId => ({ playerId, status: 'present', reason: null })));
      })
      .catch(() => { if (!cancelled) toast.error(t('attendance.loadFailed')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session.id, session.selectedPlayers, t]);

  const playerName = (id: string) => {
    const p = allPlayers.find(x => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : t('attendance.unknownPlayer');
  };
  const update = (playerId: string, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => r.playerId === playerId ? { ...r, ...patch } : r));
  const notListed = allPlayers.filter(p => !rows.some(r => r.playerId === p.id));
  const presentCount = rows.filter(r => r.status === 'present').length;

  const save = async () => {
    setSaving(true);
    try {
      await TrainingService.saveAttendance(session.id, rows);
      setRecorded(true);
      toast.success(t('attendance.saved'));
    } catch {
      toast.error(t('attendance.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
          <ClipboardCheck size={10} /> {t('attendance.title')}
          <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px]">
            {t('attendance.presentCount', { present: presentCount, total: rows.length })}
          </span>
        </p>
        {!recorded && !loading && <span className="text-[10px] text-amber-500">{t('attendance.notRecorded')}</span>}
      </div>

      {loading ? (
        <p className="text-xs text-muted">{t('attendance.loading')}</p>
      ) : (
        <>
          <div className="space-y-2">
            {rows.map(row => (
              <div key={row.playerId} data-testid="attendance-row" className="flex items-center gap-2 bg-surface-hover border border-border-subtle rounded-xl px-3 py-2">
                <span className="flex-1 text-sm font-medium text-foreground truncate">{playerName(row.playerId)}</span>
                <button
                  type="button"
                  onClick={() => update(row.playerId, { status: 'present', reason: null })}
                  aria-pressed={row.status === 'present'}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${row.status === 'present' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border text-muted hover:text-foreground'}`}
                >
                  <Check size={12} /> {t('attendance.present')}
                </button>
                <button
                  type="button"
                  onClick={() => update(row.playerId, { status: 'absent', reason: row.reason ?? 'unexcused' })}
                  aria-pressed={row.status === 'absent'}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${row.status === 'absent' ? 'bg-rose-500 border-rose-500 text-white' : 'border-border text-muted hover:text-foreground'}`}
                >
                  <X size={12} /> {t('attendance.absent')}
                </button>
                {row.status === 'absent' && (
                  <div className="w-36">
                    <Select
                      value={row.reason ?? 'unexcused'}
                      onChange={v => update(row.playerId, { reason: String(v) as AbsenceReason })}
                      options={ABSENCE_REASONS.map(r => ({ value: r, label: t(`attendance.reasons.${r}`) }))}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {notListed.length > 0 && (
            <Select
              value=""
              placeholder={t('attendance.addPlayer')}
              onChange={v => setRows(prev => [...prev, { playerId: String(v), status: 'present', reason: null }])}
              options={notListed.map(p => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))}
            />
          )}

          <Button onClick={save} isLoading={saving} className="w-full">{t('attendance.save')}</Button>
        </>
      )}
    </div>
  );
}
