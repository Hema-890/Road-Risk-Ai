import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { NearMissEvent } from '../../types';
import {
  Flame,
  AlertTriangle,
  Waves,
  Ban,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
  Clock,
  Car,
} from 'lucide-react';

export const EventSimulatorView: React.FC = () => {
  const {
    selectedRoute,
    generateSimulatedEvent,
    clearAllSimulatedEvents,
    nearMissEvents,
    activeHazards,
    routes,
    setSelectedRouteId,
  } = useApp();

  const [eventCount, setEventCount] = useState<number>(5);
  const [severity, setSeverity] = useState<NearMissEvent['severity']>('high');
  const [timeWindowMin, setTimeWindowMin] = useState<number>(10);
  const [lastGeneratedInfo, setLastGeneratedInfo] = useState<string | null>(null);

  const handleGenerate = (
    type: NearMissEvent['eventType'] | 'FLOOD' | 'BLOCKAGE' | 'TRAFFIC' | 'ACCIDENT',
    label: string
  ) => {
    generateSimulatedEvent(type, eventCount, severity);
    setLastGeneratedInfo(
      `Generated ${eventCount}x ${label} events on ${selectedRoute?.name || 'Corridor'}. Explainable Road-Risk Engine recalculated segment scores.`
    );
    setTimeout(() => setLastGeneratedInfo(null), 5000);
  };

  const handleRandomScenario = () => {
    const types: (NearMissEvent['eventType'] | 'FLOOD' | 'BLOCKAGE' | 'TRAFFIC' | 'ACCIDENT')[] = [
      'HARD_BRAKE',
      'SUDDEN_SWERVE',
      'ABNORMAL_SLOWDOWN',
      'ACCIDENT',
      'FLOOD',
      'BLOCKAGE',
      'TRAFFIC',
    ];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const count = Math.floor(Math.random() * 15) + 5;
    generateSimulatedEvent(randomType, count, 'critical');
    setLastGeneratedInfo(
      `Randomized scenario triggered: ${count}x ${randomType} injected. Check map for risk color shifts.`
    );
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
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid #eab308',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#eab308',
                }}
              >
                <Activity size={20} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Near-Miss & Hazard Event Simulator</h1>
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                  Inject probe decelerations, swerving, flooding, and road blockages to test dynamic rerouting
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={clearAllSimulatedEvents}
            style={{
              padding: '8px 14px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#f87171',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RotateCcw size={14} />
            <span>Clear Events</span>
          </button>
        </div>

        {lastGeneratedInfo && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid #10b981',
              color: '#10b981',
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle2 size={16} />
            <span>{lastGeneratedInfo}</span>
          </div>
        )}

        {/* Configuration Controls Bar */}
        <div
          style={{
            background: '#131b2e',
            border: '1px solid #1e293b',
            borderRadius: 10,
            padding: 18,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
              Target Route / Road Segment
            </label>
            <select
              value={selectedRoute?.id}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 6,
                color: '#f8fafc',
                fontSize: 12,
              }}
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
              Number of Events
            </label>
            <select
              value={eventCount}
              onChange={(e) => setEventCount(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 6,
                color: '#f8fafc',
                fontSize: 12,
              }}
            >
              <option value={1}>1 event (isolated anomaly)</option>
              <option value={5}>5 events (moderate warning)</option>
              <option value={10}>10 events (elevated spike)</option>
              <option value={20}>20 events (critical hazard cluster)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
              Assessed Severity
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 6,
                color: '#f8fafc',
                fontSize: 12,
              }}
            >
              <option value="low">Low (&lt;0.25g deceleration)</option>
              <option value="moderate">Moderate (&lt;0.4g deceleration)</option>
              <option value="high">High (&gt;0.45g deceleration)</option>
              <option value="critical">Critical (Collision shockwave)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
              Time Clustering Window
            </label>
            <select
              value={timeWindowMin}
              onChange={(e) => setTimeWindowMin(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 6,
                color: '#f8fafc',
                fontSize: 12,
              }}
            >
              <option value={5}>Last 5 minutes</option>
              <option value={10}>Last 10 minutes</option>
              <option value={30}>Last 30 minutes</option>
            </select>
          </div>
        </div>

        {/* Categorized Generator Groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Group 1: ROAD EVENTS */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#38bdf8', textTransform: 'uppercase' }}>
                ROAD EVENTS
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(56, 189, 248, 0.2)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <button
                onClick={() => handleGenerate('HARD_BRAKE', 'Hard Braking')}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(22, 30, 46, 0.8)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: 8,
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(22, 30, 46, 0.8)')}
              >
                <div style={{ background: 'rgba(37,99,235,0.2)', padding: 8, borderRadius: 6, color: '#60a5fa' }}>
                  <Car size={18} />
                </div>
                <div>
                  <b style={{ display: 'block', fontSize: 13 }}>Hard Braking</b>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Abrupt deceleration &gt;0.45g</span>
                </div>
              </button>

              <button
                onClick={() => handleGenerate('SUDDEN_SWERVE', 'Sudden Swerving')}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(22, 30, 46, 0.8)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: 8,
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(22, 30, 46, 0.8)')}
              >
                <div style={{ background: 'rgba(245,158,11,0.2)', padding: 8, borderRadius: 6, color: '#fbbf24' }}>
                  <TrendingUp size={18} />
                </div>
                <div>
                  <b style={{ display: 'block', fontSize: 13 }}>Sudden Swerving</b>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Lateral lane deflection &gt;2.5m/s²</span>
                </div>
              </button>

              <button
                onClick={() => handleGenerate('ABNORMAL_SLOWDOWN', 'Abnormal Slowdown')}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(22, 30, 46, 0.8)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  borderRadius: 8,
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(22, 30, 46, 0.8)')}
              >
                <div style={{ background: 'rgba(139,92,246,0.2)', padding: 8, borderRadius: 6, color: '#a78bfa' }}>
                  <Clock size={18} />
                </div>
                <div>
                  <b style={{ display: 'block', fontSize: 13 }}>Abnormal Slowdown</b>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Stop-and-go shockwave pattern</span>
                </div>
              </button>
            </div>
          </div>

          {/* Group 2: INCIDENTS */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#f43f5e', textTransform: 'uppercase' }}>
                INCIDENTS
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(244, 63, 94, 0.2)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <button
                onClick={() => handleGenerate('ACCIDENT', 'Accident Collision')}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(22, 30, 46, 0.8)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 8,
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(22, 30, 46, 0.8)')}
              >
                <div style={{ background: 'rgba(239,68,68,0.2)', padding: 8, borderRadius: 6, color: '#f87171' }}>
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <b style={{ display: 'block', fontSize: 13 }}>Accident</b>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Collision blocking primary lanes</span>
                </div>
              </button>

              <button
                onClick={() => handleGenerate('BLOCKAGE', 'Road Blockage')}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(22, 30, 46, 0.8)',
                  border: '1px solid rgba(249, 115, 22, 0.4)',
                  borderRadius: 8,
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(249, 115, 22, 0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(22, 30, 46, 0.8)')}
              >
                <div style={{ background: 'rgba(249,115,22,0.2)', padding: 8, borderRadius: 6, color: '#fb923c' }}>
                  <Ban size={18} />
                </div>
                <div>
                  <b style={{ display: 'block', fontSize: 13 }}>Road Block</b>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Fallen tree / structural barrier</span>
                </div>
              </button>

              <button
                onClick={() => handleGenerate('FLOOD', 'Flash Flooding')}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(22, 30, 46, 0.8)',
                  border: '1px solid rgba(6, 182, 212, 0.4)',
                  borderRadius: 8,
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(6, 182, 212, 0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(22, 30, 46, 0.8)')}
              >
                <div style={{ background: 'rgba(6,182,212,0.2)', padding: 8, borderRadius: 6, color: '#22d3ee' }}>
                  <Waves size={18} />
                </div>
                <div>
                  <b style={{ display: 'block', fontSize: 13 }}>Flooding</b>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Standing water in underpass</span>
                </div>
              </button>
            </div>
          </div>

          {/* Group 3: TRAFFIC */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#10b981', textTransform: 'uppercase' }}>
                TRAFFIC
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(16, 185, 129, 0.2)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                onClick={() => handleGenerate('TRAFFIC', 'Traffic Congestion Spike')}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(22, 30, 46, 0.8)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: 8,
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(22, 30, 46, 0.8)')}
              >
                <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: 8, borderRadius: 6, color: '#34d399' }}>
                  <TrendingUp size={18} />
                </div>
                <div>
                  <b style={{ display: 'block', fontSize: 13 }}>Traffic Spike</b>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Density surge slowing corridor throughput</span>
                </div>
              </button>

              <button
                onClick={handleRandomScenario}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(2, 132, 199, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: 8,
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(2, 132, 199, 0.25)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(2, 132, 199, 0.15)')}
              >
                <div style={{ background: 'rgba(56, 189, 248, 0.2)', padding: 8, borderRadius: 6, color: '#38bdf8' }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <b style={{ display: 'block', fontSize: 13 }}>Random Scenario</b>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Injected randomized combination anomaly</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Live Near-Miss Events Table */}
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
              Live Ingested Probe Telemetry ({nearMissEvents.length} Events)
            </h3>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Spatial & Temporal Cluster Analysis Active
            </span>
          </div>

          {nearMissEvents.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              No active near-miss anomaly events. Use the buttons above to inject simulated probe events.
            </div>
          ) : (
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>
                    <th style={{ padding: '6px 8px' }}>VEHICLE ID</th>
                    <th style={{ padding: '6px 8px' }}>EVENT TYPE</th>
                    <th style={{ padding: '6px 8px' }}>VELOCITY DELTA</th>
                    <th style={{ padding: '6px 8px' }}>COORDINATES</th>
                    <th style={{ padding: '6px 8px' }}>SEVERITY</th>
                    <th style={{ padding: '6px 8px' }}>TIMESTAMP</th>
                  </tr>
                </thead>
                <tbody>
                  {nearMissEvents.slice(0, 15).map((evt) => (
                    <tr key={evt.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{evt.vehicleId}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{evt.eventType}</td>
                      <td style={{ padding: '6px 8px' }}>
                        {evt.speedBefore} → {evt.speedAfter} km/h
                      </td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#94a3b8' }}>
                        [{evt.coordinates[0].toFixed(4)}, {evt.coordinates[1].toFixed(4)}]
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            background:
                              evt.severity === 'critical'
                                ? 'rgba(239,68,68,0.2)'
                                : evt.severity === 'high'
                                ? 'rgba(249,115,22,0.2)'
                                : 'rgba(234,179,8,0.2)',
                            color:
                              evt.severity === 'critical'
                                ? '#ef4444'
                                : evt.severity === 'high'
                                ? '#f97316'
                                : '#eab308',
                          }}
                        >
                          {evt.severity.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>{evt.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
