import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/nav';
import { NeuCard, NeuButton } from '@/components/Neu';
import { BottleCap } from '@/components/BottleCap';
import { Toast } from '@/components/Glass';
import type { Group, GroupMember, Vouch, Profile } from '@/lib/types';
import { ArrowLeft, Copy, Check } from 'lucide-react';

export function VouchQueueScreen({ groupId }: { groupId: string }) {
  const { profile } = useAuth();
  const { back } = useNav();
  const [group, setGroup] = useState<Group | null>(null);
  const [pendingMembers, setPendingMembers] = useState<Array<{ member: GroupMember; profile: Profile; vouches: Vouch[] }>>([]);
  const [activeMembers, setActiveMembers] = useState<GroupMember[]>([]);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).maybeSingle();
    setGroup(g as Group | null);

    const { data: active } = await supabase
      .from('group_members')
      .select('*, profile:profiles!group_members_user_id_fkey(*)')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('joined_at');
    setActiveMembers((active as GroupMember[]) ?? []);

    const { data: pending } = await supabase
      .from('group_members')
      .select('*, profile:profiles!group_members_user_id_fkey(*)')
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('joined_at');

    const pendingList: Array<{ member: GroupMember; profile: Profile; vouches: Vouch[] }> = [];
    for (const pm of (pending as GroupMember[]) ?? []) {
      const { data: vouches } = await supabase
        .from('vouches')
        .select('*, voucher_profile:profiles!vouches_voucher_id_fkey(*)')
        .eq('group_id', groupId)
        .eq('candidate_id', pm.user_id);
      pendingList.push({ member: pm, profile: pm.profile!, vouches: (vouches as Vouch[]) ?? [] });
    }
    setPendingMembers(pendingList);
    setLoading(false);
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  async function handleVouch(candidateId: string) {
    if (!profile) return;
    const { error } = await supabase.from('vouches').insert({
      group_id: groupId,
      voucher_id: profile.id,
      candidate_id: candidateId,
    });

    if (error) {
      setToast('Nag-vouch ka na ba para sa taong ito?');
      return;
    }

    // Check if enough vouches
    const { data: vouches } = await supabase
      .from('vouches')
      .select('id')
      .eq('group_id', groupId)
      .eq('candidate_id', candidateId);

    if (group && vouches && vouches.length >= group.vouches_required) {
      await supabase.from('group_members')
        .update({ status: 'active' })
        .eq('group_id', groupId)
        .eq('user_id', candidateId);
      setToast('Na-vouch at kasali na sa barkada.');
    } else {
      setToast(`Na-vouch. Kailangan pa ng ${group!.vouches_required - (vouches?.length ?? 0)} vouch.`);
    }
    load();
  }

  function copyInvite() {
    if (group) {
      navigator.clipboard.writeText(group.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Naglo-load...</div>;

  const myVouches = new Set<string>();

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={back} className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center active:neu-pressed">
          <ArrowLeft size={20} style={{ color: 'var(--text)' }} />
        </button>
        <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--text)' }}>Vouch queue</h1>
      </div>

      {/* Invite code */}
      <NeuCard className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Invite code</p>
            <p className="font-heading font-bold text-lg tracking-widest" style={{ color: 'var(--amber)' }}>{group?.invite_code}</p>
          </div>
          <button onClick={copyInvite} className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center active:neu-pressed">
            {copied ? <Check size={20} style={{ color: 'var(--green-light)' }} /> : <Copy size={20} style={{ color: 'var(--text)' }} />}
          </button>
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          I-share ang code. Kailangan ng {group?.vouches_required} vouch{group && group.vouches_required > 1 ? 'es' : ''} bago makasali.
        </p>
      </NeuCard>

      {/* Pending members */}
      <h2 className="text-sm font-heading font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Naghintay ng vouch</h2>
      {pendingMembers.length === 0 ? (
        <NeuCard className="text-center py-8">
          <p className="font-heading font-semibold" style={{ color: 'var(--text)' }}>Wala pang naghihintay.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>I-share ang invite code sa barkada.</p>
        </NeuCard>
      ) : (
        <div className="space-y-3">
          {pendingMembers.map(({ member, profile: p, vouches }) => {
            const myVouched = vouches.some((v) => v.voucher_id === profile?.id);
            const needed = (group?.vouches_required ?? 1) - vouches.length;
            return (
              <NeuCard key={member.id}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 neu-circle-raised flex items-center justify-center text-xl">{p.avatar_emoji}</div>
                    <div>
                      <h3 className="font-heading font-bold" style={{ color: 'var(--text)' }}>{p.display_name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        {Array.from({ length: group?.vouches_required ?? 1 }).map((_, i) => (
                          <span key={i} className={`led ${i < vouches.length ? 'led-green' : 'led-off'}`} />
                        ))}
                        <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>{vouches.length}/{group?.vouches_required}</span>
                      </div>
                    </div>
                  </div>
                  {!myVouched && (
                    <BottleCap label="vouch" size="md" onClick={() => handleVouch(member.user_id)} />
                  )}
                  {myVouched && (
                    <span className="flex items-center gap-1 text-xs font-heading font-semibold" style={{ color: 'var(--green-light)' }}>
                      <Check size={14} /> Vouched
                    </span>
                  )}
                </div>
                {vouches.length > 0 && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Na-vouch ni: {vouches.map((v) => v.voucher_profile?.display_name).join(', ')}
                  </div>
                )}
                {needed > 0 && (
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Kailangan pa ng {needed} vouch{needed > 1 ? 'es' : ''}.
                  </div>
                )}
              </NeuCard>
            );
          })}
        </div>
      )}

      {/* Active members list */}
      <h2 className="text-sm font-heading font-semibold mt-6 mb-3" style={{ color: 'var(--text-muted)' }}>Mga kasali ({activeMembers.length})</h2>
      <NeuCard inset>
        <div className="space-y-2">
          {activeMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-1">
              <span className="text-xl">{m.profile?.avatar_emoji}</span>
              <span className="font-heading font-semibold text-sm" style={{ color: 'var(--text)' }}>{m.profile?.display_name}</span>
              {m.role === 'admin' && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--amber)', color: '#000' }}>admin</span>}
            </div>
          ))}
        </div>
      </NeuCard>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
