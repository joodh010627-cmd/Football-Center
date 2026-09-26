import { useState } from 'react';
import { AuthProvider } from '@/store/AuthContext';
import { AppProvider } from '@/store/AppContext';
import { WorkspaceProvider } from '@/store/WorkspaceContext';
import { AuthGate } from '@/components/auth/AuthGate';
import { FootballApp } from '@/components/FootballApp';
import { BootScreen } from '@/components/BootScreen';
import { PublicFormPage } from '@/components/public/PublicFormPage';

/**
 * A parent opening a form link (`?f=<slug>`) never meets the app: no boot
 * screen, no login, no session. The link is a query string rather than a path
 * because GitHub Pages serves one `index.html` and cannot rewrite `/f/…`.
 */
const formSlug = new URLSearchParams(window.location.search).get('f');

export default function App() {
  // The boot overlay runs once per page load, above the auth gate, so the
  // login screen is already painted behind it when the crest fades.
  const [booting, setBooting] = useState(true);

  if (formSlug) {
    // index.html paints the page pitch-green for the boot screen; a form on
    // white shouldn't show green when the parent overscrolls.
    document.documentElement.style.background = '#EBEFEE';
    return <PublicFormPage slug={formSlug} />;
  }

  return (
    <AuthProvider>
      <AuthGate>
        <AppProvider>
          {/* Leads and form links (DB-backed since 0006, local until it is
              applied) and the evaluation overrides. Inside `AppProvider`
              because it reads the tenant's real classes. */}
          <WorkspaceProvider>
            <FootballApp />
          </WorkspaceProvider>
        </AppProvider>
      </AuthGate>
      {booting && <BootScreen onDone={() => setBooting(false)} />}
    </AuthProvider>
  );
}
