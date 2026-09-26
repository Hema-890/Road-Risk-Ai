import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, CheckCircle2, AlertTriangle, Play, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { navigationVoiceService, VoiceDiagnostics, VoiceLanguage } from '../../services/navigationVoiceService.ts';
import { speechService } from '../../services/speechService.ts';

export const VoiceDiagnosticsBar: React.FC = () => {
  const [diag, setDiag] = useState<VoiceDiagnostics>(navigationVoiceService.getDiagnostics());
  const [expanded, setExpanded] = useState<boolean>(false);
  const [activeTestLang, setActiveTestLang] = useState<string>('');

  useEffect(() => {
    const unsub = navigationVoiceService.subscribeDiagnostics((newDiag) => {
      setDiag({ ...newDiag });
    });
    return unsub;
  }, []);

  const handleTestLanguage = (lang: VoiceLanguage) => {
    setActiveTestLang(lang);
    navigationVoiceService.setLanguage(lang);
    speechService.setLanguage(lang);
    navigationVoiceService.testVoice(lang);
    setTimeout(() => setActiveTestLang(''), 3000);
  };

  const getStatusColor = (status: VoiceDiagnostics['status']) => {
    switch (status) {
      case 'SPEAKING':
        return '#10b981'; // vibrant green
      case 'READY':
        return '#38bdf8'; // sky blue
      case 'BLOCKED':
      case 'ERROR':
        return '#ef4444'; // red
      case 'NO_VOICE_AVAILABLE':
        return '#f59e0b'; // amber
      case 'STOPPED':
        return '#64748b'; // slate
      default:
        return '#38bdf8';
    }
  };

  return (
    <div
      id="roadrisk-voice-diagnostics-bar"
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 9999,
        background: 'rgba(11, 15, 25, 0.94)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${getStatusColor(diag.status)}40`,
        borderRadius: 12,
        padding: '8px 12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 12,
        maxWidth: 380,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: getStatusColor(diag.status),
              boxShadow: diag.isSpeaking ? `0 0 10px ${getStatusColor(diag.status)}` : 'none',
              animation: diag.isSpeaking ? 'pulse 1s infinite' : 'none',
            }}
          />
          <span style={{ fontWeight: 800, letterSpacing: 0.5, color: getStatusColor(diag.status) }}>
            VOICE: {diag.status}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            id="roadrisk-test-voice-btn"
            onClick={() => handleTestLanguage(diag.language)}
            style={{
              background: '#38bdf8',
              color: '#0b0f19',
              border: 'none',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Click to test audible speech in browser speakers"
          >
            <Play size={12} fill="#0b0f19" />
            <span>🔊 Test Voice</span>
          </button>

          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 2,
            }}
            title="Toggle Voice Diagnostics Details"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Language Quick Selector Pills */}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {[
          { code: 'en', label: 'EN', name: 'English' },
          { code: 'te', label: 'తెలుగు', name: 'Telugu' },
          { code: 'hi', label: 'हिंदी', name: 'Hindi' },
          { code: 'ta', label: 'தமிழ்', name: 'Tamil' },
          { code: 'kn', label: 'ಕನ್ನಡ', name: 'Kannada' },
        ].map((item) => {
          const isSelected = diag.language === item.code;
          return (
            <button
              key={item.code}
              id={`voice-lang-btn-${item.code}`}
              onClick={() => handleTestLanguage(item.code as VoiceLanguage)}
              style={{
                flex: 1,
                padding: '3px 4px',
                fontSize: 10,
                borderRadius: 5,
                border: 'none',
                background: isSelected ? '#38bdf8' : 'rgba(255,255,255,0.08)',
                color: isSelected ? '#0b0f19' : '#cbd5e1',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'background 0.15s ease',
              }}
              title={`Switch to & Test ${item.name}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Expanded Diagnostic Telemetry */}
      {expanded && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 11,
            color: '#94a3b8',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Locale:</span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>{diag.locale}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Selected Voice:</span>
            <span
              style={{
                color: '#38bdf8',
                fontWeight: 600,
                maxWidth: 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {diag.selectedVoice}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Voices:</span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>{diag.voiceCount} available</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Speech Queue:</span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>{diag.speechQueueLength}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Speaking / Pending:</span>
            <span style={{ color: diag.isSpeaking ? '#10b981' : '#f8fafc', fontWeight: 600 }}>
              {diag.isSpeaking ? 'YES (Active Audio)' : 'NO'} / {diag.isPending ? 'YES' : 'NO'}
            </span>
          </div>
          {diag.lastSpokenText && (
            <div style={{ marginTop: 2 }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>Last Spoken:</span>
              <div
                style={{
                  fontSize: 10,
                  color: '#cbd5e1',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '4px 6px',
                  borderRadius: 4,
                  marginTop: 2,
                  maxHeight: 40,
                  overflowY: 'auto',
                }}
              >
                "{diag.lastSpokenText}"
              </div>
            </div>
          )}
          {diag.lastError && (
            <div style={{ color: '#ef4444', fontSize: 10, marginTop: 2 }}>
              ⚠️ Error: {diag.lastError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceDiagnosticsBar;
