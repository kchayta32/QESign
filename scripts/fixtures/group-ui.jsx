// Test-only entry: production components/store, connected to the LOCAL RTDB emulator before import.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { connectDatabaseEmulator } from 'firebase/database';
import { rtdb } from '../../src/lib/firebase/config';
connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);

(async () => {
  const { dbStore } = await import('../../src/lib/firebase/db');
  const { AuthProvider } = await import('../../src/context/AuthContext');
  const { default: LoginForm } = await import('../../src/components/LoginForm');
  const { default: Profile } = await import('../../src/components/ProfileFormModal');
  const { default: Documents } = await import('../../src/components/ProjectDocumentsManager');
  if (!await dbStore.waitForCloudSync(['students', 'teachers', 'projectDocuments', 'projectGroups'])) throw new Error('Emulator sync timed out');
  for (const code of ['66122519070', '66122519071']) await dbStore.saveProfile('student', code, {
    firstNameTh: 'ทดสอบ', lastNameTh: code, phone: '0000000000', profileCompleted: true, advisorId: 'T-108', avatarUrl: '',
  });
  const root = createRoot(document.getElementById('root'));
  let key = 0;
  const show = (view, id = 'STD-66122519070', role = 'student') => {
    window.testClosed = false;
    const close = () => { window.testClosed = true; root.render(<p>ปิดแล้ว</p>); };
    if (view === 'login') localStorage.removeItem('SSRU_CE_AUTH_SESSION_V2');
    else localStorage.setItem('SSRU_CE_AUTH_SESSION_V2', JSON.stringify({ role, entityId: role === 'teacher' ? 'T-108' : id }));
    root.render(<AuthProvider key={++key}>
      {view === 'login' ? <LoginForm /> : view === 'profile' ? <Profile isOpen mode="edit" onClose={close} /> :
        <Documents isOpen student={dbStore.getStudentById(id)} role={role} currentTeacher={role === 'teacher' ? dbStore.getTeacherById('T-108') : undefined} onClose={close} />}
    </AuthProvider>);
  };
  window.testUI = { show, dbStore };
  show('login');
})();
