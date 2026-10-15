import React, { useState, useEffect } from 'react';
import { modeService } from '../../services/modeService.ts';
import { roadRiskOrchestrator } from '../../services/roadRiskOrchestrator.ts';
import type { RoadRiskMode, ModeConfiguration } from '../../types/modes.ts';
import { Compass, Accessibility, GraduationCap, Luggage, ChevronDown, Sliders } from 'lucide-react';

interface UserModeSelectorProps {
  onOpenSettings?: (mode: RoadRiskMode) => void;
}

export const UserModeSelector: React.FC<UserModeSelectorProps> = ({ onOpenSettings }) => {
  const [config, setConfig] = useState<ModeConfiguration>(modeService.getConfig());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    return modeService.subscribe((newConfig) => {
      setConfig(newConfig);
    });
  }, []);

  const handleSelectMode = (newMode: RoadRiskMode) => {
    modeService.setMode(newMode);
    roadRiskOrchestrator.setUserMode(newMode);
    setIsOpen(false);
  };

  const currentMode = config.mode;

  const modeDetails: Record<RoadRiskMode, { label: string; icon: React.ReactNode; color: string; badge: string }> = {
    STANDARD: {
      label: 'Standard',
      icon: <Compass className="w-4 h-4 text-emerald-400" aria-hidden="true" />,
      color: 'border-emerald-500/40 text-emerald-300',
      badge: '🗺 Standard',
    },
    ACCESSIBILITY: {
      label: 'Accessibility',
      icon: <Accessibility className="w-4 h-4 text-sky-400" aria-hidden="true" />,
      color: 'border-sky-500/50 text-sky-300',
      badge: '♿ Accessibility',
    },
    CAMPUS: {
      label: 'Campus',
      icon: <GraduationCap className="w-4 h-4 text-amber-400" aria-hidden="true" />,
      color: 'border-amber-500/50 text-amber-300',
      badge: '🎓 Campus',
    },
    TOURIST: {
      label: 'Tourist',
      icon: <Luggage className="w-4 h-4 text-rose-400" aria-hidden="true" />,
      color: 'border-rose-500/50 text-rose-300',
      badge: '🧳 Tourist',
    },
  };

  const active = modeDetails[currentMode];

  return (
    <div className="relative inline-block text-left" style={{ zIndex: 1050 }}>
      {/* Floating Mode Pill Button */}
      <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-full p-1 shadow-lg shadow-black/40 hover:border-slate-500 transition-all">
        <button
          id="user-mode-selector-btn"
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${active.color} bg-slate-800/80 hover:bg-slate-700/90`}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label={`Current User Mode: ${active.label}. Click to switch mode.`}
        >
          {active.icon}
          <span>{active.label}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {currentMode !== 'STANDARD' && onOpenSettings && (
          <button
            type="button"
            onClick={() => onOpenSettings(currentMode)}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={`Configure ${active.label} Preferences`}
            aria-label={`Configure ${active.label} Preferences`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Mode Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: 1040 }}
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute left-0 mt-2 w-64 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 shadow-2xl shadow-black/60 p-2 text-slate-100 divide-y divide-slate-800"
            style={{ zIndex: 1051 }}
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="user-mode-selector-btn"
          >
            <div className="px-3 py-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">RoadRisk AI User Mode</p>
              <p className="text-xs text-slate-300 mt-0.5">Select navigation and discovery profile</p>
            </div>

            <div className="py-1.5 space-y-1">
              {(['STANDARD', 'ACCESSIBILITY', 'CAMPUS', 'TOURIST'] as RoadRiskMode[]).map((modeKey) => {
                const item = modeDetails[modeKey];
                const isSelected = currentMode === modeKey;
                return (
                  <button
                    key={modeKey}
                    type="button"
                    onClick={() => handleSelectMode(modeKey)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-slate-800 text-white font-semibold ring-1 ring-slate-600'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50">
                        {item.icon}
                      </div>
                      <div>
                        <div className="text-xs">{item.label}</div>
                        <div className="text-[10px] text-slate-400">
                          {modeKey === 'STANDARD' && 'Fastest & Safest corridors'}
                          {modeKey === 'ACCESSIBILITY' && 'Step-free & ramp routing'}
                          {modeKey === 'CAMPUS' && 'Buildings & pedestrian paths'}
                          {modeKey === 'TOURIST' && 'Landmarks & 1-day trips'}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" />
                    )}
                  </button>
                );
              })}
            </div>

            {currentMode !== 'STANDARD' && onOpenSettings && (
              <div className="pt-2 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenSettings(currentMode);
                  }}
                  className="w-full py-1.5 px-3 rounded-lg text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-950/40 font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configure {active.label} Settings</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default UserModeSelector;
