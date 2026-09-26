import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MapContainer } from './MapContainer';
import { RiskSegment } from '../../types';
import {
  Layers,
  Filter,
  ShieldAlert,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Eye,
  Crosshair,
  PlusCircle,
} from 'lucide-react';

interface LiveRiskMapViewProps {
  onOpenReportModal: (coords?: [number, number]) => void;
}

export const LiveRiskMapView: React.FC<LiveRiskMapViewProps> = ({
  onOpenReportModal,
}) => {
  const { routes, selectedRoute, activeHazards, nearMissEvents } = useApp();

  const [minRiskFilter, setMinRiskFilter] = useState<number>(0);
  const [selectedSegmentDetail, setSelectedSegmentDetail] = useState<RiskSegment | null>(null);

  const getRiskBadgeColor = (score: number) => {
    if (score >= 81) return '#ef4444';
    if (score >= 61) return '#f97316';
    if (score >= 31) return '#eab308';
    return '#10b981';
  };

  // Aggregate all segments from routes
  const allSegments: RiskSegment[] = routes.flatMap((r) => r.segments || []);
  const filteredSegments = allSegments.filter((s) => s.riskScore >= minRiskFilter);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Real High-Fidelity WebGL Vector Map */}
      <MapContainer />

      {/* Floating Tactical Filter Controls */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          zIndex: 400,
          background: 'rgba(9, 13, 22, 0.92)',
          border: '1px solid rgba(51, 65, 85, 0.7)',
          borderRadius: 10,
          padding: '10px 14px',
          backdropFilter: 'blur(12px)',
          color: '#f8fafc',
          width: 280,
          boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} style={{ color: '#38bdf8' }} />
            <b style={{ fontSize: 12 }}>Risk Filter</b>
          </div>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>
            &ge; {minRiskFilter}/100
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={90}
          step={5}
          value={minRiskFilter}
          onChange={(e) => setMinRiskFilter(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: '#0ea5e9' }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#64748b', marginTop: 3 }}>
          <span>All</span>
          <span>Mod (&ge;31)</span>
          <span>Crit (&ge;81)</span>
        </div>

        <div style={{ borderTop: '1px solid rgba(51, 65, 85, 0.5)', marginTop: 8, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#94a3b8' }}>
          <span>Showing: <b style={{ color: '#f8fafc' }}>{filteredSegments.length}</b> segs</span>
          <span>Hazards: <b style={{ color: '#ef4444' }}>{activeHazards.length}</b></span>
        </div>
      </div>

      {/* Segment Inspector Drawer (Opens when a segment is selected) */}
      {selectedSegmentDetail && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            zIndex: 450,
            background: 'rgba(9, 13, 22, 0.94)',
            border: '1px solid rgba(51, 65, 85, 0.7)',
            borderRadius: 10,
            padding: 14,
            width: 300,
            color: '#f8fafc',
            boxShadow: '0 12px 35px rgba(0,0,0,0.65)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{selectedSegmentDetail.name}</h4>
            <span
              style={{
                background: getRiskBadgeColor(selectedSegmentDetail.riskScore),
                color: '#fff',
                padding: '2px 7px',
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              {selectedSegmentDetail.riskLevel} ({selectedSegmentDetail.riskScore}/100)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#94a3b8' }}>
            <div>Hard Braking Probes: <b style={{ color: '#f8fafc' }}>{selectedSegmentDetail.hardBrakingCount}</b></div>
            <div>Sudden Slowdowns: <b style={{ color: '#f8fafc' }}>{selectedSegmentDetail.suddenSlowdownsCount}</b></div>
            <div>Traffic Density: <b style={{ color: '#f8fafc' }}>{selectedSegmentDetail.trafficDensity}</b></div>
            <div>Surface Condition: <b style={{ color: '#f8fafc' }}>{selectedSegmentDetail.surfaceCondition}</b></div>
            <div style={{ marginTop: 2 }}>
              Action:{' '}
              <span style={{ color: selectedSegmentDetail.riskScore >= 60 ? '#f87171' : '#34d399', fontWeight: 600 }}>
                {selectedSegmentDetail.riskScore >= 60 ? 'Investigate emerging hazard' : 'Normal monitoring'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setSelectedSegmentDetail(null)}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '5px 0',
              background: '#1e293b',
              border: 'none',
              borderRadius: 6,
              color: '#94a3b8',
              fontSize: 10.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close Inspector
          </button>
        </div>
      )}
    </div>
  );
};
