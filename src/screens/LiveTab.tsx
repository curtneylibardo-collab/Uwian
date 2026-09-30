import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/nav';
import { NeuCard, NeuInput, NeuButton } from '@/components/Neu';
import { BottleCap } from '@/components/BottleCap';
import { Receipt } from '@/components/Receipt';
import { Toast } from '@/components/Glass';
import type { Session, Expense, ExpenseSplit, Profile, GroupMember, Payment } from '@/lib/types';
import { computeBalances, formatPesos, formatDate, formatTime } from '@/lib/utils';
import { ArrowLeft, Plus, Trash2, Wine, Check, X, AlertTriangle } from 'lucide-react';

export function LiveTabScreen({ groupId, sessionId }: { groupId: string; sessionId: string }) {
  const { profile } = useAuth();
  const { back } = useNav();
  const [session, setSession] = useState<Session | null>(null);
  const [members, setMembers] = useState<Array<GroupMember & { profile: Profile }>>([]);
  const [expenses, setExpenses] = useState<Array<Expense & { paid_by_profile: Profile; splits: Array<ExpenseSplit & { profile: Profile }> }>>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Add expense form state
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [isAlcohol, setIsAlcohol] = useState(false);
  const [splitIds, setSplitIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data: s } = await supabase
      .from('sessions')
      .select('*, spot:spots(*)')
      .eq('id', sessionId)
      .maybeSingle();
    setSession(s as Session | null);

    const { data: m } = await supabase
      .from('group_members')
      .select('*, profile:profiles!group_members_user_id_fkey(*)')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('joined_at');
    const memberList = (m as Array<GroupMember & { profile: Profile }>) ?? [];
    setMembers(memberList);

    const { data: exp } = await supabase
      .from('expenses')
      .select('*, paid_by_profile:profiles!expenses_paid_by_fkey(*), splits:expense_splits(profile:profiles!expense_splits_user_id_fkey(*))')
      .eq('session_id', sessionId)
      .order('created_at');
    setExpenses((exp as Array<Expense & { paid_by_profile: Profile; splits: Array<ExpenseSplit & { profile: Profile }> }>) ?? []);

    const { data: pays } = await supabase
      .from('payments')
      .select('*, payer_profile:profiles!payments_payer_id_fkey(*), receiver_profile:profiles!payments_receiver_id_fkey(*)')
      .eq('group_id', groupId);
    setPayments((pays as Payment[]) ?? []);

    if (profile && !paidBy) setPaidBy(profile.id);
    if (memberList.length > 0 && splitIds.size === 0) {
      setSplitIds(new Set(memberList.map((m) => m.user_id)));
    }

    setLoading(false);
  }, [sessionId, groupId, profile]);

  useEffect(() => { load(); }, [load]);

  // Trigger receipt printing animation on first load
  useEffect(() => {
    if (!loading && expenses.length > 0 && !printing) {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        setPrinting(true);
        setTimeout(() => setPrinting(false), 1200);
      }
    }
  }, [loading, expenses.length, printing]);

  async function handleAddExpense() {
    if (!profile || !desc.trim() || !amount) return;
    const centavos = Math.round(parseFloat(amount) * 100);
    if (isNaN(centavos) || centavos <= 0) {
      setToast('Mali ang halaga. Ilagay ang tamang numero.');
      return;
    }

    // For alcohol, auto-exclude designated driver
    let finalSplitIds = new Set(splitIds);
    if (isAlcohol && session?.designated_driver) {
      finalSplitIds = new Set([...splitIds].filter((id) => id !== session.designated_driver));
      if (finalSplitIds.size === 0) {
        setToast('Walang kasama sa split. Hindi kasama ang driver sa alcohol.');
        return;
      }
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        session_id: sessionId,
        description: desc.trim(),
        amount_centavos: centavos,
        paid_by: paidBy,
        is_alcohol: isAlcohol,
        split_type: 'equal',
      })
      .select()
      .single();

    if (error || !data) {
      setToast('Hindi naitala ang gastos. Subukan ulit.');
      return;
    }

    const splitsToInsert = [...finalSplitIds].map((uid) => ({ expense_id: data.id, user_id: uid }));
    await supabase.from('expense_splits').insert(splitsToInsert);

    const driverName = members.find((m) => m.user_id === session?.designated_driver)?.profile?.display_name;
    if (isAlcohol && session?.designated_driver && splitIds.has(session.designated_driver)) {
      setToast(`Hindi kasama si ${driverName} sa alcohol.`);
    } else {
      setToast('Naitala ang gastos.');
    }

    setShowAdd(false);
    setDesc('');
    setAmount('');
    setIsAlcohol(false);
    load();
  }

  async function handleDeleteExpense(expenseId: string) {
    await supabase.from('expenses').delete().eq('id', expenseId);
    setToast('Tinanggal ang gastos.');
    load();
  }

  // Compute balances for this session
  const sessionExpenses = expenses.map((e) => ({
    amount_centavos: e.amount_centavos,
    paid_by: e.paid_by,
    splits: e.splits.map((s) => ({ user_id: s.user_id })),
  }));
  const balances = computeBalances(sessionExpenses);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount_centavos, 0);

  // Build receipt lines
  const receiptLines = expenses.map((e) => ({
    id: e.id,
    left: `${e.description}${e.is_alcohol ? ' 🍺' : ''}`,
    right: formatPesos(e.amount_centavos),
  }));

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Naglo-load...</div>;

  const driver = members.find((m) => m.user_id === session?.designated_driver);

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={back} className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center active:neu-pressed">
          <ArrowLeft size={20} style={{ color: 'var(--text)' }} />
        </button>
        <div>
          <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--text)' }}>Live tab</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{session?.title} · {formatDate(session?.session_date ?? '')}</p>
        </div>
      </div>

      {/* Receipt */}
      {expenses.length > 0 ? (
        <div className="mb-6">
          <Receipt
            title={session?.spot?.name ?? session?.title ?? 'Inuman'}
            subtitle={`${formatDate(session?.session_date ?? '')} · ${formatTime(session?.session_time ?? '')}`}
            lines={receiptLines}
            total={formatPesos(totalSpent)}
            totalLabel="TOTAL"
            footer="Salamat sa inuman!"
            printing={printing}
          />
        </div>
      ) : (
        <NeuCard className="text-center py-12 mb-6">
          <p className="font-heading font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>Wala pang gastos.</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>I-tap ang bottle cap para mag-log.</p>
        </NeuCard>
      )}

      {/* Balances per person */}
      {expenses.length > 0 && (
        <NeuCard className="mb-4">
          <h2 className="text-sm font-heading font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Hatian</h2>
          <div className="space-y-2">
            {members.map((m) => {
              const bal = balances.get(m.user_id) ?? 0;
              return (
                <div key={m.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{m.profile?.avatar_emoji}</span>
                    <span className="text-sm font-heading font-semibold" style={{ color: 'var(--text)' }}>{m.profile?.display_name}</span>
                    {m.user_id === session?.designated_driver && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--green)', color: 'white' }}>driver</span>
                    )}
                  </div>
                  <span className="font-heading font-bold text-sm tabular-nums" style={{ color: bal > 0 ? 'var(--green-light)' : bal < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                    {formatPesos(bal)}
                  </span>
                </div>
              );
            })}
          </div>
        </NeuCard>
      )}

      {/* Pending payments */}
      {payments.filter((p) => p.status === 'pending').length > 0 && (
        <NeuCard className="mb-4">
          <h2 className="text-sm font-heading font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Nagbayad na ako</h2>
          <div className="space-y-2">
            {payments.filter((p) => p.status === 'pending').map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{p.payer_profile?.avatar_emoji}</span>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>→ {p.receiver_profile?.display_name}</span>
                </div>
                <span className="text-sm font-heading font-bold" style={{ color: 'var(--amber)' }}>{formatPesos(p.amount_centavos)}</span>
              </div>
            ))}
          </div>
        </NeuCard>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <BottleCap label="add gastos" size="lg" color="green" onClick={() => setShowAdd(true)} />
        <BottleCap label="settle na" size="lg" color="amber" onClick={() => setShowPayment(true)} />
      </div>

      {/* Add expense modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowAdd(false)}>
          <NeuCard className="w-full max-w-sm max-h-[90vh] overflow-y-auto no-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold" style={{ color: 'var(--text)' }}>Bagong gastos</h2>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--surface)', boxShadow: 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)' }}>
                <X size={16} style={{ color: 'var(--text)' }} />
              </button>
            </div>
            <div className="space-y-4">
              <NeuInput label="Ano" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Sisig + inasal" autoFocus />
              <NeuInput label="Magkano" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="480" />

              <div>
                <span className="block mb-2 text-sm font-heading font-semibold text-[var(--text-muted)]">Sino nagbayad</span>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPaidBy(m.user_id)}
                      className="px-3 py-2 rounded-[14px] text-sm font-heading font-semibold transition-all flex items-center gap-1.5"
                      style={paidBy === m.user_id
                        ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)', color: 'var(--amber)' }
                        : { background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--text)' }}
                    >
                      {m.profile?.avatar_emoji} {m.profile?.display_name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block mb-2 text-sm font-heading font-semibold text-[var(--text-muted)]">Sino ang kasama sa split</span>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => {
                    const selected = splitIds.has(m.user_id);
                    const isDriver = m.user_id === session?.designated_driver;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          const next = new Set(splitIds);
                          if (next.has(m.user_id)) next.delete(m.user_id);
                          else next.add(m.user_id);
                          setSplitIds(next);
                        }}
                        className="px-3 py-2 rounded-[14px] text-sm font-heading font-semibold transition-all flex items-center gap-1.5"
                        style={selected
                          ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)', color: 'var(--green-light)' }
                          : { background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--text)' }}
                      >
                        {m.profile?.avatar_emoji} {m.profile?.display_name}
                        {isDriver && <span className="text-xs" style={{ color: 'var(--green)' }}>🚗</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setIsAlcohol(!isAlcohol)}
                className="w-full py-3 rounded-[14px] font-heading font-semibold text-sm transition-all flex items-center justify-center gap-2"
                style={isAlcohol
                  ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)', color: 'var(--amber)' }
                  : { background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--text)' }}
              >
                <Wine size={18} /> Alcohol {isAlcohol ? '✓' : ''}
              </button>
              {isAlcohol && driver && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Hindi kasama si {driver.profile?.display_name} (driver) sa alcohol.
                </p>
              )}

              <div className="flex justify-center pt-2">
                <BottleCap label="itala" size="lg" onClick={handleAddExpense} />
              </div>
            </div>
          </NeuCard>
        </div>
      )}

      {/* Payment confirmation modal */}
      {showPayment && (
        <PaymentModal
          groupId={groupId}
          sessionId={sessionId}
          members={members}
          balances={balances}
          payments={payments}
          currentUserId={profile?.id ?? ''}
          onClose={() => setShowPayment(false)}
          onChanged={() => { load(); setToast('Na-claim ang payment.'); }}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// Payment confirmation sub-component
function PaymentModal({
  groupId,
  sessionId,
  members,
  balances,
  payments,
  currentUserId,
  onClose,
  onChanged,
}: {
  groupId: string;
  sessionId: string;
  members: Array<GroupMember & { profile: Profile }>;
  balances: Map<string, number>;
  payments: Payment[];
  currentUserId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [toast, setToast] = useState<string | null>(null);

  // Pending payments where current user is receiver
  const pendingForMe = payments.filter((p) => p.status === 'pending' && p.receiver_id === currentUserId);
  const pendingFromMe = payments.filter((p) => p.status === 'pending' && p.payer_id === currentUserId);

  // I owe money to people with positive balance
  const myBalance = balances.get(currentUserId) ?? 0;
  const iOwe = myBalance < 0;
  const creditors = members.filter((m) => (balances.get(m.user_id) ?? 0) > 0);

  async function claimPayment(receiverId: string, amount: number) {
    const { error } = await supabase.from('payments').insert({
      group_id: groupId,
      payer_id: currentUserId,
      receiver_id: receiverId,
      amount_centavos: amount,
      status: 'pending',
      session_id: sessionId,
    });
    if (error) {
      setToast('Hindi nagawa ang claim. Subukan ulit.');
      return;
    }
    setToast('Nag-tap ka ng "Nagbayad na ako". Hintayin ang confirmation.');
    onChanged();
  }

  async function confirmPayment(paymentId: string) {
    await supabase.from('payments').update({ status: 'confirmed' }).eq('id', paymentId);
    setToast('Na-confirm ang payment.');
    onChanged();
  }

  async function disputePayment(paymentId: string) {
    const note = prompt('Ano ang problema?') ?? '';
    if (!note.trim()) return;
    await supabase.from('payments').update({ status: 'disputed', dispute_note: note }).eq('id', paymentId);
    setToast('Na-dispute ang payment.');
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <NeuCard className="w-full max-w-sm max-h-[90vh] overflow-y-auto no-scrollbar" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-bold" style={{ color: 'var(--text)' }}>Settle payments</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--surface)', boxShadow: 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)' }}>
            <X size={16} style={{ color: 'var(--text)' }} />
          </button>
        </div>

        {/* I owe money */}
        {iOwe && (
          <div className="mb-4">
            <h3 className="text-xs font-heading font-semibold mb-2" style={{ color: 'var(--red)' }}>Utang mo</h3>
            <div className="space-y-2">
              {creditors.map((c) => {
                const owed = Math.abs(Math.min(0, myBalance + (balances.get(c.user_id) ?? 0)));
                const amount = Math.min(Math.abs(myBalance), balances.get(c.user_id) ?? 0);
                if (amount <= 0) return null;
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-[14px]" style={{ background: 'var(--surface)', boxShadow: 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{c.profile?.avatar_emoji}</span>
                      <span className="text-sm font-heading font-semibold" style={{ color: 'var(--text)' }}>{c.profile?.display_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-heading font-bold" style={{ color: 'var(--red)' }}>{formatPesos(amount)}</span>
                      <BottleCap label="bayad" size="md" color="green" onClick={() => claimPayment(c.user_id, amount)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending payments I need to confirm */}
        {pendingForMe.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-heading font-semibold mb-2" style={{ color: 'var(--amber)' }}>Kailangan i-confirm</h3>
            <div className="space-y-2">
              {pendingForMe.map((p) => (
                <div key={p.id} className="p-3 rounded-[14px]" style={{ background: 'var(--surface)', boxShadow: 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{p.payer_profile?.avatar_emoji}</span>
                      <span className="text-sm" style={{ color: 'var(--text)' }}>{p.payer_profile?.display_name}</span>
                    </div>
                    <span className="font-heading font-bold text-sm" style={{ color: 'var(--green-light)' }}>{formatPesos(p.amount_centavos)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => confirmPayment(p.id)} className="flex-1 py-2 rounded-[14px] text-sm font-heading font-semibold flex items-center justify-center gap-1" style={{ background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--green-light)' }}>
                      <Check size={14} /> Confirm
                    </button>
                    <button onClick={() => disputePayment(p.id)} className="flex-1 py-2 rounded-[14px] text-sm font-heading font-semibold flex items-center justify-center gap-1" style={{ background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--red)' }}>
                      <AlertTriangle size={14} /> Dispute
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payments I've claimed */}
        {pendingFromMe.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-heading font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Nagbayad ka na, naghihintay ng confirm</h3>
            <div className="space-y-2">
              {pendingFromMe.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-[14px]" style={{ background: 'var(--surface)', boxShadow: 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{p.receiver_profile?.avatar_emoji}</span>
                    <span className="text-sm" style={{ color: 'var(--text)' }}>→ {p.receiver_profile?.display_name}</span>
                  </div>
                  <span className="text-sm font-heading font-bold" style={{ color: 'var(--amber)' }}>{formatPesos(p.amount_centavos)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!iOwe && pendingForMe.length === 0 && pendingFromMe.length === 0 && (
          <p className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>Wala pang payments. Hatian na!</p>
        )}

        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </NeuCard>
    </div>
  );
}
