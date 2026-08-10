import { useState } from 'react';
import type { Role } from '@/types';
import { AppProvider } from '@/store/AppContext';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { CoachApp } from '@/components/coach/CoachApp';
import { BootScreen } from '@/components/BootScreen';

export default function App() {
  const [role, setRole] = useState<Role>('admin');
  // The app renders underneath the boot overlay from the first frame, so by the
  // time the crest fades out everything behind it is already painted.
  const [booting, setBooting] = useState(true);

  return (
    <AppProvider>
      {role === 'admin' ? (
        <AdminDashboard role={role} onRoleChange={setRole} />
      ) : (
        <CoachApp role={role} onRoleChange={setRole} />
      )}
      {booting && <BootScreen onDone={() => setBooting(false)} />}
    </AppProvider>
  );
}
