import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, X, Calendar, MapPin, Users, Plus, Trophy, Edit2, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';
import { toast } from 'sonner';
import { formatDate } from '../lib/dates';

// UI Components
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { MatchStatsModal } from './MatchStatsModal';
import { hasResult } from '../lib/matchResult';
import { DatePicker } from "./ui/DatePicker";
import { TimePicker } from "./ui/TimePicker";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { useTeam } from '../contexts/TeamContext';
import { useSeason } from '../contexts/SeasonContext';
import { Player, MatchDetails, MatchRating, PositionSlot, LineupPlayer, FormationSource } from "../types/models";
import { PlayerService, MatchService, FormationService } from "../services";
import CustomFormationModal from './CustomFormationModal';
import MatchSubstitutions from './MatchSubstitutions';
import { DEFAULT_MATCH_MINUTES } from '../lib/minutes';
import { DEFAULT_FORMATION, FORMATIONS, FORMATION_GROUPS } from '../lib/formations';
import { PLAYER_STATUS } from '../lib/domain';
import { isPast, parseLocalDate, todayISO } from '../lib/dates';

// --- Sub-Components ---

function DraggablePlayer({ player, onClick, isSubstitute = false }: { player: Player; onClick?: () => void; isSubstitute?: boolean }) {
  const { t } = useTranslation();
  const [{ isDragging }, drag] = useDrag(() => ({ 
      type: 'player', 
      item: { ...player, fromBench: isSubstitute }, 
      collect: (monitor) => ({ isDragging: !!monitor.isDragging() }) 
  }));
  
  return (
    <div ref={drag} onClick={onClick} className={`bg-surface border border-border rounded-xl p-3 cursor-pointer hover:border-blue-500/50 hover:bg-surface-hover transition-all flex items-center gap-3 ${isDragging ? 'opacity-50' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ${isSubstitute ? 'bg-slate-600' : 'bg-blue-600'}`}>{player.jerseyNumber}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{player.firstName} {player.lastName}</p>
          <p className="text-[10px] text-muted uppercase tracking-wide">{t(`positions.${player.position}`, player.position)}</p>
        </div>
    </div>
  );
}

function PositionSlotComponent({ slot, player, onDrop, onRemove, onClick, isMatchPast }: { slot: PositionSlot; player: LineupPlayer | null; onDrop: (p: any, s: string) => void; onRemove: (s: string) => void; onClick: () => void; isMatchPast: boolean; }) {
  const [{ isOver }, drop] = useDrop(() => ({ 
      accept: 'player', 
      drop: (item: any) => onDrop(item, slot.id), 
      collect: (monitor) => ({ isOver: !!monitor.isOver() }) 
  }), [onDrop, slot.id]);

  return (
    <div ref={drop} style={{ left: `${slot.x}%`, top: `${slot.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110">
      {player ? (
        <div onClick={onClick} className="relative group cursor-pointer">
          <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] border-2 border-primary/40"><span className="text-lg font-bold">{player.jerseyNumber}</span></div>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-center whitespace-nowrap"><p className="text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{player.firstName}</p></div>
          {!isMatchPast && <button onClick={(e) => { e.stopPropagation(); onRemove(slot.id); }} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><X className="w-3 h-3" /></button>}
        </div>
      ) : (
        <div className={`w-14 h-14 border-2 border-dashed rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isOver ? 'border-blue-400 bg-blue-500/20 text-white' : 'border-white/20 bg-white/5 text-slate-400'}`}>{slot.position}</div>
      )}
    </div>
  );
}

// --- Main Component ---

export default function MatchLineup() {
  const { t } = useTranslation();
  const { activeTeam } = useTeam();
  const { activeSeason } = useSeason();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [lineup, setLineup] = useState<Map<string, LineupPlayer>>(new Map());
  const [substitutes, setSubstitutes] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<LineupPlayer | null>(null);
  
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showCreateMatchModal, setShowCreateMatchModal] = useState(false);

  const [matches, setMatches] = useState<MatchDetails[]>([]); 
  const [matchDetails, setMatchDetails] = useState<MatchDetails | null>(null); 
  const [selectedPlayerPerformance, setSelectedPlayerPerformance] = useState(0);
  const [ratings, setRatings] = useState<MatchRating[]>([]);
  
  const [isEditingMatch, setIsEditingMatch] = useState(false);
  const [matchForm, setMatchForm] = useState({ opponent: '', date: '', time: '', location: '', duration: String(DEFAULT_MATCH_MINUTES) });
  const [confirmDeleteMatch, setConfirmDeleteMatch] = useState<MatchDetails | null>(null);
  const [showPastMatches, setShowPastMatches] = useState(false);
  const [showCustomFormationModal, setShowCustomFormationModal] = useState(false);
  const [customFormations, setCustomFormations] = useState<any[]>([]);

  const [currentFormation, setCurrentFormation] = useState<string>(DEFAULT_FORMATION);
  const [formationSource, setFormationSource] = useState<FormationSource>({ kind: 'default' });
  const [showFormationPicker, setShowFormationPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const formationBtnRef = useRef<HTMLButtonElement>(null);
  const formationPickerRef = useRef<HTMLDivElement>(null);

  const handleToggleFormationPicker = () => {
    if (!showFormationPicker && formationBtnRef.current) {
      const rect = formationBtnRef.current.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setShowFormationPicker(p => !p);
  };

  // Close formation picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        formationPickerRef.current && !formationPickerRef.current.contains(e.target as Node) &&
        formationBtnRef.current && !formationBtnRef.current.contains(e.target as Node)
      ) {
        setShowFormationPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // AI Recommendation Storage
  const [aiSuggestedFormation, setAiSuggestedFormation] = useState<string>(DEFAULT_FORMATION);
  const [aiSource, setAiSource] = useState<FormationSource>({ kind: 'default' });

  // --- 1. Load Data ---
  useEffect(() => {
    if (!activeTeam || !activeSeason) {
        setAllPlayers([]);
        setMatches([]);
        setMatchDetails(null);
        setRatings([]);
        return;
    }

    // Fetch primary data in parallel to reduce re-renders
    Promise.all([
      PlayerService.getAll(activeTeam.id, activeSeason.id),
      MatchService.getAll(activeTeam.id, activeSeason.id),
      MatchService.getSuggestedFormation(activeTeam.id),
      FormationService.getAll(),
      MatchService.getSeasonRatings(activeTeam.id, activeSeason.id).catch(() => [] as MatchRating[]),
    ]).then(([mappedPlayers, mappedMatches, suggestedData, formations, seasonRatings]) => {
      setAllPlayers(mappedPlayers);
      setMatches(mappedMatches);
      setCustomFormations(formations);
      setRatings(seasonRatings);
      
      if (mappedMatches.length > 0) {
        // Default to the next upcoming match. The API returns matches sorted
        // by date descending, so [0] would otherwise be the furthest-future
        // fixture; fall back to the most recent past match if nothing is
        // scheduled.
        const todayStr = todayISO();
        const nextUpcoming = mappedMatches
          .filter(m => m.date >= todayStr)
          .sort((a, b) => a.date.localeCompare(b.date))[0];
        setMatchDetails(nextUpcoming ?? mappedMatches[0]);
      } else {
        setMatchDetails(null);
      }

      if (suggestedData.formation) {
        setAiSuggestedFormation(suggestedData.formation);
        setAiSource(suggestedData.source);
      }
    }).catch(err => {
      console.error("Failed to load match data", err);
      toast.error(t('matches.loadFailed'));
    });
  }, [activeTeam, activeSeason]);

  // Remove the separate useEffect for custom formations as it's now in the main one

  // --- 2. Switch Match Logic (Reactive to AI Data) ---
useEffect(() => {
      if (!matchDetails) return;

      // Helper to check if lineup has real data
      const hasSavedLineup = matchDetails.lineup && matchDetails.lineup !== "[]";

      if (hasSavedLineup) {
          // A. Saved Match (Real data exists) -> Always load saved strategy
          setCurrentFormation(matchDetails.formation || DEFAULT_FORMATION);
          setFormationSource({ kind: 'saved' });
          
          try {
              const parsedArray = JSON.parse(matchDetails.lineup!);
              const newLineup = new Map<string, LineupPlayer>();
              parsedArray.forEach((item: any) => {
                  newLineup.set(item.slotId, item.player);
              });
              setLineup(newLineup);
          } catch (e) {
              console.error("Error parsing lineup", e);
              setLineup(new Map());
          }
      } else {
          // B. Fresh or Empty Match
          
          // 1. Calculate Date Difference
          const matchDate = parseLocalDate(matchDetails.date);
          const today = new Date();
          // Reset hours to compare dates only
          today.setHours(0, 0, 0, 0);
          matchDate.setHours(0, 0, 0, 0);
          
          const diffTime = matchDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // 2. Apply Logic: Only suggest if match is within next 7 days (and not in the past)
          const isUpcomingSoon = diffDays >= 0 && diffDays <= 7;

          if (isUpcomingSoon && aiSuggestedFormation && FORMATIONS[aiSuggestedFormation]) {
              setCurrentFormation(aiSuggestedFormation);
              setFormationSource(aiSource);
          } else if (matchDetails.formation && matchDetails.formation !== DEFAULT_FORMATION) {
              // Respect the formation stored on the match (e.g. corrected
              // retroactively on a past game) instead of forcing the default.
              setCurrentFormation(matchDetails.formation);
              setFormationSource({ kind: 'saved' });
          } else {
              setCurrentFormation(DEFAULT_FORMATION);
              setFormationSource({ kind: 'default' }); // Far future match
          }
          
          setLineup(new Map()); 
      }
      
      setSubstitutes((matchDetails.bench ?? [])
          .map(id => allPlayers.find(p => p.id === id))
          .filter((p): p is Player => !!p));

  }, [matchDetails, aiSuggestedFormation, aiSource, allPlayers]);
  // --- Handlers ---
  const handleOpenCreate = () => { setMatchForm({ opponent: '', date: '', time: '', location: '', duration: String(DEFAULT_MATCH_MINUTES) }); setIsEditingMatch(false); setShowCreateMatchModal(true); };
  
  const handleOpenEdit = () => { 
      if (!matchDetails) return; 
      setMatchForm({ opponent: matchDetails.opponent, date: matchDetails.date, time: matchDetails.time, location: matchDetails.location, duration: String(matchDetails.duration ?? DEFAULT_MATCH_MINUTES) });  
      setIsEditingMatch(true); 
      setShowCreateMatchModal(true); 
  };

  const handleCustomFormationCreated = (newFormation: any) => {
    setCustomFormations(prev => [...prev, newFormation]);
    setCurrentFormation(newFormation.name);
    setFormationSource({ kind: 'custom' });
  };

  const handleChangeFormation = (formation: string) => {
    if (formation === currentFormation) return;
    if (lineup.size > 0) {
      if (!window.confirm(t('matches.switchFormationConfirm', { formation }))) return;
    }
    setCurrentFormation(formation);
    setFormationSource({ kind: 'manual' });
    setLineup(new Map());

    // Past matches have no "save lineup" step, so a retroactive formation
    // correction is persisted immediately. Any stored lineup is cleared —
    // its slots belong to the old formation (the confirm above covers this).
    if (isMatchPast && matchDetails) {
      MatchService.update(matchDetails.id, { ...matchDetails, formation, lineup: undefined })
        .then(saved => {
          setMatches(prev => prev.map(m => m.id === saved.id ? saved : m));
          setMatchDetails(saved);
          toast.success(t('matches.formationSaved', { formation }));
        })
        .catch(() => toast.error(t('matches.matchSaveFailed')));
    }
  };

  const handleSaveMatch = async () => {
    if (!matchForm.opponent || !matchForm.date) return toast.error(t('matches.opponentDateRequired'));
    try {
        const fields = { ...matchForm, duration: Number(matchForm.duration) || DEFAULT_MATCH_MINUTES };
        const matchToSave: MatchDetails = isEditingMatch && matchDetails
            ? { ...matchDetails, ...fields }
            : { id: '', ...fields, formation: currentFormation };

        const savedMatch = isEditingMatch && matchDetails
            ? await MatchService.update(matchDetails.id, matchToSave)
            : await MatchService.create(matchToSave, activeTeam?.id, activeSeason?.id);

        if (isEditingMatch) { 
            setMatches(prev => prev.map(m => m.id === savedMatch.id ? savedMatch : m)); 
        } else { 
            setMatches(prev => [...prev, savedMatch].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())); 
        }
        setMatchDetails(savedMatch);
        setShowCreateMatchModal(false);
        toast.success(isEditingMatch ? t('matches.matchUpdated') : t('matches.matchCreated'));
    } catch (e) { toast.error(t('matches.matchSaveFailed')); }
  };

  // Optimistic match delete with rollback. If the deleted match was the one
  // being viewed, fall back to the nearest match in the visible tab.
  const handleDeleteMatch = async (target: MatchDetails) => {
    const matchesBefore = matches;
    const detailsBefore = matchDetails;
    const next = matches.filter(m => m.id !== target.id);
    setMatches(next);
    if (matchDetails?.id === target.id) {
      const todayStr = todayISO();
      const upcomingNext = next.filter(m => m.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date));
      const pastNext = next.filter(m => m.date < todayStr).sort((a, b) => b.date.localeCompare(a.date));
      setMatchDetails(showPastMatches ? (pastNext[0] ?? upcomingNext[0] ?? null) : (upcomingNext[0] ?? pastNext[0] ?? null));
    }
    toast.success(t('matches.matchDeleted'));
    try {
      await MatchService.delete(target.id);
    } catch {
      setMatches(matchesBefore);
      setMatchDetails(detailsBefore);
      toast.error(t('matches.matchDeleteFailed'));
    }
  };

  const availablePlayers = allPlayers.filter(player =>
      player.status === PLAYER_STATUS.Active &&
      !Array.from(lineup.values()).some(lp => lp?.id === player.id) &&
      !substitutes.some(sp => sp.id === player.id)
  );
  
  // Separate past and upcoming matches
  const upcomingMatches = matches.filter(m => !isPast(m.date)).sort((a, b) => a.date.localeCompare(b.date));
  const pastMatches = matches.filter(m => isPast(m.date)).sort((a, b) => b.date.localeCompare(a.date));

  // Check if currently viewing a past match
  const isMatchPast = useMemo(() => !!matchDetails && isPast(matchDetails.date), [matchDetails]);

  const activeSlots = useMemo(() => {
    if (FORMATIONS[currentFormation]) return FORMATIONS[currentFormation];
    const custom = customFormations.find(cf => cf.name === currentFormation);
    if (custom) {
        try {
            return JSON.parse(custom.positions);
        } catch (e) {
            console.error("Failed to parse custom formation", e);
        }
    }
    return FORMATIONS[DEFAULT_FORMATION];
  }, [currentFormation, customFormations]);

  const formationSourceLabel = (s: FormationSource): string => {
    switch (s.kind) {
      case 'saved': return t('matches.savedStrategy');
      case 'manual': return t('matches.manualSelection');
      case 'custom': return t('matches.customFormation');
      case 'training': return t('matches.sourceTraining', { date: s.sessionDate ? formatDate(s.sessionDate) : '', exercise: s.exerciseName });
      default: return t('matches.defaultStrategy');
    }
  };

  const getMatchRating = (matchId: string, playerId: string): number =>
    ratings.find(r => r.matchId === matchId && r.playerId === playerId)?.rating ?? 0;

  // Average of the player's per-match ratings this season
  const getPlayerAveragePerformance = (playerId: string): number | null => {
    const values = ratings.filter(r => r.playerId === playerId).map(r => r.rating);
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(avg * 10) / 10; // Round to 1 decimal
  };

  // 0 on the slider means "unrated", which is stored as no row
  const handleSaveRating = async (matchId: string, playerId: string, rating: number) => {
    const others = ratings.filter(r => !(r.matchId === matchId && r.playerId === playerId));
    try {
      if (rating > 0) {
        const saved = await MatchService.setRating(matchId, playerId, rating);
        setRatings([...others, saved]);
      } else if (getMatchRating(matchId, playerId) > 0) {
        await MatchService.clearRating(matchId, playerId);
        setRatings(others);
      }
      toast.success(t('matches.performanceSaved'));
    } catch (e) {
      toast.error(t('matches.performanceSaveFailed'));
    }
  };

  const handleDropToField = (item: any, slotId: string) => {
    if (isMatchPast) {
      toast.error(t('matches.cannotEditPast'));
      return;
    }
    const player = item as Player;
    const fromBench = item.fromBench;

    if (fromBench) {
        setSubstitutes(prev => prev.filter(p => p.id !== player.id));
    }

    setLineup(prevLineup => {
        const newLineup = new Map(prevLineup);
        for (const [key, val] of newLineup.entries()) {
            if (val.id === player.id) {
                newLineup.delete(key);
                break;
            }
        }
        newLineup.set(slotId, { ...player, positionSlot: slotId, isStarter: true });
        return newLineup;
    });
    
    toast.success(t('matches.playerSet', { name: player.firstName }));
  };

  const handleRemoveFromField = (slotId: string) => {
    setLineup(prev => {
        const newMap = new Map(prev);
        newMap.delete(slotId);
        return newMap;
    });
  };

  const handleAddSubstitute = (player: Player) => {
      setSubstitutes(prev => [...prev, player]);
  };

  const handleSaveLineup = async () => {
    // Required size follows the active formation, so 7v7 / 9v9 youth
    // formats and smaller custom formations are saveable too.
    if (lineup.size < activeSlots.length) return toast.error(t('matches.lineupIncomplete', { count: activeSlots.length }));
    if (!matchDetails) return;

    try {
        const lineupArray = Array.from(lineup.entries()).map(([slotId, player]) => ({
            slotId,
            player
        }));

        const matchToUpdate: MatchDetails = {
            ...matchDetails,
            formation: currentFormation,
            lineup: JSON.stringify(lineupArray),
            bench: substitutes.map(p => p.id),
        };

        const updatedMatch = await MatchService.update(matchDetails.id, matchToUpdate);

        setMatches(prev => prev.map(m => m.id === updatedMatch.id ? updatedMatch : m));
        setMatchDetails(updatedMatch);
        setFormationSource({ kind: 'saved' });
        toast.success(t('matches.lineupSaved', { opponent: updatedMatch.opponent }));
        setShowSaveModal(false);
    } catch (e) {
        toast.error(t('matches.lineupSaveFailed'));
    }
  };

  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 overflow-y-auto custom-scrollbar relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
            <div className="w-1 h-10 rounded-full bg-rose-500 flex-shrink-0" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('page.matchesTitle')}</h1>
              <p className="text-sm text-muted mt-0.5">{t('page.matchesSubtitle')}</p>
            </div>
        </div>
        <div className="flex gap-3">
            <Button onClick={handleOpenCreate} variant="secondary" icon={<Plus size={18} />}>{t('matches.createMatch')}</Button>
            {isMatchPast ? (
              <Button onClick={() => setShowStatsModal(true)} variant="secondary" icon={<Trophy size={18} />}>{t('matches.recordStats')}</Button>
            ) : (
              <Button onClick={() => setShowSaveModal(true)} disabled={lineup.size < activeSlots.length} icon={<Save size={18} />}>{t('matches.saveLineup')}</Button>
            )}
        </div>
      </div>

      <Card className="p-6 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            {matchDetails ? (
                <>
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold text-foreground flex items-center gap-3"><span className="text-muted text-lg">VS</span> {matchDetails.opponent}</h3>
                        {isMatchPast ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 uppercase tracking-widest">{t('matches.pastMatchBadge')}</span>
                            {hasResult(matchDetails) ? (
                              <span className="text-sm font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg border border-emerald-500/20">
                                {matchDetails.goalsFor} - {matchDetails.goalsAgainst}
                              </span>
                            ) : (
                              <span title={t('statistics.unrecorded')} className="text-sm font-bold bg-slate-500/10 text-slate-500 px-3 py-1 rounded-lg border border-slate-500/20">U</span>
                            )}
                          </div>
                        ) : (
                            <button onClick={handleOpenEdit} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"><Edit2 size={16} /></button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-6 text-sm text-muted font-medium">
                        <span className="flex items-center gap-2"><Calendar size={14} className="text-blue-500" /> {formatDate(matchDetails.date)}</span>
                        <span className="flex items-center gap-2"><Users size={14} className="text-blue-500" /> {matchDetails.time || t('matches.timeTbd')}</span>
                        <span className="flex items-center gap-2"><MapPin size={14} className="text-blue-500" /> {matchDetails.location || t('matches.locationHome')}</span>
                    </div>
                </>
            ) : (
                <div className="text-muted flex items-center gap-3">
                    <Trophy size={24} className="opacity-50"/>
                    <div><h3 className="text-lg font-bold text-muted">{t('matches.noUpcomingMatch')}</h3><p className="text-sm">{t('matches.noUpcomingMatchSub')}</p></div>
                </div>
            )}
          </div>
          <div className="border-l border-border pl-6">
            <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">{t('libraries.formationLabel')}</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-emerald-400 font-mono tracking-tight">{currentFormation}</span>
              {/* Also shown for past matches so the played formation can be
                  recorded retroactively. */}
              <button
                ref={formationBtnRef}
                onClick={handleToggleFormationPicker}
                className={`p-1.5 rounded-lg border transition-colors ${
                  showFormationPicker
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                    : 'border-border text-muted hover:text-foreground hover:border-border'
                }`}
              >
                <ChevronDown size={14} className={`transition-transform duration-200 ${showFormationPicker ? 'rotate-180' : ''}`} />
              </button>
              </div>
              <p className="text-[10px] text-muted mt-0.5">{formationSourceLabel(formationSource)}</p>
            </div>
          </div>
        </Card>
  
        <div className="grid grid-cols-12 gap-6 flex-shrink-0">
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <Card className="p-4 flex flex-col h-[250px]">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { setShowPastMatches(false); if (upcomingMatches.length > 0) setMatchDetails(upcomingMatches[0]); }}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                    !showPastMatches
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50'
                      : 'bg-surface text-muted border border-border'
                  }`}
                >
                  {t('matches.upcomingMatches')} ({upcomingMatches.length})
                </button>
                <button
                  onClick={() => { setShowPastMatches(true); if (pastMatches.length > 0) setMatchDetails(pastMatches[0]); }}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                    showPastMatches
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50'
                      : 'bg-surface text-muted border border-border'
                  }`}
                >
                  {t('matches.pastMatches')} ({pastMatches.length})
                </button>
              </div>
              <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">
                  {(!showPastMatches ? upcomingMatches : pastMatches).length > 0 ? (
                    (!showPastMatches ? upcomingMatches : pastMatches).map(match => (
                      <div key={match.id} onClick={() => setMatchDetails(match)} className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${matchDetails?.id === match.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-surface border-border hover:border-border'}`}>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-bold ${matchDetails?.id === match.id ? 'text-blue-400' : 'text-foreground'}`}>vs {match.opponent}</p>
                              {showPastMatches && (hasResult(match)
                                ? <span className="text-[10px] font-bold text-emerald-500">{match.goalsFor} - {match.goalsAgainst}</span>
                                : <span title={t('statistics.unrecorded')} className="text-[10px] font-bold text-slate-500">U</span>)}
                            </div>
                            <p className="text-[10px] text-muted">{formatDate(match.date)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={e => { e.stopPropagation(); setConfirmDeleteMatch(match); }}
                              className="p-1.5 rounded-lg text-muted/50 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                              title={t('common.delete')}
                            >
                              <Trash2 size={13} />
                            </button>
                            {matchDetails?.id === match.id && <ChevronRight size={14} className="text-blue-400" />}
                          </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted italic text-center mt-10">
                      {showPastMatches ? t('matches.noPastMatches') : t('matches.noUpcomingMatches')}
                    </p>
                  )}
              </div>
            </Card>

          <Card className="p-4 h-[350px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-muted uppercase tracking-widest">{t('matches.availablePlayers')}</h3>
              {isMatchPast && <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">{t('matches.viewOnly')}</span>}
            </div>
            <div className={`space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2 ${isMatchPast ? 'opacity-60 pointer-events-none' : ''}`}>
              {availablePlayers.length > 0 ? availablePlayers.map(player => 
                <DraggablePlayer key={player.id} player={player} onClick={() => !isMatchPast && handleAddSubstitute(player)} />
              ) : <p className="text-xs text-muted italic text-center mt-10">{t('matches.noActivePlayers')}</p>}
            </div>
          </Card>

          <Card className="p-4 h-[200px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-muted uppercase tracking-widest">{t('matches.bench')}</h3>
              {isMatchPast && <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">{t('matches.viewOnly')}</span>}
            </div>
            <div className={`space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2 ${isMatchPast ? 'opacity-60' : ''}`}>
              {substitutes.map(player => (
                <DraggablePlayer key={player.id} player={player} isSubstitute={true}
                  onClick={() => !isMatchPast && setSubstitutes(prev => prev.filter(p => p.id !== player.id))} />
              ))}
            </div>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-9">
          <div className="p-8 bg-gradient-to-br from-emerald-900 to-emerald-950 border border-emerald-900/50 rounded-xl shadow-2xl relative overflow-y-auto lg:overflow-hidden" style={{ minHeight: 'min(848px, calc(100vh - 200px))' }}>
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 49px, #fff 50px)' }}></div>
            <div className="absolute inset-8 border-2 border-emerald-400/20 rounded-lg pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 border-2 border-emerald-400/20 border-t-0 rounded-b-lg"></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-24 border-2 border-emerald-400/20 border-b-0 rounded-t-lg"></div>
              <div className="absolute top-1/2 left-0 right-0 h-0 border-t-2 border-emerald-400/20"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-emerald-400/20 rounded-full"></div>
            </div>
            <div className="absolute inset-8">
              {activeSlots.map((slot: PositionSlot) => <PositionSlotComponent key={slot.id} slot={slot} player={lineup.get(slot.id) || null} onDrop={handleDropToField} onRemove={handleRemoveFromField} onClick={() => { const p = lineup.get(slot.id); if (p && matchDetails) { setSelectedPlayer(p); setSelectedPlayerPerformance(getMatchRating(matchDetails.id, p.id)); } }} isMatchPast={isMatchPast} />)}
            </div>
            <div className="absolute top-6 right-6 bg-black/40 backdrop-blur-md rounded-lg px-4 py-2 border border-white/10">
              <p className="text-[10px] text-white/50 uppercase tracking-widest">{t('matches.starters')}</p>
              <p className="text-xl font-bold text-white">{t('matches.startersCount', { count: lineup.size, total: activeSlots.length })}</p>
            </div>
          </div>
          {isMatchPast && matchDetails && (
            <div className="mt-6">
              <MatchSubstitutions
                match={matchDetails}
                starterIds={Array.from(lineup.values()).map(p => p.id)}
                players={allPlayers}
                onRatePlayer={p => { setSelectedPlayer({ ...p, positionSlot: '', isStarter: false }); setSelectedPlayerPerformance(getMatchRating(matchDetails.id, p.id)); }}
              />
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={!!selectedPlayer} onClose={() => setSelectedPlayer(null)} title={t('team.profileLabel')} icon={<Users size={20}/>} maxWidth="max-w-md">
        {selectedPlayer && (
            <div className="text-center space-y-6">
                <div>
                  <div className="w-24 h-24 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-primary/30 border-4 border-surface-raised">{selectedPlayer.jerseyNumber}</div>
                  <h3 className="text-2xl font-bold text-foreground mb-1">{selectedPlayer.firstName} {selectedPlayer.lastName}</h3>
                  <p className="text-primary font-medium">{t(`positions.${selectedPlayer.position}`, selectedPlayer.position)}</p>
                </div>
                
                <div className="w-full space-y-4">
                    {isMatchPast ? (
                      <div className="bg-surface-raised/50 p-6 rounded-xl border border-border">
                        <p className="text-xs text-muted uppercase tracking-widest font-bold mb-4">{t('matches.matchPerformance')}</p>
                        <div className="space-y-3">
                          <input
                            type="range"
                            min="0"
                            max="10"
                            value={selectedPlayerPerformance}
                            onChange={(e) => setSelectedPlayerPerformance(Number(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-colors"
                          />
                          <div className="flex items-center justify-between">
                            <div className="flex gap-1">
                              {[...Array(10)].map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-2 h-6 rounded-sm transition-all ${
                                    i < selectedPlayerPerformance
                                      ? 'bg-blue-500 shadow-lg shadow-blue-500/50'
                                      : 'bg-slate-700'
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="text-right">
                              <p className="text-3xl font-bold text-blue-400">{selectedPlayerPerformance}</p>
                              <p className="text-xs text-slate-500">/10</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/5">
                          <p className="text-xs text-slate-500">
                            {selectedPlayerPerformance === 0 && t('matches.notRated')}
                            {selectedPlayerPerformance > 0 && selectedPlayerPerformance <= 3 && '🔴 ' + t('statistics.belowAverage')}
                            {selectedPlayerPerformance > 3 && selectedPlayerPerformance <= 5 && '🟡 ' + t('statistics.average')}
                            {selectedPlayerPerformance > 5 && selectedPlayerPerformance <= 7 && '🟢 ' + t('statistics.good')}
                            {selectedPlayerPerformance > 7 && selectedPlayerPerformance <= 9 && '⭐ ' + t('statistics.excellent')}
                            {selectedPlayerPerformance === 10 && '👑 ' + t('statistics.outstanding')}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-white/5">
                        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-4">{t('matches.averagePerformance')}</p>
                        {getPlayerAveragePerformance(selectedPlayer.id) !== null ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex gap-1">
                                {[...Array(10)].map((_, i) => {
                                  const avg = getPlayerAveragePerformance(selectedPlayer.id) || 0;
                                  return (
                                    <div
                                      key={i}
                                      className={`w-2 h-6 rounded-sm transition-all ${
                                        i < Math.round(avg)
                                          ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50'
                                          : 'bg-slate-700'
                                      }`}
                                    />
                                  );
                                })}
                              </div>
                              <div className="text-right">
                                <p className="text-3xl font-bold text-emerald-400">{getPlayerAveragePerformance(selectedPlayer.id)}</p>
                                <p className="text-xs text-slate-500">/10</p>
                              </div>
                            </div>
                            <p className="text-xs text-slate-500">
                              {(() => {
                                const avg = getPlayerAveragePerformance(selectedPlayer.id) || 0;
                                if (avg <= 3) return '🔴 ' + t('statistics.belowAverage');
                                if (avg <= 5) return '🟡 ' + t('statistics.average');
                                if (avg <= 7) return '🟢 ' + t('statistics.good');
                                if (avg <= 9) return '⭐ ' + t('statistics.excellent');
                                return '👑 ' + t('statistics.outstanding');
                              })()}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">{t('matches.noPastPerformance')}</p>
                        )}
                      </div>
                    )}
                    
                    <div className="bg-surface-raised/50 p-6 rounded-xl border border-border">
                      <p className="text-xs text-muted uppercase tracking-widest font-bold mb-2">{t('common.status')}</p>
                      <p className={`text-lg font-bold mt-2 ${
                        selectedPlayer.status === PLAYER_STATUS.Active 
                          ? 'text-emerald-400' 
                          : selectedPlayer.status === PLAYER_STATUS.Injured
                          ? 'text-red-400'
                          : 'text-muted'
                      }`}>
                        {t(`status.${selectedPlayer.status}`, selectedPlayer.status)}
                      </p>
                    </div>
                </div>
                
                <Button 
                  onClick={async () => {
                    if (isMatchPast && matchDetails) {
                      await handleSaveRating(matchDetails.id, selectedPlayer.id, selectedPlayerPerformance);
                    }
                    setSelectedPlayer(null);
                  }}
                  disabled={!isMatchPast}
                  className="w-full"
                >
                  {isMatchPast ? t('matches.savePerformance') : t('matches.upcomingMatchViewOnly')}
                </Button>
            </div>
        )}
      </Modal>

      <Modal isOpen={showCreateMatchModal} onClose={() => setShowCreateMatchModal(false)} title={isEditingMatch ? t('matches.editMatch') : t('matches.newMatch')} maxWidth="max-w-md"
        footer={<div className="flex gap-3"><Button variant="ghost" onClick={() => setShowCreateMatchModal(false)} className="flex-1">{t('common.cancel')}</Button><Button onClick={handleSaveMatch} className="flex-1">{isEditingMatch ? t('common.save') : t('matches.createMatch')}</Button></div>}>
        <div className="space-y-4">
            <Input label={t('matches.opponent')} value={matchForm.opponent} onChange={e => setMatchForm({...matchForm, opponent: e.target.value})} placeholder={t('matches.opponentPlaceholder')} />
            <DatePicker label={t('matches.matchDate')} value={matchForm.date} onChange={date => setMatchForm({...matchForm, date})} />
            <div className="grid grid-cols-2 gap-4">
                <TimePicker label={t('matches.kickoffTime')} value={matchForm.time} onChange={time => setMatchForm({...matchForm, time})} />
                <Input label={t('matches.location')} value={matchForm.location} onChange={e => setMatchForm({...matchForm, location: e.target.value})} placeholder={t('matches.locationPlaceholder')} />
            </div>
            <Input label={t('matches.durationLabel')} type="number" min={1} max={150} value={matchForm.duration} onChange={e => setMatchForm({...matchForm, duration: e.target.value})} />
        </div>
      </Modal>

      <Modal isOpen={showSaveModal} onClose={() => setShowSaveModal(false)} title={t('matches.confirmLineupTitle')} maxWidth="max-w-sm" 
        footer={<div className="flex gap-3"><Button variant="ghost" onClick={() => setShowSaveModal(false)} className="flex-1">{t('common.cancel')}</Button><Button onClick={handleSaveLineup} className="flex-1">{t('matches.confirmBtn')}</Button></div>}>
        <div className="space-y-4">
            <div className="bg-surface-raised/50 p-4 rounded-xl border border-border space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted">{t('nav.matches')}</span><span className="text-foreground font-bold">{matchDetails?.opponent || t('matches.upcomingMatchViewOnly')}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted">{t('libraries.formationLabel')}</span><span className="text-emerald-400 font-bold font-mono">{currentFormation}</span></div>
            </div>
            <p className="text-sm text-slate-400 text-center">
              {t('matches.saveLineupPrompt', 'Save this lineup for {{opponent}}?', { opponent: matchDetails ? matchDetails.opponent : t('matches.upcomingMatchViewOnly') })}
            </p>
        </div>
      </Modal>

      {/* Formation Picker — fixed to viewport, escapes all stacking contexts */}
      {showFormationPicker && (
        <div
          ref={formationPickerRef}
          style={{ position: 'fixed', top: pickerPos.top, right: pickerPos.right, zIndex: 9999 }}
          className="w-64 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/60 p-3 space-y-3"
        >
          {FORMATION_GROUPS.map(group => {
            return (
              <div key={group.labelKey}>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-1 mb-1.5">{t(group.labelKey)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.formations.map(f => (
                    <button
                      key={f}
                      onClick={() => { handleChangeFormation(f); setShowFormationPicker(false); }}
                      className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition-all border ${
                        currentFormation === f
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400'
                          : 'border-border text-muted bg-surface-raised hover:border-emerald-500/40 hover:text-emerald-300'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {customFormations.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-1 mb-1.5">{t('libraries.customFormationsLabel')}</p>
              <div className="flex flex-wrap gap-1.5">
                {customFormations.map(f => (
                  <button
                    key={f.id}
                    onClick={() => { handleChangeFormation(f.name); setShowFormationPicker(false); }}
                    className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition-all border ${
                      currentFormation === f.name
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400'
                        : 'border-border text-muted bg-surface-raised hover:border-emerald-500/40 hover:text-emerald-300'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <button
              onClick={() => { setShowCustomFormationModal(true); setShowFormationPicker(false); }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-bold transition-all border border-blue-500/30"
            >
              <Plus size={14} />
              {t('libraries.customFormation')}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDeleteMatch !== null}
        title={t('matches.deleteMatchTitle')}
        message={t('matches.deleteMatchMsg', { opponent: confirmDeleteMatch?.opponent ?? '' })}
        confirmLabel={t('common.delete')}
        onConfirm={() => { if (confirmDeleteMatch) handleDeleteMatch(confirmDeleteMatch); setConfirmDeleteMatch(null); }}
        onCancel={() => setConfirmDeleteMatch(null)}
      />

      <CustomFormationModal
        isOpen={showCustomFormationModal}
        onClose={() => setShowCustomFormationModal(false)}
        onSuccess={handleCustomFormationCreated}
      />

      {matchDetails && (
        <MatchStatsModal 
          isOpen={showStatsModal}
          onClose={() => setShowStatsModal(false)}
          match={matchDetails}
          players={allPlayers}
          onSuccess={async () => {
            const data = await MatchService.getAll(activeTeam?.id, activeSeason?.id);
            setMatches(data);
            const updated = data.find(m => m.id === matchDetails.id);
            if (updated) setMatchDetails(updated);
          }}
        />
      )}
    </div>
  );
}