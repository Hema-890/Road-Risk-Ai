import React, { useState, useEffect } from 'react';
import { modeService } from '../../services/modeService.ts';
import { aiTripPlannerService } from '../../services/aiTripPlannerService.ts';
import type { TouristAttraction, TouristTravelerType } from '../../types/modes.ts';
import {
  Luggage,
  X,
  MapPin,
  Calendar,
  Clock,
  IndianRupee,
  Navigation,
  Sparkles,
  Camera,
  Utensils,
  Landmark,
  ShieldAlert,
  Compass,
} from 'lucide-react';

interface TouristModeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToAttraction: (attraction: TouristAttraction) => void;
  onFocusCoordinates: (coords: [number, number], zoom?: number) => void;
  onOpenTripPlanner: () => void;
}

export const TouristModeDrawer: React.FC<TouristModeDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateToAttraction,
  onFocusCoordinates,
  onOpenTripPlanner,
}) => {
  const [selectedTravelerType, setSelectedTravelerType] = useState<TouristTravelerType>(
    modeService.getConfig().touristPreferences.travelerType
  );
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [attractions, setAttractions] = useState<TouristAttraction[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<any>(null);

  useEffect(() => {
    const list = modeService.getTouristAttractions();
    setAttractions(list);
    const cost = modeService.calculateTouristTripCost(list.slice(0, 4), 'CAR', 28);
    setCostBreakdown(cost);
  }, []);

  if (!isOpen) return null;

  const handleSelectTravelerType = (t: TouristTravelerType) => {
    setSelectedTravelerType(t);
    modeService.updateTouristPreferences({ travelerType: t });
  };

  const filtered = activeCategory === 'all'
    ? attractions
    : attractions.filter((a) => a.category === activeCategory);

  const travelerStyles: { id: TouristTravelerType; label: string }[] = [
    { id: 'sightseeing', label: 'Sightseeing' },
    { id: 'heritage', label: 'History & Forts' },
    { id: 'food', label: 'Culinary & Food' },
    { id: 'photography', label: 'Photography' },
    { id: 'religious', label: 'Temples & Sacred' },
    { id: 'family', label: 'Family Friendly' },
    { id: 'budget', label: 'Budget Explorer' },
  ];

  const categories = [
    { id: 'all', label: 'All Sights' },
    { id: 'heritage', label: 'Heritage' },
    { id: 'sightseeing', label: 'Scenic' },
    { id: 'culture', label: 'Culture & Museum' },
    { id: 'religious', label: 'Religious' },
    { id: 'food', label: 'Dining' },
    { id: 'nature', label: 'Nature' },
  ];

  return (
    <div
      className="fixed inset-0 flex items-center justify-end z-[1200] bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tourist-mode-title"
    >
      <div
        className="w-full max-w-md h-full bg-slate-900 border-l border-slate-700/80 shadow-2xl flex flex-col text-slate-100 overflow-hidden"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <Luggage className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="tourist-mode-title" className="text-base font-bold text-white tracking-wide">
                Tourist Companion
              </h2>
              <p className="text-xs text-slate-400">Curated Sights & Transparent Cost Estimates</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close tourist companion"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Quick AI Day Trip Action */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/60 to-slate-900 border border-rose-800/50 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-rose-400" />
                  AI Day Trip Itinerary
                </span>
                <p className="text-[11px] text-slate-300 mt-1">
                  Automated sequence with multi-stop timing, entry fees, and road risk safety checks.
                </p>
              </div>
            </div>

            {costBreakdown && (
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Estimated Total Cost</span>
                  <span className="text-sm font-bold text-rose-300">
                    ₹{costBreakdown.totalEstimatedCostInr} <span className="text-[10px] font-normal text-slate-400">(est)</span>
                  </span>
                </div>
                <div className="text-right text-[10px] text-slate-400">
                  <div>Entry: ₹{costBreakdown.breakdown.entryFeesInr} • Fuel: ₹{costBreakdown.breakdown.fuelOrTransitInr}</div>
                  <div>Meals: ₹{costBreakdown.breakdown.foodEstimateInr} • Park: ₹{costBreakdown.breakdown.parkingInr}</div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTripPlanner();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25"
            >
              <Calendar className="w-4 h-4" />
              <span>Launch Full AI Trip Planner Drawer</span>
            </button>
          </div>

          {/* Traveler Style Pills */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-400 block">Travel Style:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {travelerStyles.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTravelerType(item.id)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
                    selectedTravelerType === item.id
                      ? 'bg-rose-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-400 block">Attraction Category:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeCategory === c.id
                      ? 'bg-slate-700 text-white border border-slate-500'
                      : 'bg-slate-800/60 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Attractions List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{filtered.length} attractions available</span>
              <span>All estimates marked</span>
            </div>

            <div className="space-y-2.5">
              {filtered.map((attraction) => (
                <div
                  key={attraction.id}
                  className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70 hover:border-rose-500/60 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">{attraction.name}</h4>
                        <span className="text-[10px] text-rose-300 bg-rose-950/60 border border-rose-800/60 px-1.5 py-0.2 rounded font-semibold capitalize">
                          {attraction.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-snug">{attraction.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1 border-t border-slate-700/50">
                    <div className="flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        {attraction.entryFeeInr === 0 ? 'Free Entry' : `₹${attraction.entryFeeInr}`}
                        <span className="text-[9px] text-slate-400 ml-1">
                          ({attraction.isEntryFeeVerified ? 'Verified' : 'Estimate'})
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">
                        {attraction.isOpeningHoursVerified ? attraction.openingHours : 'Opening hours not verified'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400">
                      {attraction.wheelchairAccessible ? '♿ Step-free entrance' : 'Stairs required'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onFocusCoordinates(attraction.coordinates, 15.5)}
                        className="p-1.5 px-2.5 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-slate-200 text-xs font-medium"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigateToAttraction(attraction)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-md shadow-rose-500/20"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Route</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TouristModeDrawer;
