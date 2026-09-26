import React from 'react';
import { useApp } from '../../context/AppContext';
import { PortalType } from '../../types';
import {
  Shield,
  Compass,
  Radio,
  Map,
  BarChart3,
  FlaskConical,
  LineChart,
  Settings,
  AlertTriangle,
  Zap,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onOpenReportModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  onClose,
  onOpenReportModal,
}) => {
  const {
    activePortal,
    setActivePortal,
    runHackathonDemoScenario,
    isDemoRunning,
    currentMission,
    activeHazards,
  } = useApp();

  const navItems: { id: PortalType; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    {
      id: 'navigation',
      label: 'Citizen Safe Nav',
      icon: <Compass size={18} />,
      badge: 'LIVE',
    },
    {
      id: 'operator',
      label: 'Emergency Dispatch',
      icon: <Radio size={18} />,
      badge: currentMission.status === 'EN_ROUTE' ? 'EN ROUTE' : undefined,
    },
    {
      id: 'risk_map',
      label: 'Live Risk Map',
      icon: <Map size={18} />,
    },
    {
      id: 'authority',
      label: 'Road Intelligence',
      icon: <BarChart3 size={18} />,
      badge: activeHazards.length > 0 ? activeHazards.length : undefined,
    },
    {
      id: 'simulator',
      label: 'Event Simulator',
      icon: <FlaskConical size={18} />,
    },
    {
      id: 'analytics',
      label: 'Analytics & Risk',
      icon: <LineChart size={18} />,
    },
    {
      id: 'settings',
      label: 'Settings & Sources',
      icon: <Settings size={18} />,
    },
  ];

  return (
    <>
      {/* 1. Backdrop Overlay (Visible only when drawer is open) */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(5, 8, 15, 0.72)',
            backdropFilter: 'blur(4px)',
            zIndex: 998,
            transition: 'opacity 0.2s ease',
          }}
        />
      )}

      {/* 2. Slide-out Navigation Drawer */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          backgroundColor: '#090d16',
          borderRight: '1px solid rgba(30, 41, 59, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 999,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isOpen ? '10px 0 35px rgba(0, 0, 0, 0.8)' : 'none',
          userSelect: 'none',
        }}
      >
        {/* Brand Header & Close Button */}
        <div>
          <div
            style={{
              height: 54,
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(30, 41, 59, 0.8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 0 10px rgba(2, 132, 199, 0.4)',
                }}
              >
                <Shield size={17} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.3, color: '#f8fafc', lineHeight: 1.1 }}>
                  RoadRisk <span style={{ color: '#38bdf8' }}>AI</span>
                </div>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, letterSpacing: 0.6, marginTop: 2 }}>
                  PLATFORM NAVIGATION
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              title="Close Menu (Esc)"
              style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(51, 65, 85, 0.6)',
                color: '#94a3b8',
                cursor: 'pointer',
                width: 30,
                height: 30,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#f8fafc';
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.background = 'rgba(30, 41, 59, 0.5)';
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Navigation List */}
          <nav style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', padding: '0 8px 6px', textTransform: 'uppercase' }}>
              Core Operations
            </div>
            {navItems.map((item) => {
              const isActive = activePortal === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActivePortal(item.id);
                    onClose();
                  }}
                  title={item.label}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: isActive ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                    background: isActive ? 'rgba(14, 165, 233, 0.14)' : 'transparent',
                    color: isActive ? '#38bdf8' : '#94a3b8',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = '#f1f5f9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#94a3b8';
                    }
                  }}
                >
                  <div style={{ color: isActive ? '#38bdf8' : '#64748b', display: 'flex', alignItems: 'center' }}>
                    {item.icon}
                  </div>
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                  {item.badge && (
                    <span
                      style={{
                        background: typeof item.badge === 'string' ? 'rgba(14, 165, 233, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        border: typeof item.badge === 'string' ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                        color: typeof item.badge === 'string' ? '#38bdf8' : '#f87171',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 10,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Action Clusters */}
        <div style={{ padding: '14px 12px', borderTop: '1px solid rgba(30, 41, 59, 0.8)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Report Hazard button */}
          <button
            onClick={() => {
              onOpenReportModal();
              onClose();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '9px 12px',
              borderRadius: 6,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Report Field Hazard"
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
          >
            <AlertTriangle size={15} />
            <span>Report Field Hazard</span>
          </button>

          {/* 1-Click Hackathon Demo button */}
          <button
            onClick={() => {
              runHackathonDemoScenario();
              onClose();
            }}
            disabled={isDemoRunning}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 6,
              background: isDemoRunning ? '#334155' : 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fbbf24',
              fontSize: 12,
              fontWeight: 600,
              cursor: isDemoRunning ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="1-Click End-to-End Demo Scenario"
            onMouseEnter={(e) => {
              if (!isDemoRunning) e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)';
            }}
            onMouseLeave={(e) => {
              if (!isDemoRunning) e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)';
            }}
          >
            <Zap size={15} className={isDemoRunning ? 'animate-spin' : ''} />
            <span>{isDemoRunning ? 'Running Demo...' : '⚡ Hackathon Demo'}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
