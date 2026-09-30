import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/nav';
import { NeuCard, NeuInput, NeuButton } from '@/components/Neu';
import { BottleCap } from '@/components/BottleCap';
import { Toast } from '@/components/Glass';
import type { Spot, GroupMember, Profile } from '@/lib/types';
import { ArrowLeft, Car } from 'lucide-react';

export function CreateSessionScreen({ groupId }: { groupId: string }) {
  const { profile } = useAuth();
  const { navigate, back } = useNav();
  const [spots, setSpots] = useState<Spot[]>([]);
  const [members, setMembers] = useState<Array<GroupMember & { profile: Profile }>>([]);
  const [title, setTitle] = useState('Inuman');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('20:00');
  const [spotId, setSpotId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('spots').select('*').eq('group_id', groupId).order('name').then(({ data }) => setSpots((data as Spot[]) ?? []));
    supabase
      .from('group_members')
      .select('*, profile:profiles!group_members_user_id_fkey(*)')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('joined_at')
      .then(({ data }) => setMembers((data as Array<GroupMember & { profile: Profile }>) ?? []));
  }, [groupId]);

  async function handleCreate() {
    if (!profile) return;
    setBusy(true);

    // Default uwian deadline: 4 hours after session time
    const deadline = new Date(`${date}T${time}:00`);
    deadline.setHours(deadline.getHours() + 4);

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        group_id: groupId,
        spot_id: spotId,
        title: title.trim() || 'Inuman',
        session_date: date,
        session_time: time,
        status: 'planned',
        designated_driver: driverId,
        uwian_deadline: deadline.toISOString(),
        created_by: profile.id,
      })
      .select()
      .single();

    if (error || !data) {
      setToast('Hindi nagawa ang session. Subukan ulit.');
      setBusy(false);
      return;
    }

    // Auto-RSVP going for creator
    await supabase.from('rsvps').insert({
      session_id: data.id,
      user_id: profile.id,
      response: 'going',
    });

    setToast('Gumawa ng session.');
    setBusy(false);
    navigate({ name: 'sessionDetail', groupId, sessionId: data.id });
  }

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={back} className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center active:neu-pressed">
          <ArrowLeft size={20} style={{ color: 'var(--text)' }} />
        </button>
        <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--text)' }}>Bagong session</h1>
      </div>

      <div className="space-y-4">
        <NeuCard>
          <div className="space-y-4">
            <NeuInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday night inuman" />
            <div className="grid grid-cols-2 gap-3">
              <NeuInput label="Petsa" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <NeuInput label="Oras" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
        </NeuCard>

        <NeuCard>
          <span className="block mb-3 text-sm font-heading font-semibold text-[var(--text-muted)]">Saan?</span>
          <div className="space-y-2">
            <button
              onClick={() => setSpotId(null)}
              className="w-full text-left px-4 py-3 rounded-[14px] font-heading font-semibold text-sm transition-all"
              style={spotId === null ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)', color: 'var(--amber)' } : { background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--text)' }}
            >
              Walang spot pa
            </button>
            {spots.map((s) => (
              <button
                key={s.id}
                onClick={() => setSpotId(s.id)}
                className="w-full text-left px-4 py-3 rounded-[14px] font-heading font-semibold text-sm transition-all flex items-center justify-between"
                style={spotId === s.id ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)', color: 'var(--amber)' } : { background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--text)' }}
              >
                <span>{s.name}</span>
                {s.verified && <span className="led led-green" />}
              </button>
            ))}
            {spots.length === 0 && (
              <p className="text-xs px-4" style={{ color: 'var(--text-muted)' }}>Wala pang spot. Pumunta sa tambayan map para mag-add.</p>
            )}
          </div>
        </NeuCard>

        <NeuCard>
          <div className="flex items-center gap-2 mb-3">
            <Car size={18} style={{ color: 'var(--amber)' }} />
            <span className="text-sm font-heading font-semibold text-[var(--text-muted)]">Designated driver?</span>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => setDriverId(null)}
              className="w-full text-left px-4 py-3 rounded-[14px] font-heading font-semibold text-sm transition-all"
              style={driverId === null ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)', color: 'var(--amber)' } : { background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--text)' }}
            >
              Wala
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setDriverId(m.user_id)}
                className="w-full text-left px-4 py-3 rounded-[14px] font-heading font-semibold text-sm transition-all flex items-center gap-2"
                style={driverId === m.user_id ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)', color: 'var(--amber)' } : { background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--text)' }}
              >
                <span>{m.profile?.avatar_emoji}</span>
                <span>{m.profile?.display_name}</span>
                {driverId === m.user_id && <span className="led led-green ml-auto" />}
              </button>
            ))}
          </div>
        </NeuCard>

        <div className="flex justify-center pt-2">
          <BottleCap label="gawin" size="lg" onClick={handleCreate} disabled={busy} />
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
