import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeedbackProvider } from './context/FeedbackContext';
import { Navbar } from './layouts/Navbar';
import { Sidebar } from './layouts/Sidebar';
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
import { PanelLeftOpen } from 'lucide-react';

const TAB_TITLES: Record<string, string> = {
  classrooms: 'Room Availability',
  timetable: 'Official Timetable',
  'my-reservations': 'My Schedules',
  'all-reservations': 'All Reservations',
  'manage-rooms': 'Floors & Classrooms',
  'manage-faculty': 'Faculty Accounts',
  analytics: 'Admin Analytics',
  security: 'Account Security',
};

const AppContent: React.FC = () => {
  const { role, mustChangePassword, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('classrooms');
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) return saved === 'true';
    if (typeof window !== 'undefined' && window.innerWidth <= 768) return true;
    return false;
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  // Ensure faculty cannot be on timetable tab
  React.useEffect(() => {
    if (role === 'faculty' && currentTab === 'timetable') {
      setCurrentTab('classrooms');
    }
  }, [role, currentTab]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-white)',
          color: 'var(--color-primary-dark)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '0.05em' }}>
            RAISONI ROOM ALLOCATOR
          </div>
          <div style={{ fontSize: '13px', marginTop: '10px', color: 'var(--color-text-muted)' }}>
            Restoring session...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Main Top Header */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenLoginModal={() => setShowLoginModal(true)}
      />

      {/* Mobile Top Subbar: Stable navigation trigger below top bar for Admin, Faculty, and Reader */}
      <div className="mobile-top-subbar">
        <button
          type="button"
          onClick={toggleSidebar}
          className="mobile-sidebar-toggle-btn"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <PanelLeftOpen size={18} />
        </button>
        <span className="mobile-subbar-title">
          {TAB_TITLES[currentTab] || 'Room Allocator'}
        </span>
      </div>

      {/* Main Container with Collapsible Sidebar */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Collapsible Sidebar for Options */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

        {/* Content Area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflowY: 'auto',
          }}
        >
          <main style={{ flex: 1, paddingBottom: '60px' }}>
            {currentTab === 'classrooms' && (
              <ClassroomsView onOpenLogin={() => setShowLoginModal(true)} />
            )}
            {currentTab === 'timetable' && role !== 'faculty' && <TimetableView />}
            {currentTab === 'my-reservations' && role === 'faculty' && <MyReservationsView />}
            {currentTab === 'all-reservations' && role === 'admin' && <AllReservationsView />}
            {currentTab === 'manage-rooms' && role === 'admin' && <ManageRoomsView />}
            {currentTab === 'manage-faculty' && role === 'admin' && <ManageFacultyView />}
            {currentTab === 'analytics' && role === 'admin' && <AdminAnalyticsView />}
            {currentTab === 'security' && <AccountSecurityView />}
          </main>

          {/* Clean Footer */}
          <footer
            style={{
              borderTop: '1px solid var(--color-tint-border)',
              backgroundColor: 'var(--color-white)',
              padding: '20px',
              textAlign: 'center',
              fontSize: '12px',
            }}
          >
            <div
              style={{
                maxWidth: '1280px',
                margin: '0 auto',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <strong style={{ color: 'var(--color-primary-dark)' }}>RAISONI ROOM ALLOCATOR</strong>
              </div>
              <div style={{ color: 'var(--color-text-muted)' }}>
                Classroom Allocation & Schedule System
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Forced Password Change Modal on Initial Login */}
      {mustChangePassword && <PasswordChangeModal isForced={true} />}

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
    </div>
  );
};

export function App() {
  return (
    <FeedbackProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </FeedbackProvider>
  );
}

export default App;
