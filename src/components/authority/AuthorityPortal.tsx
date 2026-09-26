import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AUTHORITY_HOTSPOTS, HOURLY_RISK_DISTRIBUTION, CITY_SAFETY_METRICS } from '../../data/authorityData';
import { AuthorityHotspot } from '../../types';
import {
  ShieldAlert,
  BarChart3,
  Search,
  Filter,
  Download,
  Crosshair,
  AlertTriangle,
  Lightbulb,
  Compass,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Activity,
  Layers,
} from 'lucide-react';

export const AuthorityPortal: React.FC = () => {
  const { flyToLocation, exportAuthorityAuditReport } = useApp();
  const [selectedHotspot, setSelectedHotspot] = useState<AuthorityHotspot | null>(AUTHORITY_HOTSPOTS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'moderate'>('all');
  const [isDossierCollapsed, setIsDossierCollapsed] = useState(false);

  const filteredHotspots = AUTHORITY_HOTSPOTS.filter((h) => {
    const matchesSearch =
      h.junctionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity =
      severityFilter === 'all' ||
      (severityFilter === 'critical' && h.riskScore >= 80) ||
      (severityFilter === 'high' && h.riskScore >= 60 && h.riskScore < 80) ||
      (severityFilter === 'moderate' && h.riskScore < 60);

    return matchesSearch && matchesSeverity;
  });

  const getRiskColor = (score: number) => {
    if (score >= 81) return '#f43f5e';
    if (score >= 61) return '#fb7185';
    if (score >= 41) return '#f59e0b';
    if (score >= 21) return '#eab308';
    return '#10b981';
  };

  const handleSelectHotspot = (h: AuthorityHotspot) => {
    setSelectedHotspot(h);
    flyToLocation(h.coordinates, 15.5);
  };

  return (
    <div className="authority-portal-layout animate-fade-in">
      {/* Top City KPI Overview Ribbon */}
      <div className="authority-kpi-ribbon">
        <div className="kpi-card">
          <span className="kpi-label">METROPOLITAN SAFETY INDEX</span>
          <div className="kpi-val-row">
            <span className="kpi-val font-mono text-cyan-400">{CITY_SAFETY_METRICS.citySafetyIndex}</span>
            <span className="kpi-denom">/100</span>
          </div>
          <span className="kpi-sub text-emerald-400">↑ 3.2% vs last month</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">CONNECTED SENSORS</span>
          <div className="kpi-val-row">
            <span className="kpi-val font-mono text-purple-300">
              {CITY_SAFETY_METRICS.connectedTelemetryVehicles}
            </span>
          </div>
          <span className="kpi-sub">Continuous 100Hz Sensor Ingestion</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">NEAR-MISSES PREVENTED</span>
          <div className="kpi-val-row">
            <span className="kpi-val font-mono text-emerald-400">
              {CITY_SAFETY_METRICS.nearMissesPreventedWeek}
            </span>
          </div>
          <span className="kpi-sub">Adaptive Preemptive Rerouting</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">ACTIVE HAZARDS</span>
          <div className="kpi-val-row">
            <span className="kpi-val font-mono text-rose-400">
              {CITY_SAFETY_METRICS.activeHazardClustersToday}
            </span>
          </div>
          <span className="kpi-sub text-rose-400">Field Verification Logged</span>
        </div>
      </div>

      {/* Main Split Grid: Left Hotspots Feed & Right Detailed Dossier */}
      <div className="authority-main-grid">
        {/* Left Column: Hotspots Feed */}
        <div className="authority-feed-column">
          <div className="feed-header">
            <div className="feed-title-row">
              <div className="feed-title-group">
                <ShieldAlert size={17} className="text-rose-400" />
                <h3 className="feed-title">High-Risk Road Sectors</h3>
              </div>
              <button
                className="audit-export-btn"
                onClick={exportAuthorityAuditReport}
                title="Download Civil Engineering Audit Report (CSV)"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="feed-search-box">
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                placeholder="Filter junction, corridor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Severity Filter Tabs */}
            <div className="severity-filter-tabs">
              {(['all', 'critical', 'high', 'moderate'] as const).map((sev) => (
                <button
                  key={sev}
                  className={`sev-tab-btn ${severityFilter === sev ? 'active' : ''}`}
                  onClick={() => setSeverityFilter(sev)}
                >
                  {sev.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Hotspots Card List */}
          <div className="hotspots-card-list custom-scrollbar">
            {filteredHotspots.map((h) => {
              const isSelected = selectedHotspot?.id === h.id;
              const color = getRiskColor(h.riskScore);

              return (
                <div
                  key={h.id}
                  className={`hotspot-item-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectHotspot(h)}
                >
                  <div className="hotspot-item-head">
                    <span className="hotspot-score-tag font-mono" style={{ borderColor: color, color }}>
                      RISK {h.riskScore}/100
                    </span>
                    <span className="hotspot-freq font-mono">{h.nearMissCountWeekly} near-misses/wk</span>
                  </div>

                  <h4 className="hotspot-item-name">{h.junctionName}</h4>
                  <p className="hotspot-category">{h.category}</p>

                  <div className="hotspot-signals-row font-mono">
                    <span>{h.hardBrakingFrequency} brakings/hr</span>
                    <span>•</span>
                    <span>Peak: {h.peakRiskTime}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Deep Investigation & Actionable Recommendations */}
        {selectedHotspot && !isDossierCollapsed ? (
          <div className="authority-detail-column animate-fade-in">
            <div className="detail-panel-card custom-scrollbar">
              {/* Header */}
              <div className="detail-card-head">
                <div>
                  <span className="detail-tag font-mono">SECTOR INVESTIGATION DOSSIER</span>
                  <h2 className="detail-junction-title">{selectedHotspot.junctionName}</h2>
                  <p className="detail-category-subtitle">{selectedHotspot.category}</p>
                </div>

                <div className="head-actions-cluster">
                  <button
                    className="focus-map-btn"
                    onClick={() => flyToLocation(selectedHotspot.coordinates, 16.0)}
                    title="Focus Map on this Junction"
                  >
                    <Crosshair size={14} />
                    <span>Focus Map</span>
                  </button>

                  <div
                    className="detail-risk-badge font-mono"
                    style={{
                      background: `${getRiskColor(selectedHotspot.riskScore)}22`,
                      borderColor: getRiskColor(selectedHotspot.riskScore),
                      color: getRiskColor(selectedHotspot.riskScore),
                    }}
                  >
                    <div className="score-lg">{selectedHotspot.riskScore}</div>
                    <div className="score-desc">{selectedHotspot.riskLevel} SEVERITY</div>
                  </div>
                </div>
              </div>

              {/* Contributing Factors */}
              <div className="detail-section">
                <h4 className="section-title">
                  <AlertTriangle size={15} className="text-amber-400" />
                  <span>Detected Physical & Flow Conflict Signals</span>
                </h4>
                <div className="factors-tag-grid">
                  {selectedHotspot.primaryContributingFactors.map((factor, idx) => (
                    <div key={idx} className="factor-pill-item">
                      <span className="pill-dot" />
                      <span>{factor}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Road Characteristics */}
              <div className="detail-section">
                <h4 className="section-title">
                  <Compass size={15} className="text-cyan-400" />
                  <span>Road Infrastructure Characteristics</span>
                </h4>
                <div className="infra-stats-grid font-mono">
                  <div className="infra-stat">
                    <span className="label">Lanes:</span>
                    <span className="val">{selectedHotspot.roadCharacteristics.lanes} lanes</span>
                  </div>
                  <div className="infra-stat">
                    <span className="label">Surface Width:</span>
                    <span className="val">{selectedHotspot.roadCharacteristics.widthMeters} meters</span>
                  </div>
                  <div className="infra-stat">
                    <span className="label">Blind Sightlines:</span>
                    <span className="val text-rose-400">
                      {selectedHotspot.roadCharacteristics.sightlineObstruction ? 'YES (Blind Crest)' : 'NO'}
                    </span>
                  </div>
                  <div className="infra-stat">
                    <span className="label">Drainage Capacity:</span>
                    <span className="val capitalize">{selectedHotspot.roadCharacteristics.drainageQuality}</span>
                  </div>
                </div>
              </div>

              {/* Actionable Engineering Recommendation */}
              <div className="detail-section recommendation-highlight-box">
                <div className="rec-header">
                  <Lightbulb size={17} className="text-yellow-400" />
                  <span className="rec-title">EVIDENCE-BACKED CIVIL RECOMMENDATION</span>
                </div>
                <p className="rec-body">{selectedHotspot.investigationRecommendation}</p>
                <div className="rec-footer font-mono">
                  <span>Target Agency: Public Works Dept (PWD) / Traffic Police</span>
                  <span className="status-badge">Action Required</span>
                </div>
              </div>

              {/* Hourly Risk Distribution Bar Chart */}
              <div className="detail-section">
                <h4 className="section-title">
                  <BarChart3 size={15} className="text-cyan-400" />
                  <span>Time-of-Day Risk & Deceleration Distribution (24h)</span>
                </h4>

                <div className="hourly-chart-container">
                  {HOURLY_RISK_DISTRIBUTION.map((item, idx) => (
                    <div key={idx} className="chart-bar-col">
                      <div className="chart-bar-wrapper">
                        <div
                          className="chart-bar-fill"
                          style={{
                            height: `${(item.avgRisk / 100) * 100}%`,
                            background: getRiskColor(item.avgRisk),
                          }}
                          title={`${item.hour}: Avg Risk ${item.avgRisk}/100, ${item.hardBrakings} brakings`}
                        />
                      </div>
                      <span className="chart-hour-label font-mono">{item.hour.split(':')[0]}h</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
export default AuthorityPortal;
