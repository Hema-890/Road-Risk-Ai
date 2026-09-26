import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldAlert, ArrowRight, CheckCircle2, XCircle, Zap, Clock, ShieldCheck } from 'lucide-react';

export const DynamicRerouteModal: React.FC = () => {
  const { rerouteRecommendation, acceptReroute, dismissReroute, selectedRoute } = useApp();

  if (!rerouteRecommendation || !selectedRoute) return null;

  const { alternativeRoute, etaDifferenceMinutes, riskDifferencePoints, triggerReason, humanExplanation } =
    rerouteRecommendation;

  return (
    <div className="reroute-modal-backdrop animate-fade-in">
      <div className="reroute-modal-card animate-scale-up">
        {/* Header with Critical Hazard Indicator */}
        <div className="reroute-modal-header">
          <div className="reroute-icon-pulse">
            <ShieldAlert size={26} className="text-rose-400" />
          </div>
          <div className="reroute-header-titles">
            <span className="reroute-tag">IN-FLIGHT CORRIDOR INTERCEPT</span>
            <h3 className="reroute-main-title">Dynamic Reroute Recommended</h3>
            <p className="reroute-reason-text">{triggerReason}</p>
          </div>
        </div>

        {/* Side-by-Side Route Comparison Delta */}
        <div className="reroute-comparison-grid">
          {/* Current Compromised Route */}
          <div className="reroute-side current">
            <span className="side-status-badge compromised">CURRENT CORRIDOR</span>
            <h4 className="side-route-name">{selectedRoute.name}</h4>

            <div className="side-stat-row">
              <span className="stat-label">Projected Risk:</span>
              <span className="stat-val font-mono text-rose-400 font-bold">
                {selectedRoute.riskScore}/100 HIGH RISK
              </span>
            </div>

            <div className="side-stat-row">
              <span className="stat-label">Projected ETA:</span>
              <span className="stat-val font-mono">{selectedRoute.adjustedEtaMinutes} min</span>
            </div>

            <div className="compromised-warning-box">
              <span>⚠️ Accordion collision hazard ahead</span>
            </div>
          </div>

          <div className="reroute-arrow-divider">
            <ArrowRight size={24} className="text-cyan-400" />
          </div>

          {/* Recommended Safer Corridor */}
          <div className="reroute-side recommended">
            <span className="side-status-badge optimal">RECOMMENDED ALTERNATE</span>
            <h4 className="side-route-name">{alternativeRoute.name}</h4>

            <div className="side-stat-row">
              <span className="stat-label">Corridor Risk:</span>
              <span className="stat-val font-mono text-emerald-400 font-bold">
                {alternativeRoute.riskScore}/100 LOW RISK
              </span>
            </div>

            <div className="side-stat-row">
              <span className="stat-label">Projected ETA:</span>
              <span className="stat-val font-mono text-cyan-300">
                {alternativeRoute.adjustedEtaMinutes} min ({etaDifferenceMinutes >= 0 ? '+' : ''}
                {etaDifferenceMinutes}m delta)
              </span>
            </div>

            <div className="optimal-benefit-box">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>Lowers risk by {Math.abs(riskDifferencePoints)} index points</span>
            </div>
          </div>
        </div>

        {/* Explainability Paragraph */}
        <div className="reroute-explanation-banner">
          <Zap size={16} className="text-cyan-400 flex-shrink-0" />
          <p className="explanation-body">{humanExplanation}</p>
        </div>

        {/* Decision Action Buttons */}
        <div className="reroute-modal-actions">
          <button className="reroute-dismiss-btn" onClick={dismissReroute}>
            <XCircle size={17} />
            <span>Maintain Current Trajectory</span>
          </button>

          <button className="reroute-accept-btn" onClick={acceptReroute}>
            <CheckCircle2 size={18} />
            <span>Engage Reroute Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
