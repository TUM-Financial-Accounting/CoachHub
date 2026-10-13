import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Modal } from './ui/Modal';
import { DatePicker } from './ui/DatePicker';
import { TimePicker } from './ui/TimePicker';
import WeekCalendar, { CalendarItem } from './WeekCalendar';
import RecurrenceFields from './RecurrenceFields';
import SeriesDeleteDialog from './SeriesDeleteDialog';
import SeriesScopePicker from './SeriesScopePicker';

import { TrainingSession, MatchDetails, CalendarEvent, Player } from '../types/models';
import { Page } from '../types/ui';
import { TrainingService, MatchService, EventService, PlayerService } from '../services';
import { useTeam } from '../contexts/TeamContext';
import { useSeason } from '../contexts/SeasonContext';
import { useSettings } from '../contexts/SettingsContext';
import { weekStartOf } from '../lib/settings';
import { birthdaysInWeek } from '../lib/birthdays';
import { DEFAULT_FORMATION } from '../lib/formations';
import { DEFAULT_INTENSITY, INTENSITIES, intensityMeta } from '../lib/domain';
import { addMinutes, endsAfterStart, minutesToLabel, toMinutes, todayISO } from '../lib/dates';
import { Recurrence, SeriesScope, noRecurrence, recurrenceError, seriesPattern } from '../lib/recurrence';

interface CalendarViewProps {
  onNavigate: (page: Page) => void;
}

type EventType = 'event' | 'training' | 'match';

const emptyForm = {
  type: 'event' as EventType,
  date: todayISO(),
  startTime: '17:00',
  endTime: '18:00',
  title: '',
  location: '',
  description: '',
  intensity: DEFAULT_INTENSITY as string,
  opponent: '',
  focus: '',
};

export default function CalendarView({ onNavigate }: CalendarViewProps) {
  const { t, i18n } = useTranslation();
  const { activeTeam } = useTeam();
  const { activeSeason } = useSeason();
  const { settings } = useSettings();

  const [weekStart, setWeekStart] = useState<Date>(() => weekStartOf(new Date(), settings.weekStartsOn));
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [matches, setMatches] = useState<MatchDetails[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [recurrence, setRecurrence] = useState<Recurrence>(noRecurrence);
  const [showDeleteScope, setShowDeleteScope] = useState(false);
  const [editScope, setEditScope] = useState<SeriesScope>('this');
  const calendarWrapRef = useRef<HTMLDivElement>(null);

  // Two-finger horizontal swipe (trackpad) navigates between weeks. Attached
  // natively so we can preventDefault and stop the browser's back/forward
  // swipe gesture; vertical scrolling falls through to the grid untouched.
  useEffect(() => {
    const el = calendarWrapRef.current;
    if (!el) return;
    let cooling = false;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 40) return;
      e.preventDefault();
      if (cooling) return;
      cooling = true;
      const dir = e.deltaX > 0 ? 7 : -7;
      setWeekStart(prev => {
        const next = new Date(prev);
        next.setDate(prev.getDate() + dir);
        return next;
      });
      window.setTimeout(() => { cooling = false; }, 500);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    setWeekStart(prev => weekStartOf(prev, settings.weekStartsOn));
  }, [settings.weekStartsOn]);

  useEffect(() => {
    if (!activeTeam || !activeSeason || !settings.showBirthdays) {
      setPlayers([]);
      return;
    }
    let cancelled = false;
    PlayerService.getAll(activeTeam.id, activeSeason.id)
      .then(p => { if (!cancelled) setPlayers(p); })
      .catch(() => { if (!cancelled) setPlayers([]); });
    return () => { cancelled = true; };
  }, [activeTeam, activeSeason, settings.showBirthdays]);

  // --- Load data for the active team/season ---
  useEffect(() => {
    if (!activeTeam || !activeSeason) {
      setSessions([]);
      setMatches([]);
      setEvents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [s, m, e] = await Promise.all([
          TrainingService.getAll(activeTeam.id, activeSeason.id),
          MatchService.getAll(activeTeam.id, activeSeason.id),
          EventService.getAll(activeTeam.id, activeSeason.id),
        ]);
        if (cancelled) return;
        setSessions(s);
        setMatches(m);
        setEvents(e);
      } catch {
        if (!cancelled) toast.error(t('calendar.loadFailed'));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTeam, activeSeason]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  }), [weekStart]);

  const items = useMemo<CalendarItem[]>(() => {
    const out: CalendarItem[] = [];
    if (settings.showTrainings) sessions.forEach(s => out.push({
      id: s.id,
      kind: 'training',
      title: s.focus || t('nav.training'),
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      subtitle: s.intensity,
    }));
    if (settings.showMatches) matches.forEach(m => {
      const start = m.time && m.time.includes(':') ? m.time : '15:00';
      out.push({
        id: m.id,
        kind: 'match',
        title: `vs ${m.opponent}`,
        date: m.date,
        startTime: start,
        endTime: addMinutes(start, 120),
        subtitle: m.location,
      });
    });
    if (settings.showEvents) events.forEach(ev => out.push({
      id: ev.id,
      kind: 'event',
      title: ev.title,
      date: ev.date,
      startTime: ev.startTime,
      endTime: ev.endTime,
      subtitle: ev.location,
    }));
    if (settings.showBirthdays) {
      birthdaysInWeek(players, weekDays).forEach(b => out.push({
        id: b.playerId,
        kind: 'birthday',
        title: b.age === null
          ? t('settings.birthdayOf', { name: `${b.firstName} ${b.lastName}` })
          : t('settings.birthdayTurns', { name: `${b.firstName} ${b.lastName}`, age: b.age }),
        date: b.date,
        startTime: '',
        endTime: '',
        allDay: true,
      }));
    }
    return out;
  }, [sessions, matches, events, players, weekDays, settings, t]);

  // --- Week navigation ---
  const shiftWeek = (deltaWeeks: number) => {
    setWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + deltaWeeks * 7);
      return next;
    });
  };
  const goToday = () => setWeekStart(weekStartOf(new Date(), settings.weekStartsOn));

  const weekLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    const sameMonth = weekStart.getMonth() === end.getMonth();
    const startStr = weekStart.toLocaleDateString(i18n.language, { day: 'numeric', month: sameMonth ? undefined : 'short' });
    const endStr = end.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }, [weekStart, i18n.language]);

  // --- Modal helpers ---
  const openCreate = (date?: string, hour?: number) => {
    setEditingEventId(null);
    const start = hour != null ? `${String(hour).padStart(2, '0')}:00` : '17:00';
    setForm({
      ...emptyForm,
      date: date ?? todayISO(),
      startTime: start,
      endTime: addMinutes(start, 60),
    });
    setRecurrence(noRecurrence());
    setShowModal(true);
  };

  const openEditEvent = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    setEditScope('this');
    setForm({
      ...emptyForm,
      type: 'event',
      date: ev.date,
      startTime: ev.startTime,
      endTime: ev.endTime,
      title: ev.title,
      location: ev.location || '',
      description: ev.description || '',
    });
    setShowModal(true);
  };

  const handleItemClick = (item: CalendarItem) => {
    if (item.kind === 'event') {
      const ev = events.find(e => e.id === item.id);
      if (ev) openEditEvent(ev);
    } else if (item.kind === 'training') {
      onNavigate('session-planner');
    } else if (item.kind === 'birthday') {
      onNavigate('team');
    } else {
      onNavigate('match');
    }
  };

  // An end at or before the start means the block runs past midnight.
  const durationOf = (start: string, end: string): number => {
    const raw = (toMinutes(end) || 0) - (toMinutes(start) || 0);
    if (raw > 0) return raw;
    if (raw === 0) return 60;
    return raw + 24 * 60;
  };

  // Roll back only the moved row: a list snapshot would undo a concurrent drag or a team switch.
  const handleItemMove = async (item: CalendarItem, newDate: string, newStartMin: number) => {
    if (item.kind === 'birthday') return;
    const newStart = minutesToLabel(newStartMin);
    if (item.date === newDate && item.startTime === newStart) return;

    if (item.kind === 'event') {
      const ev = events.find(e => e.id === item.id);
      if (!ev) return;
      const dur = durationOf(ev.startTime, ev.endTime);
      const updated: CalendarEvent = { ...ev, date: newDate, startTime: newStart, endTime: addMinutes(newStart, dur) };
      setEvents(prev => prev.map(e => e.id === ev.id ? updated : e));
      try {
        const saved = await EventService.update(ev.id, updated);
        setEvents(prev => prev.map(e => e.id === saved.id ? saved : e));
        toast.success(t('calendar.itemMoved'));
      } catch {
        setEvents(prev => prev.map(e => e.id === ev.id ? ev : e));
        toast.error(t('calendar.moveFailed'));
      }
    } else if (item.kind === 'training') {
      const s = sessions.find(x => x.id === item.id);
      if (!s) return;
      const dur = durationOf(s.startTime, s.endTime);
      const updated: TrainingSession = { ...s, date: newDate, startTime: newStart, endTime: addMinutes(newStart, dur) };
      setSessions(prev => prev.map(x => x.id === s.id ? updated : x));
      try {
        // 'this' detaches the occurrence from its series instead of moving the whole series.
        const saved = await TrainingService.update(s.id, updated, 'this');
        setSessions(prev => prev.map(x => x.id === saved.id ? saved : x));
        toast.success(s.seriesId ? t('calendar.movedDetached') : t('calendar.itemMoved'));
      } catch {
        setSessions(prev => prev.map(x => x.id === s.id ? s : x));
        toast.error(t('calendar.moveFailed'));
      }
    } else {
      const m = matches.find(x => x.id === item.id);
      if (!m) return;
      const updated: MatchDetails = { ...m, date: newDate, time: newStart };
      setMatches(prev => prev.map(x => x.id === m.id ? updated : x));
      try {
        const saved = await MatchService.update(m.id, updated);
        setMatches(prev => prev.map(x => x.id === saved.id ? saved : x));
        toast.success(t('calendar.itemMoved'));
      } catch {
        setMatches(prev => prev.map(x => x.id === m.id ? m : x));
        toast.error(t('calendar.moveFailed'));
      }
    }
  };

  const handleSave = async () => {
    if (!activeTeam || !activeSeason) return;

    // --- Edit existing event ---
    if (editingEventId) {
      if (!form.title.trim()) return toast.error(t('calendar.titleRequired'));
      if (!endsAfterStart(form.startTime, form.endTime)) return toast.error(t('calendar.endAfterStart'));
      const updated: CalendarEvent = {
        id: editingEventId,
        title: form.title.trim(),
        description: form.description,
        location: form.location,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
      };
      const isSeries = !!events.find(e => e.id === editingEventId)?.seriesId;
      const scope = isSeries ? editScope : 'this';
      try {
        const saved = await EventService.update(editingEventId, updated, scope);
        if (scope === 'this') setEvents(prev => prev.map(e => e.id === saved.id ? saved : e));
        else setEvents(await EventService.getAll(activeTeam.id, activeSeason.id));
        toast.success(t(scope === 'this' ? 'calendar.eventUpdated' : 'recurrence.seriesUpdated'));
        setShowModal(false);
      } catch { toast.error(t('calendar.saveFailed')); }
      return;
    }

    // --- Create, branching on the chosen type ---
    const repeating = form.type !== 'match' && recurrence.frequency !== 'none';
    const pattern = seriesPattern(recurrence, form.date);
    try {
      if (form.type === 'event') {
        if (!form.title.trim()) return toast.error(t('calendar.titleRequired'));
        if (!endsAfterStart(form.startTime, form.endTime)) return toast.error(t('calendar.endAfterStart'));
        if (repeating) {
          const err = recurrenceError(recurrence, form.date);
          if (err) return toast.error(t(`recurrence.${err}`));
          const { occurrencesCreated } = await EventService.createSeries({
            title: form.title.trim(),
            description: form.description,
            location: form.location,
            startTime: form.startTime,
            endTime: form.endTime,
          }, pattern, activeTeam.id, activeSeason.id);
          setEvents(await EventService.getAll(activeTeam.id, activeSeason.id));
          toast.success(t('recurrence.seriesCreated', { count: occurrencesCreated }));
          setShowModal(false);
          return;
        }
        const saved = await EventService.create({
          title: form.title.trim(),
          description: form.description,
          location: form.location,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
        }, activeTeam.id, activeSeason.id);
        setEvents(prev => [...prev, saved]);
        toast.success(t('calendar.eventCreated'));
      } else if (form.type === 'training') {
        if (!form.focus.trim()) return toast.error(t('calendar.focusRequired'));
        if (!endsAfterStart(form.startTime, form.endTime)) return toast.error(t('calendar.endAfterStart'));
        if (repeating) {
          const err = recurrenceError(recurrence, form.date);
          if (err) return toast.error(t(`recurrence.${err}`));
          const { occurrencesCreated } = await TrainingService.createSeries({
            teamId: activeTeam.id,
            seasonId: activeSeason.id,
            pattern,
            startTime: form.startTime,
            endTime: form.endTime,
            focus: form.focus.trim(),
            intensity: form.intensity,
            selectedPlayers: '',
            selectedExercises: '',
          });
          setSessions(await TrainingService.getAll(activeTeam.id, activeSeason.id));
          toast.success(t('recurrence.seriesCreated', { count: occurrencesCreated }));
          setShowModal(false);
          return;
        }
        const saved = await TrainingService.create({
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          focus: form.focus.trim(),
          intensity: form.intensity,
          selectedPlayers: '',
          selectedExercises: '',
        }, activeTeam.id, activeSeason.id);
        setSessions(prev => [...prev, saved]);
        toast.success(t('training.sessionCreated'));
      } else {
        if (!form.opponent.trim()) return toast.error(t('calendar.opponentRequired'));
        const saved = await MatchService.create({
          id: '',
          opponent: form.opponent.trim(),
          date: form.date,
          time: form.startTime,
          location: form.location,
          formation: DEFAULT_FORMATION,
        }, activeTeam.id, activeSeason.id);
        setMatches(prev => [...prev, saved]);
        toast.success(t('matches.matchCreated'));
      }
      setShowModal(false);
    } catch { toast.error(t('calendar.saveFailed')); }
  };

  const handleDeleteEvent = () => {
    const target = events.find(e => e.id === editingEventId);
    if (!target) return;
    if (!target.seriesId) return deleteEvent(target, 'this');
    setShowModal(false);
    setShowDeleteScope(true);
  };

  const deleteEvent = async (target: CalendarEvent, scope: SeriesScope) => {
    const before = events;
    const removed = (e: CalendarEvent) =>
      scope === 'this' ? e.id === target.id
        : e.seriesId === target.seriesId && (scope === 'all' || e.date >= target.date);
    setEvents(prev => prev.filter(e => !removed(e)));
    setShowDeleteScope(false);
    setShowModal(false);
    try {
      await EventService.delete(target.id, scope);
      toast.success(scope === 'this' ? t('calendar.eventDeleted') : t(scope === 'all' ? 'recurrence.allDeleted' : 'recurrence.futureDeleted'));
    } catch {
      setEvents(before);
      toast.error(t('calendar.deleteFailed'));
    }
  };

  const legend: { kind: string; label: string; dot: string }[] = [
    settings.showTrainings && { kind: 'training', label: t('calendar.legendTraining'), dot: 'bg-cyan-500' },
    settings.showMatches && { kind: 'match', label: t('calendar.legendMatch'), dot: 'bg-rose-500' },
    settings.showEvents && { kind: 'event', label: t('calendar.legendEvent'), dot: 'bg-violet-500' },
    settings.showBirthdays && { kind: 'birthday', label: t('calendar.legendBirthday'), dot: 'bg-amber-500' },
  ].filter(Boolean) as { kind: string; label: string; dot: string }[];

  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto gap-5 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-1 h-10 rounded-full bg-primary flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('page.calendarTitle')}</h1>
            <p className="text-sm text-muted mt-0.5">{t('page.calendarSubtitle')}</p>
          </div>
        </div>
        <Button onClick={() => openCreate()} icon={<Plus size={18} />} className="shadow-lg shadow-primary/20">
          {t('calendar.newEvent')}
        </Button>
      </div>

      {/* Toolbar: week nav + legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} className="p-2 rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface-hover transition-colors" aria-label={t('calendar.previousWeek')}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={goToday} className="px-3 py-1.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-surface-hover transition-colors">
            {t('calendar.today')}
          </button>
          <button onClick={() => shiftWeek(1)} className="p-2 rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface-hover transition-colors" aria-label={t('calendar.nextWeek')}>
            <ChevronRight size={16} />
          </button>
          <span className="ml-2 text-sm font-bold text-foreground">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-4">
          {legend.map(l => (
            <span key={l.kind} className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`w-2.5 h-2.5 rounded-full ${l.dot}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div ref={calendarWrapRef} className="flex-1 min-h-0">
        <WeekCalendar
          weekStart={weekStart}
          items={items}
          startHour={settings.dayStartHour}
          endHour={settings.dayEndHour}
          onSlotClick={(date, hour) => openCreate(date, hour)}
          onItemClick={handleItemClick}
          onItemMove={handleItemMove}
        />
      </div>

      {/* Create / edit modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingEventId ? t('calendar.editEvent') : t('calendar.newEvent')}
        icon={<CalendarDays size={20} />}
        footer={
          <div className="flex gap-3 w-full">
            {editingEventId && (
              <Button variant="danger" onClick={handleDeleteEvent} icon={<Trash2 size={16} />}>{t('common.delete')}</Button>
            )}
            <Button variant="ghost" onClick={() => setShowModal(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button onClick={handleSave} className="flex-1">{t('common.save')}</Button>
          </div>
        }
      >
        <div className="space-y-5">
          {editingEventId && events.find(e => e.id === editingEventId)?.seriesId && (
            <SeriesScopePicker value={editScope} onChange={setEditScope} />
          )}

          {/* Type selector (only when creating) */}
          {!editingEventId && (
            <div className="flex gap-2 p-1 bg-surface-hover/60 border border-border rounded-xl">
              {([
                { key: 'event', label: t('calendar.typeEvent') },
                { key: 'training', label: t('calendar.typeTraining') },
                { key: 'match', label: t('calendar.typeMatch') },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setForm({ ...form, type: opt.key })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-all ${form.type === opt.key ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-muted hover:text-foreground'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Type-specific primary field */}
          {form.type === 'event' && (
            <Input label={t('calendar.titleLabel')} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={t('calendar.titlePlaceholder')} />
          )}
          {form.type === 'training' && (
            <Input label={t('training.focus')} value={form.focus} onChange={e => setForm({ ...form, focus: e.target.value })} placeholder={t('training.focusPlaceholder')} />
          )}
          {form.type === 'match' && (
            <Input label={t('matches.opponent')} value={form.opponent} onChange={e => setForm({ ...form, opponent: e.target.value })} placeholder={t('matches.opponentPlaceholder')} />
          )}

          {/* Date + times */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DatePicker label={t('training.date')} value={form.date} onChange={date => setForm({ ...form, date })} />
            <TimePicker label={t('training.startTime')} value={form.startTime} onChange={time => setForm(f => {
              // Keep the same duration when the start moves, like Google Calendar.
              const dur = (toMinutes(f.endTime) || 0) - (toMinutes(f.startTime) || 0);
              return { ...f, startTime: time, endTime: addMinutes(time, dur > 0 ? dur : 60) };
            })} />
            <TimePicker label={t('training.endTime')} value={form.endTime} onChange={time => setForm({ ...form, endTime: time })} />
          </div>

          {/* Type-specific extra fields */}
          {form.type === 'training' && (
            <Select
              label={t('training.intensity')}
              value={form.intensity}
              onChange={val => setForm({ ...form, intensity: val as string })}
              options={INTENSITIES.map(v => ({ label: t(intensityMeta(v).labelKey), value: v }))}
            />
          )}
          {(form.type === 'event' || form.type === 'match') && (
            <Input label={t('matches.location')} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder={t('calendar.locationPlaceholder')} />
          )}
          {form.type === 'event' && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted uppercase tracking-widest ml-1">{t('calendar.notes')}</label>
              <textarea
                className="w-full bg-surface-hover border border-border text-foreground rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:text-muted/60 focus:bg-surface focus:border-primary/50 focus:ring-4 focus:ring-primary/10 resize-none h-20 custom-scrollbar"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder={t('calendar.notesPlaceholder')}
              />
            </div>
          )}

          {form.type !== 'match' && !editingEventId && (
            <RecurrenceFields value={recurrence} onChange={setRecurrence} startDate={form.date} />
          )}

          {(form.type === 'training' || form.type === 'match') && !editingEventId && (
            <p className="text-xs text-muted px-1">{t('calendar.refineHint')}</p>
          )}
        </div>
      </Modal>

      <SeriesDeleteDialog
        isOpen={showDeleteScope}
        title={t('recurrence.deleteEventTitle')}
        message={t('recurrence.deleteMessage')}
        onSelect={scope => {
          const target = events.find(e => e.id === editingEventId);
          if (target) deleteEvent(target, scope);
        }}
        onClose={() => setShowDeleteScope(false)}
      />
    </div>
  );
}
