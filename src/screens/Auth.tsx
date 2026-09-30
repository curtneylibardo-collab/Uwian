import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/nav';
import { NeuCard, NeuInput, NeuButton } from '@/components/Neu';
import { BottleCap } from '@/components/BottleCap';
import { Beer } from 'lucide-react';

const EMOJIS = ['🍺', '🍻', '🚗', '🧃', '🍶', '🥃', '🍷', '🧉'];

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { navigate } = useNav();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🍺');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Kailangan ng pangalan mo.');
        setBusy(false);
        return;
      }
      const { error: err } = await signUp(email, password, name.trim(), emoji);
      if (err) setError(err);
    } else {
      const { error: err } = await signIn(email, password);
      if (err) setError('Mali ang email o password. Subukan ulit.');
    }
    setBusy(false);
  };

  const fillDemo = (em: string) => {
    setEmail(em);
    setPassword('password123');
    setMode('login');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="flex items-center gap-3">
          <BottleCap label="" icon={<Beer size={28} color="white" />} size="lg" />
          <h1 className="text-3xl font-heading font-extrabold" style={{ color: 'var(--text)' }}>Uwian</h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Barkada sessions, hatian, at uwian.</p>
      </div>

      <NeuCard className="w-full max-w-sm">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('login')}
            className="flex-1 py-2 rounded-[14px] font-heading font-semibold text-sm transition-all"
            style={mode === 'login' ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)', color: 'var(--amber)' } : { color: 'var(--text-muted)' }}
          >
            Log in
          </button>
          <button
            onClick={() => setMode('signup')}
            className="flex-1 py-2 rounded-[14px] font-heading font-semibold text-sm transition-all"
            style={mode === 'signup' ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)', color: 'var(--amber)' } : { color: 'var(--text-muted)' }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <NeuInput label="Pangalan" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ramon" required />
          )}
          <NeuInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ramon@uwian.app" required />
          <NeuInput label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />

          {mode === 'signup' && (
            <div>
              <span className="block mb-2 text-sm font-heading font-semibold text-[var(--text-muted)]">Pick mo</span>
              <div className="flex gap-2 flex-wrap">
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setEmoji(em)}
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center text-xl transition-all"
                    style={emoji === em
                      ? { background: 'var(--surface)', boxShadow: 'inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light)' }
                      : { background: 'var(--surface)', boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)' }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="neu-inset px-4 py-3 rounded-[14px] text-sm" style={{ color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <div className="flex justify-center pt-2">
            <BottleCap label={mode === 'login' ? 'pasok' : 'sali'} type="submit" size="lg" disabled={busy} />
          </div>
        </form>
      </NeuCard>

      <div className="mt-6 w-full max-w-sm">
        <p className="text-xs text-center mb-3" style={{ color: 'var(--text-muted)' }}>Try mo lang — seed accounts:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {['ramon', 'liza', 'tj', 'maya', 'ben', 'pia'].map((n) => (
            <button
              key={n}
              onClick={() => fillDemo(`${n}@uwian.app`)}
              className="neu-raised-sm px-3 py-2 text-xs font-heading font-semibold capitalize rounded-[14px] active:neu-pressed"
              style={{ color: 'var(--text)' }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
