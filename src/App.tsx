import { useState } from 'react';
import { AppProvider } from '@/store/AppContext';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { CoachApp } from '@/components/coach/CoachApp';
import { RoleSwitcher, type Role } from '@/components/RoleSwitcher';

export default function App() {
  const [role, setRole] = useState<Role>('admin');

  return (
    <AppProvider>
      <RoleSwitcher role={role} onChange={setRole} />
      {role === 'admin' ? <AdminDashboard /> : <CoachApp />}
    </AppProvider>
  );
}
