import { useState, useEffect } from 'react';
import { Save, Trophy, Users, Plus, Trash2, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { toast } from 'sonner';
import { MatchDetails, MatchEvent, Player } from '../types/models';
import { MatchService } from '../services/match-service';

interface MatchStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: MatchDetails;
  players: Player[]; // All available players to select from for goals/assists
  onSuccess: () => void;
}

export function MatchStatsModal({ isOpen, onClose, match, players, onSuccess }: MatchStatsModalProps) {
  const { t } = useTranslation();
  const [goalsFor, setGoalsFor] = useState(match.goalsFor || 0);
  const [goalsAgainst, setGoalsAgainst] = useState(match.goalsAgainst || 0);
  const [notes, setNotes] = useState(match.notes || '');
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Event form state
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [eventType, setEventType] = useState<'Goal' | 'Assist'>('Goal');
  const [minute, setMinute] = useState('');

  useEffect(() => {
    if (isOpen && match.id) {
      fetchEvents();
      setGoalsFor(match.goalsFor || 0);
      setGoalsAgainst(match.goalsAgainst || 0);
      setNotes(match.notes || '');
    }
  }, [isOpen, match]);

  const fetchEvents = async () => {
    try {
      const data = await MatchService.getEvents(match.id);
      setEvents(data);
    } catch (error) {
      console.error('Failed to fetch events', error);
    }
  };

  const handleSaveStats = async () => {
    setIsSaving(true);
    try {
      await MatchService.updateStats(match.id, goalsFor, goalsAgainst, notes);
      toast.success(t('matchStats.statsUpdated'));
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(t('matchStats.statsUpdateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEvent = async () => {
    if (!selectedPlayerId) {
      toast.error(t('matchStats.selectPlayerFirst'));
      return;
    }

    try {
      const newEvent = await MatchService.addEvent(match.id, {
        playerId: selectedPlayerId,
        eventType,
        minute: minute ? parseInt(minute) : undefined
      });
      setEvents([...events, newEvent]);
      setSelectedPlayerId('');
      setMinute('');
      toast.success(t('matchStats.eventAdded'));
    } catch (error) {
      toast.error(t('matchStats.eventAddFailed'));
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await MatchService.deleteEvent(id);
      setEvents(events.filter(e => e.id !== id));
      toast.success(t('matchStats.eventRemoved'));
    } catch (error) {
      toast.error(t('matchStats.eventRemoveFailed'));
    }
  };

  const getPlayerName = (id: string) => {
    const player = players.find(p => p.id === id);
    return player ? `${player.firstName} ${player.lastName}` : t('matchStats.unknownPlayer');
  };

  const eventTypeLabel = (type: string) => type === 'Goal' ? t('matchStats.goal') : t('matchStats.assist');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('matchStats.title', { opponent: match.opponent })} maxWidth="max-w-2xl">
      <div className="space-y-8 p-1">
        {/* Score Section */}
        <div className="bg-surface-raised p-6 rounded-2xl border border-border">
          <div className="flex items-center gap-2 mb-4 text-primary">
            <Trophy size={20} />
            <h3 className="text-sm font-bold uppercase tracking-widest">{t('matchStats.finalScore')}</h3>
          </div>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-[10px] text-muted uppercase font-bold mb-2">{t('matchStats.ourTeam')}</p>
              <input
                type="number"
                value={goalsFor}
                onChange={(e) => setGoalsFor(parseInt(e.target.value) || 0)}
                className="w-20 h-20 text-4xl font-bold text-center bg-surface border-2 border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
            <div className="text-2xl font-bold text-muted mt-6">:</div>
            <div className="text-center">
              <p className="text-[10px] text-muted uppercase font-bold mb-2">{t('matchStats.opponent')}</p>
              <input
                type="number"
                value={goalsAgainst}
                onChange={(e) => setGoalsAgainst(parseInt(e.target.value) || 0)}
                className="w-20 h-20 text-4xl font-bold text-center bg-surface border-2 border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Events Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Users size={20} />
            <h3 className="text-sm font-bold uppercase tracking-widest">{t('matchStats.goalsAssists')}</h3>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">{t('matchStats.selectPlayer')}</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as any)}
                  className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="Goal">{t('matchStats.goal')}</option>
                  <option value="Assist">{t('matchStats.assist')}</option>
                </select>
              </div>
              <Button onClick={handleAddEvent} className="w-full" variant="secondary" icon={<Plus size={16} />}>
                {t('common.add')}
              </Button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {events.length === 0 ? (
                <p className="text-xs text-muted text-center py-4 italic">{t('matchStats.noEvents')}</p>
              ) : (
                events.map(event => (
                  <div key={event.id} className="flex items-center justify-between bg-surface-raised p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-full ${event.eventType === 'Goal' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {event.eventType === 'Goal' ? <Trophy size={14} /> : <Users size={14} />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{getPlayerName(event.playerId)}</p>
                        <p className="text-[10px] text-muted">{eventTypeLabel(event.eventType)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="p-1.5 text-muted hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <MessageSquare size={20} />
            <h3 className="text-sm font-bold uppercase tracking-widest">{t('matchStats.matchNotes')}</h3>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('matchStats.notesPlaceholder')}
            className="w-full h-32 bg-surface-raised border border-border rounded-xl p-4 text-sm text-foreground placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 pt-4">
          <Button onClick={handleSaveStats} isLoading={isSaving} className="flex-1" icon={<Save size={18} />}>
            {t('matchStats.saveBtn')}
          </Button>
          <Button onClick={onClose} variant="ghost" className="flex-1">
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
