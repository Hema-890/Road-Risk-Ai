import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  TrendingUp,
  BarChart2,
  Clock,
  ShieldCheck,
  MapPin,
  AlertTriangle,
  Zap,
  Activity,
  Calendar,
} from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { routes, selectedRoute, activeHazards, nearMissEvents, currentCityId } = useApp();

  const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days'>('today');

  // Simulated trend data points
  const hourlyRiskTrend = [
    { hour: '08:00', risk: 24, events: 12 },
    { hour: '09:00', risk: 42, events: 35 },
    { hour: '10:00', risk: 78, events: 58 },
    { hour: '11:00', risk: 65, events: 41 },
    { hour: '12:00', risk: 38, events: 22 },
    { hour: '13:00', risk: 31, events: 18 },
    { hour: '14:00', risk: 54, events: 33 },
    { hour: '15:00', risk: 82, events: 64 },
    { hour: '16:00', risk: 71, events: 49 },
  ];

  const eventTypesData = [
    { name: 'Hard Braking', count: 142, color: '#ef4444', pct: 45 },
    { name: 'Sudden Swerving', count: 68, color: '#f97316', pct: 22 },
    { name: 'Abnormal Slowdown', count: 52, color: '#eab308', pct: 16 },
    { name: 'Road Blockage', count: 31, color: '#a855f7', pct: 10 },
    { name: 'Waterlogging / Flood', count: 22, color: '#06b6d4', pct: 7 },
  ];

  const topHazardousRoads = [
    { name: 'Abids GPO - Gunfoundry Corridor', score: 86, level: 'CRITICAL', events: 54, mainFactor: 'Hard Braking' },
    { name: 'Khairatabad Underpass', score: 78, level: 'HIGH', events: 42, mainFactor: 'Flooding' },
    { name: 'Secunderabad Station Arterial', score: 68, level: 'HIGH', events: 38, mainFactor: 'Traffic Congestion' },
    { name: 'Outer Ring Expressway Sec-4', score: 28, level: 'LOW', events: 6, mainFactor: 'Nominal' },
    { name: 'PVNR Smart Transit Corridor', score: 22, level: 'LOW', events: 4, mainFactor: 'Nominal' },
  ];

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
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Page Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Road Risk Intelligence & Fleet Analytics</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
              Historical near-miss density, route safety trade-offs, and emerging hazard trends
            </p>
          </div>

          <div style={{ display: 'flex', gap: 6, background: '#1e293b', padding: 4, borderRadius: 8 }}>
            {(['today', '7days', '30days'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: timeRange === t ? '#0284c7' : 'transparent',
                  color: timeRange === t ? '#fff' : '#94a3b8',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {t === 'today' ? 'Today' : t === '7days' ? 'Last 7 Days' : 'Last 30 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Top Summary Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <div style={{ background: 'rgba(17, 24, 39, 0.7)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: 10, padding: '16px 18px', backdropFilter: 'blur(10px)' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em' }}>AVERAGE ROUTE RISK</span>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
              34<span style={{ fontSize: 13, color: '#94a3b8' }}>/100</span>
            </div>
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>-18% vs Baseline Unoptimized</span>
          </div>

          <div style={{ background: 'rgba(17, 24, 39, 0.7)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: 10, padding: '16px 18px', backdropFilter: 'blur(10px)' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em' }}>NEAR-MISS PROBES</span>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
              315
            </div>
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>142 Hard Braking Decelerations</span>
          </div>

          <div style={{ background: 'rgba(17, 24, 39, 0.7)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: 10, padding: '16px 18px', backdropFilter: 'blur(10px)' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em' }}>DYNAMIC REROUTES</span>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
              8
            </div>
            <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600 }}>100% Collision Avoidance</span>
          </div>

          <div style={{ background: 'rgba(17, 24, 39, 0.7)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: 10, padding: '16px 18px', backdropFilter: 'blur(10px)' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em' }}>AVERAGE TIME SAVED</span>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
              4.8 min
            </div>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Per High-Priority Mission</span>
          </div>
        </div>

        {/* Charts Row 1: Hourly Risk Score & Event Types */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: 16 }}>
          {/* Chart 1: Risk Score Over Time */}
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Predicted Road Risk Score Over Time</h3>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Hourly corridor risk index across city center nodes</span>
              </div>
              <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>Peak: 82/100 (15:00)</span>
            </div>

            {/* SVG Area / Line Chart */}
            <div style={{ height: 180, width: '100%', position: 'relative' }}>
              <svg style={{ width: '100%', height: '100%', overflow: 'visible' }} viewBox="0 0 500 160">
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal Guide Lines */}
                <line x1="0" y1="20" x2="500" y2="20" stroke="#1e293b" strokeDasharray="3,3" />
                <line x1="0" y1="70" x2="500" y2="70" stroke="#1e293b" strokeDasharray="3,3" />
                <line x1="0" y1="120" x2="500" y2="120" stroke="#1e293b" strokeDasharray="3,3" />

                {/* Fill Area */}
                <polygon
                  points={`0,140 ${hourlyRiskTrend
                    .map((d, i) => `${(i / (hourlyRiskTrend.length - 1)) * 500},${140 - (d.risk / 100) * 120}`)
                    .join(' ')} 500,140`}
                  fill="url(#riskGrad)"
                />

                {/* Polyline */}
                <polyline
                  points={hourlyRiskTrend
                    .map((d, i) => `${(i / (hourlyRiskTrend.length - 1)) * 500},${140 - (d.risk / 100) * 120}`)
                    .join(' ')}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3"
                />

                {/* Points */}
                {hourlyRiskTrend.map((d, i) => (
                  <circle
                    key={i}
                    cx={(i / (hourlyRiskTrend.length - 1)) * 500}
                    cy={140 - (d.risk / 100) * 120}
                    r="4"
                    fill="#fff"
                    stroke="#ef4444"
                    strokeWidth="2"
                  />
                ))}
              </svg>

              {/* X Axis Labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginTop: 10 }}>
                {hourlyRiskTrend.map((d, i) => (
                  <span key={i}>{d.hour}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Chart 2: Event Types Distribution */}
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>Near-Miss Event Breakdown</h3>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Categorization of 315 telemetry triggers</span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              {eventTypesData.map((item) => (
                <div key={item.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: '#cbd5e1' }}>{item.name}</span>
                    <span style={{ fontWeight: 700, color: item.color }}>
                      {item.count} ({item.pct}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Row 2: ETA vs Risk Comparison & Top Hazardous Roads */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Corridor Comparison Table */}
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>Route ETA vs Risk Trade-Off</h3>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Comparison of available corridor choices</span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {routes.map((r) => (
                <div
                  key={r.id}
                  style={{
                    background: '#161e2e',
                    border: r.isRecommended ? '1px solid #0284c7' : '1px solid #1e293b',
                    borderRadius: 6,
                    padding: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: 12, color: r.isRecommended ? '#38bdf8' : '#f8fafc' }}>{r.name}</b>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background: r.riskScore >= 60 ? '#ef4444' : '#10b981',
                        color: '#fff',
                      }}
                    >
                      Risk {r.riskScore}/100
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    <span>ETA: {r.adjustedEtaMinutes} min ({r.distanceKm} km)</span>
                    <span>Suitability: {r.missionSuitabilityScore}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Hazardous Roads List */}
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>Top Monitored Road Segments</h3>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Highest risk clusters flagged for civil investigation</span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {topHazardousRoads.map((road) => (
                <div
                  key={road.name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    background: '#161e2e',
                    borderRadius: 6,
                    border: '1px solid #1e293b',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f8fafc' }}>{road.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>
                      Main Factor: <b style={{ color: '#cbd5e1' }}>{road.mainFactor}</b> ({road.events} events)
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 800,
                      background: road.score >= 80 ? '#ef4444' : road.score >= 60 ? '#f97316' : '#10b981',
                      color: '#fff',
                    }}
                  >
                    {road.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
