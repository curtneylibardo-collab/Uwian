import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/nav';
import { NeuCard } from '@/components/Neu';
import { BottleCap } from '@/components/BottleCap';
import { Toast } from '@/components/Glass';
import type { GroupMember, Profile, Expense, ExpenseSplit, Payment } from '@/lib/types';
import { computeBalances, applyPayments, settleUp, formatPesos } from '@/lib/utils';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export function BarkadaLedgerScreen({ groupId }: { groupId: string }) {
  const { profile } = useAuth();
  const { back } = useNav();
  const [members, setMembers] = useState<Array<GroupMember & { profile: Profile }>>([]);
  const [expenses, setExpenses] = useState<Array<Expense & { splits: ExpenseSplit[] }>>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: m } = await supabase
      .from('group_members')
      .select('*, profile:profiles!group_members_user_id_fkey(*)')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('joined_at');
    setMembers((m as Array<GroupMember & { profile: Profile }>) ?? []);

    const { data: sessions } = await supabase.from('sessions').select('id').eq('group_id', groupId);
    const sessionIds = (sessions ?? []).map((s) => s.id);
    if (sessionIds.length > 0) {
      const { data: exp } = await supabase
        .from('expenses')
        .select('*, splits:expense_splits(user_id)')
        .in('session_id', sessionIds)
        .order('created_at');
      setExpenses((exp as Array<Expense & { splits: ExpenseSplit[] }>) ?? []);
    }

    const { data: pays } = await supabase
      .from('payments')
      .select('*, payer_profile:profiles!payments_payer_id_fkey(*), receiver_profile:profiles!payments_receiver_id_fkey(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    setPayments((pays as Payment[]) ?? []);

    setLoading(false);
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const profileMap = new Map(members.map((m) => [m.user_id, m.profile!]));

  const balances = computeBalances(
    expenses.map((e) => ({
      amount_centavos: e.amount_centavos,
      paid_by: e.paid_by,
      splits: e.splits.map((s) => ({ user_id: s.user_id })),
    })),
  );
  const adjustedBalances = applyPayments(
    balances,
    payments.map((p) => ({ payer_id: p.payer_id, receiver_id: p.receiver_id, amount_centavos: p.amount_centavos, status: p.status })),
  );
  const transfers = settleUp(adjustedBalances);

  async function logPayment(toUserId: string, amount: number) {
    if (!profile) return;
    const { error } = await supabase.from('payments').insert({
      group_id: groupId,
      payer_id: profile.id,
      receiver_id: toUserId,
      amount_centavos: amount,
      status: 'pending',
    });
    if (error) {
      setToast('Hindi nagawa ang payment. Subukan ulit.');
      return;
    }
    setToast('Nag-tap ka ng "Nagbayad na ako". Hintayin ang confirmation.');
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Naglo-load...</div>;

  const totalDebt = transfers.reduce((s, t) => s + t.amount_centavos, 0);

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={back} className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center active:neu-pressed">
          <ArrowLeft size={20} style={{ color: 'var(--text)' }} />
        </button>
        <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--text)' }}>Barkada ledger</h1>
      </div>

      {/* Summary */}
      <NeuCard className="mb-4 text-center">
        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Total utang na kailangan bayaran</p>
        <p className="font-heading font-extrabold text-3xl" style={{ color: 'var(--amber)' }}>{formatPesos(totalDebt)}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{transfers.length} transfers para ma-settle</p>
      </NeuCard>

      {/* Per-person balances */}
      <NeuCard className="mb-4">
        <h2 className="text-sm font-heading font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Balanse ng bawat miyembro</h2>
        <div className="space-y-2">
          {members.map((m) => {
            const bal = adjustedBalances.get(m.user_id) ?? 0;
            return (
              <div key={m.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{m.profile?.avatar_emoji}</span>
                  <span className="text-sm font-heading font-semibold" style={{ color: 'var(--text)' }}>{m.profile?.display_name}</span>
                </div>
                <span className="font-heading font-bold text-sm tabular-nums" style={{ color: bal > 0 ? 'var(--green-light)' : bal < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                  {formatPesos(bal)}
                </span>
              </div>
            );
          })}
        </div>
      </NeuCard>

      {/* Suggested transfers */}
      {transfers.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-heading font-semibold" style={{ color: 'var(--text-muted)' }}>Suggested transfers</h2>
          {transfers.map((t, i) => {
            const fromProfile = profileMap.get(t.from);
            const toProfile = profileMap.get(t.to);
            const isMyTransfer = profile?.id === t.from;
            return (
              <NeuCard key={i} small className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg flex-shrink-0">{fromProfile?.avatar_emoji}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-heading font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {fromProfile?.display_name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>utang kay</span>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
                  <span className="text-lg flex-shrink-0">{toProfile?.avatar_emoji}</span>
                  <span className="text-sm font-heading font-semibold truncate" style={{ color: 'var(--text)' }}>
                    {toProfile?.display_name}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-heading font-bold text-sm" style={{ color: 'var(--amber)' }}>{formatPesos(t.amount_centavos)}</span>
                  {isMyTransfer && (
                    <BottleCap label="bayad" size="md" color="green" onClick={() => logPayment(t.to, t.amount_centavos)} />
                  )}
                </div>
              </NeuCard>
            );
          })}
        </div>
      ) : (
        <NeuCard className="text-center py-12">
          <p className="font-heading font-semibold text-lg" style={{ color: 'var(--text)' }}>Even na lahat!</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Wala nang utang ang barkada.</p>
        </NeuCard>
      )}

      {/* Recent payments */}
      {payments.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-heading font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Recent payments</h2>
          <NeuCard inset>
            <div className="space-y-2">
              {payments.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{p.payer_profile?.avatar_emoji}</span>
                    <span className="text-sm" style={{ color: 'var(--text)' }}>{p.payer_profile?.display_name}</span>
                    <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm">{p.receiver_profile?.avatar_emoji}</span>
                    <span className="text-sm" style={{ color: 'var(--text)' }}>{p.receiver_profile?.display_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-heading font-bold" style={{ color: 'var(--text)' }}>{formatPesos(p.amount_centavos)}</span>
                    <span className={`led ${p.status === 'confirmed' ? 'led-green' : p.status === 'disputed' ? 'led-red' : 'led-amber'}`} />
                  </div>
                </div>
              ))}
            </div>
          </NeuCard>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
