import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type Screen =
  | { name: 'auth' }
  | { name: 'groups' }
  | { name: 'groupHome'; groupId: string }
  | { name: 'vouchQueue'; groupId: string }
  | { name: 'createSession'; groupId: string }
  | { name: 'sessionDetail'; groupId: string; sessionId: string }
  | { name: 'map'; groupId: string }
  | { name: 'liveTab'; groupId: string; sessionId: string }
  | { name: 'settleUp'; groupId: string }
  | { name: 'uwian'; groupId: string; sessionId: string }
  | { name: 'hangganan' }
  | { name: 'ledger'; groupId: string }
  | { name: 'settings'; groupId: string };

interface NavCtx {
  screen: Screen;
  navigate: (s: Screen) => void;
  back: () => void;
}

const NavContext = createContext<NavCtx | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Screen[]>([{ name: 'auth' }]);

  const navigate = useCallback((s: Screen) => {
    setStack((prev) => [...prev, s]);
  }, []);

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  return (
    <NavContext.Provider value={{ screen: stack[stack.length - 1], navigate, back }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
