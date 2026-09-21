import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bug, Lightbulb, HelpCircle, Inbox, ShieldCheck, Users, UserCheck, Dumbbell, Target, MessageSquare, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { AdminService } from '../services';
import { AdminFeedbackItem, AdminUser, AdminStats } from '../types/models';
import { getStoredUserRole } from '../lib/utils';
import { clearAdminUnlock, getAdminToken } from '../lib/adminUnlock';

type StatusFilter = 'all' | AdminFeedbackItem['status'];
type TypeFilter = 'all' | AdminFeedbackItem['type'];

const TYPE_META: Record<AdminFeedbackItem['type'], { icon: any; classes: string }> = {
  bug:      { icon: Bug,        classes: 'bg-rose-500/10 text-rose-600' },
  feature:  { icon: Lightbulb,  classes: 'bg-amber-500/10 text-amber-600' },
  question: { icon: HelpCircle, classes: 'bg-blue-500/10 text-blue-600' },
};

const STATUS_CLASSES: Record<AdminFeedbackItem['status'], string> = {
  new:         'bg-slate-500/10 text-slate-600',
  in_progress: 'bg-amber-500/10 text-amber-600',
  resolved:    'bg-emerald-500/10 text-emerald-600',
};

function AdminUnlockGate({ onUnlocked }: { onUnlocked: () => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await AdminService.unlock(code);
      setCode('');
      onUnlocked();
    } catch (err: any) {
      // The backend answers 403/429/503, never 401, so a typo doesn't log the coach out.
      setError(err?.message || t('admin.unlockFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full flex items-center justify-center p-8">
      <Card className="p-8 w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <span className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center mb-3">
            <Lock size={22} />
          </span>
          <h1 className="text-lg font-bold text-foreground">{t('admin.unlockTitle')}</h1>
          <p className="text-xs text-muted mt-1.5 leading-relaxed">{t('admin.unlockDesc')}</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Input
            type="password"
            autoFocus
            autoComplete="off"
            placeholder={t('admin.unlockPlaceholder')}
            value={code}
            onChange={e => { setCode(e.target.value); if (error) setError(''); }}
          />
          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
          <Button type="submit" isLoading={submitting} icon={<Lock size={14} />} className="w-full">
            {t('admin.unlockSubmit')}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function AdminView() {
  const { t, i18n } = useTranslation();
  const isSuperuser = getStoredUserRole() === 'superuser';

  const [unlocked, setUnlocked] = useState(() => getAdminToken() !== null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedbackItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const statusLabels: Record<AdminFeedbackItem['status'], string> = {
    new: t('feedback.newStatus'),
    in_progress: t('feedback.inProgressStatus'),
    resolved: t('feedback.resolvedStatus'),
  };

  const typeLabels: Record<AdminFeedbackItem['type'], string> = {
    bug: t('feedback.bugReport'),
    feature: t('feedback.featureRequest'),
    question: t('feedback.question'),
  };

  useEffect(() => {
    if (!isSuperuser || !unlocked) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const [statsData, feedbackData, usersData] = await Promise.all([
          AdminService.getStats(),
          AdminService.getFeedback(),
          AdminService.getUsers(),
        ]);
        if (cancelled) return;
        setStats(statsData);
        setFeedback(feedbackData);
        setUsers(usersData);
      } catch (err: any) {
        if (cancelled) return;
        if (err?.status === 403) {
          clearAdminUnlock();
          setUnlocked(false);
          toast.error(t('admin.unlockExpired'));
        } else {
          toast.error(err.message || t('admin.loadFailed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isSuperuser, unlocked, t]);

  const handleStatusChange = async (item: AdminFeedbackItem, status: AdminFeedbackItem['status']) => {
    if (status === item.status) return;
    const previous = feedback;
    setFeedback(prev => prev.map(f => f.id === item.id ? { ...f, status } : f));
    try {
      await AdminService.updateFeedbackStatus(item.id, status);
      toast.success(t('admin.statusUpdated'));
    } catch (err: any) {
      setFeedback(previous);
      if (err?.status === 403) {
        clearAdminUnlock();
        setUnlocked(false);
        toast.error(t('admin.unlockExpired'));
      } else {
        toast.error(err.message || t('admin.statusUpdateFailed'));
      }
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (!isSuperuser) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8">
        <Card className="p-10 flex flex-col items-center text-center max-w-md">
          <ShieldCheck size={32} className="text-muted/40 mb-3" />
          <p className="text-sm text-muted">{t('admin.notAvailable')}</p>
        </Card>
      </div>
    );
  }

  if (!unlocked) {
    return <AdminUnlockGate onUnlocked={() => setUnlocked(true)} />;
  }

  const visibleFeedback = feedback.filter(f =>
    (statusFilter === 'all' || f.status === statusFilter) &&
    (typeFilter === 'all' || f.type === typeFilter)
  );

  const statCards = stats ? [
    { label: t('admin.statsUsers'),        value: stats.users,                             icon: Users,         classes: 'bg-blue-500/10 text-blue-500' },
    { label: t('admin.statsTeams'),        value: stats.teams,                             icon: UserCheck,     classes: 'bg-indigo-500/10 text-indigo-500' },
    { label: t('admin.statsPlayers'),      value: stats.players,                           icon: Users,         classes: 'bg-emerald-500/10 text-emerald-500' },
    { label: t('admin.statsSessions'),     value: stats.trainingSessions,                  icon: Dumbbell,      classes: 'bg-cyan-500/10 text-cyan-500' },
    { label: t('admin.statsMatches'),      value: stats.matches,                           icon: Target,        classes: 'bg-rose-500/10 text-rose-500' },
    { label: t('admin.statsOpenFeedback'), value: stats.feedbackNew + stats.feedbackInProgress, icon: MessageSquare, classes: 'bg-amber-500/10 text-amber-500' },
  ] : [];

  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto overflow-y-auto custom-scrollbar gap-6">
      <div className="flex items-center gap-3">
        <div className="w-1 h-10 rounded-full bg-primary flex-shrink-0" />
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('page.adminTitle')}</h1>
          <p className="text-sm text-muted mt-0.5">{t('page.adminSubtitle')}</p>
        </div>
      </div>

      {loading ? (
        <Card className="p-8 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </Card>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {statCards.map(card => {
                const Icon = card.icon;
                return (
                  <Card key={card.label} className="p-4 flex flex-col gap-2">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${card.classes}`}>
                      <Icon size={16} />
                    </span>
                    <p className="text-xl font-bold text-foreground leading-none">{card.value}</p>
                    <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">{card.label}</p>
                  </Card>
                );
              })}
            </div>
          )}

          <div>
            <div className="relative flex flex-wrap items-end justify-between gap-3 mb-3" style={{ zIndex: visibleFeedback.length + 1 }}>
              <h2 className="text-base font-semibold text-foreground">{t('admin.feedbackHeading')}</h2>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="w-full sm:w-40">
                  <Select
                    label={t('admin.filterStatus')}
                    options={[
                      { label: t('admin.filterAll'), value: 'all' },
                      { label: statusLabels.new, value: 'new' },
                      { label: statusLabels.in_progress, value: 'in_progress' },
                      { label: statusLabels.resolved, value: 'resolved' },
                    ]}
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v as StatusFilter)}
                  />
                </div>
                <div className="w-full sm:w-40">
                  <Select
                    label={t('admin.filterType')}
                    options={[
                      { label: t('admin.filterAll'), value: 'all' },
                      { label: typeLabels.bug, value: 'bug' },
                      { label: typeLabels.feature, value: 'feature' },
                      { label: typeLabels.question, value: 'question' },
                    ]}
                    value={typeFilter}
                    onChange={(v) => setTypeFilter(v as TypeFilter)}
                  />
                </div>
              </div>
            </div>

            {visibleFeedback.length === 0 ? (
              <Card className="p-10 flex flex-col items-center justify-center text-center">
                <Inbox size={32} className="text-muted/40 mb-3" />
                <p className="text-sm text-muted">{t('admin.emptyFeedback')}</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {visibleFeedback.map((item, idx) => {
                  const typeMeta = TYPE_META[item.type] ?? TYPE_META.question;
                  const TypeIcon = typeMeta.icon;
                  return (
                    // overflow-visible and descending z-index: the card's backdrop-blur traps the dropdown in its own stacking context.
                    <Card key={item.id} className="p-5 overflow-visible" style={{ zIndex: visibleFeedback.length - idx }}>
                      <div className="flex items-start gap-3">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${typeMeta.classes}`}>
                          <TypeIcon size={16} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">{item.title}</p>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${STATUS_CLASSES[item.status]}`}>
                                {statusLabels[item.status]}
                              </span>
                            </div>
                            <span className="text-xs text-muted flex-shrink-0">{formatDate(item.createdAt)}</span>
                          </div>
                          <p className="text-xs text-muted mt-1">
                            {item.coachName ? `${item.coachName} · ` : ''}{item.coachEmail}
                          </p>
                          <p className="text-sm text-muted mt-1.5 whitespace-pre-wrap">{item.description}</p>
                          {item.screenshotUrls.length > 0 && (
                            <div className="flex flex-wrap gap-3 mt-3">
                              {item.screenshotUrls.map((url, idx) => (
                                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-block">
                                  <img
                                    src={url}
                                    alt={`Screenshot ${idx + 1}`}
                                    className="max-h-48 rounded-lg border border-border hover:border-primary/50 transition-colors"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 w-full sm:w-44">
                            <Select
                              label={t('admin.setStatus')}
                              options={[
                                { label: statusLabels.new, value: 'new' },
                                { label: statusLabels.in_progress, value: 'in_progress' },
                                { label: statusLabels.resolved, value: 'resolved' },
                              ]}
                              value={item.status}
                              onChange={(v) => handleStatusChange(item, v as AdminFeedbackItem['status'])}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground mb-3">{t('admin.usersHeading')}</h2>
            {users.length === 0 ? (
              <Card className="p-10 flex flex-col items-center justify-center text-center">
                <Users size={32} className="text-muted/40 mb-3" />
                <p className="text-sm text-muted">{t('admin.emptyUsers')}</p>
              </Card>
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-3 text-[11px] font-bold text-muted uppercase tracking-widest">{t('admin.colEmail')}</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-muted uppercase tracking-widest">{t('admin.colName')}</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-muted uppercase tracking-widest">{t('admin.colRole')}</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-muted uppercase tracking-widest">{t('admin.colCreated')}</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-muted uppercase tracking-widest text-right">{t('admin.colTeams')}</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-muted uppercase tracking-widest text-right">{t('admin.colFeedback')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-b border-border/50 last:border-0 hover:bg-surface-hover transition-colors">
                        <td className="px-4 py-3 text-foreground">{user.email}</td>
                        <td className="px-4 py-3 text-muted">{user.fullName || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                            user.role === 'superuser' ? 'bg-violet-500/10 text-violet-600' : 'bg-slate-500/10 text-slate-600'
                          }`}>
                            {user.role === 'superuser' ? t('admin.roleSuperuser') : t('admin.roleCoach')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3 text-muted text-right">{user.teamCount}</td>
                        <td className="px-4 py-3 text-muted text-right">{user.feedbackCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
