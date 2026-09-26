import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Database,
  CheckCircle2,
  Info,
  Sliders,
  ExternalLink,
  ShieldAlert,
  Server,
  Layers,
  RotateCcw,
} from 'lucide-react';

export const DataSourcesView: React.FC = () => {
  const {
    mapTileStyle,
    setMapTileStyle,
    riskWeights,
    updateRiskWeight,
  } = useApp();

  const resetWeights = () => {
    updateRiskWeight('hardBraking', 35);
    updateRiskWeight('suddenSwerving', 25);
    updateRiskWeight('abnormalSlowdown', 20);
    updateRiskWeight('trafficCongestion', 20);
    updateRiskWeight('accidentReports', 40);
    updateRiskWeight('floodingDepth', 45);
    updateRiskWeight('roadBlockage', 50);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        backgroundColor: '#0b0f17',
        color: '#f8fafc',
        padding: '24px 32px',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid #38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Database size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Data Sources & Engine Transparency</h1>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                Explicit audit of real geographic data vs simulated vehicle probe intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Data Architecture Transparency Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* REAL DATA CARD */}
          <div
            style={{
              background: '#111827',
              border: '1px solid #10b981',
              borderRadius: 10,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  background: '#10b981',
                  color: '#0b0f17',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                GENUINE REAL DATA
              </span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Geographic Road Network</h3>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
              The following layers utilize verified, real-world geospatial infrastructure with zero mocked geometry:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: '#161e2e', padding: 10, borderRadius: 6, fontSize: 12 }}>
                <b style={{ color: '#f8fafc', display: 'block' }}>Map Tiles & Road Geometry</b>
                <span style={{ color: '#94a3b8' }}>
                  OpenStreetMap (OSM) live vector and raster tiles. Real streets, highway flyovers, and junctions.
                </span>
                <div style={{ fontSize: 10, color: '#10b981', marginTop: 4 }}>
                  Attribution: © OpenStreetMap contributors
                </div>
              </div>

              <div style={{ background: '#161e2e', padding: 10, borderRadius: 6, fontSize: 12 }}>
                <b style={{ color: '#f8fafc', display: 'block' }}>Turn-by-Turn Routing Engine</b>
                <span style={{ color: '#94a3b8' }}>
                  Open Source Routing Machine (OSRM) HTTP API driving profile. Real road graph traversal.
                </span>
                <div style={{ fontSize: 10, color: '#10b981', marginTop: 4 }}>
                  Engine: OSRM v5 (Car / Emergency Profile)
                </div>
              </div>

              <div style={{ background: '#161e2e', padding: 10, borderRadius: 6, fontSize: 12 }}>
                <b style={{ color: '#f8fafc', display: 'block' }}>Geographic Coordinates & Hospitals</b>
                <span style={{ color: '#94a3b8' }}>
                  Real GPS coordinates for dispatch hubs, trauma centers, and city intersections.
                </span>
              </div>
            </div>
          </div>

          {/* SIMULATED DATA CARD */}
          <div
            style={{
              background: '#111827',
              border: '1px solid #f59e0b',
              borderRadius: 10,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  background: '#f59e0b',
                  color: '#0b0f17',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                PROTOTYPE SIMULATED SENSORS
              </span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Probe Telemetry & Hazards</h3>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
              To demonstrate predictive capabilities without requiring a connected commercial telematics fleet:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: '#161e2e', padding: 10, borderRadius: 6, fontSize: 12 }}>
                <b style={{ color: '#f8fafc', display: 'block' }}>Vehicle Accelerometer Probes</b>
                <span style={{ color: '#94a3b8' }}>
                  Simulated deceleration &gt;0.45g (hard braking) and lateral gyro deflection (swerving).
                </span>
                <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>
                  Model: Spatial & temporal Poisson cluster generator
                </div>
              </div>

              <div style={{ background: '#161e2e', padding: 10, borderRadius: 6, fontSize: 12 }}>
                <b style={{ color: '#f8fafc', display: 'block' }}>Dynamic Hazards & Weather</b>
                <span style={{ color: '#94a3b8' }}>
                  Simulated waterlogging depth sensors, road barrier blocks, and traffic shockwaves.
                </span>
              </div>

              <div style={{ background: '#161e2e', padding: 10, borderRadius: 6, fontSize: 12 }}>
                <b style={{ color: '#f8fafc', display: 'block' }}>Citizen Field Hazard Reports</b>
                <span style={{ color: '#94a3b8' }}>
                  Crowdsourced manual hazard inputs (Potholes, Accidents, Construction bottlenecks).
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Explainable Road-Risk Engine Configurable Weights */}
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Explainable Road-Risk Engine Formula Weights
              </h3>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Fine-tune the scoring sensitivity for individual hazard factors (0 - 100 normalization)
              </span>
            </div>
            <button
              onClick={resetWeights}
              style={{
                padding: '6px 12px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 6,
                color: '#cbd5e1',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RotateCcw size={12} />
              <span>Reset Defaults</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#cbd5e1' }}>Hard Braking Penalty Weight</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#ef4444' }}>
                  +{riskWeights.hardBraking || 35} pts
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={60}
                value={riskWeights.hardBraking || 35}
                onChange={(e) => updateRiskWeight('hardBraking', parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#ef4444' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#cbd5e1' }}>Sudden Swerving Penalty Weight</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#f97316' }}>
                  +{riskWeights.suddenSwerving || 25} pts
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={50}
                value={riskWeights.suddenSwerving || 25}
                onChange={(e) => updateRiskWeight('suddenSwerving', parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#f97316' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#cbd5e1' }}>Flooding Depth (&gt;40cm) Penalty</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#06b6d4' }}>
                  +{riskWeights.floodingDepth || 45} pts
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={70}
                value={riskWeights.floodingDepth || 45}
                onChange={(e) => updateRiskWeight('floodingDepth', parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#06b6d4' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#cbd5e1' }}>Road Blockage / Closure Penalty</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#f43f5e' }}>
                  +{riskWeights.roadBlockage || 50} pts
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={70}
                value={riskWeights.roadBlockage || 50}
                onChange={(e) => updateRiskWeight('roadBlockage', parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#f43f5e' }}
              />
            </div>
          </div>
        </div>

        {/* Map Tile Style Selector */}
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Map Render Style</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setMapTileStyle('tactical_dark')}
              style={{
                padding: '10px 16px',
                borderRadius: 6,
                border: mapTileStyle === 'tactical_dark' ? '2px solid #38bdf8' : '1px solid #334155',
                background: mapTileStyle === 'tactical_dark' ? 'rgba(56,189,248,0.12)' : '#1e293b',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🌙 Tactical Dark (CartoDB Dark Matter)
            </button>
            <button
              onClick={() => setMapTileStyle('osm_standard')}
              style={{
                padding: '10px 16px',
                borderRadius: 6,
                border: mapTileStyle === 'osm_standard' ? '2px solid #38bdf8' : '1px solid #334155',
                background: mapTileStyle === 'osm_standard' ? 'rgba(56,189,248,0.12)' : '#1e293b',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🗺️ OpenStreetMap Standard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
