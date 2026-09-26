import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { UrgencyLevel } from '../../types';
import { CITY_PRESETS, DEFAULT_CITY } from '../../data/mockScenarios';
import { searchLocations, SearchLocationResult } from '../../services/geocodingService';
import {
  Navigation,
  Play,
  Square,
  RefreshCw,
  Zap,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Search,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  X,
  MapPin,
  Building2,
  Sliders,
} from 'lucide-react';

interface EmergencyRouteControlProps {
  onOpenReportModal: () => void;
}

export const EmergencyRouteControl: React.FC<EmergencyRouteControlProps> = ({
  onOpenReportModal,
}) => {
  const {
    currentMission,
    updateMissionSetup,
    setMissionOrigin,
    setMissionDestination,
    setDestinationLocation,
    clearDestination,
    selectedVehicle,
    vehicles,
    setSelectedVehicleId,
    routingPreference,
    setRoutingPreference,
    routes,
    selectedRoute,
    setSelectedRouteId,
    isCalculatingRoute,
    calculateRouteWithOsrm,
    startNavigationMission,
    isSimulationPlaying,
    setIsSimulationPlaying,
    resetToMissionSetup,
    acceptReroute,
    rerouteRecommendation,
    whyThisRouteExplanation,
    currentCityId,
    activeHazards,
    telemetry,
    simulationSpeed,
    setSimulationSpeed,
    triggerHazardInjection,
  } = useApp();

  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchLocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const city = CITY_PRESETS[currentCityId] || DEFAULT_CITY;

  const getRiskColor = (score: number) => {
    if (score >= 81) return '#ef4444';
    if (score >= 61) return '#f97316';
    if (score >= 31) return '#eab308';
    return '#10b981';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 81) return 'CRITICAL RISK';
    if (score >= 61) return 'HIGH RISK';
    if (score >= 31) return 'MODERATE RISK';
    return 'LOW RISK';
  };

  // Close search popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search autocomplete combining Real OpenStreetMap Geocoding and Curated Facilities
  useEffect(() => {
    let active = true;
    if (!searchQuery.trim()) {
      // Default: Curated City Emergency Destinations
      setSearchResults(
        city.destinations.map((d) => ({
          id: `local_${d.id}`,
          name: d.name,
          label: `${d.label} (Emergency Trauma Hub)`,
          coordinates: d.coords,
          type: 'hospital',
          source: 'curated_facility',
        }))
      );
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchLocations(searchQuery, currentCityId, currentMission.originCoords);
        if (active) {
          setSearchResults(results);
          setIsSearching(false);
        }
      } catch {
        if (active) setIsSearching(false);
      }
    }, 220);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [searchQuery, currentCityId, city.destinations, currentMission.originCoords]);

  const handleSelectLocation = (loc: SearchLocationResult) => {
    setDestinationLocation(loc.name, loc.coordinates);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  return (
    <>
      {/* 1. Google Maps-Style Floating Search & Destination Bar */}
      <div
        ref={searchContainerRef}
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          zIndex: 460,
          width: 360,
          maxWidth: 'calc(100vw - 28px)',
        }}
      >
        {/* Search Input Box */}
        <div
          style={{
            background: 'rgba(9, 13, 22, 0.94)',
            border: '1px solid rgba(51, 65, 85, 0.8)',
            borderRadius: 24,
            padding: '6px 14px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#f8fafc',
            transition: 'border-color 0.2s ease',
          }}
        >
          <Search size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />

          <input
            type="text"
            placeholder="Search destination or place..."
            value={searchQuery || (isSearchOpen ? '' : currentMission.destination ? currentMission.destination.split(',')[0] : '')}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isSearchOpen) setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: 13,
              fontWeight: 500,
              width: '100%',
            }}
          />

          {(searchQuery || currentMission.destination) && (
            <button
              onClick={() => {
                setSearchQuery('');
                clearDestination();
              }}
              title="Clear destination and return to normal map"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
            >
              <X size={15} />
            </button>
          )}

          {/* Calculate / Route Directions Button */}
          <button
            onClick={() => {
              if (!isSearchOpen) {
                calculateRouteWithOsrm();
              } else {
                setIsSearchOpen(false);
              }
            }}
            disabled={isCalculatingRoute || currentMission.status === 'EN_ROUTE'}
            title={isSearchOpen ? 'Close suggestions' : 'Recalculate route via OSRM'}
            style={{
              background: 'rgba(14, 165, 233, 0.18)',
              border: '1px solid rgba(14, 165, 233, 0.45)',
              borderRadius: 16,
              padding: '4px 10px',
              color: '#38bdf8',
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: isCalculatingRoute || currentMission.status === 'EN_ROUTE' ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            <RefreshCw size={11} className={isCalculatingRoute ? 'animate-spin' : ''} />
            <span>{isCalculatingRoute ? 'Calculating...' : 'Route'}</span>
          </button>
        </div>

        {/* Destination & Origin Popover Dropdown */}
        {isSearchOpen && (
          <div
            style={{
              marginTop: 8,
              background: 'rgba(9, 13, 22, 0.96)',
              border: '1px solid rgba(51, 65, 85, 0.8)',
              borderRadius: 12,
              backdropFilter: 'blur(16px)',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
              maxHeight: 'calc(100vh - 120px)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Origin Switcher Row */}
            <div
              style={{
                padding: '9px 12px',
                borderBottom: '1px solid rgba(30, 41, 59, 0.8)',
                background: 'rgba(15, 23, 42, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8' }}>
                <span style={{ fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', fontSize: 10 }}>FROM:</span>
                <select
                  value={city.origins.find((o) => o.name === currentMission.origin)?.id || city.origins[0]?.id}
                  onChange={(e) => {
                    setMissionOrigin(e.target.value);
                    calculateRouteWithOsrm();
                  }}
                  disabled={currentMission.status === 'EN_ROUTE'}
                  style={{
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(51, 65, 85, 0.6)',
                    borderRadius: 6,
                    color: '#f8fafc',
                    fontSize: 11,
                    padding: '2px 6px',
                    outline: 'none',
                    maxWidth: 240,
                    textOverflow: 'ellipsis',
                  }}
                >
                  {city.origins.map((o) => (
                    <option key={o.id} value={o.id} style={{ background: '#0f172a', color: '#fff' }}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Destination Selection List with Badges */}
            <div style={{ padding: '8px 6px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {searchQuery ? 'Search Suggestions' : 'Emergency Trauma Hubs'}
                </span>
                {isSearching && (
                  <span style={{ fontSize: 10, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RefreshCw size={10} className="animate-spin" /> Searching OSM...
                  </span>
                )}
              </div>

              {searchResults.map((d) => {
                const isSelected = currentMission.destination === d.name;
                const isHospital = d.type === 'hospital';
                return (
                  <button
                    key={d.id}
                    onClick={() => handleSelectLocation(d)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: isSelected ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent',
                      background: isSelected ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                      color: '#f8fafc',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      width: '100%',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: isSelected
                          ? 'rgba(239, 68, 68, 0.25)'
                          : isHospital
                          ? 'rgba(244, 63, 94, 0.15)'
                          : 'rgba(30, 41, 59, 0.8)',
                        border: isSelected
                          ? '1px solid rgba(239, 68, 68, 0.5)'
                          : isHospital
                          ? '1px solid rgba(244, 63, 94, 0.35)'
                          : '1px solid rgba(51, 65, 85, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isSelected ? '#f87171' : isHospital ? '#fb7185' : '#38bdf8',
                        flexShrink: 0,
                      }}
                    >
                      {isHospital ? <Building2 size={15} /> : <MapPin size={15} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#f87171' : '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {d.name}
                        </span>
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: d.source === 'curated_facility' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(14, 165, 233, 0.18)',
                            color: d.source === 'curated_facility' ? '#f87171' : '#38bdf8',
                            border: d.source === 'curated_facility' ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(14, 165, 233, 0.35)',
                            textTransform: 'uppercase',
                            flexShrink: 0,
                          }}
                        >
                          {d.source === 'curated_facility' ? 'Trauma Hub' : 'OSM Place'}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                        {d.label}
                      </div>
                    </div>

                    <span style={{ fontSize: 10, color: '#38bdf8', fontWeight: 600, flexShrink: 0 }}>
                      Route ➔
                    </span>
                  </button>
                );
              })}

              {searchResults.length === 0 && !isSearching && (
                <div style={{ padding: '16px 12px', textAlign: 'center', color: '#64748b', fontSize: 11 }}>
                  No matching destinations found for "{searchQuery}".
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Compact Floating Route Information Panel (Appears under search bar) */}
      {selectedRoute && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: 14,
            width: 360,
            maxWidth: 'calc(100vw - 28px)',
            maxHeight: 'calc(100vh - 120px)',
            backgroundColor: 'rgba(9, 13, 22, 0.94)',
            border: '1px solid rgba(51, 65, 85, 0.8)',
            borderRadius: 12,
            backdropFilter: 'blur(16px)',
            zIndex: 450,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 32px rgba(0, 0, 0, 0.7)',
            color: '#f8fafc',
            overflow: 'hidden',
          }}
        >
          {/* Header row */}
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid rgba(30, 41, 59, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                ROUTE
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginTop: 1 }}>
                {selectedRoute.name}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  background: getRiskColor(selectedRoute.riskScore),
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                }}
              >
                {getRiskLabel(selectedRoute.riskScore)} — {selectedRoute.riskScore}/100
              </div>

              <button
                onClick={clearDestination}
                title="Clear destination and return to normal map"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 6,
                  color: '#f87171',
                  padding: '3px 7px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <X size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics & Hazards summary */}
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                ⏱ {selectedRoute.adjustedEtaMinutes} min <span style={{ color: '#64748b' }}>•</span> {selectedRoute.distanceKm} km
              </span>
              <span style={{ fontSize: 11, color: activeHazards.length > 0 ? '#f87171' : '#10b981', fontWeight: 600 }}>
                {activeHazards.length} {activeHazards.length === 1 ? 'hazard' : 'hazards'} along route
              </span>
            </div>

            {/* Live Telemetry & Progress when EN_ROUTE */}
            {currentMission.status === 'EN_ROUTE' && (
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(51, 65, 85, 0.6)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 700 }}>
                  <span style={{ color: '#38bdf8' }}>EN ROUTE (LIVE SIM)</span>
                  <span style={{ color: '#94a3b8' }}>{(telemetry.progressFraction * 100).toFixed(0)}% Completed</span>
                </div>
                <div style={{ width: '100%', height: 5, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, telemetry.progressFraction * 100))}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #10b981)', transition: 'width 0.3s ease' }} />
                </div>

                {/* Telemetry Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, textAlign: 'center', marginTop: 2 }}>
                  <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '3px 4px', borderRadius: 4 }}>
                    <div style={{ fontSize: 9, color: '#64748b' }}>SPEED</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#f8fafc' }}>{telemetry.speedKmh} km/h</div>
                  </div>
                  <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '3px 4px', borderRadius: 4 }}>
                    <div style={{ fontSize: 9, color: '#64748b' }}>REMAINING</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#38bdf8' }}>{telemetry.distanceRemainingKm.toFixed(1)} km</div>
                  </div>
                  <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '3px 4px', borderRadius: 4 }}>
                    <div style={{ fontSize: 9, color: '#64748b' }}>ETA</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#10b981' }}>{telemetry.etaRemainingMinutes.toFixed(1)} m</div>
                  </div>
                </div>

                {/* Next Maneuver */}
                {telemetry.nextManeuver && (
                  <div style={{ fontSize: 10, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <span style={{ color: '#38bdf8' }}>🧭</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {telemetry.nextManeuver.instruction}
                    </span>
                  </div>
                )}

                {/* Speed Multipliers & Incident Trigger */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 4, borderTop: '1px solid rgba(51, 65, 85, 0.5)', paddingTop: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>SPEED:</span>
                    {[1, 2, 5, 10].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setSimulationSpeed(spd)}
                        style={{
                          background: simulationSpeed === spd ? '#0284c7' : 'rgba(30, 41, 59, 0.7)',
                          border: simulationSpeed === spd ? '1px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.5)',
                          color: '#fff',
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 3,
                          cursor: 'pointer',
                        }}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  {/* Inject Incident Ahead button */}
                  <button
                    onClick={() => triggerHazardInjection('ROAD_BLOCKAGE')}
                    title="Simulate road blockage ahead to test dynamic reroute"
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      borderRadius: 4,
                      padding: '2px 7px',
                      color: '#f87171',
                      fontSize: 9.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Zap size={10} />
                    <span>Test Incident</span>
                  </button>
                </div>
              </div>
            )}

            {/* Main Action Buttons: Start/Pause Sim + Expand Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 2 }}>
              <button
                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                style={{
                  padding: '7px 10px',
                  background: isDetailsExpanded ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.7)',
                  border: isDetailsExpanded ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(51, 65, 85, 0.6)',
                  borderRadius: 6,
                  color: isDetailsExpanded ? '#38bdf8' : '#cbd5e1',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Route Details</span>
                {isDetailsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {currentMission.status !== 'EN_ROUTE' ? (
                <button
                  onClick={startNavigationMission}
                  style={{
                    padding: '7px 10px',
                    background: '#10b981',
                    border: 'none',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                  }}
                >
                  <Play size={13} />
                  <span>Start</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsSimulationPlaying(!isSimulationPlaying)}
                  style={{
                    padding: '7px 10px',
                    background: isSimulationPlaying ? '#eab308' : '#10b981',
                    border: 'none',
                    borderRadius: 6,
                    color: '#0b0f17',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                  }}
                >
                  {isSimulationPlaying ? <Square size={13} /> : <Play size={13} />}
                  <span>{isSimulationPlaying ? 'Pause' : 'Resume'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Expandable Deep Controls (Progressive Disclosure) */}
          {isDetailsExpanded && (
            <div
              style={{
                borderTop: '1px solid rgba(30, 41, 59, 0.8)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                overflowY: 'auto',
                maxHeight: 'calc(100vh - 280px)',
              }}
            >
              {/* Routing Preference Slider */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#cbd5e1' }}>Preference</span>
                  <span style={{ fontSize: 10.5, color: '#38bdf8', fontWeight: 700 }}>
                    {routingPreference < 40 ? 'Fastest ETA' : routingPreference > 60 ? 'Safest Corridor' : 'Balanced'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={routingPreference}
                  onChange={(e) => setRoutingPreference(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#0ea5e9' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
                  <span>FASTEST</span>
                  <span>BALANCED</span>
                  <span>SAFEST</span>
                </div>
              </div>

              {/* Unit & Priority row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>
                    Unit
                  </label>
                  <select
                    value={selectedVehicle.id}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    disabled={currentMission.status === 'EN_ROUTE'}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      color: '#f8fafc',
                      fontSize: 11,
                    }}
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.callsign} ({v.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 }}>
                    Priority
                  </label>
                  <select
                    value={currentMission.urgency}
                    onChange={(e) => updateMissionSetup({ urgency: e.target.value as UrgencyLevel })}
                    disabled={currentMission.status === 'EN_ROUTE'}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      color: '#f8fafc',
                      fontSize: 11,
                    }}
                  >
                    <option value="CRITICAL">P1 - Critical</option>
                    <option value="HIGH">P2 - Urgent</option>
                    <option value="MEDIUM">P3 - Standard</option>
                  </select>
                </div>
              </div>

              {/* "Why this route?" Explanation */}
              <div
                style={{
                  background: 'rgba(14, 165, 233, 0.08)',
                  border: '1px solid rgba(14, 165, 233, 0.25)',
                  borderRadius: 6,
                  padding: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <Sparkles size={12} style={{ color: '#38bdf8' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
                    Decision Rationale
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.45, color: '#cbd5e1' }}>
                  {whyThisRouteExplanation}
                </p>
              </div>

              {/* Alternative Corridors */}
              <div>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
                  Available Corridors ({routes.length})
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {routes.map((r) => {
                    const isSel = r.id === selectedRoute?.id;
                    const color = getRiskColor(r.riskScore);
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRouteId(r.id)}
                        style={{
                          padding: '6px 9px',
                          borderRadius: 6,
                          border: isSel ? '1px solid #38bdf8' : '1px solid #1e293b',
                          background: isSel ? 'rgba(56, 189, 248, 0.12)' : 'rgba(22, 30, 46, 0.7)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: isSel ? '#38bdf8' : '#f8fafc' }}>
                            {r.name}
                          </div>
                          <div style={{ fontSize: 9.5, color: '#94a3b8' }}>
                            {r.distanceKm} km · {r.adjustedEtaMinutes} min
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '2px 5px',
                            borderRadius: 4,
                            border: `1px solid ${color}`,
                            color,
                          }}
                        >
                          Risk {r.riskScore}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reroute & Reset actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                <button
                  onClick={acceptReroute}
                  disabled={!rerouteRecommendation}
                  style={{
                    padding: '6px 8px',
                    background: rerouteRecommendation ? '#f97316' : '#1e293b',
                    border: rerouteRecommendation ? '1px solid #ea580c' : '1px solid #334155',
                    borderRadius: 6,
                    color: rerouteRecommendation ? '#fff' : '#64748b',
                    fontSize: 10.5,
                    fontWeight: 600,
                    cursor: rerouteRecommendation ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <Zap size={12} />
                  <span>Force Reroute</span>
                </button>

                <button
                  onClick={resetToMissionSetup}
                  style={{
                    padding: '6px 8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    color: '#cbd5e1',
                    fontSize: 10.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Reset Mission</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
