import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, History, FileDown } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line,
} from 'recharts';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useTeam } from '../contexts/TeamContext';
import { useSeason } from '../contexts/SeasonContext';
import { MatchService } from '../services';
import { MatchDetails, TopPerformer } from '../types/models';
import { toast } from 'sonner';
import { formatDate, parseLocalDate, todayISO } from '../lib/dates';
import { hasResult, isUnrecorded, matchOutcome } from '../lib/matchResult';
import { loadSeasonReport } from '../lib/seasonReport/load';
import { renderSeasonReport, reportFileName } from '../lib/seasonReport/render';

export default function StatisticsView() {
  const { t, i18n } = useTranslation();
  const { activeTeam } = useTeam();
  const { activeSeason } = useSeason();
  const [matches, setMatches] = useState<MatchDetails[]>([]);
  const [unrecorded, setUnrecorded] = useState<MatchDetails[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const exportReport = async () => {
    if (!activeTeam || !activeSeason || exporting) return;
    setExporting(true);
    try {
      const report = await loadSeasonReport(activeTeam, activeSeason);
      const doc = renderSeasonReport(report, (key, options) => t(key as any, options as any) as string, i18n.language);
      doc.save(reportFileName(report));
      toast.success(t('seasonReport.done'));
    } catch (err) {
      console.error('[SeasonReport] export failed', err);
      toast.error(t('seasonReport.failed'));
    } finally {
      setExporting(false);
    }
  };

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
      const today = todayISO();
      const finishedMatches = matchesData
        .filter(m => m.date <= today && hasResult(m))
        .sort((a, b) => a.date.localeCompare(b.date));
      setMatches(finishedMatches);
      setUnrecorded(matchesData.filter(isUnrecorded));
      setTopPerformers(performersData);
    } catch (error) {
      toast.error(t('feedback.loadFailed'));
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

  // Recorded and unrecorded past matches together; U never counts towards the totals above.
  const history = useMemo(
    () => [...matches, ...unrecorded].sort((a, b) => a.date.localeCompare(b.date)),
    [matches, unrecorded],
  );

  const outcomeStyle = {
    W: { color: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-600', label: t('statistics.win') },
    D: { color: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-600', label: t('statistics.draw') },
    L: { color: 'bg-rose-500', badge: 'bg-rose-500/10 text-rose-600', label: t('statistics.loss') },
    U: { color: 'bg-slate-400', badge: 'bg-slate-500/10 text-slate-500', label: t('statistics.unrecorded') },
  } as const;

  const recentForm = history.slice(-5).map(m => {
    const type = matchOutcome(m) ?? 'U';
    return { type: type === 'U' ? t('statistics.unrecordedShort') : type, ...outcomeStyle[type] };
  });

  const shortDate = (dateStr: string) => {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  };
  const monthOf = (dateStr: string) =>
    parseLocalDate(dateStr).toLocaleDateString(i18n.language, { month: 'short' });

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
    { name: t('statistics.wins'), value: stats.wins, color: '#10b981' },
    { name: t('statistics.draws'), value: stats.draws, color: '#f59e0b' },
    { name: t('statistics.losses'), value: stats.losses, color: '#ef4444' },
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
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('page.statisticsTitle')}</h1>
            <p className="text-sm text-muted mt-0.5">
              {activeTeam?.name}{activeSeason?.name ? ` · ${activeSeason.name}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-end gap-5">
          {recentForm.length > 0 && (
            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <span className="text-xs text-muted">{t('statistics.lastResults', { count: recentForm.length })}</span>
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
          {activeTeam && activeSeason && (
            <Button onClick={exportReport} isLoading={exporting} icon={<FileDown size={16} />}>
              {exporting ? t('seasonReport.generating') : t('seasonReport.button')}
            </Button>
          )}
        </div>
      </div>

      {matches.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <History size={36} className="text-muted/30 mb-4" />
          <h3 className="text-base font-semibold text-foreground">{t('statistics.noMatchResultsYet')}</h3>
          <p className="text-sm text-muted mt-1">{t('statistics.noMatchResultsSub')}</p>
        </Card>
      ) : (
        <div className="space-y-6 pb-8">
          {/* Hero stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <p className="text-xs text-muted font-medium mb-4">{t('statistics.seasonRecord')}</p>
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-3xl font-black text-emerald-500">{stats.wins}</p>
                  <p className="text-[11px] text-muted font-medium mt-1">{t('statistics.wins')}</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-amber-500">{stats.draws}</p>
                  <p className="text-[11px] text-muted font-medium mt-1">{t('statistics.draws')}</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-rose-500">{stats.losses}</p>
                  <p className="text-[11px] text-muted font-medium mt-1">{t('statistics.losses')}</p>
                </div>
              </div>
              <p className="text-xs text-muted mt-4 pt-4 border-t border-border/40">
                {t('statistics.matchesPlayedCount', { count: stats.total })}
                {unrecorded.length > 0 && <> · {t('statistics.unrecordedCount', { count: unrecorded.length })}</>}
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-xs text-muted font-medium mb-4">{t('statistics.points')}</p>
              <p className="text-4xl font-black text-foreground">{stats.points}</p>
              <p className="text-xs text-muted mt-4 pt-4 border-t border-border/40">
                {t('statistics.pointsSub', { ptsPerGame: stats.ptsPerGame, winRate: stats.winRate })}
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-xs text-muted font-medium mb-4">{t('statistics.goals')}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-foreground">{stats.goalsFor}</p>
                <span className="text-sm text-muted">{t('statistics.goalsScored')}</span>
              </div>
              <p className="text-xs text-muted mt-4 pt-4 border-t border-border/40">
                {t('statistics.goalsSub', { goalsAgainst: stats.goalsAgainst, goalDiffPrefix: stats.goalDiff > 0 ? '+' : '', goalDiff: stats.goalDiff })}
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-xs text-muted font-medium mb-4">{t('statistics.cleanSheets')}</p>
              <p className="text-4xl font-black text-foreground">{stats.cleanSheets}</p>
              <p className="text-xs text-muted mt-4 pt-4 border-t border-border/40">
                {t('statistics.cleanSheetsSub', { pct: stats.total > 0 ? Math.round((stats.cleanSheets / stats.total) * 100) : 0 })}
              </p>
            </Card>
          </div>

          {/* Secondary stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { value: stats.avgScored, label: t('statistics.avgGoalsScored') },
              { value: stats.avgConceded, label: t('statistics.avgGoalsConceded') },
              { value: stats.unbeatenStreak, label: t('statistics.unbeatenStreak') },
              { value: stats.ptsPerGame, label: t('statistics.ptsPerGame') },
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
                <h3 className="text-sm font-semibold text-foreground">{t('statistics.pointsPerMatch')}</h3>
                <p className="text-xs text-muted mt-0.5">{t('statistics.fullSeasonTimeline')}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-muted">{t('statistics.winLegend')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs text-muted">{t('statistics.drawLegend')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-xs text-muted">{t('statistics.lossLegend')}</span>
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
                  <h3 className="text-sm font-semibold text-foreground">{t('statistics.goalsPerMatch')}</h3>
                  <p className="text-xs text-muted mt-0.5">{t('statistics.fullSeasonMatches', { count: matches.length })}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-muted">{t('statistics.scoredLegend')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-xs text-muted">{t('statistics.concededLegend')}</span>
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
                      formatter={(value, name) => [value, name === 'scored' ? t('statistics.scoredLegend') : t('statistics.concededLegend')]}
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
              <h3 className="text-sm font-semibold text-foreground">{t('statistics.resultsBreakdown')}</h3>
              <p className="text-xs text-muted mt-0.5 mb-4">{t('statistics.seasonTotals')}</p>
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
                    <span className="text-xs text-muted">{t('statistics.playedCenterText')}</span>
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
              title={t('statistics.topScorers')}
              items={topPerformers.filter(p => p.goals > 0).slice(0, 5)}
              statKey="goals"
              statLabel={t('statistics.goals')}
            />
            <LeaderboardCard
              title={t('statistics.topAssisters')}
              items={topPerformers.filter(p => p.assists > 0).sort((a, b) => b.assists - a.assists).slice(0, 5)}
              statKey="assists"
              statLabel={t('statistics.assists')}
            />
          </div>

          {/* Match history */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-foreground">{t('statistics.matchHistory')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-muted border-b border-border/50">
                    <th className="px-5 py-3 font-medium">{t('statistics.tableResult')}</th>
                    <th className="px-5 py-3 font-medium">{t('statistics.tableOpponent')}</th>
                    <th className="px-5 py-3 font-medium text-center">{t('statistics.tableScore')}</th>
                    <th className="px-5 py-3 font-medium">{t('statistics.tableDate')}</th>
                    <th className="px-5 py-3 font-medium">{t('statistics.tableVenue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {history.slice().reverse().map(m => {
                    const outcome = matchOutcome(m) ?? 'U';
                    return (
                      <tr key={m.id} className="hover:bg-surface-raised/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <span title={outcomeStyle[outcome].label} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${outcomeStyle[outcome].badge}`}>
                            {outcome === 'U' ? t('statistics.unrecordedShort') : outcome}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-medium text-foreground">vs {m.opponent}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="text-sm font-bold text-foreground tabular-nums">
                            {hasResult(m) ? `${m.goalsFor} – ${m.goalsAgainst}` : '–'}
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
  const { t } = useTranslation();
  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted text-center py-10">{t('statistics.noDataRecordedYet')}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item.playerId}className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-raised/40 transition-colors">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${index === 0 ? 'bg-amber-500 text-white' : index === 1 ? 'bg-slate-400 text-white' : index === 2 ? 'bg-amber-700 text-white' : 'border border-border text-muted'}`}>
                {index + 1}
              </span>
              <div className="w-9 h-9 rounded-lg bg-surface border border-border/50 overflow-hidden flex-shrink-0">
                {item.imageUrl ? (
                  <img src={item.imageUrl}alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted">
                    <Users size={15} />
                  </div>
                )}
              </div>
              <p className="text-sm font-medium text-foreground flex-1 truncate">
                {item.firstName} {item.lastName}
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
  const { t } = useTranslation();
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    const pts = d.points;
    const color = pts === 3 ? 'text-emerald-600' : pts === 1 ? 'text-amber-600' : 'text-rose-600';
    return (
      <div className="px-3 py-2 rounded-lg bg-surface border border-border shadow-lg text-xs space-y-0.5">
        <p className="font-semibold text-foreground">{d.opponent}</p>
        <p className="text-muted">{d.fullDate} · {d.score}</p>
        <p className={`font-bold ${color}`}>{t('statistics.pointPlural', { count: pts })}</p>
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
