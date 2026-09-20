import { useState } from 'react';
import { AuthProvider } from '@/store/AuthContext';
import { AppProvider } from '@/store/AppContext';
import { WorkspaceProvider } from '@/store/WorkspaceContext';
import { AuthGate } from '@/components/auth/AuthGate';
import { FootballApp } from '@/components/FootballApp';
import { BootScreen } from '@/components/BootScreen';

export default function App() {
  // The boot overlay runs once per page load, above the auth gate, so the
  // login screen is already painted behind it when the crest fades.
  const [booting, setBooting] = useState(true);

  return (
    <AuthProvider>
      <AuthGate>
        <AppProvider>
          {/* Everything with no table yet — the CRM pipeline, form links, the
              evaluation overrides. Inside `AppProvider` because it seeds from
              the tenant's real classes. */}
          <WorkspaceProvider>
            <FootballApp />
          </WorkspaceProvider>
        </AppProvider>
      </AuthGate>
      {booting && <BootScreen onDone={() => setBooting(false)} />}
    </AuthProvider>
  );
}
