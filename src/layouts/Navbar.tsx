import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Calendar,
  UserCheck,
  ShieldAlert,
  BarChart3,
  KeyRound,
  LogOut,
  LogIn,
  Radio,
  BookOpen,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenLoginModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, onOpenLoginModal }) => {
  const { user, role, isAuthenticated, logout, mustChangePassword } = useAuth();

  return (
    <header style={{ borderBottom: '2px solid var(--color-purple)', backgroundColor: 'var(--color-white)' }}>
      {/* Top Banner if user must change password */}
      {mustChangePassword && (
        <div
          style={{
            backgroundColor: 'var(--color-purple)',
            color: 'var(--color-white)',
            padding: '8px 16px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <ShieldAlert size={16} />
          SECURITY REQUIREMENT: You must change your temporary/default password before full access is granted.
          <button
            onClick={() => onSelectTab('security')}
            className="btn-secondary"
            style={{ padding: '4px 8px', fontSize: '11px', textTransform: 'uppercase' }}
          >
            Change Password Now
          </button>
        </div>
      )}

      {/* Main Bar */}
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              backgroundColor: 'var(--color-purple)',
              color: 'var(--color-white)',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building2 size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '0.5px' }}>
              CAMPUS CLASSROOM ALLOCATOR
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={12} />
              REALTIME RESERVATION SYSTEM
            </div>
          </div>
        </div>

        {/* Mode & User Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="badge-outline">
            {role === 'admin' && 'ADMINISTRATOR MODE'}
            {role === 'faculty' && `FACULTY: ${user?.full_name || user?.username}`}
            {role === 'reader' && 'READER MODE (PUBLIC)'}
          </div>

          {isAuthenticated ? (
            <button onClick={logout} className="btn-secondary" style={{ padding: '6px 12px' }}>
              <LogOut size={14} />
              Sign Out
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="btn-primary"
              style={{ padding: '6px 14px' }}
            >
              <LogIn size={14} />
              Faculty / Admin Sign In
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-bar */}
      <nav
        style={{
          backgroundColor: 'var(--color-white)',
          borderTop: '1px solid var(--color-purple)',
          padding: '0 20px',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
          }}
        >
          {/* Universal Tabs */}
          <button
            onClick={() => onSelectTab('classrooms')}
            style={{
              backgroundColor: currentTab === 'classrooms' ? 'var(--color-purple)' : 'transparent',
              color: currentTab === 'classrooms' ? 'var(--color-white)' : 'var(--color-purple)',
              border: 'none',
              borderRadius: '0',
              padding: '12px 16px',
              borderBottom: currentTab === 'classrooms' ? '3px solid var(--color-purple)' : 'none',
              fontWeight: currentTab === 'classrooms' ? 700 : 500,
            }}
          >
            <Building2 size={16} />
            Room Availability
          </button>

          <button
            onClick={() => onSelectTab('timetable')}
            style={{
              backgroundColor: currentTab === 'timetable' ? 'var(--color-purple)' : 'transparent',
              color: currentTab === 'timetable' ? 'var(--color-white)' : 'var(--color-purple)',
              border: 'none',
              borderRadius: '0',
              padding: '12px 16px',
              fontWeight: currentTab === 'timetable' ? 700 : 500,
            }}
          >
            <BookOpen size={16} />
            Official Timetable
          </button>

          {/* Faculty Tabs */}
          {role === 'faculty' && (
            <button
              onClick={() => onSelectTab('my-reservations')}
              style={{
                backgroundColor: currentTab === 'my-reservations' ? 'var(--color-purple)' : 'transparent',
                color: currentTab === 'my-reservations' ? 'var(--color-white)' : 'var(--color-purple)',
                border: 'none',
                borderRadius: '0',
                padding: '12px 16px',
                fontWeight: currentTab === 'my-reservations' ? 700 : 500,
              }}
            >
              <Calendar size={16} />
              My Bookings
            </button>
          )}

          {/* Admin Tabs */}
          {role === 'admin' && (
            <>
              <button
                onClick={() => onSelectTab('all-reservations')}
                style={{
                  backgroundColor: currentTab === 'all-reservations' ? 'var(--color-purple)' : 'transparent',
                  color: currentTab === 'all-reservations' ? 'var(--color-white)' : 'var(--color-purple)',
                  border: 'none',
                  borderRadius: '0',
                  padding: '12px 16px',
                  fontWeight: currentTab === 'all-reservations' ? 700 : 500,
                }}
              >
                <Calendar size={16} />
                All Reservations
              </button>

              <button
                onClick={() => onSelectTab('manage-rooms')}
                style={{
                  backgroundColor: currentTab === 'manage-rooms' ? 'var(--color-purple)' : 'transparent',
                  color: currentTab === 'manage-rooms' ? 'var(--color-white)' : 'var(--color-purple)',
                  border: 'none',
                  borderRadius: '0',
                  padding: '12px 16px',
                  fontWeight: currentTab === 'manage-rooms' ? 700 : 500,
                }}
              >
                <Building2 size={16} />
                Floors & Classrooms
              </button>

              <button
                onClick={() => onSelectTab('manage-faculty')}
                style={{
                  backgroundColor: currentTab === 'manage-faculty' ? 'var(--color-purple)' : 'transparent',
                  color: currentTab === 'manage-faculty' ? 'var(--color-white)' : 'var(--color-purple)',
                  border: 'none',
                  borderRadius: '0',
                  padding: '12px 16px',
                  fontWeight: currentTab === 'manage-faculty' ? 700 : 500,
                }}
              >
                <UserCheck size={16} />
                Faculty Accounts
              </button>

              <button
                onClick={() => onSelectTab('analytics')}
                style={{
                  backgroundColor: currentTab === 'analytics' ? 'var(--color-purple)' : 'transparent',
                  color: currentTab === 'analytics' ? 'var(--color-white)' : 'var(--color-purple)',
                  border: 'none',
                  borderRadius: '0',
                  padding: '12px 16px',
                  fontWeight: currentTab === 'analytics' ? 700 : 500,
                }}
              >
                <BarChart3 size={16} />
                Admin Analytics
              </button>
            </>
          )}

          {/* Account Security (for authenticated users) */}
          {isAuthenticated && (
            <button
              onClick={() => onSelectTab('security')}
              style={{
                backgroundColor: currentTab === 'security' ? 'var(--color-purple)' : 'transparent',
                color: currentTab === 'security' ? 'var(--color-white)' : 'var(--color-purple)',
                border: 'none',
                borderRadius: '0',
                padding: '12px 16px',
                fontWeight: currentTab === 'security' ? 700 : 500,
              }}
            >
              <KeyRound size={16} />
              Account Security
            </button>
          )}
        </div>
      </nav>
    </header>
  );
};
