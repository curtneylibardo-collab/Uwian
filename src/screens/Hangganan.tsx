import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/nav';
import { NeuCard } from '@/components/Neu';
import { TallyCounter } from '@/components/TallyCounter';
import { Toast } from '@/components/Glass';
import type { Hangganan } from '@/lib/types';
import { ArrowLeft, Lock, Home } from 'lucide-react';

export function HanggananScreen() {
  const { profile } = useAuth();
  const { back, navigate } = useNav();
  const [hangganan, setHangganan] = useState<Hangganan | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLimitEdit, setShowLimitEdit] = useState(false);
  const [newLimit, setNewLimit] = useState(5);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('hangganan')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();
    setHangganan(data as Hangganan | null);
    setNewLimit(data?.limit_max ?? 5);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  async function ensureHangganan(): Promise<Hangganan | null> {
    if (!profile) return null;
    if (hangganan) return hangganan;
    const { data, error } = await supabase
      .from('hangganan')
      .insert({ user_id: profile.id, count: 0, limit_max: 5 })
      .select()
      .single();
    if (error) return null;
    setHangganan(data as Hangganan);
    return data as Hangganan;
  }

  async function handleIncrement() {
    const h = await ensureHangganan();
    if (!h) return;
    const newCount = h.count + 1;
    const { data } = await supabase
      .from('hangganan')
      .update({ count: newCount, updated_at: new Date().toISOString() })
      .eq('id', h.id)
      .select()
      .single();
    if (data) setHangganan(data as Hangganan);
  }

  async function handleDecrement() {
    if (!hangganan || hangganan.count === 0) return;
    const newCount = hangganan.count - 1;
    const { data } = await supabase
      .from('hangganan')
      .update({ count: newCount, updated_at: new Date().toISOString() })
      .eq('id', hangganan.id)
      .select()
      .single();
    if (data) setHangganan(data as Hangganan);
  }

  async function handleReset() {
    if (!hangganan) return;
    const { data } = await supabase
      .from('hangganan')
      .update({ count: 0, updated_at: new Date().toISOString() })
      .eq('id', hangganan.id)
      .select()
      .single();
    if (data) {
      setHangganan(data as Hangganan);
      setToast('Reset ang counter.');
    }
  }

  async function handleSaveLimit() {
    const h = await ensureHangganan();
    if (!h) return;
    const { data } = await supabase
      .from('hangganan')
      .update({ limit_max: newLimit, updated_at: new Date().toISOString() })
      .eq('id', h.id)
      .select()
      .single();
    if (data) {
      setHangganan(data as Hangganan);
      setShowLimitEdit(false);
      setToast('Na-update ang limit.');
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Naglo-load...</div>;

  const count = hangganan?.count ?? 0;
  const limit = hangganan?.limit_max ?? 5;
  const atLimit = count >= limit;
  const nearLimit = count >= limit - 1 && count < limit;

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={back} className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center active:neu-pressed">
          <ArrowLeft size={20} style={{ color: 'var(--text)' }} />
        </button>
        <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--text)' }}>Hangganan</h1>
      </div>

      {/* Private label */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <Lock size={14} style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs font-heading font-semibold" style={{ color: 'var(--text-muted)' }}>Private lang ito. Ikaw lang ang nakakakita.</span>
      </div>

      {/* Tally counter */}
      <NeuCard className="mb-6 py-10">
        <TallyCounter
          count={count}
          limit={limit}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onReset={handleReset}
        />
      </NeuCard>

      {/* Edit limit */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => setShowLimitEdit(!showLimitEdit)}
          className="neu-raised-sm px-5 py-3 rounded-[14px] font-heading font-semibold text-sm active:neu-pressed"
          style={{ color: 'var(--text)' }}
        >
          Baguhin ang limit
        </button>

        {showLimitEdit && (
          <NeuCard inset small className="w-full max-w-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNewLimit(Math.max(1, newLimit - 1))}
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-heading font-bold active:neu-pressed"
                style={{ background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--text)' }}
              >
                −
              </button>
              <span className="flex-1 text-center font-heading font-extrabold text-3xl" style={{ color: 'var(--amber)' }}>{newLimit}</span>
              <button
                onClick={() => setNewLimit(Math.min(20, newLimit + 1))}
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-heading font-bold active:neu-pressed"
                style={{ background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--text)' }}
              >
                +
              </button>
            </div>
            <button
              onClick={handleSaveLimit}
              className="w-full mt-3 py-3 rounded-[14px] font-heading font-semibold text-sm active:neu-pressed"
              style={{ background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--green-light)' }}
            >
              I-save ang limit
            </button>
          </NeuCard>
        )}

        {/* Link to check-in when at/near limit */}
        {(atLimit || nearLimit) && (
          <button
            onClick={() => back()}
            className="flex items-center gap-2 text-sm font-heading font-semibold active:opacity-60"
            style={{ color: 'var(--amber)' }}
          >
            <Home size={16} /> Pumunta sa uwian check-in
          </button>
        )}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
