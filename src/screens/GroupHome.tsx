import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/nav';
import { NeuCard, NeuButton } from '@/components/Neu';
import { BottleCap } from '@/components/BottleCap';
import { Coaster } from '@/components/Coaster';
import { Toast } from '@/components/Glass';
import type { Group, GroupMember, Session, Profile, Payment, Expense, ExpenseSplit } from '@/lib/types';
import { computeBalances, applyPayments, settleUp, formatPesos, formatDate, formatTime } from '@/lib/utils';
import { ArrowLeft, Plus, MapPin, Receipt, Users, Settings, Scale, AlertTriangle, UserPlus } from 'lucide-react';

export function GroupHomeScreen({ groupId }: { groupId: string }) {
  const { profile } = useAuth();
  const { navigate, back } = useNav();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [missingCheckins, setMissingCheckins] = useState<Profile[]>([]);
  const [netBalance, setNetBalance] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;

    const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).maybeSingle();
    setGroup(g as Group | null);

    const { data: m } = await supabase
      .from('group_members')
      .select('*, profile:profiles!group_members_user_id_fkey(*)')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('joined_at');
    setMembers((m as GroupMember[]) ?? []);

    const { data: pending } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('status', 'pending');
    setPendingCount(pending?.length ?? 0);

    const { data: s } = await supabase
      .from('sessions')
      .select('*, spot:spots(*)')
      .eq('group_id', groupId)
      .order('session_date', { ascending: false });
    setSessions((s as Session[]) ?? []);

    // Check for missing uwian check-ins on live/ended sessions
    const liveSessions = (s as Session[])?.filter((sess) => sess.status === 'live' || sess.status === 'ended') ?? [];
    const missing: Profile[] = [];
    for (const sess of liveSessions) {
      if (!sess.uwian_deadline) continue;
      const deadline = new Date(sess.uwian_deadline);
      const minsOverdue = (Date.now() - deadline.getTime()) / 60000;
      if (minsOverdue < 60) continue;

      const { data: checkedIn } = await supabase
        .from('uwian_checkins')
        .select('user_id')
        .eq('session_id', sess.id)
        .eq('confirmed', true);
      const checkedIds = new Set((checkedIn ?? []).map((c) => c.user_id));

      const activeMembers = (m as GroupMember[]) ?? [];
      for (const mem of activeMembers) {
        if (!checkedIds.has(mem.user_id)) {
          if (mem.profile && !missing.find((p) => p.id === mem.user_id)) {
            missing.push(mem.profile);
          }
        }
      }
    }
    setMissingCheckins(missing);

    // Compute net balance for this user across all sessions
    const allSessionIds = ((s as Session[]) ?? []).map((sess) => sess.id);
    if (allSessionIds.length > 0) {
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*, splits:expense_splits(user_id)')
        .in('session_id', allSessionIds);

      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('group_id', groupId);

      const balances = computeBalances(
        ((expenses ?? []) as unknown as Array<{ amount_centavos: number; paid_by: string; splits: Array<{ user_id: string }> }>),
      );
      const adjusted = applyPayments(
        balances,
        (payments ?? []).map((p) => ({ payer_id: p.payer_id, receiver_id: p.receiver_id, amount_centavos: p.amount_centavos, status: p.status })),
      );
      setNetBalance(adjusted.get(profile.id) ?? 0);
    } else {
      setNetBalance(0);
    }

    setLoading(false);
  }, [groupId, profile]);

  useEffect(() => { load(); }, [load]);

  const upcomingSession = sessions.find((s) => s.status === 'planned' || s.status === 'live');
  const liveSession = sessions.find((s) => s.status === 'live');

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Naglo-load...</div>;

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={back} className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center active:neu-pressed">
            <ArrowLeft size={20} style={{ color: 'var(--text)' }} />
          </button>
          <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--text)' }}>{group?.name}</h1>
        </div>
        <button
          onClick={() => navigate({ name: 'settings', groupId })}
          className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center active:neu-pressed"
          aria-label="Settings"
        >
          <Settings size={20} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Missing check-in alert */}
      {missingCheckins.length > 0 && (
        <div className="glass rounded-2xl px-4 py-3 mb-4 flex items-center gap-3" style={{ borderColor: 'var(--red)' }}>
          <AlertTriangle size={20} style={{ color: 'var(--red)' }} />
          <div className="text-sm" style={{ color: 'var(--text)' }}>
            <span className="font-heading font-semibold">May hindi pa nakauwi: </span>
            <span>{missingCheckins.map((p) => p.display_name).join(', ')}</span>
          </div>
        </div>
      )}

      {/* Members as coasters */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-heading font-semibold" style={{ color: 'var(--text-muted)' }}>Mga miyembro ({members.length})</h2>
          <button
            onClick={() => navigate({ name: 'vouchQueue', groupId })}
            className="flex items-center gap-1 text-xs font-heading font-semibold active:opacity-60"
            style={{ color: 'var(--amber)' }}
          >
            {pendingCount > 0 && <span className="led led-amber" />}
            <UserPlus size={14} /> Vouch queue
          </button>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {members.map((m) => (
            <Coaster
              key={m.id}
              profile={m.profile!}
              status="pending"
              size="sm"
              label={m.profile?.display_name}
              sublabel={m.role === 'admin' ? 'admin' : undefined}
            />
          ))}
        </div>
      </div>

      {/* Upcoming / live session */}
      {upcomingSession ? (
        <NeuCard className="mb-4 cursor-pointer active:neu-pressed" onClick={() => navigate({ name: 'sessionDetail', groupId, sessionId: upcomingSession.id })}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {upcomingSession.status === 'live' && <span className="led led-green" />}
              <h3 className="font-heading font-bold text-base" style={{ color: 'var(--text)' }}>{upcomingSession.title}</h3>
            </div>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: upcomingSession.status === 'live' ? 'var(--green)' : 'var(--surface)', color: upcomingSession.status === 'live' ? 'white' : 'var(--text-muted)', boxShadow: upcomingSession.status === 'live' ? 'none' : 'inset 2px 2px 4px var(--shadow-dark)' }}>
              {upcomingSession.status === 'live' ? 'Live ngayon' : 'Planned'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span>{formatDate(upcomingSession.session_date)}</span>
            <span>·</span>
            <span>{formatTime(upcomingSession.session_time)}</span>
            {upcomingSession.spot && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1"><MapPin size={12} /> {upcomingSession.spot.name}</span>
              </>
            )}
          </div>
          {liveSession && (
            <div className="mt-3 flex gap-2">
              <BottleCap label="tab na" color="green" size="md" onClick={(e: any) => { e?.stopPropagation?.(); navigate({ name: 'liveTab', groupId, sessionId: liveSession.id }); }} />
              <BottleCap label="uwian" color="amber" size="md" onClick={(e: any) => { e?.stopPropagation?.(); navigate({ name: 'uwian', groupId, sessionId: liveSession.id }); }} />
            </div>
          )}
        </NeuCard>
      ) : (
        <NeuCard className="mb-4 text-center py-8">
          <p className="font-heading font-semibold mb-1" style={{ color: 'var(--text)' }}>Wala pang session.</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Gumawa ng una.</p>
        </NeuCard>
      )}

      {/* Ledger summary */}
      <NeuCard className="mb-4 cursor-pointer active:neu-pressed" onClick={() => navigate({ name: 'ledger', groupId })}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale size={24} style={{ color: 'var(--amber)' }} />
            <div>
              <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--text)' }}>Barkada ledger</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Unpaid debts across sessions</p>
            </div>
          </div>
          {netBalance !== null && (
            <div className="text-right">
              <div className="font-heading font-bold text-lg" style={{ color: netBalance > 0 ? 'var(--green-light)' : netBalance < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                {formatPesos(netBalance)}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{netBalance > 0 ? 'utang sa\'yo' : netBalance < 0 ? 'utang mo' : 'even'}</div>
            </div>
          )}
        </div>
      </NeuCard>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <NeuButton onClick={() => navigate({ name: 'createSession', groupId })} className="flex items-center justify-center gap-2 text-sm">
          <Plus size={18} /> Session
        </NeuButton>
        <NeuButton onClick={() => navigate({ name: 'map', groupId })} className="flex items-center justify-center gap-2 text-sm">
          <MapPin size={18} /> Tambayan
        </NeuButton>
        <NeuButton onClick={() => navigate({ name: 'settleUp', groupId })} className="flex items-center justify-center gap-2 text-sm">
          <Receipt size={18} /> Settle up
        </NeuButton>
        <NeuButton onClick={() => navigate({ name: 'vouchQueue', groupId })} className="flex items-center justify-center gap-2 text-sm">
          <Users size={18} /> Vouch
        </NeuButton>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
