import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './layouts/Navbar';
import { ClassroomsView } from './pages/ClassroomsView';
import { TimetableView } from './pages/TimetableView';
import { MyReservationsView } from './pages/MyReservationsView';
import { AllReservationsView } from './pages/AllReservationsView';
import { ManageRoomsView } from './pages/ManageRoomsView';
import { ManageFacultyView } from './pages/ManageFacultyView';
import { AdminAnalyticsView } from './pages/AdminAnalyticsView';
import { AccountSecurityView } from './pages/AccountSecurityView';
import { LoginModal } from './components/LoginModal';
import { PasswordChangeModal } from './components/PasswordChangeModal';
import { getSupabaseConfigStatus, type SupabaseConfigStatus } from './lib/supabaseClient';
import { Database } from 'lucide-react';

const AppContent: React.FC = () => {
  const { role, mustChangePassword } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('classrooms');
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [configStatus, setConfigStatus] = useState<SupabaseConfigStatus | null>(null);
  const [showConfigNotice, setShowConfigNotice] = useState<boolean>(true);

  useEffect(() => {
    const status = getSupabaseConfigStatus();
    setConfigStatus(status);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Supabase Environment Configuration Notice (when in default template / local mode) */}
      {configStatus && !configStatus.isConfigured && (
        <div
          style={{
            borderBottom: '2px solid var(--color-purple)',
            backgroundColor: 'var(--color-white)',
            color: 'var(--color-purple)',
            fontSize: '12px',
          }}
        >
          <div
            style={{
              maxWidth: '1280px',
              margin: '0 auto',
              padding: '6px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={14} />
              <span>
                <strong>SUPABASE CONFIGURATION STATUS:</strong> Running with verified local database engine ({configStatus.missingVariables.join(', ')} unset).
              </span>
            </div>
            <button
              onClick={() => setShowConfigNotice((prev) => !prev)}
              className="btn-link"
              style={{ fontSize: '11px', padding: 0 }}
            >
              {showConfigNotice ? 'Hide Setup Details' : 'Show Setup Details'}
            </button>
          </div>

          {showConfigNotice && (
            <div
              style={{
                maxWidth: '1280px',
                margin: '0 auto',
                padding: '10px 20px 14px',
                borderTop: '1px solid var(--color-purple)',
                fontSize: '12px',
                lineHeight: 1.6,
              }}
            >
              <p>
                To connect to your cloud Supabase instance, update <code>.env.local</code> with your project's URL and Publishable Anon Key:
              </p>
              <pre
                style={{
                  padding: '6px 10px',
                  border: '1px solid var(--color-purple)',
                  borderRadius: '4px',
                  margin: '6px 0',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                }}
              >
                VITE_SUPABASE_URL=https://your-project-id.supabase.co{'\n'}
                VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
              </pre>
              <p style={{ opacity: 0.8 }}>
                All database migrations are ready in <code>supabase/migrations/</code> and Edge Functions in <code>supabase/functions/</code>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenLoginModal={() => setShowLoginModal(true)}
      />

      {/* Main View Area */}
      <main style={{ flex: 1, paddingBottom: '60px' }}>
        {currentTab === 'classrooms' && (
          <ClassroomsView onOpenLogin={() => setShowLoginModal(true)} />
        )}
        {currentTab === 'timetable' && <TimetableView />}
        {currentTab === 'my-reservations' && role === 'faculty' && <MyReservationsView />}
        {currentTab === 'all-reservations' && role === 'admin' && <AllReservationsView />}
        {currentTab === 'manage-rooms' && role === 'admin' && <ManageRoomsView />}
        {currentTab === 'manage-faculty' && role === 'admin' && <ManageFacultyView />}
        {currentTab === 'analytics' && role === 'admin' && <AdminAnalyticsView />}
        {currentTab === 'security' && <AccountSecurityView />}
      </main>

      {/* Forced Password Change Modal on Initial Login */}
      {mustChangePassword && (
        <PasswordChangeModal isForced={true} />
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            setShowLoginModal(false);
            setCurrentTab('classrooms');
          }}
        />
      )}

      {/* Footer */}
      <footer
        style={{
          borderTop: '2px solid var(--color-purple)',
          backgroundColor: 'var(--color-white)',
          padding: '20px',
          textAlign: 'center',
          fontSize: '12px',
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <strong>COLLEGE CLASSROOM ALLOCATOR</strong> — Secure Serverless Academic Scheduling
          </div>
          <div style={{ opacity: 0.8 }}>
            Pure White (#FFFFFF) & Solid Purple (#5B21B6) Design System
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
