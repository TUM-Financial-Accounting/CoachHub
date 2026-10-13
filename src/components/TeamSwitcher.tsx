import { useTeam } from '../contexts/TeamContext';
import { Users } from 'lucide-react';
import { Select } from './ui/Select';
import { useTranslation } from 'react-i18next';
import { emitAppEvent } from '../lib/appEvents';

export default function TeamSwitcher({ collapsed }: { collapsed: boolean }) {
  const { teams, activeTeam, setActiveTeamId, loading } = useTeam();
  const { t } = useTranslation();

  if (loading) return <div className="h-10 animate-pulse bg-surface-hover rounded-xl mx-2 my-2"></div>;

  if (collapsed) {
     return (
        <div className="mx-auto my-2 w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
           <Users size={18} />
        </div>
     );
  }

  const options = teams.map(t => ({ label: t.name, value: t.id }));
  // Add a special "Create New Team" option
  options.push({ label: `+ ${t('modals.createTeamBtn')}`, value: 'CREATE_NEW' });

  return (
     <div className="px-3 py-2 border-b border-border">
        <div className="mb-1">
           <span className="text-[10px] font-bold text-muted uppercase tracking-widest leading-none">
              {t('nav.teamSwitcherLabel')}
           </span>
        </div>
        <Select 
           placeholder={teams.length === 0 ? t('nav.noTeamsYet') : t('nav.selectTeam')}
           value={activeTeam?.id || ''}
           options={options}
           onChange={(val) => {
              if (String(val) === 'CREATE_NEW') {
                 // Trigger team creation modal
                 emitAppEvent('open-create-team');
              } else {
                 setActiveTeamId(String(val));
              }
           }}
        />
     </div>
  );
}
