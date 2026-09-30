import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { NavProvider, useNav } from '@/lib/nav';
import { AuthScreen } from '@/screens/Auth';
import { MyGroupsScreen } from '@/screens/MyGroups';
import { GroupHomeScreen } from '@/screens/GroupHome';
import { VouchQueueScreen } from '@/screens/VouchQueue';
import { CreateSessionScreen } from '@/screens/CreateSession';
import { SessionDetailScreen } from '@/screens/SessionDetail';
import { TambayanMapScreen } from '@/screens/TambayanMap';
import { LiveTabScreen } from '@/screens/LiveTab';
import { SettleUpScreen } from '@/screens/SettleUp';
import { UwianCheckInScreen } from '@/screens/UwianCheckIn';
import { HanggananScreen } from '@/screens/Hangganan';
import { BarkadaLedgerScreen } from '@/screens/BarkadaLedger';
import { GroupSettingsScreen } from '@/screens/GroupSettings';

function Router() {
  const { screen } = useNav();
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface)' }}>
        <p style={{ color: 'var(--text-muted)' }} className="font-heading">Naglo-load...</p>
      </div>
    );
  }

  // If not logged in, force auth screen
  if (!session && screen.name !== 'auth') {
    return <AuthScreen />;
  }

  // If logged in and on auth screen, go to groups
  if (session && screen.name === 'auth') {
    return <MyGroupsScreen />;
  }

  switch (screen.name) {
    case 'auth':
      return <AuthScreen />;
    case 'groups':
      return <MyGroupsScreen />;
    case 'groupHome':
      return <GroupHomeScreen groupId={screen.groupId} />;
    case 'vouchQueue':
      return <VouchQueueScreen groupId={screen.groupId} />;
    case 'createSession':
      return <CreateSessionScreen groupId={screen.groupId} />;
    case 'sessionDetail':
      return <SessionDetailScreen groupId={screen.groupId} sessionId={screen.sessionId} />;
    case 'map':
      return <TambayanMapScreen groupId={screen.groupId} />;
    case 'liveTab':
      return <LiveTabScreen groupId={screen.groupId} sessionId={screen.sessionId} />;
    case 'settleUp':
      return <SettleUpScreen groupId={screen.groupId} />;
    case 'uwian':
      return <UwianCheckInScreen groupId={screen.groupId} sessionId={screen.sessionId} />;
    case 'hangganan':
      return <HanggananScreen />;
    case 'ledger':
      return <BarkadaLedgerScreen groupId={screen.groupId} />;
    case 'settings':
      return <GroupSettingsScreen groupId={screen.groupId} />;
    default:
      return <MyGroupsScreen />;
  }
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavProvider>
          <Router />
        </NavProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
