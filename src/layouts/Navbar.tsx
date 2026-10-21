import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  ShieldAlert,
  LogOut,
  LogIn,
  Radio,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenLoginModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onSelectTab,
  onOpenLoginModal,
}) => {
  const { user, role, isAuthenticated, logout, mustChangePassword } = useAuth();

  return (
    <header
      style={{
        borderBottom: '1px solid var(--color-tint-border)',
        backgroundColor: 'var(--color-white)',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 60,
      }}
    >
      {/* Top Banner if user must change password */}
      {mustChangePassword && (
        <div
          style={{
            backgroundColor: 'var(--color-primary-dark)',
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
            style={{ padding: '4px 10px', fontSize: '11px', textTransform: 'uppercase' }}
          >
            Change Password Now
          </button>
        </div>
      )}

      {/* Main Bar */}
      <div
        className="app-header-bar"
        style={{
          width: '100%',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            className="app-header-brand-icon"
            style={{
              backgroundColor: 'var(--color-primary-dark)',
              color: 'var(--color-white)',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Building2 size={20} />
          </div>

          <div>
            <div
              className="app-header-brand-title"
              style={{
                fontWeight: 800,
                fontSize: '17px',
                letterSpacing: '0.3px',
                color: 'var(--color-primary-dark)',
                lineHeight: 1.2,
              }}
            >
              RAISONI ROOM ALLOCATOR
            </div>
            <div
              className="app-header-brand-sub"
              style={{
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '1px',
              }}
            >
              <Radio size={11} color="var(--color-accent)" />
              ACADEMIC ALLOCATION & SCHEDULING SYSTEM
            </div>
          </div>
        </div>

        {/* Mode & User Status */}
        <div className="app-header-user-status" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="badge-outline">
            {role === 'admin' && 'ADMINISTRATOR MODE'}
            {role === 'faculty' && `FACULTY: ${user?.full_name || user?.username}`}
            {role === 'reader' && 'READER MODE (PUBLIC)'}
          </div>

          {isAuthenticated ? (
            <button onClick={logout} className="btn-secondary" style={{ padding: '6px 14px' }}>
              <LogOut size={14} />
              Sign Out
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="btn-primary"
              style={{ padding: '7px 16px' }}
            >
              <LogIn size={14} />
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
