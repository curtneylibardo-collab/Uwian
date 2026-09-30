import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/nav';
import { NeuCard } from '@/components/Neu';
import { BottleCap } from '@/components/BottleCap';
import { Receipt } from '@/components/Receipt';
import { Toast } from '@/components/Glass';
import type { GroupMember, Profile, Payment, Expense, ExpenseSplit } from '@/lib/types';
import { computeBalances, applyPayments, settleUp, formatPesos } from '@/lib/utils';
import { ArrowLeft, Check, AlertTriangle, ArrowRight } from 'lucide-react';

export function SettleUpScreen({ groupId }: { groupId: string }) {
  const { profile } = useAuth();
  const { back } = useNav();
  const [members, setMembers] = useState<Array<GroupMember & { profile: Profile }>>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Array<Expense & { splits: ExpenseSplit[] }>>([]);
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

    const { data: pays } = await supabase
      .from('payments')
      .select('*, payer_profile:profiles!payments_payer_id_fkey(*), receiver_profile:profiles!payments_receiver_id_fkey(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    setPayments((pays as Payment[]) ?? []);

    // Get all session ids for this group
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

  async function confirmPayment(paymentId: string) {
    await supabase.from('payments').update({ status: 'confirmed' }).eq('id', paymentId);
    setToast('Na-confirm ang payment.');
    load();
  }

  async function disputePayment(paymentId: string) {
    const note = prompt('Ano ang problema?') ?? '';
    if (!note.trim()) return;
    await supabase.from('payments').update({ status: 'disputed', dispute_note: note }).eq('id', paymentId);
    setToast('Na-dispute ang payment.');
    load();
  }

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

  const pendingPayments = payments.filter((p) => p.status === 'pending');
  const disputedPayments = payments.filter((p) => p.status === 'disputed');
  const myBalance = profile ? (adjustedBalances.get(profile.id) ?? 0) : 0;

  // Build receipt lines for transfers
  const receiptLines = transfers.map((t, i) => ({
    id: `transfer-${i}`,
    left: `${profileMap.get(t.from)?.display_name ?? '?'} → ${profileMap.get(t.to)?.display_name ?? '?'}`,
    right: formatPesos(t.amount_centavos),
  }));

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={back} className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center active:neu-pressed">
          <ArrowLeft size={20} style={{ color: 'var(--text)' }} />
        </button>
        <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--text)' }}>Settle up</h1>
      </div>

      {/* My balance summary */}
      <NeuCard className="mb-4 text-center">
        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Net balance mo</p>
        <p className="font-heading font-extrabold text-3xl" style={{ color: myBalance > 0 ? 'var(--green-light)' : myBalance < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
          {formatPesos(myBalance)}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {myBalance > 0 ? 'utang sa\'yo ang tropa' : myBalance < 0 ? 'may utang ka' : 'even na kayo'}
        </p>
      </NeuCard>

      {/* Suggested transfers as receipt */}
      {transfers.length > 0 ? (
        <div className="mb-6">
          <Receipt
            title="Settle up transfers"
            subtitle="Pinakakaunting transfers para bayaran"
            lines={receiptLines}
            total={formatPesos(transfers.reduce((s, t) => s + t.amount_centavos, 0))}
            totalLabel="TOTAL FLOW"
            footer="I-tap ang transfer para mag-log ng payment."
          />
          <div className="space-y-2 mt-4">
            {transfers.map((t, i) => {
              const fromProfile = profileMap.get(t.from);
              const toProfile = profileMap.get(t.to);
              const isMyTransfer = profile?.id === t.from;
              return (
                <NeuCard key={i} small className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{fromProfile?.avatar_emoji}</span>
                    <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-lg">{toProfile?.avatar_emoji}</span>
                    <span className="text-sm font-heading font-semibold ml-1" style={{ color: 'var(--text)' }}>
                      {fromProfile?.display_name} → {toProfile?.display_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-sm" style={{ color: 'var(--amber)' }}>{formatPesos(t.amount_centavos)}</span>
                    {isMyTransfer && (
                      <BottleCap label="bayad" size="md" color="green" onClick={() => logPayment(t.to, t.amount_centavos)} />
                    )}
                  </div>
                </NeuCard>
              );
            })}
          </div>
        </div>
      ) : (
        <NeuCard className="text-center py-12 mb-6">
          <p className="font-heading font-semibold text-lg" style={{ color: 'var(--text)' }}>Even na kayo!</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Wala nang utang.</p>
        </NeuCard>
      )}

      {/* Pending payments */}
      {pendingPayments.length > 0 && (
        <NeuCard className="mb-4">
          <h2 className="text-sm font-heading font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Naghihintay ng confirmation</h2>
          <div className="space-y-2">
            {pendingPayments.map((p) => (
              <div key={p.id} className="p-3 rounded-[14px]" style={{ background: 'var(--surface)', boxShadow: 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{p.payer_profile?.avatar_emoji}</span>
                    <span className="text-sm" style={{ color: 'var(--text)' }}>→ {p.receiver_profile?.display_name}</span>
                  </div>
                  <span className="font-heading font-bold text-sm" style={{ color: 'var(--amber)' }}>{formatPesos(p.amount_centavos)}</span>
                </div>
                {profile?.id === p.receiver_id && (
                  <div className="flex gap-2">
                    <button onClick={() => confirmPayment(p.id)} className="flex-1 py-2 rounded-[14px] text-sm font-heading font-semibold flex items-center justify-center gap-1" style={{ background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--green-light)' }}>
                      <Check size={14} /> Confirm
                    </button>
                    <button onClick={() => disputePayment(p.id)} className="flex-1 py-2 rounded-[14px] text-sm font-heading font-semibold flex items-center justify-center gap-1" style={{ background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--red)' }}>
                      <AlertTriangle size={14} /> Dispute
                    </button>
                  </div>
                )}
                {profile?.id === p.payer_id && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Naghihintay na i-confirm ni {p.receiver_profile?.display_name}.</p>
                )}
              </div>
            ))}
          </div>
        </NeuCard>
      )}

      {/* Disputed payments */}
      {disputedPayments.length > 0 && (
        <NeuCard className="mb-4" >
          <h2 className="text-sm font-heading font-semibold mb-3" style={{ color: 'var(--red)' }}>May dispute</h2>
          <div className="space-y-2">
            {disputedPayments.map((p) => (
              <div key={p.id} className="p-3 rounded-[14px]" style={{ background: 'var(--surface)', boxShadow: 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{p.payer_profile?.display_name} → {p.receiver_profile?.display_name}</span>
                  <span className="font-heading font-bold text-sm" style={{ color: 'var(--red)' }}>{formatPesos(p.amount_centavos)}</span>
                </div>
                {p.dispute_note && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Note: {p.dispute_note}</p>}
              </div>
            ))}
          </div>
        </NeuCard>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
