import { useState, useEffect, useMemo } from 'react';
import { Users, History } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line,
} from 'recharts';
import { Card } from './ui/Card';
import { useTeam } from '../contexts/TeamContext';
import { useSeason } from '../contexts/SeasonContext';
import { MatchService } from '../services';
import { MatchDetails } from '../types/models';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';

interface TopPerformer {
  player_id: string;
  first_name: string;
  last_name: string;
  image_url: string;
  goals: number;
  assists: number;
}

export default function StatisticsView() {
  const { activeTeam } = useTeam();
  const { activeSeason } = useSeason();
  const [matches, setMatches] = useState<MatchDetails[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeTeam) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [activeTeam, activeSeason]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [matchesData, performersData] = await Promise.all([
        MatchService.getAll(activeTeam?.id, activeSeason?.id),
        MatchService.getTopPerformers(activeTeam!.id, activeSeason?.id)
      ]);
      const today = new Date().toLocaleDateString('en-CA');
      const finishedMatches = matchesData
        .filter(m => m.date <= today && (m.goalsFor !== undefined || m.goalsAgainst !== undefined))
        .sort((a, b) => a.date.localeCompare(b.date));
      setMatches(finishedMatches);
      setTopPerformers(performersData);
    } catch (error) {
      toast.error('Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => {
    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;

    matches.forEach(m => {
      const gf = m.goalsFor ?? 0;
      const ga = m.goalsAgainst ?? 0;
      goalsFor += gf;
      goalsAgainst += ga;
      if (gf > ga) wins++;
      else if (gf < ga) losses++;
      else draws++;
    });

    const total = matches.length;
    const points = wins * 3 + draws;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const cleanSheets = matches.filter(m => (m.goalsAgainst ?? 0) === 0).length;
    const goalDiff = goalsFor - goalsAgainst;
    const ptsPerGame = total > 0 ? (points / total).toFixed(1) : '0.0';
    const avgScored = total > 0 ? (goalsFor / total).toFixed(1) : '0.0';
    const avgConceded = total > 0 ? (goalsAgainst / total).toFixed(1) : '0.0';

    let unbeatenStreak = 0;
    for (let i = matches.length - 1; i >= 0; i--) {
      const gf = matches[i].goalsFor ?? 0;
      const ga = matches[i].goalsAgainst ?? 0;
      if (gf >= ga) unbeatenStreak++;
      else break;
    }

    return {
      wins, draws, losses, goalsFor, goalsAgainst, total,
      points, winRate, cleanSheets, goalDiff, ptsPerGame,
      avgScored, avgConceded, unbeatenStreak,
    };
  }, [matches]);

  const recentForm = useMemo(() => {
    return matches.slice(-5).map(m => {
      const gf = m.goalsFor ?? 0;
      const ga = m.goalsAgainst ?? 0;
      if (gf > ga) return { type: 'W', color: 'bg-emerald-500', label: 'Win' };
      if (gf < ga) return { type: 'L', color: 'bg-rose-500', label: 'Loss' };
      return { type: 'D', color: 'bg-amber-500', label: 'Draw' };
    });
  }, [matches]);

  const shortDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  const monthOf = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' });

  const pointsData = matches.map((m, i, arr) => {
    const gf = m.goalsFor ?? 0;
    const ga = m.goalsAgainst ?? 0;
    const pts = gf > ga ? 3 : gf === ga ? 1 : 0;
    const month = monthOf(m.date);
    const prevMonth = i > 0 ? monthOf(arr[i - 1].date) : null;
    return {
      date: m.date,
      monthLabel: month !== prevMonth ? month : '',
      fullDate: shortDate(m.date),
      points: pts,
      score: `${gf}–${ga}`,
      opponent: m.opponent,
    };
  });

  const chartData = matches.map((m, i, arr) => {
    const month = monthOf(m.date);
    const prevMonth = i > 0 ? monthOf(arr[i - 1].date) : null;
    return {
      date: m.date,
      monthLabel: month !== prevMonth ? month : '',
      fullDate: shortDate(m.date),
      scored: m.goalsFor ?? 0,
      conceded: m.goalsAgainst ?? 0,
      opponent: m.opponent,
    };
  });

  const pointsMonthTicks = pointsData.filter(d => d.monthLabel).map(d => d.date);
  const chartMonthTicks  = chartData .filter(d => d.monthLabel).map(d => d.date);
  const pointsMonthMap = new Map(pointsData.map(d => [d.date, d.monthLabel]));
  const chartMonthMap  = new Map(chartData .map(d => [d.date, d.monthLabel]));

  const pieData = [
    { name: 'Wins', value: stats.wins, color: '#10b981' },
    { name: 'Draws', value: stats.draws, color: '#f59e0b' },
    { name: 'Losses', value: stats.losses, color: '#ef4444' },
  ].filter(d => d.value > 0);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-primary/10 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto overflow-y-auto custom-scrollbar gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-10 rounded-full bg-primary flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Statistics</h1>
            <p className="text-sm text-muted mt-0.5">
              {activeTeam?.name}{activeSeason?.name ? ` · ${activeSeason.name}` : ''}
            </p>
          </div>
        </div>
        {recentForm.length > 0 && (
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <span className="text-xs text-muted">Last {recentForm.length} results</span>
            <div className="flex gap-1">
              {recentForm.map((f, i) => (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-md ${f.color} flex items-center justify-center text-white text-xs font-bold`}
                  title={f.label}
                >
                  {f.type}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {matches.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <History size={36} className="text-muted/30 mb-4" />
          <h3 className="text-base font-semibold text-foreground">No match results yet</h3>
          <p className="text-sm text-muted mt-1">Record your first match result to see statistics here.</p>
        </Card>
      ) : (
        <div className="space-y-6 pb-8">
          {/* Hero stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <p className="text-xs text-muted font-medium mb-4">Season Record</p>
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-3xl font-black text-emerald-500">{stats.wins}</p>
                  <p className="text-[11px] text-muted font-medium mt-1">Wins</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-amber-500">{stats.draws}</p>
                  <p className="text-[11px] text-muted font-medium mt-1">Draws</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-rose-500">{stats.losses}</p>
                  <p className="text-[11px] text-muted font-medium mt-1">Losses</p>
                </div>
              </div>
              <p className="text-xs text-muted mt-4 pt-4 border-t border-border/40">{stats.total} matches played</p>
            </Card>

            <Card className="p-5">
              <p className="text-xs text-muted font-medium mb-4">Points</p>
              <p className="text-4xl font-black text-foreground">{stats.points}</p>
              <p className="text-xs text-muted mt-4 pt-4 border-t border-border/40">
                {stats.ptsPerGame} per game · {stats.winRate}% win rate
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-xs text-muted font-medium mb-4">Goals</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-foreground">{stats.goalsFor}</p>
                <span className="text-sm text-muted">scored</span>
              </div>
              <p className="text-xs text-muted mt-4 pt-4 border-t border-border/40">
                {stats.goalsAgainst} conceded · {stats.goalDiff > 0 ? '+' : ''}{stats.goalDiff} goal diff
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-xs text-muted font-medium mb-4">Clean Sheets</p>
              <p className="text-4xl font-black text-foreground">{stats.cleanSheets}</p>
              <p className="text-xs text-muted mt-4 pt-4 border-t border-border/40">
                {stats.total > 0 ? Math.round((stats.cleanSheets / stats.total) * 100) : 0}% of matches
              </p>
            </Card>
          </div>

          {/* Secondary stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { value: stats.avgScored, label: 'Goals scored / game' },
              { value: stats.avgConceded, label: 'Goals conceded / game' },
              { value: stats.unbeatenStreak, label: 'Unbeaten streak' },
              { value: stats.ptsPerGame, label: 'Points per game' },
            ].map(({ value, label }) => (
              <Card key={label} className="p-4 text-center">
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted mt-1">{label}</p>
              </Card>
            ))}
          </div>

          {/* Points timeline */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Points per Match</h3>
                <p className="text-xs text-muted mt-0.5">Full season timeline</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-muted">Win (3 pts)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs text-muted">Draw (1 pt)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-xs text-muted">Loss (0 pts)</span>
                </div>
              </div>
            </div>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pointsData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/30" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    dy={8}
                    ticks={pointsMonthTicks}
                    tickFormatter={(value) => pointsMonthMap.get(value) ?? ''}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} ticks={[0, 1, 3]} domain={[0, 3]} width={20} />
                  <Tooltip content={<PointsTooltip />} />
                  <Line
                    type="linear"
                    dataKey="points"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={<PointsDot />}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <Card className="xl:col-span-8 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Goals per Match</h3>
                  <p className="text-xs text-muted mt-0.5">Full season — {matches.length} matches</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-muted">Scored</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-xs text-muted">Conceded</span>
                  </div>
                </div>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/30" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11 }}
                      dy={8}
                      ticks={chartMonthTicks}
                      tickFormatter={(value) => chartMonthMap.get(value) ?? ''}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} allowDecimals={false} width={20} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: '10px',
                        fontSize: '12px',
                      }}
                      formatter={(value, name) => [value, name === 'scored' ? 'Scored' : 'Conceded']}
                      labelFormatter={(label, payload: any[]) => {
                        const p = payload?.[0]?.payload;
                        return p ? `${p.opponent} · ${p.fullDate}` : label;
                      }}
                    />
                    <Line type="linear" dataKey="scored" name="scored" stroke="#10b981" strokeWidth={1.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                    <Line type="linear" dataKey="conceded" name="conceded" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="xl:col-span-4 p-6 flex flex-col">
              <h3 className="text-sm font-semibold text-foreground">Results Breakdown</h3>
              <p className="text-xs text-muted mt-0.5 mb-4">Season totals</p>
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="h-[200px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} innerRadius={62} outerRadius={82} paddingAngle={6} dataKey="value" stroke="none">
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-foreground">{stats.total}</span>
                    <span className="text-xs text-muted">played</span>
                  </div>
                </div>
                <div className="w-full space-y-2 mt-4">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/40">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-xs text-foreground">{d.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        {d.value}
                        <span className="text-muted font-normal ml-1">({Math.round((d.value / stats.total) * 100)}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Leaderboards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LeaderboardCard
              title="Top Scorers"
              items={topPerformers.filter(p => p.goals > 0).slice(0, 5)}
              statKey="goals"
              statLabel="Goals"
            />
            <LeaderboardCard
              title="Top Assisters"
              items={topPerformers.filter(p => p.assists > 0).sort((a, b) => b.assists - a.assists).slice(0, 5)}
              statKey="assists"
              statLabel="Assists"
            />
          </div>

          {/* Match history */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-foreground">Match History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-muted border-b border-border/50">
                    <th className="px-5 py-3 font-medium">Result</th>
                    <th className="px-5 py-3 font-medium">Opponent</th>
                    <th className="px-5 py-3 font-medium text-center">Score</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Venue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {matches.slice().reverse().map(m => {
                    const isWin = (m.goalsFor ?? 0) > (m.goalsAgainst ?? 0);
                    const isLoss = (m.goalsFor ?? 0) < (m.goalsAgainst ?? 0);
                    return (
                      <tr key={m.id} className="hover:bg-surface-raised/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${isWin ? 'bg-emerald-500/10 text-emerald-600' : isLoss ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            {isWin ? 'W' : isLoss ? 'L' : 'D'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-medium text-foreground">vs {m.opponent}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="text-sm font-bold text-foreground tabular-nums">
                            {m.goalsFor} – {m.goalsAgainst}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-muted">{formatDate(m.date)}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-muted">{m.location}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function LeaderboardCard({ title, items, statKey, statLabel }: {
  title: string;
  items: any[];
  statKey: string;
  statLabel: string;
}) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted text-center py-10">No data recorded yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item.player_id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-raised/40 transition-colors">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${index === 0 ? 'bg-amber-500 text-white' : index === 1 ? 'bg-slate-400 text-white' : index === 2 ? 'bg-amber-700 text-white' : 'border border-border text-muted'}`}>
                {index + 1}
              </span>
              <div className="w-9 h-9 rounded-lg bg-surface border border-border/50 overflow-hidden flex-shrink-0">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted">
                    <Users size={15} />
                  </div>
                )}
              </div>
              <p className="text-sm font-medium text-foreground flex-1 truncate">
                {item.first_name} {item.last_name}
              </p>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-bold text-foreground">{item[statKey]}</p>
                <p className="text-[10px] text-muted">{statLabel}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PointsDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const color = payload.points === 3 ? '#10b981' : payload.points === 1 ? '#f59e0b' : '#ef4444';
  return <circle cx={cx} cy={cy} r={6} fill={color} stroke="white" strokeWidth={2} />;
}

function PointsTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    const pts = d.points;
    const color = pts === 3 ? 'text-emerald-600' : pts === 1 ? 'text-amber-600' : 'text-rose-600';
    return (
      <div className="px-3 py-2 rounded-lg bg-surface border border-border shadow-lg text-xs space-y-0.5">
        <p className="font-semibold text-foreground">{d.opponent}</p>
        <p className="text-muted">{d.fullDate} · {d.score}</p>
        <p className={`font-bold ${color}`}>{pts} {pts === 1 ? 'point' : 'points'}</p>
      </div>
    );
  }
  return null;
}

function CustomPieTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="px-3 py-2 rounded-lg bg-surface border border-border shadow-lg text-xs">
        <p className="font-semibold text-foreground">{data.name}: {data.value}</p>
      </div>
    );
  }
  return null;
}
