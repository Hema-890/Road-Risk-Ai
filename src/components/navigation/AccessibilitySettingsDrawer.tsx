import React, { useState, useEffect } from 'react';
import { modeService } from '../../services/modeService.ts';
import type { AccessibilityPreferences } from '../../types/modes.ts';
import { X, Check, Accessibility, Eye, Volume2, Move, ShieldCheck, HelpCircle } from 'lucide-react';

interface AccessibilitySettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccessibilitySettingsDrawer: React.FC<AccessibilitySettingsDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(
    modeService.getConfig().accessibilityPreferences
  );

  useEffect(() => {
    return modeService.subscribe((config) => {
      setPreferences(config.accessibilityPreferences);
    });
  }, []);

  // Sync high contrast, large controls, reduced motion directly to DOM for instant visual adaptation
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (preferences.highContrastUI) {
        document.documentElement.classList.add('roadrisk-high-contrast');
      } else {
        document.documentElement.classList.remove('roadrisk-high-contrast');
      }

      if (preferences.largeControls) {
        document.documentElement.classList.add('roadrisk-large-controls');
      } else {
        document.documentElement.classList.remove('roadrisk-large-controls');
      }

      if (preferences.reducedMotion) {
        document.documentElement.classList.add('roadrisk-reduced-motion');
      } else {
        document.documentElement.classList.remove('roadrisk-reduced-motion');
      }
    }
  }, [preferences.highContrastUI, preferences.largeControls, preferences.reducedMotion]);

  if (!isOpen) return null;

  const handleToggle = (key: keyof AccessibilityPreferences) => {
    const updated = {
      ...preferences,
      [key]: !preferences[key],
    };
    setPreferences(updated);
    modeService.updateAccessibilityPreferences(updated);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-end z-[1200] bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="accessibility-settings-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className="w-full max-w-md h-full bg-slate-900 border-l border-slate-700/80 shadow-2xl flex flex-col text-slate-100 overflow-hidden"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Accessibility className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="accessibility-settings-title" className="text-base font-bold text-white tracking-wide">
                Accessibility Profile
              </h2>
              <p className="text-xs text-slate-400">Route & Interface Accommodations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close accessibility settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Note Banner */}
          <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-800/50 text-xs text-sky-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sky-100">Verified Barrier-Free Routing</p>
              <p className="mt-0.5 text-sky-300/90 leading-relaxed">
                Routes avoid steps, stairs, and excessive gradients where verified. If accessibility data is unverified on a corridor, it is transparently reported.
              </p>
            </div>
          </div>

          {/* Section 1: Mobility & Physical Routing */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>Physical & Mobility Routing</span>
            </h3>

            <div className="space-y-2">
              <ToggleRow
                id="toggle-wheelchair-user"
                label="Wheelchair User Mode"
                description="Prioritizes verified curb cuts, elevators, and wide level sidewalks"
                checked={preferences.wheelchairUser}
                onChange={() => handleToggle('wheelchairUser')}
              />
              <ToggleRow
                id="toggle-avoid-stairs"
                label="Avoid Stairs & Steps"
                description="Penalizes and reroutes away from footbridges and steps"
                checked={preferences.avoidStairs}
                onChange={() => handleToggle('avoidStairs')}
              />
              <ToggleRow
                id="toggle-step-free"
                label="Strict Step-Free Route"
                description="Guarantees level ground or ramp access from origin to destination"
                checked={preferences.stepFreeRoute}
                onChange={() => handleToggle('stepFreeRoute')}
              />
              <ToggleRow
                id="toggle-prefer-elevators"
                label="Prefer Elevators Over Stairs"
                description="Directs through accessible station elevators and skywalk lifts"
                checked={preferences.preferElevators}
                onChange={() => handleToggle('preferElevators')}
              />
              <ToggleRow
                id="toggle-low-gradient"
                label="Low Incline / Low Gradient"
                description="Avoids steep hill climbs (maximum recommended slope: ≤6%)"
                checked={preferences.lowGradientRequired}
                onChange={() => handleToggle('lowGradientRequired')}
              />
              <ToggleRow
                id="toggle-safer-crossings"
                label="Safer Pedestrian Crossings"
                description="Prefers signalized crosswalks with audible pushbuttons"
                checked={preferences.saferPedestrianCrossings}
                onChange={() => handleToggle('saferPedestrianCrossings')}
              />
            </div>
          </div>

          {/* Section 2: Destination Facilities */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Accessible Facilities at Destination
            </h3>
            <div className="space-y-2">
              <ToggleRow
                id="toggle-accessible-entrances"
                label="Accessible Entrances Only"
                description="Routes to verified ramp or automatic door entryways"
                checked={preferences.accessibleEntrancesOnly}
                onChange={() => handleToggle('accessibleEntrancesOnly')}
              />
              <ToggleRow
                id="toggle-accessible-parking"
                label="Wheelchair Accessible Parking"
                description="Surfaces designated blue parking bays with transfer space"
                checked={preferences.accessibleParkingRequired}
                onChange={() => handleToggle('accessibleParkingRequired')}
              />
              <ToggleRow
                id="toggle-accessible-toilets"
                label="Accessible Restrooms"
                description="Locates step-free universal accessible toilets"
                checked={preferences.accessibleToiletsRequired}
                onChange={() => handleToggle('accessibleToiletsRequired')}
              />
            </div>
          </div>

          {/* Section 3: Interface & Sensory Accommodations */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>Visual & Sensory Accommodations</span>
            </h3>
            <div className="space-y-2">
              <ToggleRow
                id="toggle-high-contrast"
                label="High Contrast Interface"
                description="Increases contrast ratios and applies high-visibility markers"
                checked={preferences.highContrastUI}
                onChange={() => handleToggle('highContrastUI')}
              />
              <ToggleRow
                id="toggle-large-controls"
                label="Large Touch Controls"
                description="Increases button sizes (≥48px) for easier touch targeting"
                checked={preferences.largeControls}
                onChange={() => handleToggle('largeControls')}
              />
              <ToggleRow
                id="toggle-reduced-motion"
                label="Reduced Motion"
                description="Disables parallax shifts, map camera flight spins, and pulsing"
                checked={preferences.reducedMotion}
                onChange={() => handleToggle('reducedMotion')}
              />
              <ToggleRow
                id="toggle-audio-guidance"
                label="Audio Voice Guidance"
                description="Spoken announcements for upcoming stairs, curbs, and elevators"
                checked={preferences.audioGuidance}
                onChange={() => handleToggle('audioGuidance')}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setPreferences(modeService.getConfig().accessibilityPreferences);
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors flex items-center gap-1.5 shadow-md shadow-sky-500/20"
          >
            <Check className="w-4 h-4" />
            <span>Apply Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ id, label, description, checked, onChange }) => {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 hover:border-slate-600 transition-colors">
      <div className="flex-1">
        <label htmlFor={id} className="text-xs font-semibold text-white block cursor-pointer">
          {label}
        </label>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`w-11 h-6 shrink-0 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${
          checked ? 'bg-sky-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white shadow-md transform transition-transform absolute top-1 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};

export default AccessibilitySettingsDrawer;
