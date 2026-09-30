import { useState } from 'react';
import { AuthProvider } from '@/store/AuthContext';
import { AppProvider } from '@/store/AppContext';
import { WorkspaceProvider } from '@/store/WorkspaceContext';
import { AuthGate } from '@/components/auth/AuthGate';
import { FootballApp } from '@/components/FootballApp';
import { BootScreen } from '@/components/BootScreen';
import { PublicFormPage } from '@/components/public/PublicFormPage';
import { PublicSurveyPage } from '@/components/public/PublicSurveyPage';

/**
 * A parent opening a form link (`?f=<slug>`) never meets the app: no boot
 * screen, no login, no session. The link is a query string rather than a path
 * because GitHub Pages serves one `index.html` and cannot rewrite `/f/…`.
 */
const params = new URLSearchParams(window.location.search);
const formSlug = params.get('f');
/** A survey link (`?s=<token>`) — one family's own copy, sent in 알림톡. */
const surveyToken = params.get('s');

export default function App() {
  // The boot overlay runs once per page load, above the auth gate, so the
  // login screen is already painted behind it when the crest fades.
  const [booting, setBooting] = useState(true);

  if (formSlug || surveyToken) {
    // index.html paints the page pitch-green for the boot screen; a form on
    // white shouldn't show green when the parent overscrolls.
    document.documentElement.style.background = '#EBEFEE';
    return surveyToken ? (
      <PublicSurveyPage token={surveyToken} />
    ) : (
      <PublicFormPage slug={formSlug!} />
    );
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
