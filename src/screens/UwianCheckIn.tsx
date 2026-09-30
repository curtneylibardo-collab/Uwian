import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/nav';
import { NeuCard } from '@/components/Neu';
import { BottleCap } from '@/components/BottleCap';
import { Latch } from '@/components/Latch';
import { Coaster } from '@/components/Coaster';
import { Toast } from '@/components/Glass';
import type { Session, GroupMember, Profile, UwianCheckin, DirectionTag, TransportType } from '@/lib/types';
import { ArrowLeft, Footprints, Car, Users, Navigation, AlertTriangle } from 'lucide-react';
import { minsSince, minsUntil, relativeTime } from '@/lib/utils';

const transportOptions: Array<{ value: TransportType; label: string; icon: typeof Footprints }> = [
  { value: 'walk', label: 'Lakad', icon: Footprints },
  { value: 'ride', label: 'Sakay', icon: Car },
  { value: 'taxi', label: 'Taxi', icon: Navigation },
  { value: 'designated_driver', label: 'Driver', icon: Car },
];

export function UwianCheckInScreen({ groupId, sessionId }: { groupId: string; sessionId: string }) {
  const { profile } = useAuth();
  const { back } = useNav();
  const [session, setSession] = useState<Session | null>(null);
  const [members, setMembers] = useState<Array<GroupMember & { profile: Profile }>>([]);
  const [checkins, setCheckins] = useState<UwianCheckin[]>([]);
  const [directionTags, setDirectionTags] = useState<DirectionTag[]>([]);
  const [myCheckin, setMyCheckin] = useState<UwianCheckin | null>(null);
  const [myTransport, setMyTransport] = useState<TransportType | null>(null);
  const [myDirection, setMyDirection] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: s } = await supabase
      .from('sessions')
      .select('*')
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

    const { data: dt } = await supabase
      .from('group_direction_tags')
      .select('*')
      .eq('group_id', groupId)
      .order('sort_order');
    setDirectionTags((dt as DirectionTag[]) ?? []);

    const { data: ci } = await supabase
      .from('uwian_checkins')
      .select('*, profile:profiles!uwian_checkins_user_id_fkey(*), buddy_profile:profiles!uwian_checkins_buddy_id_fkey(*)')
      .eq('session_id', sessionId);
    setCheckins((ci as UwianCheckin[]) ?? []);

    if (profile) {
      const mine = (ci as UwianCheckin[])?.find((c) => c.user_id === profile.id);
      setMyCheckin(mine ?? null);
      setMyTransport(mine?.transport ?? null);
      setMyDirection(mine?.direction_tag ?? null);
    }

    setLoading(false);
  }, [sessionId, groupId, profile]);

  useEffect(() => { load(); }, [load]);

  async function handleTransport(t: TransportType) {
    setMyTransport(t);
    if (myCheckin) {
      await supabase.from('uwian_checkins').update({ transport: t }).eq('id', myCheckin.id);
    }
  }

  async function handleDirection(tag: string) {
    setMyDirection(tag);
    if (myCheckin) {
      await supabase.from('uwian_checkins').update({ direction_tag: tag }).eq('id', myCheckin.id);
    }
  }

  async function handleLatched() {
    if (!profile || !myTransport) {
      setToast('Piliin muna kung paano ka uuwi.');
      return;
    }

    // Find a buddy with the same direction tag
    let buddyId: string | null = null;
    if (myDirection) {
      const potentialBuddies = checkins.filter(
        (c) => c.direction_tag === myDirection && c.user_id !== profile.id && !c.confirmed,
      );
      if (potentialBuddies.length > 0) {
        buddyId = potentialBuddies[0].user_id;
      }
    }

    if (myCheckin) {
      await supabase.from('uwian_checkins').update({
        confirmed: true,
        confirmed_at: new Date().toISOString(),
        buddy_id: buddyId,
      }).eq('id', myCheckin.id);
    } else {
      await supabase.from('uwian_checkins').insert({
        session_id: sessionId,
        user_id: profile.id,
        transport: myTransport,
        direction_tag: myDirection,
        buddy_id: buddyId,
        confirmed: true,
        confirmed_at: new Date().toISOString(),
      });
    }

    setToast('Nakauwi na ako. Stay safe!');
    load();
  }

  // Find my buddy
  const myBuddy = myCheckin?.buddy_id
    ? members.find((m) => m.user_id === myCheckin.buddy_id)?.profile
    : null;

  // Find who hasn't confirmed
  const confirmedIds = new Set(checkins.filter((c) => c.confirmed).map((c) => c.user_id));
  const notConfirmed = members.filter((m) => !confirmedIds.has(m.user_id));

  // Check deadline status
  const deadline = session?.uwian_deadline;
  const minsOverdue = deadline ? minsSince(deadline) : 0;
  const minsLeft = deadline ? minsUntil(deadline) : 0;
  const isOverdue = minsOverdue > 0;

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Naglo-load...</div>;

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={back} className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center active:neu-pressed">
          <ArrowLeft size={20} style={{ color: 'var(--text)' }} />
        </button>
        <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--text)' }}>Uwian check-in</h1>
      </div>

      {/* Deadline alert */}
      {deadline && (
        <div
          className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3"
          style={{
            background: isOverdue ? 'var(--red)' : 'var(--surface)',
            boxShadow: isOverdue ? 'none' : '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)',
          }}
        >
          {isOverdue ? (
            <>
              <AlertTriangle size={20} color="white" />
              <span className="text-sm font-heading font-semibold text-white">
                Lampas na sa deadline ng {minsOverdue} min.
              </span>
            </>
          ) : (
            <>
              <span className="led led-amber" />
              <span className="text-sm font-heading font-semibold" style={{ color: 'var(--text)' }}>
                {minsLeft > 0 ? `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m pa bago deadline.` : 'Deadline na.'}
              </span>
            </>
          )}
        </div>
      )}

      {/* My check-in form */}
      {!myCheckin?.confirmed && (
        <NeuCard className="mb-4">
          <h2 className="text-sm font-heading font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Sino ang maghahatid?</h2>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {transportOptions.map((t) => {
              const Icon = t.icon;
              const selected = myTransport === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => handleTransport(t.value)}
                  className="flex flex-col items-center gap-1 py-3 rounded-[14px] transition-all"
                  style={selected
                    ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)', color: 'var(--amber)' }
                    : { background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--text)' }}
                >
                  <Icon size={20} />
                  <span className="text-xs font-heading font-semibold">{t.label}</span>
                </button>
              );
            })}
          </div>

          {directionTags.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-heading font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Saan papunta?</h3>
              <div className="flex flex-wrap gap-2">
                {directionTags.map((dt) => {
                  const selected = myDirection === dt.tag;
                  return (
                    <button
                      key={dt.id}
                      onClick={() => handleDirection(dt.tag)}
                      className="px-3 py-2 rounded-[14px] text-sm font-heading font-semibold transition-all"
                      style={selected
                        ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)', color: 'var(--amber)' }
                        : { background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--text)' }}
                    >
                      {dt.tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2">
            <Latch
              onLatched={handleLatched}
              label="I-slide para makauwi"
              latchedLabel="Nakauwi na ako"
              disabled={!myTransport}
            />
          </div>
        </NeuCard>
      )}

      {/* My buddy card */}
      {myCheckin?.confirmed && myBuddy && (
        <NeuCard className="mb-4">
          <div className="flex items-center gap-3">
            <Users size={24} style={{ color: 'var(--green-light)' }} />
            <div>
              <h3 className="font-heading font-semibold text-sm" style={{ color: 'var(--text)' }}>Buddy mo</h3>
              <p className="text-base font-heading font-bold" style={{ color: 'var(--green-light)' }}>
                {myBuddy.avatar_emoji} {myBuddy.display_name}
              </p>
              {myCheckin.direction_tag && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Parehas kayong {myCheckin.direction_tag}</p>
              )}
            </div>
          </div>
        </NeuCard>
      )}

      {/* My confirmed status */}
      {myCheckin?.confirmed && (
        <NeuCard className="mb-4 text-center" inset>
          <span className="led led-green" style={{ width: 16, height: 16 }} />
          <p className="font-heading font-bold text-lg mt-2" style={{ color: 'var(--green-light)' }}>Nakauwi na ako</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{relativeTime(myCheckin.confirmed_at)}</p>
        </NeuCard>
      )}

      {/* Members as coasters with status */}
      <h2 className="text-sm font-heading font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Sino na ang nakauwi?</h2>
      <div className="flex flex-wrap gap-3 justify-center mb-4">
        {members.map((m) => {
          const ci = checkins.find((c) => c.user_id === m.user_id);
          const status = ci?.confirmed ? 'home' : ci ? 'traveling' : 'not_confirmed';
          return (
            <Coaster
              key={m.id}
              profile={m.profile!}
              status={status as any}
              size="sm"
              label={m.profile?.display_name}
              sublabel={ci?.confirmed ? 'nakauwi' : ci ? 'may check-in' : 'wala pa'}
            />
          );
        })}
      </div>

      {/* Not confirmed warning */}
      {notConfirmed.length > 0 && isOverdue && minsOverdue >= 30 && (
        <div className="glass rounded-2xl px-4 py-3 mb-4 flex items-center gap-3" style={{ borderColor: 'var(--red)' }}>
          <AlertTriangle size={20} style={{ color: 'var(--red)' }} />
          <div className="text-sm" style={{ color: 'var(--text)' }}>
            <span className="font-heading font-semibold">May hindi pa nakakauwi: </span>
            <span>{notConfirmed.map((m) => m.profile?.display_name).join(', ')}</span>
            {minsOverdue >= 60 && (
              <p className="text-xs mt-1" style={{ color: 'var(--red)' }}>Lampas 60 min na. Flag sa group page.</p>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
