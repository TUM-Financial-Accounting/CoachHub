import { useState, useEffect } from 'react';
import { Calendar, Users, TrendingUp, Plus, Clock, MapPin, Activity, Shield } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

// UI Components
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { CountUp } from "./ui/CountUp";
import { Player, TrainingSession, Match } from "../types/models";
import { Page } from "../types/ui";
import { PlayerService, TrainingService, MatchService } from '../services';
import { useTeam } from '../contexts/TeamContext';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { activeTeam } = useTeam();
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [calculatedAttendance, setCalculatedAttendance] = useState(0);

  // Calculate attendance rate based on training session participation
  const calculateAttendance = (playerList: Player[], sessionList: TrainingSession[]) => {
    if (sessionList.length === 0 || playerList.length === 0) return 0;

    const playerAttendanceCount: { [key: string]: number } = {};
    
    // Count how many sessions each player was selected for
    sessionList.forEach(session => {
      const playerIds = session.selectedPlayers
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
      
      playerIds.forEach(playerId => {
        playerAttendanceCount[playerId] = (playerAttendanceCount[playerId] || 0) + 1;
      });
    });

    // Calculate average attendance percentage
    const totalSelections = Object.values(playerAttendanceCount).reduce((a, b) => a + b, 0);
    const maxPossibleSelections = playerList.length * sessionList.length;
    const attendanceRate = Math.round((totalSelections / maxPossibleSelections) * 100);

    return attendanceRate;
  };

  // Fetch all data on component mount
  useEffect(() => {
    if (!activeTeam) {
      setPlayers([]);
      setSessions([]);
      setMatches([]);
      setAttendanceData([]);
      return;
    }

    const fetchData = async () => {
      try {
        const [playersData, sessionsData, matchesData] = await Promise.all([
          PlayerService.getAll(activeTeam.id),
          TrainingService.getAll(activeTeam.id),
          MatchService.getAll(activeTeam.id)
        ]);

        setPlayers(playersData);
        setSessions(sessionsData);
        setMatches(matchesData);

        // Calculate attendance from training session participation
        if (playersData.length > 0 && sessionsData.length > 0) {
          const attendance = calculateAttendance(playersData, sessionsData);
          setCalculatedAttendance(attendance);
        }

        // Calculate attendance data from training sessions grouped by month
        const calculateMonthlyAttendance = () => {
          const monthMap: { [key: string]: { total: number; count: number } } = {};
          const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

          sessionsData.forEach(session => {
            const date = new Date(session.date);
            const monthName = monthOrder[date.getMonth()];
            
            if (!monthMap[monthName]) {
              monthMap[monthName] = { total: 0, count: 0 };
            }

            // Count selected players for this session
            const playerIds = session.selectedPlayers
              .split(',')
              .map(id => id.trim())
              .filter(id => id.length > 0);
            
            const sessionAttendance = (playerIds.length / playersData.length) * 100;
            monthMap[monthName].total += sessionAttendance;
            monthMap[monthName].count += 1;
          });

          // Convert to chart format, maintaining month order
          const chartData = monthOrder
            .filter(month => monthMap[month])
            .map(month => ({
              month: month.slice(0, 3),
              attendance: Math.round(monthMap[month].total / monthMap[month].count)
            }));

          return chartData;
        };

        setAttendanceData(calculateMonthlyAttendance());
      } catch (error) {
        toast.error('Failed to load dashboard data');
      }
    };

    fetchData();
  }, [activeTeam]);
  
  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  // --- Derived values (computed each render from real data) ---
  const today = new Date().toISOString().split('T')[0];

  const upcomingSessions = sessions
    .filter(s => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextSession = upcomingSessions[0] ?? null;

  const upcomingMatches = matches
    .filter(m => m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextMatch = upcomingMatches[0] ?? null;

  // Month-over-month attendance trend
  const now = new Date();
  const thisMonthIdx = now.getMonth();
  const lastMonthIdx = thisMonthIdx === 0 ? 11 : thisMonthIdx - 1;
  const avgAttendanceForGroup = (group: TrainingSession[]) => {
    if (group.length === 0 || players.length === 0) return 0;
    const total = group.reduce((sum, s) => {
      const count = s.selectedPlayers.split(',').filter(id => id.trim()).length;
      return sum + (count / players.length) * 100;
    }, 0);
    return total / group.length;
  };
  const thisMonthAvg = avgAttendanceForGroup(sessions.filter(s => new Date(s.date).getMonth() === thisMonthIdx));
  const lastMonthAvg = avgAttendanceForGroup(sessions.filter(s => new Date(s.date).getMonth() === lastMonthIdx));
  const attendanceTrend = lastMonthAvg > 0 ? Math.round(thisMonthAvg - lastMonthAvg) : null;

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-10 rounded-full bg-blue-500 flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
            <p className="text-sm text-slate-400 mt-0.5">Welcome back, Coach</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            onClick={() => onNavigate('session-planner')} 
            icon={<Plus size={16} />}
            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
          >
            Session
          </Button>

          <Button 
            variant="secondary" 
            onClick={() => onNavigate('team')} 
            icon={<Plus size={16} />}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
          >
            Player
          </Button>
        </div>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-8"
      >
        {/* Key Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Next Training Session */}
          <Card 
            animate 
            delay={0}
            className="p-6 cursor-pointer hover:border-blue-500/50 transition-colors group"
            onClick={() => onNavigate('session-planner')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-500/10 p-3 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                <Calendar className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-slate-800 text-slate-400 rounded border border-slate-700 uppercase tracking-wider">
                {nextSession ? 'Scheduled' : 'None'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Next Session</h3>
            <p className="text-sm text-slate-400 mb-4 line-clamp-1">
              {nextSession ? nextSession.focus : 'No sessions scheduled'}
            </p>
            <div className="flex flex-col gap-2 text-xs font-medium text-slate-400">
              {nextSession && (
                <>
                  <span className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-500" /> {nextSession.startTime} - {nextSession.endTime}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" /> {formatDate(nextSession.date)}
                  </span>
                </>
              )}
            </div>
          </Card>

          {/* Upcoming Match */}
          <Card 
            animate 
            delay={0.1}
            className="p-6 cursor-pointer hover:border-emerald-500/50 transition-colors group"
            onClick={() => onNavigate('match')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-emerald-500/10 p-3 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                <Users className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold px-2 py-1 bg-slate-800 text-slate-400 rounded border border-slate-700 uppercase tracking-wider">
                {nextMatch ? 'Upcoming' : 'None'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Upcoming Match</h3>
            <p className="text-sm text-slate-400 mb-4">
              {nextMatch ? `vs. ${nextMatch.opponent}` : 'No matches scheduled'}
            </p>
            <div className="flex flex-col gap-2 text-xs font-medium text-slate-400">
              {nextMatch && (
                <>
                  <span className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-500" /> {nextMatch.time} Kickoff
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" /> {nextMatch.location}
                  </span>
                </>
              )}
            </div>
          </Card>

          {/* Team Attendance Rate */}
          <Card 
            animate 
            delay={0.2}
            className="p-6 cursor-pointer hover:border-purple-500/50 transition-colors group"
            onClick={() => onNavigate('team')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-500/10 p-3 rounded-xl group-hover:bg-purple-500/20 transition-colors">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${
                attendanceTrend === null
                  ? 'text-slate-400 bg-slate-800 border-slate-700'
                  : attendanceTrend >= 0
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
              }`}>
                {attendanceTrend === null ? 'No trend data' : `${attendanceTrend >= 0 ? '+' : ''}${attendanceTrend}% vs Last Month`}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Attendance Rate</h3>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-white"><CountUp value={calculatedAttendance} suffix="%" /></p>
              <p className="text-xs text-slate-500">Based on training</p>
            </div>
          </Card>
        </div>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card animate delay={0.3} className="p-6 md:p-8">
            <h3 className="text-lg font-bold text-white mb-6">Attendance Overview</h3>
            {attendanceData.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceData}>
                  <defs>
                    <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255, 0.05)" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }} 
                  />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255, 0.05)'}}
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderColor: 'rgba(255,255,255,0.1)',
                      color: '#f8fafc',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                    }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Bar 
                    dataKey="attendance" 
                    fill="url(#colorAttendance)" 
                    radius={[6, 6, 0, 0]} 
                    barSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-xl">
                <Activity size={32} className="mb-3 opacity-40" />
                <p className="text-sm font-medium">No session data yet</p>
                <p className="text-xs text-slate-700 mt-1">Create training sessions to see attendance trends</p>
              </div>
            )}
          </Card>

          <Card animate delay={0.4} className="p-6 md:p-8">
            <h3 className="text-lg font-bold text-white mb-6">Team Statistics</h3>
            <div className="space-y-8">
              {/* Stat 1 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-400">Training Sessions</span>
                  <span className="text-sm font-bold text-white">{sessions.length} total</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((sessions.length / Math.max(sessions.length, 1)) * 100, 100)}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                  />
                </div>
              </div>
              
              {/* Stat 2 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-400">Upcoming Matches</span>
                  <span className="text-sm font-bold text-white">{upcomingMatches.length} scheduled</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${Math.min((upcomingMatches.length / Math.max(upcomingMatches.length, 1)) * 100, 100)}%` }}
                     transition={{ duration: 1, delay: 0.7 }}
                     className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                  />
                </div>
              </div>
              
              {/* Stat 3 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-400">Squad Availability</span>
                  <span className="text-sm font-bold text-white">{players.filter(p => p.status === 'Active').length} / {players.length}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${players.length > 0 ? (players.filter(p => p.status === 'Active').length / players.length) * 100 : 0}%` }}
                     transition={{ duration: 1, delay: 0.9 }}
                     className="bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-full shadow-[0_0_10px_rgba(147,51,234,0.5)]" 
                  />
                </div>
              </div>

              <div className="pt-6 mt-2 border-t border-white/5">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5 hover:bg-slate-800 transition-colors">
                    <p className="text-2xl font-bold text-emerald-500"><CountUp value={players.filter(p => p.status === 'Active').length} /></p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5 hover:bg-slate-800 transition-colors">
                    <p className="text-2xl font-bold text-slate-300"><CountUp value={players.filter(p => p.status === 'Injured').length} /></p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Injured</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5 hover:bg-slate-800 transition-colors">
                    <p className="text-2xl font-bold text-white"><CountUp value={players.length} /></p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Upcoming Schedule */}
        {upcomingSessions.length > 0 && (
          <Card animate delay={0.5} className="p-6 md:p-8">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Upcoming Schedule</h3>
              <button onClick={() => onNavigate('session-planner')} className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-semibold">
                View All →
              </button>
            </div>
            <div className="space-y-2">
              {upcomingSessions.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-900/50 border border-white/5 hover:border-white/10 transition-colors group">
                  <div className="w-11 h-11 rounded-lg bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-blue-400 uppercase leading-none">
                      {new Date(s.date + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short' })}
                    </span>
                    <span className="text-base font-bold text-white leading-tight">{s.date.slice(8, 10)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">{s.focus}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <Clock size={11} /> {s.startTime} – {s.endTime}
                      <span className="text-slate-700">·</span>
                      <Shield size={11} /> {s.selectedPlayers.split(',').filter(id => id.trim()).length} players
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider shrink-0 ${
                    s.intensity === 'High'   ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                    s.intensity === 'Low'    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                              'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>{s.intensity}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

      </motion.div>
    </div>
  );
}