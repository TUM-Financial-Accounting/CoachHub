import { useTranslation } from 'react-i18next';
import { SeriesScope } from '../lib/recurrence';

interface SeriesScopePickerProps {
  value: SeriesScope;
  onChange: (scope: SeriesScope) => void;
}

const SCOPES = [
  { scope: 'this', key: 'recurrence.editThis' },
  { scope: 'future', key: 'recurrence.editFuture' },
  { scope: 'all', key: 'recurrence.editAll' },
] as const;

export default function SeriesScopePicker({ value, onChange }: SeriesScopePickerProps) {
  const { t } = useTranslation();
  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-3">
      <div className="text-xs font-bold text-blue-300 uppercase tracking-wider">{t('recurrence.editScopeTitle')}</div>
      <div className="flex flex-wrap gap-2">
        {SCOPES.map(s => (
          <button
            key={s.scope}
            type="button"
            onClick={() => onChange(s.scope)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${value === s.scope ? 'bg-blue-600 border-blue-600 text-white' : 'bg-surface-raised border-border text-muted hover:text-foreground'}`}
          >
            {t(s.key)}
          </button>
        ))}
      </div>
      {value !== 'this' && <p className="text-[11px] text-muted">{t('recurrence.editDateWarning')}</p>}
    </div>
  );
}
