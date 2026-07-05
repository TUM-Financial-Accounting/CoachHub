import { useSeason } from '../contexts/SeasonContext';
import { Calendar } from 'lucide-react';
import { Select } from './ui/Select';
import { useTranslation } from 'react-i18next';

export default function SeasonSwitcher({ collapsed }: { collapsed: boolean }) {
  const { seasons, activeSeason, setActiveSeasonId, loading } = useSeason();
  const { t } = useTranslation();

  if (loading) return <div className="h-10 animate-pulse bg-surface-hover rounded-xl mx-2 my-2"></div>;

  if (collapsed) {
     return (
        <div className="mx-auto my-2 w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
           <Calendar size={18} />
        </div>
     );
  }

  const options = seasons.map(s => ({ label: s.name, value: s.id }));
  options.push({ label: `+ ${t('modals.createSeasonBtn')}`, value: 'CREATE_NEW' });

  return (
     <div className="px-3 py-2 border-b border-border">
        <div className="mb-1">
           <span className="text-[10px] font-bold text-muted uppercase tracking-widest leading-none">
              {t('nav.seasonSwitcherLabel')}
           </span>
        </div>
        <Select 
           placeholder={seasons.length === 0 ? t('nav.noSeasonsYet') : t('nav.selectSeason')}
           value={activeSeason?.id || ''}
           options={options}
           onChange={(val) => {
              if (String(val) === 'CREATE_NEW') {
                 window.dispatchEvent(new CustomEvent('open-create-season'));
              } else {
                 setActiveSeasonId(String(val));
              }
           }}
        />
     </div>
  );
}
