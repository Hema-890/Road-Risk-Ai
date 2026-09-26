// ==============================================================================
// ROADRISK AI — BACKGROUND NAVIGATION VOICE SETTINGS PANEL
// Controls Voice Enabled/Disabled, Language (English, Telugu, Hindi, Tamil, Kannada),
// Gender (Female / Male), Volume Slider, and Immediate Audio Test.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Mic, Play, Check, X } from 'lucide-react';
import navigationVoiceService, { VoiceLanguage, VoiceGender } from '../../services/navigationVoiceService.ts';

interface VoiceSettingsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceSettingsPopover: React.FC<VoiceSettingsPopoverProps> = ({ isOpen, onClose }) => {
  const [enabled, setEnabled] = useState<boolean>(navigationVoiceService.isVoiceEnabled());
  const [language, setLanguage] = useState<VoiceLanguage>(navigationVoiceService.getLanguage());
  const [gender, setGender] = useState<VoiceGender>(navigationVoiceService.getGender());
  const [volume, setVolume] = useState<number>(navigationVoiceService.getVolume());
  const [tested, setTested] = useState<boolean>(false);

  useEffect(() => {
    setEnabled(navigationVoiceService.isVoiceEnabled());
    setLanguage(navigationVoiceService.getLanguage());
    setGender(navigationVoiceService.getGender());
    setVolume(navigationVoiceService.getVolume());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleEnabled = (val: boolean) => {
    setEnabled(val);
    navigationVoiceService.setVoiceEnabled(val);
  };

  const handleLanguageChange = (lang: VoiceLanguage) => {
    setLanguage(lang);
    navigationVoiceService.setLanguage(lang);
  };

  const handleGenderChange = (gen: VoiceGender) => {
    setGender(gen);
    navigationVoiceService.setGender(gen);
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    navigationVoiceService.setVolume(vol);
  };

  const handleTestVoice = () => {
    setTested(true);
    navigationVoiceService.testVoice();
    setTimeout(() => setTested(false), 2500);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 48,
        right: 120,
        zIndex: 9999,
        width: 290,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: 12,
        padding: 14,
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.65)',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Mic size={14} color="#38bdf8" />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>VOICE NAVIGATION</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 2,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* 1. Toggle ON / OFF */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
        <span style={{ fontSize: 11.5, color: '#cbd5e1', fontWeight: 600 }}>Background Voice</span>
        <div style={{ display: 'flex', background: 'rgba(30, 41, 59, 0.8)', borderRadius: 6, padding: 2 }}>
          <button
            onClick={() => handleToggleEnabled(true)}
            style={{
              background: enabled ? '#0284c7' : 'transparent',
              color: enabled ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ON
          </button>
          <button
            onClick={() => handleToggleEnabled(false)}
            style={{
              background: !enabled ? '#dc2626' : 'transparent',
              color: !enabled ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            OFF
          </button>
        </div>
      </div>

      {/* 2. Language Selection */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>LANGUAGE</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
          {(
            [
              { code: 'en', label: 'English' },
              { code: 'te', label: 'తెలుగు' },
              { code: 'hi', label: 'हिन्दी' },
              { code: 'ta', label: 'தமிழ்' },
              { code: 'kn', label: 'ಕನ್ನಡ' },
            ] as const
          ).map((item) => (
            <button
              key={item.code}
              onClick={() => handleLanguageChange(item.code)}
              style={{
                background: language === item.code ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                border: language === item.code ? '1px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.5)',
                color: language === item.code ? '#38bdf8' : '#e2e8f0',
                borderRadius: 6,
                padding: '5px 4px',
                fontSize: 11,
                fontWeight: language === item.code ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Gender Selection (Female / Male) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>VOICE GENDER</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['female', 'male'] as const).map((g) => (
            <button
              key={g}
              onClick={() => handleGenderChange(g)}
              style={{
                flex: 1,
                background: gender === g ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                border: gender === g ? '1px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.5)',
                color: gender === g ? '#38bdf8' : '#e2e8f0',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: 11,
                fontWeight: gender === g ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                textTransform: 'capitalize',
              }}
            >
              {gender === g && <Check size={12} />}
              <span>{g}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Volume Slider */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>
          <span>VOLUME</span>
          <span>{Math.round(volume * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            accentColor: '#38bdf8',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* 5. Test Button */}
      <button
        onClick={handleTestVoice}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: '#ffffff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 11.5,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
        }}
      >
        <Play size={12} fill="#ffffff" />
        <span>{tested ? 'Speaking...' : '▶ Test Voice'}</span>
      </button>
    </div>
  );
};

export default VoiceSettingsPopover;
