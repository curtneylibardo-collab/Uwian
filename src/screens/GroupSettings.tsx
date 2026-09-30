import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/nav';
import { NeuCard, NeuToggle } from '@/components/Neu';
import { BottleCap } from '@/components/BottleCap';
import { Toast } from '@/components/Glass';
import { useTheme } from '@/lib/theme';
import type { Group, DirectionTag } from '@/lib/types';
import { ArrowLeft, Plus, X, Moon, Sun, Tag } from 'lucide-react';

export function GroupSettingsScreen({ groupId }: { groupId: string }) {
  const { profile } = useAuth();
  const { back } = useNav();
  const { theme, toggleTheme } = useTheme();
  const [group, setGroup] = useState<Group | null>(null);
  const [directionTags, setDirectionTags] = useState<DirectionTag[]>([]);
  const [newTag, setNewTag] = useState('');
  const [vouches, setVouches] = useState<1 | 2>(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).maybeSingle();
    setGroup(g as Group | null);
    setVouches((g as Group)?.vouches_required ?? 1);

    const { data: dt } = await supabase
      .from('group_direction_tags')
      .select('*')
      .eq('group_id', groupId)
      .order('sort_order');
    setDirectionTags((dt as DirectionTag[]) ?? []);

    if (profile) {
      const { data: mem } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', profile.id)
        .maybeSingle();
      setIsAdmin(mem?.role === 'admin');
    }

    setLoading(false);
  }, [groupId, profile]);

  useEffect(() => { load(); }, [load]);

  async function handleAddTag() {
    if (!newTag.trim()) return;
    const maxOrder = directionTags.length > 0 ? Math.max(...directionTags.map((t) => t.sort_order)) : 0;
    const { data, error } = await supabase
      .from('group_direction_tags')
      .insert({ group_id: groupId, tag: newTag.trim(), sort_order: maxOrder + 1 })
      .select()
      .single();
    if (error) {
      setToast('Hindi nagawa ang tag. Subukan ulit.');
      return;
    }
    setDirectionTags([...directionTags, data as DirectionTag]);
    setNewTag('');
    setToast('Naitapon ang direction tag.');
  }

  async function handleDeleteTag(id: string) {
    await supabase.from('group_direction_tags').delete().eq('id', id);
    setDirectionTags(directionTags.filter((t) => t.id !== id));
    setToast('Tinanggal ang tag.');
  }

  async function handleSaveVouches() {
    if (!group) return;
    const { error } = await supabase
      .from('groups')
      .update({ vouches_required: vouches })
      .eq('id', groupId);
    if (error) {
      setToast('Hindi na-update. Subukan ulit.');
      return;
    }
    setToast('Na-update ang vouches required.');
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Naglo-load...</div>;

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={back} className="neu-raised-sm w-12 h-12 rounded-full flex items-center justify-center active:neu-pressed">
          <ArrowLeft size={20} style={{ color: 'var(--text)' }} />
        </button>
        <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--text)' }}>Group settings</h1>
      </div>

      {/* Theme toggle */}
      <NeuCard className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === 'night' ? <Moon size={20} style={{ color: 'var(--amber)' }} /> : <Sun size={20} style={{ color: 'var(--amber)' }} />}
            <div>
              <h2 className="font-heading font-semibold text-sm" style={{ color: 'var(--text)' }}>Theme</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{theme === 'night' ? 'Night' : 'Day'}</p>
            </div>
          </div>
          <NeuToggle on={theme === 'day'} onToggle={toggleTheme} label={theme === 'night' ? 'gawing day' : 'gawing night'} />
        </div>
      </NeuCard>

      {/* Group info */}
      <NeuCard className="mb-4">
        <h2 className="text-sm font-heading font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Group info</h2>
        <div className="space-y-3">
          <div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Pangalan</span>
            <p className="font-heading font-bold text-base" style={{ color: 'var(--text)' }}>{group?.name}</p>
          </div>
          <div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Invite code</span>
            <p className="font-heading font-bold text-base tracking-widest" style={{ color: 'var(--amber)' }}>{group?.invite_code}</p>
          </div>
        </div>
      </NeuCard>

      {/* Vouches required */}
      {isAdmin && (
        <NeuCard className="mb-4">
          <h2 className="text-sm font-heading font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Ilang vouch para makasali?</h2>
          <div className="flex gap-2 mb-3">
            {[1, 2].map((n) => (
              <button
                key={n}
                onClick={() => setVouches(n as 1 | 2)}
                className="flex-1 py-3 rounded-[14px] font-heading font-semibold transition-all"
                style={vouches === n
                  ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)', color: 'var(--amber)' }
                  : { background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--text)' }}
              >
                {n} vouch{n > 1 ? 'es' : ''}
              </button>
            ))}
          </div>
          <button
            onClick={handleSaveVouches}
            className="w-full py-3 rounded-[14px] font-heading font-semibold text-sm active:neu-pressed"
            style={{ background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)', color: 'var(--green-light)' }}
          >
            I-save
          </button>
        </NeuCard>
      )}

      {/* Direction tags */}
      <NeuCard className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Tag size={18} style={{ color: 'var(--amber)' }} />
          <h2 className="text-sm font-heading font-semibold" style={{ color: 'var(--text-muted)' }}>Direction tags</h2>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Ginagamit para mag-pair ng buddies sa uwian.</p>
        <div className="space-y-2 mb-3">
          {directionTags.map((dt) => (
            <div key={dt.id} className="flex items-center justify-between p-3 rounded-[14px]" style={{ background: 'var(--surface)', boxShadow: 'inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light)' }}>
              <span className="text-sm font-heading font-semibold" style={{ color: 'var(--text)' }}>{dt.tag}</span>
              {isAdmin && (
                <button onClick={() => handleDeleteTag(dt.id)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--surface)', boxShadow: '2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light)' }}>
                  <X size={14} style={{ color: 'var(--red)' }} />
                </button>
              )}
            </div>
          ))}
          {directionTags.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Wala pang tags. Mag-add para mag-pair ng buddies.</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <input
              className="neu-inset flex-1 px-4 py-3 text-[var(--text)] outline-none text-sm"
              placeholder="North QC, South Makati..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            />
            <button
              onClick={handleAddTag}
              className="w-12 h-12 rounded-[14px] flex items-center justify-center active:neu-pressed"
              style={{ background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)' }}
            >
              <Plus size={20} style={{ color: 'var(--amber)' }} />
            </button>
          </div>
        )}
      </NeuCard>

      {/* Admin badge */}
      {isAdmin && (
        <NeuCard className="text-center" inset>
          <span className="text-xs px-3 py-1 rounded-full font-heading font-semibold" style={{ background: 'var(--amber)', color: '#000' }}>admin</span>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Admin ka ng group na ito.</p>
        </NeuCard>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
