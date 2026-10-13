import { useTranslation } from 'react-i18next';
import { Select } from './ui/Select';
import { DatePicker } from './ui/DatePicker';
import { Input } from './ui/Input';
import { MAX_OCCURRENCES, REPEAT_FREQUENCIES, Recurrence, RepeatFrequency, WEEKDAYS, weekOfMonth, weekdayOf } from '../lib/recurrence';

interface RecurrenceFieldsProps {
  value: Recurrence;
  onChange: (value: Recurrence) => void;
  startDate: string;
}

// 2024-01-01 was a Monday, so index i maps onto WEEKDAYS[i].
const weekdayLabel = (day: number, lang: string) =>
  new Date(2024, 0, 1 + day).toLocaleDateString(lang, { weekday: 'short' });

export default function RecurrenceFields({ value, onChange, startDate }: RecurrenceFieldsProps) {
  const { t, i18n } = useTranslation();
  const startDay = weekdayOf(startDate);
  const repeating = value.frequency !== 'none';
  const nth = weekOfMonth(startDate);

  const toggle = (day: number) => {
    const has = value.extraWeekdays.includes(day);
    onChange({ ...value, extraWeekdays: has ? value.extraWeekdays.filter(d => d !== day) : [...value.extraWeekdays, day] });
  };

  return (
    <div className="bg-surface-hover/40 border border-border rounded-xl p-4 space-y-4">
      <Select
        label={t('recurrence.repeat')}
        value={value.frequency}
        onChange={val => onChange({ ...value, frequency: val as RepeatFrequency })}
        options={REPEAT_FREQUENCIES.map(f => ({ label: t(`recurrence.${f}`), value: f }))}
      />

      {repeating && (
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-muted uppercase tracking-widest ml-1">{t('recurrence.ends')}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="flex gap-2 p-1 bg-surface-hover/60 border border-border rounded-xl">
              {(['date', 'count'] as const).map(end => (
                <button
                  key={end}
                  type="button"
                  onClick={() => onChange({ ...value, endType: end })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-all ${value.endType === end ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-muted hover:text-foreground'}`}
                >
                  {t(end === 'date' ? 'recurrence.endOnDate' : 'recurrence.endAfterCount')}
                </button>
              ))}
            </div>
            {value.endType === 'date' ? (
              <DatePicker value={value.until} onChange={until => onChange({ ...value, until })} />
            ) : (
              <Input
                type="number"
                min={1}
                max={MAX_OCCURRENCES}
                value={Number.isNaN(value.count) ? '' : value.count}
                onChange={e => onChange({ ...value, count: e.target.valueAsNumber })}
                rightElement={t('recurrence.times')}
              />
            )}
          </div>
        </div>
      )}

      {repeating && (
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-muted uppercase tracking-widest ml-1">{t('recurrence.repeatOn')}</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map(day => {
              const locked = day === startDay;
              const active = locked || value.extraWeekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={locked}
                  onClick={() => toggle(day)}
                  title={locked ? t('recurrence.startDayLocked') : undefined}
                  className={`w-12 py-2 rounded-lg text-xs font-bold border transition-all ${active ? 'bg-primary border-primary text-white shadow-md shadow-primary/20' : 'bg-surface-raised border-border text-muted hover:text-foreground'} ${locked ? 'cursor-default' : ''}`}
                >
                  {weekdayLabel(day, i18n.language)}
                </button>
              );
            })}
          </div>
          {value.frequency === 'monthly' && (
            <p className="text-xs text-muted px-1">
              {t('recurrence.monthlyHint', { n: nth })}{nth === 5 ? ` ${t('recurrence.monthlyFifth')}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
