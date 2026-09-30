import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/nav';
import { NeuCard, NeuButton } from '@/components/Neu';
import { BottleCap } from '@/components/BottleCap';
import { Toast } from '@/components/Glass';
import type { Group, GroupMember } from '@/lib/types';
import { Users, Plus, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';

export function MyGroupsScreen() {
  const { profile, signOut } = useAuth();
  const { navigate } = useNav();
  const { theme, toggleTheme } = useTheme();
  const [groups, setGroups] = useState<Array<{ group: Group; members: GroupMember[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [vouches, setVouches] = useState<1 | 2>(1);
  const [toast, setToast] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    if (!profile) return;
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, status')
      .eq('user_id', profile.id)
      .eq('status', 'active');

    if (!memberships || memberships.length === 0) {
      setLoading(false);
      return;
    }

    const groupIds = memberships.map((m) => m.group_id);
    const { data: groupData } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds);

    const result: Array<{ group: Group; members: GroupMember[] }> = [];
    for (const g of groupData ?? []) {
      const { data: members } = await supabase
        .from('group_members')
        .select('*, profile:profiles!group_members_user_id_fkey(*)')
        .eq('group_id', g.id)
        .eq('status', 'active');
      result.push({ group: g as Group, members: (members as GroupMember[]) ?? [] });
    }
    setGroups(result);
    setLoading(false);
  }

  async function handleCreate() {
    if (!profile || !newName.trim()) return;
    const { data, error } = await supabase
      .from('groups')
      .insert({ name: newName.trim(), vouches_required: vouches, created_by: profile.id })
      .select()
      .single();

    if (error || !data) {
      setToast('Hindi nagawa ang group. Subukan ulit.');
      return;
    }

    await supabase.from('group_members').insert({
      group_id: data.id,
      user_id: profile.id,
      role: 'admin',
      status: 'active',
    });

    setShowCreate(false);
    setNewName('');
    setToast('Gumawa ng bagong barkada group.');
    loadGroups();
  }

  async function handleJoin() {
    if (!profile || !joinCode.trim()) return;
    const { data: group } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', joinCode.trim().toUpperCase())
      .maybeSingle();

    if (!group) {
      setToast('Walang group na may ganyang invite code.');
      return;
    }

    const { error } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: profile.id,
      role: 'member',
      status: 'pending',
    });

    if (error) {
      setToast('Baka kasali ka na, o naghintay pa ng vouch.');
      return;
    }

    setShowJoin(false);
    setJoinCode('');
    setToast('Naghintay ng vouch mula sa mga miyembro.');
  }

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 neu-circle-raised flex items-center justify-center text-2xl">
            {profile?.avatar_emoji}
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--text)' }}>{profile?.display_name}</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Mga barkada group</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleTheme}
            className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center active:neu-pressed"
            aria-label="Toggle theme"
          >
            {theme === 'night' ? <Sun size={20} style={{ color: 'var(--amber)' }} /> : <Moon size={20} style={{ color: 'var(--amber)' }} />}
          </button>
          <button
            onClick={() => { signOut(); }}
            className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center text-xs font-heading font-semibold active:neu-pressed"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Log out"
          >
            out
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>Naglo-load...</div>
      ) : groups.length === 0 ? (
        <NeuCard className="text-center py-12">
          <Users size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="font-heading font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>Wala pang group.</p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Gumawa ng bagong barkada group, o mag-join gamit ang invite code.</p>
        </NeuCard>
      ) : (
        <div className="space-y-4">
          {groups.map(({ group, members }) => (
            <NeuCard key={group.id} className="cursor-pointer active:neu-pressed" onClick={() => navigate({ name: 'groupHome', groupId: group.id })}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-heading font-bold" style={{ color: 'var(--text)' }}>{group.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{members.length} miyembro</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{group.vouches_required} vouch{group.vouches_required > 1 ? 'es' : ''}</span>
                  </div>
                </div>
                <div className="flex -space-x-2">
                  {members.slice(0, 4).map((m) => (
                    <div key={m.id} className="w-9 h-9 rounded-full flex items-center justify-center text-sm border-2" style={{ background: 'var(--surface)', borderColor: 'var(--surface)', boxShadow: '2px 2px 4px var(--shadow-dark)' }}>
                      {m.profile?.avatar_emoji}
                    </div>
                  ))}
                </div>
              </div>
            </NeuCard>
          ))}
        </div>
      )}

      <div className="flex gap-3 justify-center mt-6">
        <NeuButton onClick={() => setShowCreate(true)}>
          <span className="flex items-center gap-2"><Plus size={18} /> Bagong group</span>
        </NeuButton>
        <NeuButton onClick={() => setShowJoin(true)}>
          <span className="flex items-center gap-2">May invite code</span>
        </NeuButton>
      </div>

      <div className="mt-6">
        <BottleCap label="hatian" color="green" size="lg" onClick={() => profile && navigate({ name: 'hangganan' })} />
        <p className="text-center text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Hangganan (private)</p>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowCreate(false)}>
          <NeuCard className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-heading font-bold mb-4" style={{ color: 'var(--text)' }}>Bagong barkada group</h2>
            <div className="space-y-4">
              <NeuCard inset small className="block">
                <label className="block mb-2 text-sm font-heading font-semibold text-[var(--text-muted)]">Pangalan ng group</label>
                <input className="w-full bg-transparent outline-none text-[var(--text)]" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tropa Nights" autoFocus />
              </NeuCard>
              <div>
                <span className="block mb-2 text-sm font-heading font-semibold text-[var(--text-muted)]">Ilang vouch para makasali?</span>
                <div className="flex gap-2">
                  {[1, 2].map((n) => (
                    <button key={n} onClick={() => setVouches(n as 1 | 2)} className="flex-1 py-3 rounded-[14px] font-heading font-semibold transition-all"
                      style={vouches === n ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)', color: 'var(--amber)' } : { background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--text)' }}>
                      {n} vouch{n > 1 ? 'es' : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-center pt-2">
                <BottleCap label="gawa" size="lg" onClick={handleCreate} />
              </div>
            </div>
          </NeuCard>
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowJoin(false)}>
          <NeuCard className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-heading font-bold mb-4" style={{ color: 'var(--text)' }}>Mag-join gamit ang invite code</h2>
            <input className="neu-inset w-full px-4 py-3 text-center text-lg font-heading font-bold uppercase tracking-widest text-[var(--text)] outline-none mb-4" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="TROPA123" autoFocus />
            <div className="flex justify-center">
              <BottleCap label="sali" size="lg" onClick={handleJoin} />
            </div>
          </NeuCard>
        </div>
      )}
    </div>
  );
}
