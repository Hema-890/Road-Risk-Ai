import React, { useState, useEffect } from 'react';
import { modeService } from '../../services/modeService.ts';
import { roadRiskOrchestrator } from '../../services/roadRiskOrchestrator.ts';
import type { Campus, CampusBuilding, CampusPOI } from '../../types/modes.ts';
import {
  GraduationCap,
  X,
  Building2,
  BookOpen,
  Utensils,
  Home,
  Shield,
  PhoneCall,
  Navigation,
  Bus,
  AlertTriangle,
  HeartPulse,
} from 'lucide-react';

interface CampusModeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToPOI: (poi: CampusPOI) => void;
  onFocusCoordinates: (coords: [number, number], zoom?: number) => void;
}

export const CampusModeDrawer: React.FC<CampusModeDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateToPOI,
  onFocusCoordinates,
}) => {
  const [selectedCampusId, setSelectedCampusId] = useState<string>(
    modeService.getConfig().campusPreferences.activeCampusId || 'iit_hyderabad'
  );
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [buildings, setBuildings] = useState<CampusBuilding[]>([]);
  const [pois, setPois] = useState<CampusPOI[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    setCampuses(modeService.getCampuses());
  }, []);

  useEffect(() => {
    const campus = modeService.getCampus(selectedCampusId);
    if (campus) {
      setBuildings(modeService.getCampusBuildings(selectedCampusId));
      setPois(modeService.getCampusPOIs(selectedCampusId));
    }
  }, [selectedCampusId]);

  if (!isOpen) return null;

  const currentCampus = modeService.getCampus(selectedCampusId);

  const handleSelectCampus = (campusId: string) => {
    setSelectedCampusId(campusId);
    modeService.updateCampusPreferences({ activeCampusId: campusId });
    const c = modeService.getCampus(campusId);
    if (c) {
      onFocusCoordinates(c.centerCoordinates, c.defaultZoom);
    }
  };

  const filteredPois = filterCategory === 'all'
    ? pois
    : pois.filter((p) => {
        if (filterCategory === 'academic') return p.category === 'department' || p.category === 'laboratory';
        if (filterCategory === 'amenity') return p.category === 'cafeteria' || p.category === 'library' || p.category === 'auditorium';
        if (filterCategory === 'emergency') return p.category === 'medical_center' || p.category === 'security';
        return p.category === filterCategory;
      });

  return (
    <div
      className="fixed inset-0 flex items-center justify-end z-[1200] bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campus-mode-title"
    >
      <div
        className="w-full max-w-md h-full bg-slate-900 border-l border-slate-700/80 shadow-2xl flex flex-col text-slate-100 overflow-hidden"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <GraduationCap className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="campus-mode-title" className="text-base font-bold text-white tracking-wide">
                Campus Navigation
              </h2>
              <p className="text-xs text-slate-400">Institutional Wayfinding & Safety</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close campus mode drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Campus Selector */}
          <div className="space-y-1.5">
            <label htmlFor="campus-select" className="text-xs font-semibold text-slate-300">
              Active Institutional Campus:
            </label>
            <select
              id="campus-select"
              value={selectedCampusId}
              onChange={(e) => handleSelectCampus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.city})
                </option>
              ))}
            </select>
          </div>

          {/* Emergency Dispatch Banner */}
          {currentCampus?.emergencyContacts && currentCampus.emergencyContacts.length > 0 && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-200 flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-red-400" />
                  Campus Emergency Contacts
                </span>
                <span className="text-[10px] text-red-300 uppercase tracking-wider font-semibold">24/7 Available</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {currentCampus.emergencyContacts.slice(0, 2).map((emg, idx) => (
                  <a
                    key={idx}
                    href={`tel:${emg.phone}`}
                    className="p-2 rounded-lg bg-red-900/30 border border-red-700/50 hover:bg-red-900/50 flex flex-col transition-colors"
                  >
                    <span className="text-[10px] text-slate-300 font-medium">{emg.role}</span>
                    <span className="text-xs font-bold text-white flex items-center gap-1 mt-0.5">
                      <PhoneCall className="w-3 h-3 text-red-400" />
                      {emg.phone}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'All Places' },
              { id: 'academic', label: 'Departments & Labs' },
              { id: 'amenity', label: 'Library & Dining' },
              { id: 'emergency', label: 'Health & Security' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilterCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
                  filterCategory === cat.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* POIs List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{filteredPois.length} destinations found</span>
              <span>Pedestrian spine active</span>
            </div>

            <div className="space-y-2">
              {filteredPois.map((poi) => (
                <div
                  key={poi.id}
                  className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/70 hover:border-amber-500/60 transition-all flex items-start justify-between gap-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{poi.name}</h4>
                      {poi.isAccessible && (
                        <span className="text-[10px] text-sky-400 bg-sky-950/60 border border-sky-800/60 px-1.5 py-0.2 rounded font-semibold">
                          ♿ Step-free
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {poi.buildingName ? `${poi.buildingName} • ` : ''}Floor {poi.floor || 'Ground'}
                    </p>
                    {poi.operatingHours && (
                      <p className="text-[10px] text-amber-400/90 mt-1">Hours: {poi.operatingHours}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onFocusCoordinates(poi.coordinates, 17.5)}
                      className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-slate-200 text-xs font-medium"
                      title="View on map"
                    >
                      Focus
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateToPOI(poi)}
                      className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-md shadow-amber-500/20"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Route</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shuttle Notice */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-[11px] text-slate-400 flex items-start gap-2.5">
            <Bus className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">Campus Transit Status</p>
              <p className="mt-0.5 text-slate-400">
                {currentCampus?.transitSupported
                  ? currentCampus.transitNotes
                  : 'Campus transit data unavailable.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampusModeDrawer;
