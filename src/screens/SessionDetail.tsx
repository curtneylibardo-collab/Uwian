import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/nav';
import { NeuCard } from '@/components/Neu';
import { BottleCap } from '@/components/BottleCap';
import { RsvpSwitch } from '@/components/RsvpSwitch';
import { Coaster } from '@/components/Coaster';
import { Toast } from '@/components/Glass';
import type { Session, Rsvp, GroupMember, Profile, Spot, RsvpResponse } from '@/lib/types';
import { ArrowLeft, MapPin, Car, Clock, Receipt, Home } from 'lucide-react';
import { formatDate, formatTime, formatPesos } from '@/lib/utils';

export function SessionDetailScreen({ groupId, sessionId }: { groupId: string; sessionId: string }) {
  const { profile } = useAuth();
  const { navigate, back } = useNav();
  const [session, setSession] = useState<Session | null>(null);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [members, setMembers] = useState<Array<GroupMember & { profile: Profile }>>([]);
  const [myRsvp, setMyRsvp] = useState<RsvpResponse>('maybe');
  const [totalSpent, setTotalSpent] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    setMembers((m as Array<GroupMember & { profile: Profile }>) ?? []);

    const { data: r } = await supabase
      .from('rsvps')
      .select('*, profile:profiles!rsvps_user_id_fkey(*)')
      .eq('session_id', sessionId);
    setRsvps((r as Rsvp[]) ?? []);

    if (profile) {
      const mine = (r as Rsvp[])?.find((rv) => rv.user_id === profile.id);
      setMyRsvp(mine?.response ?? 'maybe');
    }

    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount_centavos')
      .eq('session_id', sessionId);
    setTotalSpent((expenses ?? []).reduce((sum, e) => sum + e.amount_centavos, 0));

    setLoading(false);
  }, [sessionId, groupId, profile]);

  useEffect(() => { load(); }, [load]);

  async function handleRsvp(response: RsvpResponse) {
    if (!profile) return;
    setMyRsvp(response);
    const { error } = await supabase
      .from('rsvps')
      .upsert({ session_id: sessionId, user_id: profile.id, response, updated_at: new Date().toISOString() }, { onConflict: 'session_id,user_id' });
    if (error) {
      setToast('Hindi nagawa ang RSVP. Subukan ulit.');
      setMyRsvp(myRsvp);
    }
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Naglo-load...</div>;

  const rsvpMap = new Map(rsvps.map((r) => [r.user_id, r.response]));
  const goingMembers = members.filter((m) => rsvpMap.get(m.user_id) === 'going');
  const maybeMembers = members.filter((m) => rsvpMap.get(m.user_id) === 'maybe');
  const cantMembers = members.filter((m) => rsvpMap.get(m.user_id) === 'cant');

  const driver = members.find((m) => m.user_id === session?.designated_driver);

  const statusLed: Record<string, { led: string; label: string }> = {
    going: { led: 'led-green', label: 'Going' },
    maybe: { led: 'led-amber', label: 'Maybe' },
    cant: { led: 'led-red', label: "Can't" },
  };

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={back} className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center active:neu-pressed">
          <ArrowLeft size={20} style={{ color: 'var(--text)' }} />
        </button>
        <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--text)' }}>{session?.title}</h1>
      </div>

      {/* Session info */}
      <NeuCard className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <Clock size={18} style={{ color: 'var(--amber)' }} />
          <span className="font-heading font-semibold" style={{ color: 'var(--text)' }}>
            {formatDate(session?.session_date ?? '')} · {formatTime(session?.session_time ?? '')}
          </span>
        </div>
        {session?.spot && (
          <div className="flex items-center gap-3 mb-3">
            <MapPin size={18} style={{ color: 'var(--amber)' }} />
            <span className="font-heading font-semibold" style={{ color: 'var(--text)' }}>{session.spot.name}</span>
          </div>
        )}
        {driver && (
          <div className="flex items-center gap-3">
            <Car size={18} style={{ color: 'var(--green-light)' }} />
            <span className="font-heading font-semibold text-sm" style={{ color: 'var(--text)' }}>
              Driver: {driver.profile?.display_name}
            </span>
          </div>
        )}
        {session?.status === 'live' && (
          <div className="mt-3 flex items-center gap-2">
            <span className="led led-green" />
            <span className="text-sm font-heading font-semibold" style={{ color: 'var(--green-light)' }}>Live ngayon</span>
          </div>
        )}
      </NeuCard>

      {/* RSVP */}
      <NeuCard className="mb-4">
        <h2 className="text-sm font-heading font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Ikaw ba, kasama?</h2>
        <RsvpSwitch value={myRsvp} onChange={handleRsvp} />
      </NeuCard>

      {/* Members by RSVP */}
      <NeuCard className="mb-4">
        <h2 className="text-sm font-heading font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Mga sagot</h2>
        {goingMembers.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="led led-green" />
              <span className="text-xs font-heading font-semibold" style={{ color: 'var(--green-light)' }}>Going ({goingMembers.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {goingMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'var(--surface)', boxShadow: 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)' }}>
                  <span className="text-sm">{m.profile?.avatar_emoji}</span>
                  <span className="text-xs font-heading font-semibold" style={{ color: 'var(--text)' }}>{m.profile?.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {maybeMembers.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="led led-amber" />
              <span className="text-xs font-heading font-semibold" style={{ color: 'var(--amber)' }}>Maybe ({maybeMembers.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {maybeMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'var(--surface)', boxShadow: 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)' }}>
                  <span className="text-sm">{m.profile?.avatar_emoji}</span>
                  <span className="text-xs font-heading font-semibold" style={{ color: 'var(--text)' }}>{m.profile?.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {cantMembers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="led led-red" />
              <span className="text-xs font-heading font-semibold" style={{ color: 'var(--red)' }}>Can't ({cantMembers.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {cantMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'var(--surface)', boxShadow: 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)' }}>
                  <span className="text-sm">{m.profile?.avatar_emoji}</span>
                  <span className="text-xs font-heading font-semibold" style={{ color: 'var(--text)' }}>{m.profile?.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </NeuCard>

      {/* Live tab summary */}
      {totalSpent > 0 && (
        <NeuCard className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Receipt size={20} style={{ color: 'var(--amber)' }} />
              <div>
                <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--text)' }}>Tab ngayon</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Gastos sa session</p>
              </div>
            </div>
            <span className="font-heading font-bold text-lg" style={{ color: 'var(--text)' }}>{formatPesos(totalSpent)}</span>
          </div>
        </NeuCard>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <BottleCap label="tab na" color="green" size="lg" onClick={() => navigate({ name: 'liveTab', groupId, sessionId })} />
        {session?.status === 'live' && (
          <BottleCap label="uwian" color="amber" size="lg" onClick={() => navigate({ name: 'uwian', groupId, sessionId })} />
        )}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
