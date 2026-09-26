import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield,
  Activity,
  Volume2,
  VolumeX,
  Clock,
  Wifi,
  Sparkles,
  AlertTriangle,
  Zap,
  Bell,
  Compass,
  Radio,
} from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import trafficService from '../../services/trafficService';

import { VoiceSettingsPopover } from '../navigation/VoiceSettingsPopover.tsx';

interface HeaderProps {
  onOpenReportModal: () => void;
  onOpenDemoLab: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenReportModal, onOpenDemoLab, onToggleSidebar }) => {
  const {
    activePortal,
    setActivePortal,
    currentMission,
    selectedVehicle,
    userLocation,
    isAudioMuted,
    toggleAudioMute,
    runHackathonDemoScenario,
    stopHackathonDemo,
    isDemoRunning,
  } = useApp();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [isVoicePopoverOpen, setIsVoicePopoverOpen] = useState<boolean>(false);
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(
    notificationService.getPermissionStatus() === 'granted'
  );

  const handleToggleAlerts = async () => {
    if (alertsEnabled) {
      await notificationService.disableAlerts();
      setAlertsEnabled(false);
    } else {
      const res = await notificationService.enableEmergencyAlerts();
      if (res.success) {
        setAlertsEnabled(true);
      }
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header
      style={{
        height: 48,
        backgroundColor: 'rgba(9, 13, 22, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(30, 41, 59, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        color: '#f8fafc',
        zIndex: 500,
        flexShrink: 0,
      }}
    >
      {/* Left: Navigation Menu Toggle (☰) + Brand + Status Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Compact Navigation Menu Button */}
        <button
          onClick={onToggleSidebar}
          title="Open Navigation Menu (☰)"
          id="btn-nav-menu"
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(51, 65, 85, 0.7)',
            color: '#f8fafc',
            cursor: 'pointer',
            width: 32,
            height: 32,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)')}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>☰</span>
        </button>

        {/* Brand Logo & Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 8px rgba(2, 132, 199, 0.4)',
            }}
          >
            <Shield size={14} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: '0.02em', color: '#f8fafc' }}>
            RoadRisk <span style={{ color: '#38bdf8' }}>AI</span>
          </span>
        </div>

        {/* Mode Switcher Pill (Citizen Safety Navigation vs Emergency Command) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(51, 65, 85, 0.8)',
            borderRadius: 20,
            padding: 2,
            gap: 2,
            marginLeft: 4,
          }}
        >
          <button
            onClick={() => setActivePortal('navigation')}
            id="btn-mode-citizen"
            title="Citizen Road Safety Navigation"
            style={{
              background: activePortal === 'navigation' ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'transparent',
              color: activePortal === 'navigation' ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderRadius: 16,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: activePortal === 'navigation' ? '0 2px 8px rgba(2, 132, 199, 0.45)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Compass size={12} />
            <span>Citizen Nav</span>
          </button>

          <button
            onClick={() => setActivePortal('operator')}
            id="btn-mode-operator"
            title="Emergency Vehicle Dispatch & Corridor Command"
            style={{
              background: activePortal === 'operator' ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'transparent',
              color: activePortal === 'operator' ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderRadius: 16,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: activePortal === 'operator' ? '0 2px 8px rgba(220, 38, 38, 0.45)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Radio size={12} />
            <span>Dispatch</span>
          </button>
        </div>

        {/* Responsive Desktop Live System Indicators (Phase 6) */}
        <div className="header-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 6 }}>
          <span style={{ color: '#334155' }}>|</span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(15, 23, 42, 0.7)',
              padding: '3px 10px',
              borderRadius: 16,
              border: '1px solid rgba(51, 65, 85, 0.6)',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }}>
              LIVE SYSTEM
            </span>

            {/* GPS Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700 }} title="GPS Location Status">
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: userLocation?.coordinates ? '#10b981' : '#f59e0b',
                  display: 'inline-block',
                  boxShadow: userLocation?.coordinates ? '0 0 6px rgba(16, 185, 129, 0.8)' : 'none',
                }}
              />
              <span style={{ color: userLocation?.coordinates ? '#f1f5f9' : '#94a3b8' }}>
                GPS {userLocation?.coordinates ? 'LIVE' : 'SEARCHING'}
              </span>
            </div>

            <span style={{ color: '#334155' }}>•</span>

            {/* Traffic Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700 }} title="TomTom Live Traffic Status">
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: trafficService.isLiveTrafficConfigured() ? '#10b981' : '#f59e0b',
                  display: 'inline-block',
                  boxShadow: trafficService.isLiveTrafficConfigured() ? '0 0 6px rgba(16, 185, 129, 0.8)' : 'none',
                }}
              />
              <span style={{ color: trafficService.isLiveTrafficConfigured() ? '#10b981' : '#94a3b8' }}>
                TRAFFIC {trafficService.isLiveTrafficConfigured() ? 'LIVE' : 'UNAVAILABLE'}
              </span>
            </div>

            <span style={{ color: '#334155' }}>•</span>

            {/* Safety Intelligence Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700 }} title="Hazard & Safety Engine">
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#10b981',
                  display: 'inline-block',
                  boxShadow: '0 0 6px rgba(16, 185, 129, 0.8)',
                }}
              />
              <span style={{ color: '#38bdf8' }}>SAFETY ACTIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Secondary Action Buttons, Audio, Time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Enable Emergency Alerts / Web Push (Phase 11) */}
        <button
          onClick={handleToggleAlerts}
          title={alertsEnabled ? 'Push Alerts Active (Click to disable)' : 'Enable Emergency & Citizen Push Alerts'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 6,
            background: alertsEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.12)',
            border: alertsEnabled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(56, 189, 248, 0.35)',
            color: alertsEnabled ? '#34d399' : '#38bdf8',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = alertsEnabled ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.22)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = alertsEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.12)';
          }}
        >
          <Bell size={13} />
          <span>{alertsEnabled ? 'ALERTS ON' : 'ENABLE ALERTS'}</span>
        </button>

        {/* Report Hazard button */}
        <button
          onClick={onOpenReportModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 6,
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)')}
        >
          <AlertTriangle size={13} />
          <span>Report Hazard</span>
        </button>

        {/* 1-Click Demo Trigger / Reset */}
        <button
          onClick={isDemoRunning ? stopHackathonDemo : runHackathonDemoScenario}
          title={isDemoRunning ? 'Stop demo and clear route' : 'Launch Hackathon Demo scenario'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 11px',
            borderRadius: 6,
            background: isDemoRunning ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.18)',
            border: isDemoRunning ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(245, 158, 11, 0.4)',
            color: isDemoRunning ? '#f87171' : '#fbbf24',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isDemoRunning ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.28)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isDemoRunning ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.18)';
          }}
        >
          <Zap size={13} className={isDemoRunning ? 'animate-pulse' : ''} />
          <span>{isDemoRunning ? '■ Reset Demo' : '⚡ Demo'}</span>
        </button>

        {/* Simulation Mode Badge */}
        {isDemoRunning && (
          <span
            style={{
              background: '#dc2626',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 6,
              letterSpacing: '0.05em',
              animation: 'pulse 2s infinite',
            }}
          >
            SIMULATION MODE
          </span>
        )}

        <span style={{ color: '#334155' }}>|</span>

        {/* Audio / Voice Navigation Settings */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsVoicePopoverOpen(!isVoicePopoverOpen)}
            aria-label="Voice Navigation Settings"
            title="Navigation Voice Settings (Language, Male/Female, Volume)"
            style={{
              background: isVoicePopoverOpen ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
              border: isVoicePopoverOpen ? '1px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: 6,
              padding: '4px 8px',
              color: isAudioMuted ? '#64748b' : '#38bdf8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {isAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span>Voice</span>
          </button>

          <VoiceSettingsPopover
            isOpen={isVoicePopoverOpen}
            onClose={() => setIsVoicePopoverOpen(false)}
          />
        </div>

        {/* Clock */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            color: '#94a3b8',
            paddingLeft: 4,
          }}
        >
          <Clock size={12} />
          <span>{currentTime || '12:00:00'}</span>
        </div>
      </div>
    </header>
  );
};
