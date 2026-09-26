import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import {
  CheckCircle2,
  Clock,
  Navigation,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  FileText,
  Activity,
} from 'lucide-react';

export const MissionDebriefModal: React.FC = () => {
  const { debriefReport, closeDebrief, resetToMissionSetup, exportDebriefReport } = useApp();

  useEffect(() => {
    if (debriefReport) {
      // Fire tactical celebratory confetti
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#10b981', '#f59e0b', '#ffffff'],
      });
    }
  }, [debriefReport]);

  if (!debriefReport) return null;

  return (
    <div className="debrief-modal-backdrop animate-fade-in">
      <div className="debrief-modal-card animate-scale-up">
        {/* Header */}
        <div className="debrief-header">
          <div className="debrief-badge-icon">
            <CheckCircle2 size={28} className="text-emerald-400" />
          </div>
          <div>
            <span className="debrief-mission-id font-mono">MISSION RECORD: {debriefReport.missionId}</span>
            <h2 className="debrief-title">Emergency Mission Successfully Completed</h2>
            <p className="debrief-subtitle">
              Unit <strong>{debriefReport.vehicleCallsign}</strong> arrived safely at Apex Emergency Trauma Hub
            </p>
          </div>
        </div>

        {/* 4-Stat Metric Summary Grid */}
        <div className="debrief-stats-grid">
          <div className="debrief-stat-card">
            <div className="stat-top">
              <Clock size={16} className="text-cyan-400" />
              <span className="stat-label">TRANSIT TIME</span>
            </div>
            <div className="stat-number font-mono">{debriefReport.actualArrivalMinutes}m</div>
            <span className="stat-subtext text-emerald-400">Saved 2.0 min via Corridor</span>
          </div>

          <div className="debrief-stat-card">
            <div className="stat-top">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span className="stat-label">RISK AVOIDED</span>
            </div>
            <div className="stat-number font-mono text-emerald-400">-{debriefReport.riskPointsAvoided} pts</div>
            <span className="stat-subtext">Avg Corridor Risk: {debriefReport.averageRiskIndex}/100</span>
          </div>

          <div className="debrief-stat-card">
            <div className="stat-top">
              <Navigation size={16} className="text-purple-400" />
              <span className="stat-label">DISTANCE</span>
            </div>
            <div className="stat-number font-mono">{debriefReport.distanceTraveledKm} km</div>
            <span className="stat-subtext">{debriefReport.reroutesExecutedCount} Reroutes Engaged</span>
          </div>

          <div className="debrief-stat-card">
            <div className="stat-top">
              <Sparkles size={16} className="text-amber-400" />
              <span className="stat-label">GREEN CORRIDOR</span>
            </div>
            <div className="stat-number font-mono text-cyan-300">
              {debriefReport.greenCorridorEfficiencyPct}%
            </div>
            <span className="stat-subtext">4/4 Signals Pre-empted</span>
          </div>
        </div>

        {/* Timeline of In-Flight Events */}
        <div className="debrief-timeline-section">
          <h4 className="timeline-title">
            <Activity size={16} className="text-cyan-400" />
            <span>Mission Telemetry & Event Chronology</span>
          </h4>

          <div className="timeline-list custom-scrollbar">
            {debriefReport.timeline.map((item, index) => (
              <div key={index} className="timeline-item">
                <span className="timeline-timestamp font-mono">{item.timestamp}</span>
                <span className={`timeline-marker type-${item.type}`} />
                <span className="timeline-desc">{item.event}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Debrief Actions */}
        <div className="debrief-actions-bar">
          <button className="debrief-secondary-btn" onClick={closeDebrief}>
            <FileText size={16} />
            <span>Close Record</span>
          </button>

          <button
            className="debrief-secondary-btn"
            onClick={exportDebriefReport}
            style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
          >
            <Sparkles size={16} />
            <span>Export Dossier (JSON)</span>
          </button>

          <button className="debrief-primary-btn" onClick={resetToMissionSetup}>
            <RotateCcw size={16} />
            <span>Configure New Mission</span>
          </button>
        </div>
      </div>
    </div>
  );
};
