// ==============================================================================
// ROADRISK AI — VOICE COMMAND DISCOVERY MODAL ("WHAT CAN I SAY?")
// Interactive, visual cheat-sheet for hands-free and voice-directed navigation.
// Users can see and click any command to execute it directly.
// ==============================================================================

import React from 'react';
import {
  X,
  Mic,
  Navigation,
  Car,
  Search,
  MapPin,
  Volume2,
  Clock,
  CornerUpRight,
  Compass,
  Bike,
  Footprints,
  Train,
} from 'lucide-react';

interface VoiceCommandHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCommand?: (commandText: string) => void;
}

interface CommandCategory {
  title: string;
  icon: React.ReactNode;
  color: string;
  badge: string;
  commands: string[];
}

export const VoiceCommandHelpModal: React.FC<VoiceCommandHelpModalProps> = ({
  isOpen,
  onClose,
  onSelectCommand,
}) => {
  if (!isOpen) return null;

  const categories: CommandCategory[] = [
    {
      title: 'Navigation',
      icon: <Navigation size={18} color="#38bdf8" />,
      color: '#38bdf8',
      badge: 'CORE',
      commands: [
        'Navigate to Vijayawada',
        'Take me to Hyderabad',
        'Start navigation',
        'Stop navigation',
        'Recalculate route',
      ],
    },
    {
      title: 'Transport Modes',
      icon: <Car size={18} color="#10b981" />,
      color: '#10b981',
      badge: 'MODES',
      commands: [
        'Switch to car',
        'Switch to bike',
        'Switch to bicycle',
        'Switch to walking',
        'Switch to transit',
      ],
    },
    {
      title: 'Search & POIs',
      icon: <Search size={18} color="#f59e0b" />,
      color: '#f59e0b',
      badge: 'DISCOVERY',
      commands: [
        'Find petrol stations',
        'Find hospitals',
        'Find police stations',
        'Find restaurants',
        'Find charging stations',
      ],
    },
    {
      title: 'Map & Viewport',
      icon: <Compass size={18} color="#a855f7" />,
      color: '#a855f7',
      badge: 'MAP',
      commands: ['Zoom in', 'Zoom out', 'Recenter map'],
    },
    {
      title: 'Voice Controls',
      icon: <Volume2 size={18} color="#ec4899" />,
      color: '#ec4899',
      badge: 'AUDIO',
      commands: ['Repeat that', 'Mute voice', 'Unmute voice'],
    },
    {
      title: 'Departure Timing',
      icon: <Clock size={18} color="#06b6d4" />,
      color: '#06b6d4',
      badge: 'TIME',
      commands: ['Depart now', 'Depart at 6 PM'],
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-help-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(5, 8, 16, 0.82)',
        backdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(9, 13, 22, 0.98))',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: 20,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(56, 189, 248, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
          animation: 'fadeInScale 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(30, 41, 59, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(14, 165, 233, 0.15))',
                border: '1px solid #38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(56, 189, 248, 0.3)',
              }}
            >
              <Mic size={20} color="#38bdf8" />
            </div>
            <div>
              <h2
                id="voice-help-title"
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  margin: 0,
                  letterSpacing: '-0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                🎙️ What can I say?
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
                Speak clearly into your microphone in English, Telugu, Hindi, Tamil, or Kannada.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close voice guide"
            style={{
              background: 'rgba(51, 65, 85, 0.4)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#f8fafc';
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
              e.currentTarget.style.borderColor = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.background = 'rgba(51, 65, 85, 0.4)';
              e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Categories Grid */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {categories.map((cat, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: `1px solid rgba(51, 65, 85, 0.6)`,
                borderRadius: 14,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'border-color 0.15s ease',
              }}
            >
              {/* Category Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      padding: 6,
                      borderRadius: 8,
                      background: `${cat.color}18`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {cat.icon}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{cat.title}</span>
                </div>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: `${cat.color}25`,
                    color: cat.color,
                    border: `1px solid ${cat.color}40`,
                  }}
                >
                  {cat.badge}
                </span>
              </div>

              {/* Commands List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cat.commands.map((cmd, cIdx) => (
                  <button
                    key={cIdx}
                    onClick={() => {
                      if (onSelectCommand) {
                        onSelectCommand(cmd);
                        onClose();
                      }
                    }}
                    style={{
                      background: 'rgba(30, 41, 59, 0.45)',
                      border: '1px solid rgba(51, 65, 85, 0.4)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 12,
                      color: '#cbd5e1',
                      textAlign: 'left',
                      cursor: onSelectCommand ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      if (onSelectCommand) {
                        e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)';
                        e.currentTarget.style.borderColor = '#38bdf8';
                        e.currentTarget.style.color = '#38bdf8';
                        e.currentTarget.style.transform = 'translateX(2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (onSelectCommand) {
                        e.currentTarget.style.background = 'rgba(30, 41, 59, 0.45)';
                        e.currentTarget.style.borderColor = 'rgba(51, 65, 85, 0.4)';
                        e.currentTarget.style.color = '#cbd5e1';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }
                    }}
                  >
                    <span>"{cmd}"</span>
                    {onSelectCommand && <CornerUpRight size={12} style={{ opacity: 0.6 }} />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(51, 65, 85, 0.4)',
            background: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11.5,
            color: '#94a3b8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
            <span>Click any example to speak or execute it directly.</span>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              border: 'none',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceCommandHelpModal;
