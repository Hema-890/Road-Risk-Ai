// ==============================================================================
// ROADRISK AI — TURN-BY-TURN DIRECTIONS DRAWER & ROUTE TELEMETRY PANEL
// Displays comprehensive maneuver instructions, arrival clock, traffic delay,
// and safety score computed directly from real roadway geometry.
// ==============================================================================

import React from 'react';
import {
  X,
  Navigation,
  ArrowRight,
  CornerUpLeft,
  CornerUpRight,
  RotateCw,
  MapPin,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import type { RouteOption, NavigationManeuver } from '../../types/index.ts';

interface DirectionsPanelProps {
  route: RouteOption;
  isOpen: boolean;
  onClose: () => void;
  onStartNavigation: () => void;
}

export const DirectionsPanel: React.FC<DirectionsPanelProps> = ({
  route,
  isOpen,
  onClose,
  onStartNavigation,
}) => {
  if (!isOpen) return null;

  // Authoritative arrival time from route timing
  const arrivalTimeStr = route.formattedArrivalTime || (route.arrivalTime ? new Date(route.arrivalTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : new Date(Date.now() + (route.adjustedEtaMinutes || 10) * 60000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
  const durationStr = route.formattedDuration || `${Math.round(route.adjustedEtaMinutes || 10)} min`;
  const trafficDelayMin = Math.round((route.trafficDelaySeconds || 0) / 60);

  const getManeuverIcon = (type?: string, modifier?: string) => {
    const t = (type || '').toLowerCase();
    const m = (modifier || '').toLowerCase();

    if (t.includes('arrive')) return <MapPin size={18} color="#ef4444" />;
    if (t.includes('depart')) return <Navigation size={18} color="#10b981" />;
    if (t.includes('roundabout')) return <RotateCw size={18} color="#38bdf8" />;
    if (m.includes('left') || t.includes('left')) return <CornerUpLeft size={18} color="#38bdf8" />;
    if (m.includes('right') || t.includes('right')) return <CornerUpRight size={18} color="#38bdf8" />;
    return <ArrowRight size={18} color="#94a3b8" />;
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'LOW':
        return '#10b981';
      case 'MODERATE':
        return '#eab308';
      case 'ELEVATED':
        return '#f97316';
      case 'CRITICAL':
        return '#ef4444';
      default:
        return '#38bdf8';
    }
  };

  const maneuvers = route.maneuvers && route.maneuvers.length > 0
    ? route.maneuvers
    : [
        {
          id: 'm_fallback_1',
          instruction: `Head out towards ${route.summary || 'corridor'}`,
          distanceMeters: Math.round((route.distanceKm * 1000) * 0.4),
          type: 'depart' as const,
          coordinates: route.fullCoordinates[0] || [0, 0],
        },
        {
          id: 'm_fallback_2',
          instruction: 'Continue along main arterial route',
          distanceMeters: Math.round((route.distanceKm * 1000) * 0.6),
          type: 'straight' as const,
          coordinates: route.fullCoordinates[Math.floor(route.fullCoordinates.length / 2)] || [0, 0],
        },
        {
          id: 'm_fallback_3',
          instruction: 'Arrive at destination',
          distanceMeters: 0,
          type: 'arrive' as const,
          coordinates: route.fullCoordinates[route.fullCoordinates.length - 1] || [0, 0],
        },
      ];

  return (
    <div
      role="dialog"
      aria-label="Turn-by-turn directions"
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        bottom: 20,
        width: 380,
        maxWidth: 'calc(100vw - 40px)',
        background: 'rgba(11, 15, 25, 0.96)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: 16,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.1)',
        zIndex: 550,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#f8fafc',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 18px',
          borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
          background: 'rgba(15, 23, 42, 0.8)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.06em',
                padding: '2px 7px',
                borderRadius: 4,
                background: route.objective === 'SAFEST' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                color: route.objective === 'SAFEST' ? '#10b981' : '#38bdf8',
                border: `1px solid ${route.objective === 'SAFEST' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
              }}
            >
              {route.objective || 'RECOMMENDED'}
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{route.travelMode || 'DRIVE'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              {durationStr}
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8' }}>
              {route.distanceKm.toFixed(1)} km
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 12, color: '#cbd5e1' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={13} color="#94a3b8" />
              Arrive by <strong>{arrivalTimeStr}</strong>
            </span>
            {trafficDelayMin > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b', fontWeight: 600 }}>
                <Flame size={13} />
                +{trafficDelayMin} min traffic
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Close directions"
          style={{
            background: 'rgba(51, 65, 85, 0.4)',
            border: 'none',
            borderRadius: '50%',
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Safety & Risk Summary Strip */}
      <div
        style={{
          padding: '10px 18px',
          background: 'rgba(30, 41, 59, 0.4)',
          borderBottom: '1px solid rgba(51, 65, 85, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={14} color={getRiskBadgeColor(route.riskLevel)} />
          <span style={{ color: '#cbd5e1' }}>Risk Index:</span>
          <strong style={{ color: getRiskBadgeColor(route.riskLevel) }}>
            {route.riskScore}/100 ({route.riskLevel})
          </strong>
        </div>

        {route.hazardCount > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b', fontWeight: 600 }}>
            <AlertTriangle size={13} />
            <span>{route.hazardCount} Hazard(s) Nearby</span>
          </div>
        ) : (
          <span style={{ color: '#10b981', fontWeight: 600 }}>Corridor Clear</span>
        )}
      </div>

      {route.modeNotice && (
        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(245, 158, 11, 0.12)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
            fontSize: 11,
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <AlertTriangle size={13} />
          <span>{route.modeNotice}</span>
        </div>
      )}

      {/* Turn-by-Turn Maneuver List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: '0.08em', marginBottom: 6 }}>
          MANEUVER-BY-MANEUVER DIRECTIONS
        </div>

        {maneuvers.map((m: NavigationManeuver, idx: number) => {
          const distKm = m.distanceMeters >= 1000 ? `${(m.distanceMeters / 1000).toFixed(1)} km` : `${m.distanceMeters} m`;
          const estMin = Math.max(1, Math.round(m.distanceMeters / 500));

          return (
            <div
              key={m.id || idx}
              className="directions-maneuver-item"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '10px 10px',
                borderRadius: 8,
                background: idx === 0 ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                borderLeft: idx === 0 ? '3px solid #38bdf8' : '3px solid transparent',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(51, 65, 85, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {getManeuverIcon(m.type, m.modifier)}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', lineHeight: 1.35 }}>
                  {m.instruction}
                </div>
                {m.distanceMeters > 0 && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                    {distKm} • ~{estMin} min
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Start Navigation Button */}
      <div
        style={{
          padding: '14px 18px',
          borderTop: '1px solid rgba(51, 65, 85, 0.5)',
          background: 'rgba(15, 23, 42, 0.95)',
        }}
      >
        <button
          onClick={() => {
            onClose();
            onStartNavigation();
          }}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.03em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)',
            transition: 'all 0.15s ease',
          }}
        >
          <Navigation size={17} />
          START NAVIGATION
        </button>
      </div>
    </div>
  );
};

export default DirectionsPanel;
