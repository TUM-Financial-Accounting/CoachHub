
import { useTeam } from '../contexts/TeamContext';
import { Users } from 'lucide-react';
import { Select } from './ui/Select';

export default function TeamSwitcher({ collapsed }: { collapsed: boolean }) {
  const { teams, activeTeam, setActiveTeamId, loading } = useTeam();

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
  options.push({ label: '+ Create Team', value: 'CREATE_NEW' });

  return (
     <div className="px-3 py-2 border-b border-border">
        <Select 
           placeholder={teams.length === 0 ? "No teams yet" : "Select Team"}
           value={activeTeam?.id || ''}
           options={options}
           onChange={(val) => {
              if (String(val) === 'CREATE_NEW') {
                 // Trigger team creation modal
                 window.dispatchEvent(new CustomEvent('open-create-team'));
              } else {
                 setActiveTeamId(String(val));
              }
           }}
        />
     </div>
  );
}
