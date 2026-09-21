import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  CalendarDays, Layout, Link2, Monitor, Moon, Palette, RotateCcw, Sun,
} from 'lucide-react';

import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { useSettings } from '../contexts/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import { START_PAGES, StartPage, WeekStart } from '../lib/settings';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200 outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
        checked ? 'bg-primary' : 'bg-surface-raised border border-border'
      }`}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  );
}

function Row({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// Card's backdrop-blur creates a stacking context, so earlier sections need a higher z to keep open dropdowns on top.
function Section({ icon, title, z, children }: { icon: React.ReactNode; title: string; z: number; children: React.ReactNode }) {
  return (
    <Card className="p-6 overflow-visible" style={{ zIndex: z }}>
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-primary">{icon}</span>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </Card>
  );
}

function Segmented<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-surface-hover/60 border border-border rounded-xl">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            value === opt.value
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${String(h).padStart(2, '0')}:00`,
}));

export default function SettingsView() {
  const { t, i18n } = useTranslation();
  const { settings, updateSettings, resetSettings } = useSettings();
  const { theme, setTheme } = useTheme();

  const startPageLabels: Record<StartPage, string> = {
    dashboard: t('nav.dashboard'),
    calendar: t('nav.calendar'),
    team: t('nav.squadRoster'),
    'session-planner': t('nav.training'),
    statistics: t('nav.statistics'),
  };

  const startHourOptions = HOUR_OPTIONS.filter(o => Number(o.value) < settings.dayEndHour);
  const endHourOptions = HOUR_OPTIONS
    .filter(o => Number(o.value) > settings.dayStartHour)
    .concat({ value: '24', label: '24:00' });

  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto overflow-y-auto custom-scrollbar gap-6">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-1 h-10 rounded-full bg-primary flex-shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('page.settingsTitle')}</h1>
          <p className="text-sm text-muted mt-0.5">{t('page.settingsSubtitle')}</p>
        </div>
      </div>

      <Section icon={<Palette size={18} />} title={t('settings.appearance')} z={4}>
        <Row title={t('settings.theme')} description={t('settings.themeDesc')}>
          <Segmented
            value={theme}
            onChange={v => setTheme(v)}
            options={[
              { value: 'light' as const, label: t('theme.light'), icon: <Sun size={13} /> },
              { value: 'dark' as const, label: t('theme.dark'), icon: <Moon size={13} /> },
              { value: 'system' as const, label: t('theme.system'), icon: <Monitor size={13} /> },
            ]}
          />
        </Row>
        <Row title={t('settings.language')} description={t('settings.languageDesc')}>
          <Segmented
            value={i18n.language.startsWith('de') ? 'de' : 'en'}
            onChange={v => i18n.changeLanguage(v)}
            options={[
              { value: 'en' as const, label: 'English' },
              { value: 'de' as const, label: 'Deutsch' },
            ]}
          />
        </Row>
      </Section>

      <Section icon={<CalendarDays size={18} />} title={t('settings.calendar')} z={3}>
        <Row title={t('settings.showBirthdays')} description={t('settings.showBirthdaysDesc')}>
          <Toggle
            checked={settings.showBirthdays}
            onChange={v => updateSettings({ showBirthdays: v })}
            label={t('settings.showBirthdays')}
          />
        </Row>
        <Row title={t('settings.showTrainings')} description={t('settings.showTrainingsDesc')}>
          <Toggle
            checked={settings.showTrainings}
            onChange={v => updateSettings({ showTrainings: v })}
            label={t('settings.showTrainings')}
          />
        </Row>
        <Row title={t('settings.showMatches')} description={t('settings.showMatchesDesc')}>
          <Toggle
            checked={settings.showMatches}
            onChange={v => updateSettings({ showMatches: v })}
            label={t('settings.showMatches')}
          />
        </Row>
        <Row title={t('settings.showEvents')} description={t('settings.showEventsDesc')}>
          <Toggle
            checked={settings.showEvents}
            onChange={v => updateSettings({ showEvents: v })}
            label={t('settings.showEvents')}
          />
        </Row>
        <Row title={t('settings.weekStartsOn')} description={t('settings.weekStartsOnDesc')}>
          <Segmented
            value={settings.weekStartsOn}
            onChange={(v: WeekStart) => updateSettings({ weekStartsOn: v })}
            options={[
              { value: 'monday' as const, label: t('settings.monday') },
              { value: 'sunday' as const, label: t('settings.sunday') },
            ]}
          />
        </Row>
        <Row title={t('settings.dayWindow')} description={t('settings.dayWindowDesc')}>
          <div className="flex items-center gap-2">
            <div className="w-28">
              <Select
                options={startHourOptions}
                value={String(settings.dayStartHour)}
                onChange={v => updateSettings({ dayStartHour: Number(v) })}
              />
            </div>
            <span className="text-muted text-sm">–</span>
            <div className="w-28">
              <Select
                options={endHourOptions}
                value={String(settings.dayEndHour)}
                onChange={v => updateSettings({ dayEndHour: Number(v) })}
              />
            </div>
          </div>
        </Row>
      </Section>

      <Section icon={<Layout size={18} />} title={t('settings.general')} z={2}>
        <Row title={t('settings.startPage')} description={t('settings.startPageDesc')}>
          <div className="w-48">
            <Select
              options={START_PAGES.map(p => ({ value: p, label: startPageLabels[p] }))}
              value={settings.startPage}
              onChange={v => updateSettings({ startPage: v as StartPage })}
            />
          </div>
        </Row>
      </Section>

      <Section icon={<Link2 size={18} />} title={t('settings.integrations')} z={1}>
        <Row title={t('settings.googleCalendar')} description={t('settings.googleCalendarDesc')}>
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 rounded-md bg-surface-raised border border-border text-[10px] font-bold uppercase tracking-wider text-muted">
              {t('settings.comingSoon')}
            </span>
            <Button variant="secondary" disabled icon={<Link2 size={14} />}>
              {t('settings.connect')}
            </Button>
          </div>
        </Row>
      </Section>

      <div className="flex justify-end pb-2 flex-shrink-0">
        <Button
          variant="ghost"
          icon={<RotateCcw size={14} />}
          onClick={() => {
            resetSettings();
            toast.success(t('settings.resetDone'));
          }}
        >
          {t('settings.reset')}
        </Button>
      </div>
    </div>
  );
}
