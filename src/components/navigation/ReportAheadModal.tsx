// ==============================================================================
// ROADRISK AI — REPORT AHEAD MODAL
// Fast 1-tap citizen road hazard reporting interface
// ==============================================================================

import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  Send,
  CheckCircle2,
  Car,
  Waves,
  Construction,
  CircleAlert,
  Wrench,
  Ban,
  ShieldCheck,
} from 'lucide-react';
import hazardReportService, { UserHazardType } from '../../services/hazardReportService.ts';

interface ReportAheadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCoordinates: [number, number]; // [lng, lat]
  onReportSubmitted?: () => void;
}

const HAZARD_OPTIONS: Array<{
  type: UserHazardType;
  label: string;
  icon: React.ReactNode;
  color: string;
}> = [
  { type: 'Accident', label: 'Accident', icon: <Car size={18} />, color: '#ef4444' },
  { type: 'Road blocked', label: 'Road Blocked', icon: <Ban size={18} />, color: '#dc2626' },
  { type: 'Flooding', label: 'Waterlogging', icon: <Waves size={18} />, color: '#0284c7' },
  { type: 'Pothole', label: 'Severe Pothole', icon: <CircleAlert size={18} />, color: '#f59e0b' },
  { type: 'Construction', label: 'Road Work', icon: <Construction size={18} />, color: '#f97316' },
  { type: 'Traffic hazard', label: 'Traffic Jam', icon: <AlertTriangle size={18} />, color: '#eab308' },
  { type: 'Vehicle breakdown', label: 'Breakdown', icon: <Wrench size={18} />, color: '#8b5cf6' },
  { type: 'Other hazard', label: 'Other Hazard', icon: <AlertTriangle size={18} />, color: '#64748b' },
];

export const ReportAheadModal: React.FC<ReportAheadModalProps> = ({
  isOpen,
  onClose,
  currentCoordinates,
  onReportSubmitted,
}) => {
  const [selectedType, setSelectedType] = useState<UserHazardType>('Accident');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await hazardReportService.submitReport(
        selectedType,
        currentCoordinates,
        description,
        `Corridor [${currentCoordinates[1].toFixed(4)}, ${currentCoordinates[0].toFixed(4)}]`
      );
      setSuccess(true);
      if (onReportSubmitted) onReportSubmitted();
      setTimeout(() => {
        setSuccess(false);
        setDescription('');
        onClose();
      }, 1400);
    } catch (e) {
      console.warn('Report submission failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 16,
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden',
          color: '#f8fafc',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#1e293b55',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#ef444422',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Report Road Hazard</h3>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
                Alert fellow motorists and emergency dispatchers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Hazard Reported</h4>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                Broadcasted as <span style={{ color: '#f59e0b', fontWeight: 600 }}>USER_REPORTED</span>. Thank you for making roads safer!
              </p>
            </div>
          ) : (
            <>
              {/* GPS indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: '#38bdf8',
                  background: '#0284c715',
                  padding: '6px 12px',
                  borderRadius: 8,
                  marginBottom: 16,
                  border: '1px solid #0284c733',
                }}
              >
                <ShieldCheck size={14} />
                <span>
                  GPS Location: {currentCoordinates[1].toFixed(5)}, {currentCoordinates[0].toFixed(5)}
                </span>
              </div>

              {/* Hazard Selection Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {HAZARD_OPTIONS.map((opt) => {
                  const isSelected = selectedType === opt.type;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setSelectedType(opt.type)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: isSelected ? '#1e293b' : '#0f172a',
                        border: isSelected ? `2px solid ${opt.color}` : '1px solid #334155',
                        color: isSelected ? '#f8fafc' : '#cbd5e1',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ color: opt.color }}>{opt.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 500 }}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Optional Description */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                  Additional Details (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Left lane blocked by overturned vehicle"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={120}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    background: '#ef4444',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  <Send size={14} />
                  <span>{submitting ? 'Submitting...' : 'Submit Report'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportAheadModal;
