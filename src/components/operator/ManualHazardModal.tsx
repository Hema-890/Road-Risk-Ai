import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ManualHazardReport } from '../../types';
import { AlertTriangle, MapPin, X, CheckCircle, ShieldAlert } from 'lucide-react';

interface ManualHazardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCoords?: [number, number] | null;
}

export const ManualHazardModal: React.FC<ManualHazardModalProps> = ({
  isOpen,
  onClose,
  initialCoords,
}) => {
  const { addManualHazardReport, currentCityId } = useApp();

  const [category, setCategory] = useState<ManualHazardReport['category']>('road_blockage');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<ManualHazardReport['severity']>('high');
  const [lng, setLng] = useState<number>(initialCoords ? initialCoords[0] : 78.474);
  const [lat, setLat] = useState<number>(initialCoords ? initialCoords[1] : 17.396);
  const [submitted, setSubmitted] = useState(false);

  React.useEffect(() => {
    if (initialCoords) {
      setLng(initialCoords[0]);
      setLat(initialCoords[1]);
    }
  }, [initialCoords]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newReport: ManualHazardReport = {
      id: `manual_haz_${Date.now()}`,
      category,
      title: title || `${category.replace('_', ' ').toUpperCase()} Reported`,
      description: description || `Reported by field incident unit at coordinates [${lng.toFixed(4)}, ${lat.toFixed(4)}]`,
      severity,
      coordinates: [lng, lat],
      locationName: `Incident Sector near [${lng.toFixed(4)}, ${lat.toFixed(4)}]`,
      reportedBy: 'Emergency Operations Unit',
      reportedAt: 'Just now',
      verified: true,
    };

    addManualHazardReport(newReport);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1200);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 12,
          padding: 24,
          color: '#f8fafc',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📍 Report Road Hazard</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                Inject field hazard data into Explainable Road-Risk Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <CheckCircle size={44} style={{ color: '#10b981', margin: '0 auto 12px' }} />
            <h4 style={{ margin: 0, fontSize: 16, color: '#10b981' }}>Hazard Reported Successfully!</h4>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#94a3b8' }}>
              Updating segment risk scores and evaluating route impact...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
                What happened?
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { id: 'accident', label: 'Accident', icon: '⚠', desc: 'Collision' },
                  { id: 'road_blockage', label: 'Road Block', icon: '🚧', desc: 'Obstruction' },
                  { id: 'flooding', label: 'Flooding', icon: '🌊', desc: 'Waterlogging' },
                  { id: 'construction', label: 'Traffic', icon: '🚗', desc: 'Heavy Bottleneck' },
                  { id: 'pothole', label: 'Road Damage', icon: '🛣', desc: 'Pothole / Degradation' },
                  { id: 'poor_visibility', label: 'Other', icon: '⚡', desc: 'Hazard Alert' },
                ].map((item) => {
                  const isSelected = category === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCategory(item.id as any);
                        if (!title) setTitle(`${item.label} Reported`);
                      }}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 8,
                        border: isSelected ? '1px solid #ef4444' : '1px solid rgba(51, 65, 85, 0.6)',
                        background: isSelected ? 'rgba(239, 68, 68, 0.16)' : 'rgba(30, 41, 59, 0.6)',
                        color: isSelected ? '#f87171' : '#cbd5e1',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 3,
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{item.icon}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700 }}>{item.label}</span>
                      <span style={{ fontSize: 9.5, color: isSelected ? '#fca5a5' : '#64748b' }}>{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                Hazard Title
              </label>
              <input
                type="text"
                placeholder="e.g., Overturned vehicle blocking corridor"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(51, 65, 85, 0.7)',
                  borderRadius: 6,
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                Description & Impact
              </label>
              <textarea
                rows={2}
                placeholder="Details on lane obstruction or estimated clearance time..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: 6,
                  color: '#f8fafc',
                  fontSize: 13,
                  resize: 'none',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                  Longitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: 6,
                    color: '#f8fafc',
                    fontSize: 12,
                    fontFamily: 'monospace',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                  Latitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: 6,
                    color: '#f8fafc',
                    fontSize: 12,
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                Assessed Severity Level
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {(['low', 'moderate', 'high', 'critical'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSeverity(lvl)}
                    style={{
                      padding: '6px 0',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      border: severity === lvl ? '2px solid #38bdf8' : '1px solid #334155',
                      background:
                        severity === lvl
                          ? lvl === 'critical'
                            ? '#ef4444'
                            : lvl === 'high'
                            ? '#f97316'
                            : lvl === 'moderate'
                            ? '#eab308'
                            : '#10b981'
                          : '#1e293b',
                      color: severity === lvl ? '#fff' : '#94a3b8',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: 6,
                  color: '#94a3b8',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  flex: 2,
                  padding: '10px 0',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                }}
              >
                Submit Hazard Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
