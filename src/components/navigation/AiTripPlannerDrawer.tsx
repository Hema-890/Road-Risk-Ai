// ==============================================================================
// ROADRISK AI — AI TRIP PLANNER DRAWER & TIMELINE UI
// Natural-language itinerary generation, multi-stop route optimization,
// appointment-aware departure calculator, budget constraint tracker, and
// step-by-step navigation handoff with map synchronization.
// ==============================================================================

import React, { useState } from 'react';
import {
  Calendar,
  Sparkles,
  MapPin,
  Clock,
  DollarSign,
  Shield,
  Navigation,
  ChevronRight,
  Plus,
  Trash2,
  ArrowRight,
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Compass,
} from 'lucide-react';
import { aiTripPlannerService } from '../../services/aiTripPlannerService.ts';
import { roadRiskOrchestrator } from '../../services/roadRiskOrchestrator.ts';
import type {
  Itinerary,
  ItineraryStop,
  TripPlanRequest,
  TransportMode,
  TripLocation,
} from '../../types/index.ts';

interface AiTripPlannerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onFocusLocation: (coords: [number, number], zoom?: number) => void;
  onStartSegmentNavigation?: (stop: ItineraryStop) => void;
}

const QUICK_PROMPTS = [
  'Plan a one-day Hyderabad trip under ₹2,000 using public transport',
  'Plan a weekend food & photography trip to Vijayawada',
  'Visit 3 heritage spots and return home by 8 PM under ₹1,500',
  'Safest scenic route with minimum cost',
];

export const AiTripPlannerDrawer: React.FC<AiTripPlannerDrawerProps> = ({
  isOpen,
  onClose,
  onFocusLocation,
  onStartSegmentNavigation,
}) => {
  const [promptInput, setPromptInput] = useState<string>('Plan a one-day Hyderabad trip under ₹2,000 using public transport where possible');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [itinerary, setItinerary] = useState<Itinerary | null>(() => aiTripPlannerService.getActiveItinerary());
  const [activeStopIdx, setActiveStopIdx] = useState<number>(0);
  const [isNavigatingItinerary, setIsNavigatingItinerary] = useState<boolean>(false);
  const [newStopName, setNewStopName] = useState<string>('');
  const [appointmentTime, setAppointmentTime] = useState<string>('04:00 PM');
  const [appointmentResult, setAppointmentResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGeneratePlan = async (customPrompt?: string) => {
    const textToUse = customPrompt || promptInput;
    setIsGenerating(true);
    try {
      const result = await roadRiskOrchestrator.planAiTrip(textToUse);
      setItinerary(result);
      setActiveStopIdx(0);
      if (result.allStops.length > 0) {
        onFocusLocation(result.allStops[0].location.coordinates, 14);
      }
    } catch (err) {
      console.error('Failed to generate trip:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStopClick = (stop: ItineraryStop, idx: number) => {
    setActiveStopIdx(idx);
    onFocusLocation(stop.location.coordinates, 15);
  };

  const handleStartNavigationForStop = (stop: ItineraryStop) => {
    setIsNavigatingItinerary(true);
    roadRiskOrchestrator.startNavigation();
    if (onStartSegmentNavigation) {
      onStartSegmentNavigation(stop);
    }
  };

  const handleNextStop = () => {
    const { stop, isCompleted } = aiTripPlannerService.advanceToNextStop();
    if (isCompleted || !stop) {
      setIsNavigatingItinerary(false);
      roadRiskOrchestrator.stopNavigation();
    } else {
      setActiveStopIdx((prev) => prev + 1);
      onFocusLocation(stop.location.coordinates, 15);
    }
  };

  const handleRemoveStop = (stopId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = aiTripPlannerService.removeStopFromActiveItinerary(stopId);
    if (updated) setItinerary({ ...updated });
  };

  const handleAddStop = async () => {
    if (!newStopName.trim()) return;
    const searchRes = await roadRiskOrchestrator.searchPlaces(newStopName);
    if (searchRes.length > 0) {
      const top = searchRes[0];
      const newLoc: TripLocation = {
        id: `custom_stop_${Date.now()}`,
        name: top.name,
        coordinates: top.coordinates,
        category: 'custom',
        durationMinutes: 45,
        estimatedCostInr: 50,
      };
      const updated = aiTripPlannerService.addStopToActiveItinerary(newLoc);
      if (updated) {
        setItinerary({ ...updated });
        setNewStopName('');
      }
    }
  };

  const handleCalculateAppointment = () => {
    const calc = aiTripPlannerService.calculateAppointmentDeparture(appointmentTime, 18, 10, 35);
    setAppointmentResult(calc.explanation);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: 16,
        bottom: 20,
        width: '100%',
        maxWidth: 440,
        background: 'rgba(11, 15, 23, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: 16,
        padding: '16px',
        color: '#f8fafc',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(168, 85, 247, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc',
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>AI Trip Planner</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Safety-Aware Multi-Stop Itineraries</div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* 2. Natural Language Input Bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="e.g. Plan a one-day Hyderabad trip under ₹2,000..."
            style={{
              width: '100%',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: 10,
              padding: '10px 12px',
              paddingRight: 40,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 500,
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGeneratePlan();
            }}
          />
          <button
            onClick={() => handleGeneratePlan()}
            disabled={isGenerating}
            style={{
              position: 'absolute',
              right: 6,
              top: 6,
              bottom: 6,
              background: '#0284c7',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              padding: '0 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={14} />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '6px 0', scrollbarWidth: 'none' }}>
          {QUICK_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPromptInput(p);
                handleGeneratePlan(p);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                borderRadius: 12,
                padding: '3px 8px',
                fontSize: 10.5,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Appointment Arrival Departure Calculator */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 8,
          padding: '8px 10px',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
            Appointment Arrival:
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              type="text"
              value={appointmentTime}
              onChange={(e) => setAppointmentTime(e.target.value)}
              style={{
                width: 80,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                textAlign: 'center',
              }}
            />
            <button
              onClick={handleCalculateAppointment}
              style={{
                background: '#334155',
                border: 'none',
                color: '#38bdf8',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Calculate
            </button>
          </div>
        </div>
        {appointmentResult && (
          <div style={{ fontSize: 10.5, color: '#38bdf8', marginTop: 4, fontStyle: 'italic' }}>
            {appointmentResult}
          </div>
        )}
      </div>

      {/* 4. Active Itinerary Overview Card */}
      {itinerary && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#f8fafc' }}>
                {itinerary.title}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {itinerary.allStops.length} Stops • {itinerary.days[0]?.totalDurationMinutes} mins total
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#38bdf8' }}>
                ₹{itinerary.totalEstimatedCostInr}
              </div>
              <div style={{ fontSize: 10, color: itinerary.budgetSatisfied ? '#34d399' : '#f87171' }}>
                {itinerary.budgetLimitInr ? `Budget: ₹${itinerary.budgetLimitInr}` : 'Standard Estimate'}
              </div>
            </div>
          </div>

          {/* Active Navigation Controller banner */}
          {isNavigatingItinerary && (
            <div
              style={{
                marginTop: 8,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(52, 211, 153, 0.4)',
                borderRadius: 6,
                padding: '6px 8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>
                Navigating Stop #{activeStopIdx + 1}: {itinerary.allStops[activeStopIdx]?.location.name}
              </div>
              <button
                onClick={handleNextStop}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Next Stop
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. Scrollable Stops Timeline (Sections 12, 15) */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {itinerary?.allStops.map((stop, idx) => {
          const isSelected = activeStopIdx === idx;
          return (
            <div
              key={stop.id}
              onClick={() => handleStopClick(stop, idx)}
              style={{
                background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${isSelected ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
                borderRadius: 10,
                padding: '10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Travel segment from previous stop */}
              {stop.travelFromPrevious && (
                <div
                  style={{
                    fontSize: 10,
                    color: '#94a3b8',
                    paddingBottom: 6,
                    marginBottom: 6,
                    borderBottom: '1px dashed rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    🚗 Travel: {stop.travelFromPrevious.distanceKm} km ({stop.travelFromPrevious.durationMinutes} min)
                  </span>
                  <span>Travel Cost: ₹{stop.travelFromPrevious.costInr}</span>
                </div>
              )}

              {/* Stop Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: isSelected ? '#0284c7' : '#334155',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>
                      {stop.location.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                      Arrival: {stop.plannedArrivalTime} • Stay: {stop.durationMinutes} min
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#38bdf8' }}>
                    ₹{stop.costInr}
                  </div>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: stop.riskScore > 50 ? '#f87171' : '#34d399',
                    }}
                  >
                    Risk: {stop.riskScore}/100
                  </span>
                </div>
              </div>

              {/* Activity & Controls */}
              <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 6 }}>
                {stop.activity}
              </div>

              {isSelected && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartNavigationForStop(stop);
                    }}
                    style={{
                      flex: 1,
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <Navigation size={12} />
                    <span>Navigate Stop</span>
                  </button>

                  <button
                    onClick={(e) => handleRemoveStop(stop.id, e)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 6. Add Custom Stop Input */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <input
          type="text"
          value={newStopName}
          onChange={(e) => setNewStopName(e.target.value)}
          placeholder="Add stop name (e.g. Salar Jung Museum)..."
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 6,
            padding: '6px 10px',
            color: '#fff',
            fontSize: 11,
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddStop();
          }}
        />
        <button
          onClick={handleAddStop}
          style={{
            background: '#334155',
            border: 'none',
            color: '#38bdf8',
            borderRadius: 6,
            padding: '0 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
};

export default AiTripPlannerDrawer;
