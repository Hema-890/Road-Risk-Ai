import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Navigation,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Clock,
  Gauge,
  Flag,
  Sparkles,
  Zap,
} from 'lucide-react';

export const NavigationCockpit: React.FC = () => {
  const {
    telemetry,
    selectedRoute,
    selectedVehicle,
    currentMission,
    greenCorridor,
    completeMission,
    triggerHazardInjection,
    simulationSpeed,
    setSimulationSpeed,
  } = useApp();

  if (!selectedRoute || !telemetry.nextManeuver) return null;

  const getManeuverIcon = () => {
    switch (telemetry.nextManeuver.type) {
      case 'turn_right':
        return <CornerUpRight size={28} className="text-cyan-400" />;
      case 'turn_left':
        return <CornerUpLeft size={28} className="text-cyan-400" />;
      case 'destination':
        return <Flag size={28} className="text-emerald-400" />;
      default:
        return <ArrowUp size={28} className="text-cyan-400" />;
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 81) return '#f43f5e';
    if (score >= 61) return '#fb7185';
    if (score >= 41) return '#f59e0b';
    if (score >= 21) return '#eab308';
    return '#10b981';
  };

  return (
    <div className="navigation-cockpit-overlay">
      {/* Top Turn-by-Turn Instruction Banner */}
      <div className="cockpit-maneuver-banner animate-slide-down">
        <div className="maneuver-icon-container">{getManeuverIcon()}</div>

        <div className="maneuver-text-group">
          <div className="maneuver-distance-row">
            <span className="maneuver-dist font-mono">{telemetry.nextManeuver.distanceToMeters}m</span>
            <span className="maneuver-sub">NEXT MANEUVER</span>
          </div>
          <div className="maneuver-instruction">{telemetry.nextManeuver.instruction}</div>
        </div>

        {/* Current Segment Risk Badge */}
        <div
          className="active-segment-risk-badge"
          style={{
            borderColor: getRiskColor(telemetry.currentSegmentRisk),
            color: getRiskColor(telemetry.currentSegmentRisk),
          }}
        >
          <span className="seg-score font-mono">{telemetry.currentSegmentRisk}</span>
          <span className="seg-label">SEGMENT RISK</span>
        </div>
      </div>

      {/* Bottom Telemetry & Mission Control Panel */}
      <div className="cockpit-bottom-dock animate-slide-up">
        {/* Speedometer & Progress Dial */}
        <div className="dock-speedometer-box">
          <div className="speed-dial">
            <span className="speed-number font-mono">{telemetry.speedKmh}</span>
            <span className="speed-unit">KM/H</span>
          </div>
          <div className="vehicle-identity">
            <span className="v-callsign font-mono">{selectedVehicle.callsign}</span>
            <span className="v-type">{selectedVehicle.type}</span>
          </div>
        </div>

        {/* Journey Progress Bar */}
        <div className="dock-journey-progress">
          <div className="journey-metric-row">
            <div className="jm-cell">
              <span className="jm-label">REMAINING DISTANCE</span>
              <span className="jm-val font-mono">{telemetry.distanceRemainingKm} km</span>
            </div>

            <div className="jm-cell">
              <span className="jm-label">ESTIMATED ARRIVAL</span>
              <span className="jm-val font-mono text-cyan-400">{telemetry.etaRemainingMinutes} min</span>
            </div>

            <div className="jm-cell">
              <span className="jm-label">CORRIDOR STATUS</span>
              <span className="jm-val font-mono text-emerald-400">
                {selectedRoute.greenCorridorCompatible ? 'GREEN CORRIDOR SYNC' : 'STANDARD PRIORITY'}
              </span>
            </div>
          </div>

          <div className="journey-progress-track">
            <div
              className="journey-progress-fill"
              style={{ width: `${Math.round(telemetry.progressFraction * 100)}%` }}
            />
          </div>

          {/* Green Corridor 4-Signal Nodes */}
          {selectedRoute.greenCorridorCompatible && (
            <div className="green-corridor-nodes-track">
              {greenCorridor.signals.map((sig, idx) => (
                <div
                  key={sig.id}
                  className={`corridor-node-pill ${sig.state.toLowerCase()}`}
                  title={`${sig.intersectionName} (${sig.state})`}
                >
                  <span className="node-dot" />
                  <span className="node-num">SIG-{idx + 1}</span>
                  <span className="node-status font-mono">
                    {sig.state === 'GREEN_LOCKED' ? 'LOCK' : sig.state === 'PREPARING_YELLOW' ? 'PREP' : 'WAIT'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Controls: Speed Multipliers, Hazard Test & End Mission */}
        <div className="dock-actions-cluster">
          {/* Simulation Speed Switcher */}
          <div className="speed-multiplier-group">
            <span className="multiplier-label">Sim Speed:</span>
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                className={`multiplier-btn ${simulationSpeed === s ? 'active' : ''}`}
                onClick={() => setSimulationSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Trigger Hazard Test Button */}
          <button
            className="trigger-hazard-btn"
            onClick={() => triggerHazardInjection('BRAKING_CLUSTER')}
            title="Inject Sudden Braking Cluster Ahead"
          >
            <AlertTriangle size={15} />
            <span>Test Hazard</span>
          </button>

          {/* Complete Mission */}
          <button className="complete-mission-btn" onClick={completeMission}>
            <CheckCircle2 size={16} />
            <span>Arrived Hub</span>
          </button>
        </div>
      </div>
    </div>
  );
};
