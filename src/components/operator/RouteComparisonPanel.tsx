import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { RouteOption } from '../../types';
import {
  ArrowLeft,
  Play,
  ShieldAlert,
  Sparkles,
  CheckCircle,
  Clock,
  Navigation2,
  Zap,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';

export const RouteComparisonPanel: React.FC = () => {
  const {
    routes,
    selectedRoute,
    setSelectedRouteId,
    selectedVehicle,
    currentMission,
    startNavigationMission,
    resetToMissionSetup,
  } = useApp();

  const [isMinimized, setIsMinimized] = useState(false);

  const getRiskBadgeColor = (score: number) => {
    if (score >= 81) return '#f43f5e';
    if (score >= 61) return '#fb7185';
    if (score >= 41) return '#f59e0b';
    if (score >= 21) return '#eab308';
    return '#10b981';
  };

  if (!selectedRoute || routes.length === 0) return null;

  return (
    <div className={`route-comparison-tray ${isMinimized ? 'minimized' : ''} animate-slide-up`}>
      {/* Tray Header Bar */}
      <div className="tray-header-bar">
        <div className="tray-header-left">
          <button className="back-setup-btn" onClick={resetToMissionSetup} title="Back to Mission Dispatch Setup">
            <ArrowLeft size={15} />
            <span>Modify Dispatch</span>
          </button>
          <div className="tray-titles">
            <h2 className="tray-heading">Predictive Corridor Analysis</h2>
            <span className="tray-vehicle-tag font-mono">
              {selectedVehicle.callsign} ({selectedVehicle.widthMeters}m chassis)
            </span>
          </div>
        </div>

        {/* AI Recommendation Chip & Minimize Button */}
        <div className="tray-header-right">
          <div className="ai-rec-chip-compact">
            <Sparkles size={13} className="text-cyan-400" />
            <span>AI: {selectedRoute.recommendationReason}</span>
          </div>

          <button
            className="tray-minimize-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand Corridor Cards' : 'Minimize (Maximize Map View)'}
          >
            {isMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Corridor Cards Row (Collapsed when minimized) */}
      {!isMinimized && (
        <div className="route-cards-scroll-row custom-scrollbar">
          {routes.map((route) => {
            const isSelected = route.id === selectedRoute.id;
            const riskColor = getRiskBadgeColor(route.riskScore);

            return (
              <div
                key={route.id}
                className={`route-card-box ${isSelected ? 'selected' : ''} ${
                  route.isRecommended ? 'recommended-border' : ''
                }`}
                onClick={() => setSelectedRouteId(route.id)}
              >
                {/* Top Row: Tag & Risk Pill */}
                <div className="card-top-row">
                  <div className="route-name-group">
                    {route.isRecommended && (
                      <span className="ai-rec-chip font-mono">
                        <Sparkles size={11} /> RECOMMENDED
                      </span>
                    )}
                    <h3 className="route-title">{route.name}</h3>
                  </div>

                  <div className="risk-score-pill" style={{ borderColor: riskColor, color: riskColor }}>
                    <span className="score-val font-mono">{route.riskScore}</span>
                    <span className="score-label">/100</span>
                  </div>
                </div>

                <p className="route-summary-text">{route.summary}</p>

                {/* Segmented Risk Profile Mini-Bar */}
                <div className="segment-mini-bar-group">
                  <div className="mini-bar-track">
                    {route.segments.map((seg, idx) => (
                      <div
                        key={idx}
                        className="mini-bar-segment"
                        style={{
                          background: getRiskBadgeColor(seg.riskScore),
                          flex: seg.coordinates.length,
                        }}
                        title={`${seg.name}: ${seg.riskScore}/100 Risk (${seg.riskLevel})`}
                      />
                    ))}
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="route-metrics-row">
                  <div className="metric-cell">
                    <span className="m-label">
                      <Clock size={12} /> ETA
                    </span>
                    <span className="m-val font-mono text-cyan-300">{route.adjustedEtaMinutes}m</span>
                  </div>

                  <div className="metric-cell">
                    <span className="m-label">
                      <Navigation2 size={12} /> DIST
                    </span>
                    <span className="m-val font-mono">{route.distanceKm}km</span>
                  </div>

                  <div className="metric-cell">
                    <span className="m-label">
                      <Zap size={12} /> FIT
                    </span>
                    <span className="m-val font-mono text-emerald-400">{route.missionSuitabilityScore}%</span>
                  </div>
                </div>

                {/* Badges */}
                <div className="compatibility-badges">
                  {route.greenCorridorCompatible && (
                    <span className="compat-badge green-corridor">
                      <CheckCircle size={11} /> Green Corridor
                    </span>
                  )}
                  {route.hazardCount > 0 && (
                    <span className="compat-badge hazard-detected">
                      <ShieldAlert size={11} /> {route.hazardCount} Hazard
                    </span>
                  )}
                  <span className="compat-badge vehicle-fit">
                    Fit: {route.vehicleSuitabilityScore}% ({selectedVehicle.widthMeters}m W)
                  </span>
                </div>

                {/* Select Button */}
                <button
                  className={`select-route-action-btn ${isSelected ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRouteId(route.id);
                  }}
                >
                  {isSelected ? 'Active Corridor Selected' : 'Select This Corridor'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Dispatch Action Bar */}
      <div className="route-action-bottom-bar">
        <div className="selection-confirmation-info">
          <span className="confirm-label">ACTIVE SELECTION:</span>
          <strong className="confirm-name">{selectedRoute.name}</strong>
          <span className="confirm-eta font-mono text-cyan-300">
            ETA: {selectedRoute.adjustedEtaMinutes} min ({selectedRoute.distanceKm} km)
          </span>
          <span
            className="confirm-risk font-mono"
            style={{ color: getRiskBadgeColor(selectedRoute.riskScore) }}
          >
            Risk: {selectedRoute.riskScore}/100 ({selectedRoute.riskLevel})
          </span>
        </div>

        <button className="start-navigation-btn" onClick={startNavigationMission}>
          <Play size={17} fill="currentColor" />
          <span>Engage Live Emergency Navigation</span>
        </button>
      </div>
    </div>
  );
};
export default RouteComparisonPanel;
