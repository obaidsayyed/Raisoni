import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  BookOpen,
  Calendar,
  CalendarCheck,
  Layers,
  Users,
  BarChart3,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  visible: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
}) => {
  const { role, isAuthenticated } = useAuth();

  const navItems: NavItem[] = [
    {
      id: 'classrooms',
      label: 'Room Availability',
      icon: <Building2 size={18} />,
      visible: true,
    },
    {
      id: 'timetable',
      label: 'Official Timetable',
      icon: <BookOpen size={18} />,
      visible: role !== 'faculty',
    },
    {
      id: 'my-reservations',
      label: 'My Schedules',
      icon: <Calendar size={18} />,
      visible: role === 'faculty',
    },
    {
      id: 'all-reservations',
      label: 'All Reservations',
      icon: <CalendarCheck size={18} />,
      visible: role === 'admin',
    },
    {
      id: 'manage-rooms',
      label: 'Floors & Classrooms',
      icon: <Layers size={18} />,
      visible: role === 'admin',
    },
    {
      id: 'manage-faculty',
      label: 'Faculty Accounts',
      icon: <Users size={18} />,
      visible: role === 'admin',
    },
    {
      id: 'analytics',
      label: 'Admin Analytics',
      icon: <BarChart3 size={18} />,
      visible: role === 'admin',
    },
    {
      id: 'security',
      label: 'Account Security',
      icon: <KeyRound size={18} />,
      visible: isAuthenticated,
    },
  ];

  const visibleItems = navItems.filter((item) => item.visible);

  const handleSelect = (id: string) => {
    onSelectTab(id);
    // On mobile screens, auto-collapse after clicking an option
    if (typeof window !== 'undefined' && window.innerWidth <= 768 && !collapsed) {
      onToggleCollapse();
    }
  };

  return (
    <>
      {/* Mobile Floating Button to Expand Options when Totally Collapsed on Mobile */}
      {collapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mobile-sidebar-open-btn"
          title="Open Navigation Options"
          aria-label="Open Navigation Options"
        >
          <PanelLeftOpen size={15} />
          <span>Options</span>
        </button>
      )}

      {/* Backdrop overlay on mobile when expanded */}
      {!collapsed && (
        <div
          className="sidebar-backdrop"
          onClick={onToggleCollapse}
          title="Tap to close options"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`app-sidebar ${collapsed ? 'sidebar-collapsed' : 'mobile-sidebar-expanded'}`}
        style={{
          width: collapsed ? '64px' : '240px',
          backgroundColor: 'var(--color-white)',
          borderRight: '1px solid var(--color-tint-border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        {/* Sidebar Header / Toggle */}
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--color-tint-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
          }}
        >
          {!collapsed && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                color: 'var(--color-text-muted)',
              }}
            >
              Options
            </span>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="btn-secondary"
            style={{
              padding: '6px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        {/* Navigation Options List */}
        <nav
          style={{
            flex: 1,
            padding: '10px 6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            overflowY: 'auto',
          }}
        >
          {visibleItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                title={collapsed ? item.label : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: collapsed ? '8px 0' : '9px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  backgroundColor: isActive ? 'var(--color-tint-soft)' : 'transparent',
                  color: isActive ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '12.5px',
                  border: 'none',
                  borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isActive ? 'var(--color-primary-dark)' : 'var(--color-accent)',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </span>
                {!collapsed && (
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Status / Mode Info */}
        {!collapsed && (
          <div
            style={{
              padding: '10px 12px',
              borderTop: '1px solid var(--color-tint-border)',
              fontSize: '10.5px',
              color: 'var(--color-text-muted)',
              backgroundColor: 'var(--color-tint-subtle)',
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>
              {role === 'admin' && 'ADMIN CONSOLE'}
              {role === 'faculty' && 'FACULTY PORTAL'}
              {role === 'reader' && 'PUBLIC READER'}
            </div>
            <div style={{ marginTop: '1px', opacity: 0.8 }}>Raisoni Allocator v2.0</div>
          </div>
        )}
      </aside>
    </>
  );
};
