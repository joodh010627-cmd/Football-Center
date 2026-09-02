import { useState } from 'react';
import { AuthProvider, useSession } from '@/store/AuthContext';
import { AppProvider } from '@/store/AppContext';
import { AuthGate } from '@/components/auth/AuthGate';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { CoachApp } from '@/components/coach/CoachApp';
import { BootScreen } from '@/components/BootScreen';

export default function App() {
  // The boot overlay runs once per page load, above the auth gate, so the
  // login screen is already painted behind it when the crest fades.
  const [booting, setBooting] = useState(true);

  return (
    <AuthProvider>
      <AuthGate>
        <AppProvider>
          <RoleRouter />
        </AppProvider>
      </AuthGate>
      {booting && <BootScreen onDone={() => setBooting(false)} />}
    </AuthProvider>
  );
}

/**
 * Which app you get, decided by `academy_members.role`.
 *
 * Note there is no state here and no prop to change it. The prototype's role
 * toggle is gone: an owner and a coach are different logins, and the only way
 * to see the other interface is to be the other person. Even if this branch
 * were edited in the browser, a coach rendering `AdminDashboard` would find it
 * empty — the revenue, cost and evaluation queries return nothing for them.
 */
function RoleRouter() {
  const session = useSession();
  return session.membership.role === 'owner' ? <AdminDashboard /> : <CoachApp />;
}
