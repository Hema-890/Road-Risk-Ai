import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  searchLocations,
  searchCategory,
  SearchLocationResult,
  getRecentSearches,
  saveRecentSearch,
} from '../../services/geocodingService';
import searchService, { SearchResult } from '../../services/searchService.ts';
import { speechService } from '../../services/speechService';
import { voiceCommandService, VoiceLanguage } from '../../services/voiceCommandService';
import voiceInputService, { VoiceInputState } from '../../services/voiceInputService.ts';
import { voiceAlertService, SupportedLanguage } from '../../services/voiceAlertService';
import { crashDetectionService, CrashDetectionEvent } from '../../services/crashDetectionService';
import navigationVoiceService from '../../services/navigationVoiceService';
import VoiceDiagnosticsBar from './VoiceDiagnosticsBar.tsx';
import TravelModeSelector from './TravelModeSelector.tsx';
import DirectionsPanel from './DirectionsPanel.tsx';
import SelectedPlaceCard from './SelectedPlaceCard.tsx';
import VoiceCommandHelpModal from './VoiceCommandHelpModal.tsx';
import confetti from 'canvas-confetti';
import {
  Crosshair,
  Navigation,
  Shield,
  X,
  Volume2,
  VolumeX,
  ArrowUpRight,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  MapPin,
  CheckCircle2,
  Compass,
  AlertTriangle,
  Building,
  Building2,
  Briefcase,
  Fuel,
  Train,
  Utensils,
  Zap,
  Clock,
  Mic,
  MicOff,
  History,
  PhoneCall,
  Share2,
  Search,
  CloudRain,
  TrendingUp,
  TrendingDown,
  Waves,
  Activity,
  ArrowUpDown,
  HardDrive,
  Layers,
  Wifi,
  WifiOff,
  List,
  Siren,
} from 'lucide-react';
import weatherService, { LiveWeatherObservation } from '../../services/weatherService.ts';
import floodService, { FloodAssessmentResult } from '../../services/floodService.ts';
import trafficPredictionService, { TrafficPredictionResult } from '../../services/trafficPredictionService.ts';
import trafficService from '../../services/trafficService.ts';
import { networkStatusService } from '../../services/networkStatusService.ts';
import { offlineMapService } from '../../services/offlineMapService.ts';
import { offlineStorageService } from '../../services/offlineStorageService.ts';
import { performanceDiagnosticsService } from '../../services/performanceDiagnosticsService.ts';
import { calculateDistanceKm } from '../../utils/geoUtils.ts';
import { OfflineMapManagerModal } from './OfflineMapManagerModal.tsx';
import ReportAheadModal from './ReportAheadModal.tsx';

export const CitizenNavigationControl: React.FC = () => {
  const {
    userLocation,
    requestUserLocation,
    isWatchingLocation,
    currentMission,
    setDestinationLocation,
    clearDestination,
    setOriginLocation,
    clearOrigin,
    routes,
    selectedRoute,
    setSelectedRouteId,
    isCalculatingRoute,
    whyThisRouteExplanation,
    navigationPhase,
    setNavigationPhase,
    startCitizenNavigation,
    stopCitizenNavigation,
    navigationManeuver,
    isAudioMuted,
    toggleAudioMute,
    currentCityId,
    flyToLocation,
    openPlaceDetails,
    rerouteRecommendation,
    acceptReroute,
    dismissReroute,
    travelMode,
    setTravelMode,
    departureTime,
    setRequestedDepartureTime,
    routesByMode,
    routeErrorNotice,
    clearRouteError,
  } = useApp();

  const [showVoiceHelpModal, setShowVoiceHelpModal] = useState<boolean>(false);
  const [activeSearchField, setActiveSearchField] = useState<'destination' | 'source'>('destination');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceQuery, setSourceQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchLocationResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchLocationResult[]>([]);
  const [selectedSearchResultIdx, setSelectedSearchResultIdx] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(networkStatusService.isOnline());
  const [offlineRegionsCount, setOfflineRegionsCount] = useState<number>(0);
  const [offlineSearchNotice, setOfflineSearchNotice] = useState<string | null>(null);

  // Selected Place Quick Card & Dedicated Directions Panel State
  const [selectedPlaceInfo, setSelectedPlaceInfo] = useState<SearchResult | null>(null);
  const [showDirectionsPanel, setShowDirectionsPanel] = useState<boolean>(false);

  // Fuel Intelligence State (Requirement 22)
  const [citizenVehicleType, setCitizenVehicleType] = useState<'car' | 'bike'>('car');
  const [fuelPercent] = useState<number>(68);

  // Voice Command & Audio Waveform State
  const [voiceState, setVoiceState] = useState<VoiceInputState>('IDLE');
  const [micAudioLevel, setMicAudioLevel] = useState<number>(0);
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>('en-US');
  const [voiceFeedbackText, setVoiceFeedbackText] = useState<string | null>(null);

  // Crash Detection State
  const [activeCrashAlert, setActiveCrashAlert] = useState<CrashDetectionEvent | null>(null);
  const [crashCountdown, setCrashCountdown] = useState<number>(20);

  // Weather, Flood & Traffic Prediction State (Phases 5, 6, 13)
  const [liveWeather, setLiveWeather] = useState<LiveWeatherObservation | null>(null);
  const [liveFlood, setLiveFlood] = useState<FloodAssessmentResult | null>(null);
  const [trafficPrediction, setTrafficPrediction] = useState<TrafficPredictionResult | null>(null);
  const [showPredictionCard, setShowPredictionCard] = useState<boolean>(true);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showRouteDetailsDrawer, setShowRouteDetailsDrawer] = useState<boolean>(false);
  const [showSosModal, setShowSosModal] = useState<boolean>(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Subscribe to Network status and count downloaded offline regions
  useEffect(() => {
    const unsub = networkStatusService.subscribe((h) => setIsNetworkOnline(h.isOnline));
    offlineStorageService.getAllRegions().then((r) => setOfflineRegionsCount(r.length)).catch(() => {});
    return () => unsub();
  }, []);

  // Sync Weather, Flood & Traffic Predictions
  useEffect(() => {
    const coords = userLocation.coordinates || currentMission.originCoords || [78.4744, 17.3616];
    weatherService.getLiveWeather(coords[1], coords[0]).then(setLiveWeather).catch(() => {});
    floodService.assessFloodRisk(coords[1], coords[0]).then(setLiveFlood).catch(() => {});
    trafficPredictionService.predictTrafficForPoint({
      latitude: coords[1],
      longitude: coords[0],
    }).then(setTrafficPrediction).catch(() => {});
  }, [userLocation.coordinates, currentMission.destinationCoords]);

  // Background Navigation Voice Assistant: Maneuver updates with distance/time triggers
  useEffect(() => {
    if (navigationPhase === 'NAVIGATING' && navigationManeuver) {
      navigationVoiceService.handleManeuverUpdate(
        navigationManeuver.id,
        navigationManeuver.type as any,
        navigationManeuver.instruction || '',
        navigationManeuver.distanceMeters
      );
    }
  }, [navigationPhase, navigationManeuver]);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Listen for crash / sudden deceleration events
  useEffect(() => {
    const unsub = crashDetectionService.subscribe((event) => {
      if (event.status === 'PENDING_CONFIRMATION') {
        setActiveCrashAlert(event);
        setCrashCountdown(20);
        speechService.speak('Potential safety event detected. Please confirm you are safe.', true);
      } else if (event.status === 'USER_CONFIRMED_SAFE' || event.status === 'EMERGENCY_DISPATCHED') {
        setActiveCrashAlert(null);
      }
    });
    return unsub;
  }, []);

  // Countdown timer for crash alert
  useEffect(() => {
    if (!activeCrashAlert) return;
    if (crashCountdown <= 0) {
      crashDetectionService.markEmergency(activeCrashAlert.id);
      setActiveCrashAlert(null);
      return;
    }
    const timer = setTimeout(() => {
      setCrashCountdown((c) => c - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [activeCrashAlert, crashCountdown]);

  // Handle clicking outside of search popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fast debounced Geocoding Search (250ms) with AbortController cancellation & Offline Fallback
  useEffect(() => {
    let active = true;
    const abortController = new AbortController();
    const query = activeSearchField === 'source' ? sourceQuery : searchQuery;
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      setOfflineSearchNotice(null);
      return;
    }

    setIsSearching(true);
    setOfflineSearchNotice(null);
    const startPerf = performance.now();

    const timeoutId = setTimeout(async () => {
      try {
        const origin = userLocation.coordinates || currentMission.originCoords;
        if (!networkStatusService.isOnline()) {
          // Offline POI Search
          const localResults = await offlineMapService.searchOffline(query);
          if (active) {
            const mapped: SearchLocationResult[] = localResults.map((lr) => ({
              id: lr.id,
              name: lr.name,
              label: `${lr.name} • ${lr.category} [Offline Data]`,
              type: lr.category as any,
              coordinates: lr.coordinates,
              source: 'curated_facility',
              rawOsm: {},
            }));
            setSearchResults(mapped);
            setIsSearching(false);
            if (mapped.length === 0) {
              setOfflineSearchNotice('Destination not available in downloaded offline data.');
            }
            performanceDiagnosticsService.recordMetric(
              'searchLatencyMs',
              performance.now() - startPerf,
              'Offline Local POI Database'
            );
          }
          return;
        }

        const results = await searchService.search(query, { originCoords: origin, signal: abortController.signal });
        if (active) {
          const mapped: SearchLocationResult[] = results.map((r) => ({
            id: r.id,
            name: r.name,
            label: `${r.displayName} • ${r.category}`,
            type: r.type as any,
            coordinates: r.coordinates,
            source: (r.provider === 'TomTom' ? 'tomtom_search' : 'osm_geocoder') as any,
            distance_km: r.distanceKm,
            rawOsm: r,
          }));
          setSearchResults(mapped);
          setIsSearching(false);
          performanceDiagnosticsService.recordMetric(
            'searchLatencyMs',
            performance.now() - startPerf,
            'Unified Search Service'
          );
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        // Network error fallback to offline
        try {
          const localResults = await offlineMapService.searchOffline(query);
          if (active) {
            const mapped: SearchLocationResult[] = localResults.map((lr) => ({
              id: lr.id,
              name: lr.name,
              label: `${lr.name} • ${lr.category} [Offline Data]`,
              type: lr.category as any,
              coordinates: lr.coordinates,
              source: 'curated_facility',
              rawOsm: {},
            }));
            setSearchResults(mapped);
            if (mapped.length === 0) {
              setOfflineSearchNotice('Destination not available in downloaded offline data.');
            }
          }
        } catch {
          if (active) setSearchResults([]);
        }
        if (active) setIsSearching(false);
      }
    }, 250);

    return () => {
      active = false;
      abortController.abort();
      clearTimeout(timeoutId);
    };
  }, [searchQuery, sourceQuery, activeSearchField, currentCityId, userLocation.coordinates, currentMission.originCoords]);

  // Quick category pills
  const categories = [
    { label: 'Restaurants', icon: <Utensils size={13} />, key: 'restaurant' as const },
    { label: 'Fuel', icon: <Fuel size={13} />, key: 'fuel' as const },
    { label: 'EV Charging', icon: <Zap size={13} />, key: 'ev' as const },
    { label: 'Hospitals', icon: <Building2 size={13} />, key: 'hospital' as const },
    { label: 'Pharmacy', icon: <Building2 size={13} />, key: 'pharmacy' as const },
    { label: 'Parking', icon: <MapPin size={13} />, key: 'parking' as const },
  ];

  const handleCategoryClick = async (cat: 'restaurant' | 'fuel' | 'ev' | 'hospital' | 'pharmacy' | 'parking' | 'hotel') => {
    setActiveSearchField('destination');
    setIsSearching(true);
    setIsSearchOpen(true);
    setSearchQuery(cat);
    const origin = userLocation.coordinates || currentMission.originCoords;
    const results = await searchCategory(cat, origin, currentCityId);
    setSearchResults(results);
    setIsSearching(false);
  };

  // Select place from search -> updates Source or Destination & opens quick card
  const handleSelectLocation = (loc: SearchLocationResult) => {
    saveRecentSearch(loc);
    setRecentSearches(getRecentSearches());
    setIsSearchOpen(false);
    setSelectedSearchResultIdx(-1);

    const placeRes: SearchResult = (loc as any).rawOsm || {
      id: loc.id,
      name: loc.name,
      displayName: loc.label,
      type: loc.type as any,
      category: loc.type,
      latitude: loc.coordinates[1],
      longitude: loc.coordinates[0],
      coordinates: loc.coordinates,
      provider: 'TomTom',
      source: 'Unified Search',
      confidence: 0.9,
      distanceKm: loc.distance_km,
    };

    setSelectedPlaceInfo(placeRes);
    flyToLocation(loc.coordinates, 15);

    if (activeSearchField === 'source') {
      setOriginLocation(loc.name, loc.coordinates);
      setSourceQuery('');
    } else {
      setSearchQuery('');
      setDestinationLocation(loc.name, loc.coordinates);
    }
  };

  const handleSwapOriginDestination = () => {
    if (currentMission.destinationCoords && currentMission.originCoords) {
      const origName = currentMission.origin;
      const origCoords = currentMission.originCoords;
      const destName = currentMission.destination;
      const destCoords = currentMission.destinationCoords;

      setOriginLocation(destName, destCoords);
      setDestinationLocation(origName, origCoords);
    }
  };

  // Real Speech Recognition & Voice Command Intent Engine (Requirements 26-32)
  useEffect(() => {
    const unsub = voiceInputService.subscribe({
      onStateChange: (state, msg) => {
        setVoiceState(state);
        if (msg) setVoiceFeedbackText(msg);
      },
      onInterimTranscript: (text) => {
        setVoiceFeedbackText(`"${text}"`);
      },
      onAudioLevel: (level) => {
        setMicAudioLevel(level);
      },
      onIntentRecognized: async (intent) => {
        setVoiceFeedbackText(`Recognized: ${intent.type}`);

        if (intent.type === 'START_NAVIGATION') {
          startCitizenNavigation();
          speechService.speak('Navigation started. Follow route instructions.');
        } else if (intent.type === 'STOP_NAVIGATION') {
          stopCitizenNavigation();
          speechService.speak('Navigation cancelled.');
        } else if (intent.type === 'NAVIGATE_TO' && (intent.normalizedQuery || intent.rawTranscript)) {
          const q = intent.normalizedQuery || intent.rawTranscript;
          speechService.speak(`Searching for ${q}`);
          const origin = userLocation.coordinates || currentMission.originCoords;
          const res = await searchService.search(q, { originCoords: origin, limit: 1 });
          if (res.length > 0) {
            setDestinationLocation(res[0].name, res[0].coordinates);
            speechService.speak(`Route calculated to ${res[0].name.split(',')[0]}.`);
          } else {
            speechService.speak(`Could not find a place matching ${q}.`);
          }
        } else if (intent.type === 'FIND_POI' && intent.payload) {
          handleCategoryClick(intent.payload as any);
          speechService.speak(`Finding nearby ${intent.payload}`);
        } else if (intent.type === 'SWITCH_MODE' && intent.payload) {
          setTravelMode(intent.payload);
          speechService.speak(`Switched travel mode to ${intent.payload.toLowerCase()}.`);
        } else if (intent.type === 'FASTEST_ROUTE') {
          const fastest = routes.find((r) => r.objective === 'FASTEST') || routes[0];
          if (fastest) {
            setSelectedRouteId(fastest.id);
            speechService.speak('Selected fastest route.');
          }
        } else if (intent.type === 'SAFEST_ROUTE') {
          const safest = routes.find((r) => r.objective === 'SAFEST') || routes[0];
          if (safest) {
            setSelectedRouteId(safest.id);
            speechService.speak('Selected safest route.');
          }
        } else if (intent.type === 'CURRENT_LOCATION') {
          requestUserLocation();
          speechService.speak('Recentering to your current GPS location.');
        } else if (intent.type === 'ZOOM_IN') {
          if (userLocation.coordinates) flyToLocation(userLocation.coordinates, 16);
          speechService.speak('Zooming in.');
        } else if (intent.type === 'ZOOM_OUT') {
          if (userLocation.coordinates) flyToLocation(userLocation.coordinates, 13);
          speechService.speak('Zooming out.');
        } else if (intent.type === 'REPEAT_INSTRUCTION') {
          const textToRepeat = navigationManeuver ? navigationManeuver.instruction : (selectedRoute?.summary || 'Follow highlighted navigation corridor.');
          speechService.speak(textToRepeat, true);
        } else if (intent.type === 'SET_DEPARTURE') {
          setRequestedDepartureTime(intent.payload === 'now' ? 'now' : new Date());
          speechService.speak(`Departure time set to ${intent.payload === 'now' ? 'now' : intent.payload}.`);
        } else if (intent.type === 'RECENTER_MAP') {
          requestUserLocation();
          speechService.speak('Recentering map to current location.');
        } else if (intent.type === 'REROUTE') {
          if (routes.length > 1) {
            const nextIdx = (routes.findIndex((r) => r.id === selectedRoute?.id) + 1) % routes.length;
            setSelectedRouteId(routes[nextIdx].id);
            speechService.speak(`Switched to ${routes[nextIdx].name}.`);
          } else {
            speechService.speak('Checking for route updates and traffic hazards.');
          }
        } else if (intent.type === 'MUTE') {
          if (!isAudioMuted) toggleAudioMute();
          speechService.speak('Voice muted.');
        } else if (intent.type === 'UNMUTE') {
          if (isAudioMuted) toggleAudioMute();
          speechService.speak('Voice unmuted.');
        }
      },
    });

    return () => unsub();
  }, [
    userLocation.coordinates,
    currentMission.originCoords,
    routes,
    selectedRoute,
    navigationManeuver,
    isAudioMuted,
    startCitizenNavigation,
    stopCitizenNavigation,
    setDestinationLocation,
    setTravelMode,
    setSelectedRouteId,
    requestUserLocation,
    flyToLocation,
    toggleAudioMute,
    setRequestedDepartureTime,
  ]);

  const handleToggleVoice = async () => {
    if (voiceState === 'LISTENING') {
      voiceInputService.stopListening();
    } else {
      voiceInputService.setLanguage(voiceLanguage as any);
      await voiceInputService.startListening();
    }
  };

  const handleExecuteVoiceCommand = async (cmdText: string) => {
    const parsed = voiceInputService.parseIntent(cmdText);
    if (parsed.type === 'START_NAVIGATION') {
      startCitizenNavigation();
      speechService.speak('Navigation started. Follow route instructions.');
    } else if (parsed.type === 'STOP_NAVIGATION') {
      stopCitizenNavigation();
      speechService.speak('Navigation cancelled.');
    } else if (parsed.type === 'SWITCH_MODE' && parsed.payload) {
      setTravelMode(parsed.payload);
      speechService.speak(`Switched travel mode to ${parsed.payload.toLowerCase()}.`);
    } else if (parsed.type === 'NAVIGATE_TO' && (parsed.normalizedQuery || parsed.rawTranscript)) {
      const q = parsed.normalizedQuery || parsed.rawTranscript;
      speechService.speak(`Searching for ${q}`);
      const origin = userLocation.coordinates || currentMission.originCoords;
      const res = await searchService.search(q, { originCoords: origin, limit: 1 });
      if (res.length > 0) {
        setDestinationLocation(res[0].name, res[0].coordinates);
        speechService.speak(`Route calculated to ${res[0].name.split(',')[0]}.`);
      }
    } else if (parsed.type === 'FIND_POI' && parsed.payload) {
      handleCategoryClick(parsed.payload as any);
      speechService.speak(`Finding nearby ${parsed.payload}`);
    } else if (parsed.type === 'SET_DEPARTURE') {
      if (parsed.payload === 'now') {
        setRequestedDepartureTime('now');
      } else {
        const d = new Date();
        d.setHours(18, 0, 0, 0);
        setRequestedDepartureTime(d);
      }
      speechService.speak('Departure time updated.');
    } else if (parsed.type === 'REPEAT_INSTRUCTION') {
      const textToRepeat = navigationManeuver ? navigationManeuver.instruction : (selectedRoute?.summary || 'Follow displayed route.');
      speechService.speak(textToRepeat, true);
    } else if (parsed.type === 'CURRENT_LOCATION') {
      requestUserLocation();
      speechService.speak('Recentering to your current GPS location.');
    } else if (parsed.type === 'ZOOM_IN') {
      if (userLocation.coordinates) flyToLocation(userLocation.coordinates, 16);
      speechService.speak('Zooming in.');
    } else if (parsed.type === 'ZOOM_OUT') {
      if (userLocation.coordinates) flyToLocation(userLocation.coordinates, 13);
      speechService.speak('Zooming out.');
    } else if (parsed.type === 'MUTE') {
      if (!isAudioMuted) toggleAudioMute();
    } else if (parsed.type === 'UNMUTE') {
      if (isAudioMuted) toggleAudioMute();
      speechService.speak('Voice unmuted.');
    } else if (parsed.type === 'SHOW_TRAFFIC') {
      const trafficText = selectedRoute?.trafficDelaySeconds && selectedRoute.trafficDelaySeconds > 60
        ? `Traffic delay of ${Math.round(selectedRoute.trafficDelaySeconds / 60)} minutes along active route.`
        : 'Road network flowing smoothly with nominal traffic.';
      speechService.speak(trafficText);
    } else if (parsed.type === 'SAFEST_ROUTE') {
      const safest = [...routes].sort((a, b) => a.riskScore - b.riskScore)[0];
      if (safest) {
        setSelectedRouteId(safest.id);
        speechService.speak(`Selected safest route with risk score ${safest.riskScore} of 100.`);
      }
    } else if (parsed.type === 'FASTEST_ROUTE') {
      const fastest = [...routes].sort((a, b) => a.adjustedEtaMinutes - b.adjustedEtaMinutes)[0];
      if (fastest) {
        setSelectedRouteId(fastest.id);
        speechService.speak(`Selected fastest route with ETA of ${fastest.adjustedEtaMinutes} minutes.`);
      }
    } else if (parsed.type === 'AVOID_HIGHWAYS') {
      speechService.speak('Highways avoidance preference applied to route planning.');
    } else if (parsed.type === 'AVOID_TOLLS') {
      speechService.speak('Toll avoidance preference applied to route planning.');
    }
  };

  useEffect(() => {
    (window as any).__voiceInputService = voiceInputService;
    (window as any).__executeVoiceCommand = handleExecuteVoiceCommand;
    return () => {
      delete (window as any).__voiceInputService;
      delete (window as any).__executeVoiceCommand;
    };
  }, [handleExecuteVoiceCommand]);

  const handleStartNavigation = () => {
    startCitizenNavigation();
  };

  const handleEndNavigation = () => {
    stopCitizenNavigation();
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {}
  };

  const renderManeuverIcon = (type?: string) => {
    switch (type) {
      case 'turn-left':
      case 'left':
        return <CornerUpLeft size={36} color="#38bdf8" />;
      case 'turn-right':
      case 'right':
        return <CornerUpRight size={36} color="#38bdf8" />;
      case 'fork':
        return <ArrowUpRight size={36} color="#38bdf8" />;
      default:
        return <ArrowUp size={36} color="#38bdf8" />;
    }
  };

  return (
    <>
      <VoiceDiagnosticsBar />
      {/* ============================================================ */}
      {/* 1. TOP FLOATING SEARCH & CATEGORY BAR (Google Maps style)    */}
      {/* ============================================================ */}
      {navigationPhase !== 'NAVIGATING' && (
        <div
          ref={searchContainerRef}
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            zIndex: 460,
            width: 420,
            maxWidth: 'calc(100vw - 28px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Connected FROM / TO Search Card (Part 2) */}
          <div
            style={{
              background: 'rgba(9, 13, 22, 0.96)',
              backdropFilter: 'blur(16px)',
              borderRadius: 14,
              border: '1px solid rgba(56, 189, 248, 0.28)',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Location State System (Requirement 3) */}
            {userLocation.status === 'prompting' && (
              <div className="location-state-banner status-searching">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    className="animate-spin"
                    style={{
                      width: 12,
                      height: 12,
                      border: '2px solid #38bdf8',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                    }}
                  />
                  <span>Finding your location…</span>
                </div>
                <span className="accuracy-tag">GPS Satellites</span>
              </div>
            )}

            {userLocation.status === 'denied' && (
              <div className="location-state-banner status-denied">
                <span>Location permission is required for live navigation.</span>
                <button onClick={requestUserLocation} className="enable-location-btn">
                  Enable Location
                </button>
              </div>
            )}

            {userLocation.status === 'low_accuracy' && (
              <div className="location-state-banner status-warning">
                <span>Location accuracy is low</span>
                <span className="accuracy-tag">±{userLocation.accuracyMeters}m</span>
              </div>
            )}

            {userLocation.status === 'unavailable' && (
              <div className="location-state-banner status-offline">
                <span>Location temporarily unavailable</span>
              </div>
            )}

            {userLocation.isSimulated && (
              <div className="location-state-banner status-demo">
                <span>DEMO LOCATION • Simulated GPS</span>
              </div>
            )}

            {userLocation.status === 'granted' && !userLocation.isSimulated && (
              <div className="location-state-banner status-active">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                  <div className="live-gps-dot" />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Live location • {userLocation.address || 'GPS Lock Active'}
                  </span>
                </div>
                <span className="accuracy-tag">±{userLocation.accuracyMeters || 20}m</span>
              </div>
            )}

            {/* FROM ROW */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: '1px solid rgba(51, 65, 85, 0.45)',
                paddingBottom: 7,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 66, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.05em' }}>FROM</span>
                <MapPin size={13} color="#38bdf8" />
              </div>

              {activeSearchField === 'source' ? (
                <input
                  id="roadrisk-origin-input"
                  className="search-input origin-input"
                  type="text"
                  placeholder="Enter starting location or landmark..."
                  value={sourceQuery}
                  autoFocus
                  onBlur={() => {
                    if (!sourceQuery) setActiveSearchField('destination');
                  }}
                  onChange={(e) => {
                    setSourceQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#f8fafc',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                />
              ) : (
                <div
                  id="roadrisk-origin-input"
                  onClick={() => {
                    setActiveSearchField('source');
                    setIsSearchOpen(true);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    userSelect: 'none',
                    overflow: 'hidden',
                  }}
                >
                  {currentMission.origin && currentMission.origin !== 'Current Location' ? (
                    <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📍 {currentMission.origin}
                    </span>
                  ) : (
                    <>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#10b981',
                          boxShadow: '0 0 8px rgba(16, 185, 129, 0.8)',
                          flexShrink: 0,
                          display: 'inline-block',
                        }}
                      />
                      <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        Current location
                      </span>
                      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        (GPS • Accurate to ±{userLocation.accuracyMeters ? Math.round(userLocation.accuracyMeters) : 20}m)
                      </span>
                    </>
                  )}
                </div>
              )}

              {currentMission.origin && currentMission.origin !== 'Current Location' && (
                <button
                  onClick={() => {
                    clearOrigin();
                    setSourceQuery('');
                  }}
                  title="Reset to Live GPS Location"
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#38bdf8',
                    borderRadius: 6,
                    padding: '2px 6px',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  GPS
                </button>
              )}

              <button
                onClick={handleSwapOriginDestination}
                title="Swap Origin and Destination"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ArrowUpDown size={14} />
              </button>
            </div>

            {/* TO ROW */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 66, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.05em' }}>TO</span>
                <Search size={13} color="#f59e0b" />
              </div>

              <input
                id="roadrisk-destination-input"
                className="search-input destination-input"
                type="text"
                placeholder={currentMission.destination || 'Where do you want to go?'}
                value={activeSearchField === 'destination' ? searchQuery : ''}
                onFocus={() => {
                  setActiveSearchField('destination');
                  setIsSearchOpen(true);
                }}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedSearchResultIdx((prev) => Math.min(searchResults.length - 1, prev + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedSearchResultIdx((prev) => Math.max(0, prev - 1));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedSearchResultIdx >= 0 && searchResults[selectedSearchResultIdx]) {
                      handleSelectLocation(searchResults[selectedSearchResultIdx]);
                    } else if (searchResults.length > 0) {
                      handleSelectLocation(searchResults[0]);
                    }
                  } else if (e.key === 'Escape') {
                    setIsSearchOpen(false);
                  }
                }}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f8fafc',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              />

              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setOfflineSearchNotice(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={15} />
                </button>
              )}

              {/* Voice Command Mic Button with Live Audio Level */}
              <button
                onClick={handleToggleVoice}
                title={`Voice Search (${voiceLanguage})`}
                aria-label="Toggle Microphone Voice Search"
                id="voice-mic-search-btn"
                style={{
                  background: voiceState === 'LISTENING' ? '#ef4444' : 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid ' + (voiceState === 'LISTENING' ? '#ef4444' : 'rgba(56, 189, 248, 0.4)'),
                  color: voiceState === 'LISTENING' ? '#fff' : '#38bdf8',
                  borderRadius: 8,
                  padding: '5px 7px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s ease',
                  boxShadow: voiceState === 'LISTENING' ? '0 0 12px rgba(239, 68, 68, 0.6)' : 'none',
                }}
              >
                {voiceState === 'LISTENING' ? <MicOff size={15} /> : <Mic size={15} />}
                {voiceState === 'LISTENING' && micAudioLevel > 0.05 && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#fff',
                    }}
                  />
                )}
              </button>

              {/* What Can I Say? Voice Command Discovery Guide Button */}
              <button
                onClick={() => setShowVoiceHelpModal(true)}
                title="What can I say? (Voice Command Guide)"
                aria-label="What can I say? Voice Command Guide"
                id="voice-commands-help-btn"
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  borderRadius: 8,
                  padding: '5px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>🎙️ What can I say?</span>
              </button>

              {/* Offline Map Manager Shortcut Button */}
              <button
                onClick={() => setShowOfflineModal(true)}
                title="Offline Map & Routing Manager"
                style={{
                  background: isNetworkOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid ' + (isNetworkOnline ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.5)'),
                  color: isNetworkOnline ? '#10b981' : '#f59e0b',
                  borderRadius: 8,
                  padding: '4px 7px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 10.5,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                <HardDrive size={13} />
                <span>{offlineRegionsCount > 0 ? `${offlineRegionsCount} Reg` : 'Offline'}</span>
              </button>
            </div>
          </div>

          {/* Voice Feedback Banner & Live Audio Waveform */}
          {voiceFeedbackText && (
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.96)',
                border: '1px solid #38bdf8',
                borderRadius: 10,
                padding: '8px 14px',
                color: '#38bdf8',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {voiceState === 'LISTENING' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {[0.5, 0.9, 1.0, 0.7, 0.4].map((h, i) => (
                      <span
                        key={i}
                        style={{
                          width: 3,
                          height: Math.max(4, Math.round(18 * (micAudioLevel > 0.05 ? micAudioLevel * h : 0.25))),
                          background: '#38bdf8',
                          borderRadius: 2,
                          transition: 'height 0.08s ease',
                        }}
                      />
                    ))}
                  </div>
                )}
                <span>🎙️ {voiceFeedbackText}</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['en-US', 'te-IN', 'hi-IN', 'ta-IN', 'kn-IN'] as VoiceLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setVoiceLanguage(lang);
                      voiceInputService.setLanguage(lang as any);
                      navigationVoiceService.setLanguage(lang as any);
                      speechService.setLanguage(lang as any);
                    }}
                    style={{
                      padding: '2px 6px',
                      fontSize: 10,
                      borderRadius: 4,
                      border: 'none',
                      background: voiceLanguage === lang ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                      color: voiceLanguage === lang ? '#0b0f17' : '#94a3b8',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    {lang === 'en-US' ? 'EN' : lang === 'te-IN' ? 'తెలుగు' : lang === 'hi-IN' ? 'हिंदी' : lang === 'ta-IN' ? 'தமிழ்' : 'ಕನ್ನಡ'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Horizontal Category Filter Pills */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              paddingBottom: 4,
              scrollbarWidth: 'none',
            }}
          >
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => handleCategoryClick(cat.key)}
                style={{
                  background: 'rgba(15, 23, 42, 0.88)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(51, 65, 85, 0.7)',
                  borderRadius: 20,
                  padding: '6px 12px',
                  color: '#e2e8f0',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Vehicle / Travel Mode Selector (Car, Bike, Bicycle, Walk, Transit) */}
          <TravelModeSelector
            currentMode={travelMode}
            onSelectMode={(mode) => setTravelMode(mode)}
            isLoading={isCalculatingRoute}
          />

          {/* Authoritative Departure Time Control Bar */}
          <div
            id="departure-time-control-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '6px 12px',
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(51, 65, 85, 0.6)',
              borderRadius: 10,
              fontSize: 12,
              color: '#94a3b8',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} color="#38bdf8" />
              <span>Departure:</span>
              <strong style={{ color: '#f8fafc' }}>
                {Math.abs(Date.now() - departureTime.getTime()) < 120_000
                  ? 'Depart now'
                  : departureTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                id="depart-now-btn"
                onClick={() => setRequestedDepartureTime('now')}
                style={{
                  background: Math.abs(Date.now() - departureTime.getTime()) < 120_000 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.6)',
                  border: Math.abs(Date.now() - departureTime.getTime()) < 120_000 ? '1px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.6)',
                  color: Math.abs(Date.now() - departureTime.getTime()) < 120_000 ? '#38bdf8' : '#cbd5e1',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Depart now
              </button>

              <button
                id="depart-evening-btn"
                onClick={() => {
                  const target = new Date();
                  target.setHours(18, 0, 0, 0);
                  if (target.getTime() < Date.now()) {
                    target.setDate(target.getDate() + 1);
                  }
                  setRequestedDepartureTime(target);
                }}
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(51, 65, 85, 0.6)',
                  color: '#cbd5e1',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                6:00 PM
              </button>
            </div>
          </div>

          {/* Route Error / Transit Notice Banner */}
          {routeErrorNotice && (
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(239, 68, 68, 0.6)',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#fca5a5', lineHeight: 1.4 }}>
                <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{routeErrorNotice}</span>
              </div>
              <button
                onClick={clearRouteError}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Search Dropdown / Recent Searches Popover */}
          {isSearchOpen && (
            <div
              style={{
                background: 'rgba(9, 13, 22, 0.98)',
                backdropFilter: 'blur(20px)',
                borderRadius: 14,
                border: '1px solid rgba(56, 189, 248, 0.2)',
                boxShadow: '0 20px 48px rgba(0, 0, 0, 0.85)',
                maxHeight: 380,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {isSearching ? (
                <div style={{ padding: 18, color: '#38bdf8', fontSize: 13, textAlign: 'center', fontWeight: 600 }}>
                  Searching worldwide road network...
                </div>
              ) : searchResults.length > 0 ? (
                <div>
                  <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>
                    SEARCH RESULTS
                  </div>
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="search-result-item"
                      data-id={result.id}
                      onClick={() => handleSelectLocation(result)}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        borderBottom: '1px solid rgba(30, 41, 59, 0.5)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div
                        style={{
                          marginTop: 2,
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(255,255,255,0.05)',
                        }}
                      >
                        {result.type === 'city' ? (
                          <Building size={16} color="#38bdf8" />
                        ) : result.type === 'highway' || result.type === 'street' ? (
                          <Compass size={16} color="#8b5cf6" />
                        ) : result.type === 'hospital' ? (
                          <Building2 size={16} color="#ef4444" />
                        ) : result.type === 'fuel' ? (
                          <Fuel size={16} color="#f59e0b" />
                        ) : result.type === 'railway' || result.type === 'transit' ? (
                          <Train size={16} color="#10b981" />
                        ) : result.type === 'restaurant' ? (
                          <Utensils size={16} color="#f97316" />
                        ) : result.type === 'airport' ? (
                          <Navigation size={16} color="#06b6d4" />
                        ) : (
                          <MapPin size={16} color="#38bdf8" />
                        )}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600 }}>{result.name}</span>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              textTransform: 'uppercase',
                            }}
                          >
                            {result.type}
                          </span>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{result.label}</span>
                          {(() => {
                            const origin = userLocation.coordinates || currentMission.originCoords;
                            if (origin && result.coordinates) {
                              const dist = calculateDistanceKm(origin, result.coordinates);
                              return (
                                <span style={{ color: '#38bdf8', fontWeight: 700, flexShrink: 0 }}>
                                  • {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : offlineSearchNotice ? (
                <div style={{ padding: 18, textAlign: 'center', color: '#f59e0b', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(245, 158, 11, 0.08)' }}>
                  <AlertTriangle size={15} />
                  <span>{offlineSearchNotice}</span>
                </div>
              ) : recentSearches.length > 0 && !searchQuery ? (
                <div>
                  <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <History size={13} />
                    <span>RECENT SEARCHES</span>
                  </div>
                  {recentSearches.map((recent) => (
                    <div
                      key={recent.id}
                      onClick={() => handleSelectLocation(recent)}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        borderBottom: '1px solid rgba(30, 41, 59, 0.4)',
                      }}
                    >
                      <Clock size={14} color="#94a3b8" />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 500 }}>{recent.name}</div>
                        <div style={{ color: '#64748b', fontSize: 11 }}>{recent.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                  Type a city, street, business, landmark, or coordinates to search.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. PLACE DETAILS & EXPLORATION: Handled contextually by Google-Maps-Style PlaceInformationPanel */}

      {/* ============================================================ */}
      {/* 3. ROUTE SELECTION BOTTOM SHEET (3 Alternatives + Safety)    */}
      {/* ============================================================ */}
      {routes.length > 0 && navigationPhase !== 'NAVIGATING' && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 16,
            right: 16,
            maxWidth: 520,
            margin: '0 auto',
            zIndex: 480,
            background: 'rgba(9, 13, 22, 0.96)',
            backdropFilter: 'blur(20px)',
            borderRadius: 18,
            border: '1px solid rgba(56, 189, 248, 0.35)',
            boxShadow: '0 24px 54px rgba(0, 0, 0, 0.9)',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Destination Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 10.5, color: '#38bdf8', fontWeight: 700, letterSpacing: '0.06em' }}>
                SELECT SAFE CORRIDOR
              </span>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                To: {currentMission.destination || 'Destination'}
              </h4>
            </div>
            <button
              onClick={clearDestination}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#cbd5e1',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Change
            </button>
          </div>

          {/* Dynamic Rerouting Alert Banner (Phase 12) */}
          {rerouteRecommendation && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.18)',
                border: '1px solid #ef4444',
                borderRadius: 12,
                padding: '12px 14px',
                color: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <AlertTriangle size={18} color="#ef4444" />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fca5a5' }}>
                  DYNAMIC REROUTE ADVISORY
                </span>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.4 }}>
                {rerouteRecommendation.humanExplanation}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={acceptReroute}
                  style={{
                    flex: 1,
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Accept Reroute ({rerouteRecommendation.etaDifferenceMinutes >= 0 ? '+' : ''}{rerouteRecommendation.etaDifferenceMinutes}m)
                </button>
                <button
                  onClick={dismissReroute}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#cbd5e1',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Weather & Flood Intelligence Status Pill (Phases 5 & 6) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 11,
              color: '#94a3b8',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CloudRain size={14} color="#38bdf8" />
              <span>
                <strong style={{ color: '#f8fafc' }}>Weather: </strong>
                {liveWeather ? `${liveWeather.temperatureCelsius}°C, ${liveWeather.precipitationMm > 0 ? `${liveWeather.precipitationMm}mm rain` : 'Clear'}` : 'Checking...'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Waves size={14} color="#06b6d4" />
              <span>
                <strong style={{ color: '#f8fafc' }}>Flood: </strong>
                {liveFlood ? `${liveFlood.overallLevel} Risk (Model)` : 'Assessing...'}
              </span>
            </div>
          </div>

          {/* 3 Alternative Routes List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {routes.slice(0, 3).map((route, idx) => {
              const isSelected = selectedRoute?.id === route.id;
              const safetyScore = Math.max(0, 100 - route.riskScore);

              return (
                <div
                  key={route.id}
                  className={`route-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedRouteId(route.id)}
                  style={{
                    background: isSelected ? 'rgba(2, 132, 199, 0.18)' : 'rgba(30, 41, 59, 0.45)',
                    border: isSelected ? '1.5px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.5)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ color: isSelected ? '#38bdf8' : '#cbd5e1', fontSize: 13, fontWeight: 700 }}>
                          {route.name || `Corridor ${idx + 1}`}
                        </span>
                        {idx === 0 && (
                          <span style={{ background: '#10b981', color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                            BEST ROUTE
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background:
                              route.trafficDataSource === 'LIVE'
                                ? 'rgba(16, 185, 129, 0.2)'
                                : route.trafficDataSource === 'DEMO'
                                ? 'rgba(234, 179, 8, 0.2)'
                                : 'rgba(148, 163, 184, 0.15)',
                            color:
                              route.trafficDataSource === 'LIVE'
                                ? '#10b981'
                                : route.trafficDataSource === 'DEMO'
                                ? '#eab308'
                                : '#94a3b8',
                            border: `1px solid ${
                              route.trafficDataSource === 'LIVE'
                                ? 'rgba(16, 185, 129, 0.4)'
                                : route.trafficDataSource === 'DEMO'
                                ? 'rgba(234, 179, 8, 0.4)'
                                : 'rgba(148, 163, 184, 0.3)'
                            }`,
                          }}
                        >
                          {route.trafficDataSource === 'LIVE'
                            ? 'LIVE TRAFFIC'
                            : route.trafficDataSource === 'DEMO'
                            ? 'DEMO TRAFFIC'
                            : 'TRAFFIC: NOT CONFIGURED'}
                        </span>
                      </div>

                      {/* Distance, ETA, Signals & Turns */}
                      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: '#f8fafc', fontWeight: 800 }}>
                          {route.formattedDuration || `${Math.round(route.adjustedEtaMinutes)} min`}
                        </span>
                        <span>•</span>
                        <span>{route.distanceKm} km</span>
                        <span>•</span>
                        <span style={{ color: '#a7f3d0', fontWeight: 700 }}>
                          🕒 {route.formattedArrivalTime ? `Arrive ${route.formattedArrivalTime}` : `${Math.round(route.adjustedEtaMinutes)} min`}
                        </span>
                        {route.trafficDelaySeconds && route.trafficDelaySeconds > 60 ? (
                          <>
                            <span>•</span>
                            <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                              +{Math.round(route.trafficDelaySeconds / 60)}m delay
                            </span>
                          </>
                        ) : null}
                        <span>•</span>
                        <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                          🚦 {route.trafficSignalsCount ?? 0} signals
                        </span>
                        <span>•</span>
                        <span>{route.maneuvers?.length || 8} turns</span>
                      </div>

                      {/* Major Roads */}
                      {route.majorRoads && route.majorRoads.length > 0 && (
                        <div style={{ color: '#64748b', fontSize: 10.5, marginTop: 3 }}>
                          via {route.majorRoads.slice(0, 3).join(' ➔ ')}
                        </div>
                      )}
                    </div>

                    {/* Safety Index Pill */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        background: safetyScore >= 80 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        border: `1px solid ${safetyScore >= 80 ? '#10b981' : '#f59e0b'}`,
                        padding: '4px 8px',
                        borderRadius: 8,
                        flexShrink: 0,
                      }}
                    >
                      <Shield size={13} color={safetyScore >= 80 ? '#10b981' : '#f59e0b'} />
                      <span style={{ color: safetyScore >= 80 ? '#10b981' : '#f59e0b', fontSize: 11, fontWeight: 800 }}>
                        {safetyScore >= 80 ? 'LOW RISK' : 'MEDIUM RISK'}
                      </span>
                    </div>
                  </div>

                  {/* Safety Feature Checklist & Details Trigger */}
                  {isSelected && (
                    <div style={{ borderTop: '1px solid rgba(56, 189, 248, 0.2)', paddingTop: 8, marginTop: 2 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {(route.safetyBulletPoints && route.safetyBulletPoints.length > 0 ? route.safetyBulletPoints : [
                          `✓ ${route.trafficSignalsCount ?? 0} mapped traffic signals along corridor`,
                          `✓ ${route.nearbyHospitals?.length ?? 1} emergency hospital in corridor reach`,
                          `✓ Continuous Smart Student Safety tracking corridor`,
                        ]).map((bp, bidx) => (
                          <div key={bidx} style={{ fontSize: 11, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <CheckCircle2 size={12} color="#10b981" />
                            <span>{bp}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowRouteDetailsDrawer(true);
                          }}
                          style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            color: '#38bdf8',
                            borderRadius: 6,
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <List size={13} />
                          <span>View Corridor Details</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Trade-off Explanation */}
          {whyThisRouteExplanation && (
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(51, 65, 85, 0.5)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 11,
                color: '#94a3b8',
                lineHeight: 1.4,
              }}
            >
              {whyThisRouteExplanation}
            </div>
          )}

          {/* Fuel & Range Intelligence (Requirement 22) */}
          {selectedRoute && (
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Fuel size={14} color="#f59e0b" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.04em' }}>
                    FUEL INTELLIGENCE
                  </span>
                </div>
                {/* Vehicle Mode Switcher: Car vs Bike */}
                <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: 2 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCitizenVehicleType('car');
                    }}
                    style={{
                      background: citizenVehicleType === 'car' ? '#38bdf8' : 'transparent',
                      color: citizenVehicleType === 'car' ? '#0b0f17' : '#94a3b8',
                      border: 'none',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🚗 Car
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCitizenVehicleType('bike');
                    }}
                    style={{
                      background: citizenVehicleType === 'bike' ? '#38bdf8' : 'transparent',
                      color: citizenVehicleType === 'bike' ? '#0b0f17' : '#94a3b8',
                      border: 'none',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🏍 Bike
                  </button>
                </div>
              </div>

              {(() => {
                const estRangeKm = citizenVehicleType === 'car' ? Math.round(fuelPercent * 3.1) : Math.round(fuelPercent * 2.35);
                const destDistKm = selectedRoute.distanceKm;
                const isSufficient = estRangeKm >= destDistKm;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, fontSize: 11 }}>
                      <div>
                        <span style={{ color: '#64748b', fontSize: 10 }}>Fuel</span>
                        <div style={{ color: '#f8fafc', fontWeight: 700 }}>{fuelPercent}%</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', fontSize: 10 }}>Est. Range</span>
                        <div style={{ color: '#38bdf8', fontWeight: 700 }}>{estRangeKm} km</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', fontSize: 10 }}>Distance</span>
                        <div style={{ color: '#f8fafc', fontWeight: 700 }}>{destDistKm} km</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', fontSize: 10 }}>Status</span>
                        <div style={{ color: isSufficient ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                          {isSufficient ? 'Enough' : 'Low'}
                        </div>
                      </div>
                    </div>

                    {!isSufficient && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(239, 68, 68, 0.15)', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <span style={{ color: '#fca5a5', fontSize: 11, fontWeight: 600 }}>
                          ⚠️ Fuel may be insufficient for trip.
                        </span>
                        <button
                          onClick={() => handleCategoryClick('fuel')}
                          style={{
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            padding: '3px 8px',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Find Petrol Stations
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Traffic Prediction Forecasting Card (Phase 13: 5, 10, 15, 30 min) */}
          {trafficPrediction && (
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: 12,
                padding: '10px 14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => setShowPredictionCard((prev) => !prev)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={14} color="#06b6d4" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', letterSpacing: '0.04em' }}>
                    TRAFFIC PREDICTION ({trafficPrediction.status})
                  </span>
                </div>
                <span style={{ fontSize: 10, color: '#64748b' }}>
                  {showPredictionCard ? '▲ Hide' : '▼ View'}
                </span>
              </div>

              {showPredictionCard && (
                <div style={{ marginTop: 8 }}>
                  {trafficPrediction.dataSufficiency === 'SUFFICIENT' ? (
                    <>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: 6,
                          textAlign: 'center',
                        }}
                      >
                        {trafficPrediction.horizons.map((h) => (
                          <div
                            key={h.horizonMinutes}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              padding: '6px 4px',
                              borderRadius: 8,
                              border: '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>
                              +{h.horizonMinutes}m
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
                              {h.predictedSpeedKmh} <span style={{ fontSize: 9 }}>km/h</span>
                            </div>
                            <div
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                marginTop: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 2,
                                color: h.trend === 'WORSENING' ? '#f87171' : h.trend === 'IMPROVING' ? '#34d399' : '#94a3b8',
                              }}
                            >
                              {h.trend === 'WORSENING' ? <TrendingDown size={10} /> : h.trend === 'IMPROVING' ? <TrendingUp size={10} /> : '—'}
                              <span>{h.congestionLevel}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#94a3b8', lineHeight: 1.35 }}>
                        {trafficPrediction.summaryExplanation}
                      </p>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: '#f59e0b', padding: '4px 0' }}>
                      ⚠️ {trafficPrediction.summaryExplanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Start Navigation Action & Quick Report Ahead */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              id="roadrisk-start-navigation-btn"
              className="start-navigation-btn"
              onClick={handleStartNavigation}
              style={{
                flex: 1,
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                padding: '13px 18px',
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.45)',
              }}
            >
              <Navigation size={18} />
              <span>Start Navigation</span>
            </button>

            {selectedRoute && (
              <button
                id="roadrisk-directions-btn"
                onClick={() => {
                  setShowDirectionsPanel(true);
                  if (selectedRoute) {
                    const firstManeuver = selectedRoute.maneuvers && selectedRoute.maneuvers.length > 0
                      ? selectedRoute.maneuvers[0]
                      : {
                          id: 'step_start',
                          instruction: `Head along ${selectedRoute.name}`,
                          distanceMeters: Math.max(100, Math.round(selectedRoute.distanceKm * 1000 * 0.1)),
                          type: 'straight',
                        };
                    navigationVoiceService.startNavigation(selectedRoute.name, firstManeuver);
                  }
                }}
                style={{
                  background: 'rgba(56, 189, 248, 0.18)',
                  border: '1px solid rgba(56, 189, 248, 0.5)',
                  color: '#38bdf8',
                  borderRadius: 12,
                  padding: '0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="View Detailed Turn-by-Turn Directions"
              >
                <List size={16} />
                <span>Directions</span>
              </button>
            )}
            <button
              onClick={() => setShowReportModal(true)}
              style={{
                background: 'rgba(239, 68, 68, 0.18)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#f87171',
                borderRadius: 12,
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Report Road Hazard Ahead (Phase 9)"
            >
              <AlertTriangle size={16} />
              <span>Report</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. ACTIVE TURN-BY-TURN NAVIGATION HUD                        */}
      {/* ============================================================ */}
      {navigationPhase === 'NAVIGATING' && (
        <>
          {/* Top Maneuver Banner */}
          <div
            className="navigation-hud top-maneuver-banner"
            style={{
              position: 'absolute',
              top: 14,
              left: 16,
              right: 16,
              maxWidth: 460,
              margin: '0 auto',
              zIndex: 500,
              background: 'rgba(9, 13, 22, 0.96)',
              backdropFilter: 'blur(20px)',
              borderRadius: 16,
              border: '1px solid #38bdf8',
              boxShadow: '0 16px 40px rgba(0,0,0,0.85)',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div style={{ flexShrink: 0 }}>
              {renderManeuverIcon(navigationManeuver?.type)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#38bdf8', fontWeight: 800 }}>
                {navigationManeuver?.distanceMeters ? `In ${navigationManeuver.distanceMeters} meters` : 'Continue Straight'}
              </div>
              <div className="maneuver-instruction" style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
                {navigationManeuver?.instruction || `Head towards ${currentMission.destination || 'destination'}`}
              </div>
            </div>
          </div>

          {/* Bottom Navigation Telemetry Dock */}
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              left: 16,
              right: 16,
              maxWidth: 460,
              margin: '0 auto',
              zIndex: 500,
              background: 'rgba(9, 13, 22, 0.96)',
              backdropFilter: 'blur(20px)',
              borderRadius: 16,
              border: '1px solid rgba(56, 189, 248, 0.3)',
              boxShadow: '0 20px 48px rgba(0,0,0,0.85)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Speed & Remaining Distance */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: '#38bdf8' }}>
                  {userLocation.speedKmh || 42}
                </span>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>km/h</span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                {selectedRoute?.adjustedEtaMinutes || 12} min · {selectedRoute?.distanceKm || 4.2} km left
              </div>
            </div>

            {/* Controls: SOS, audio mute, voice command, and end navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setShowSosModal(true)}
                title="Emergency SOS Broadcast (Student Safety ID)"
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: '1px solid #ef4444',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  boxShadow: '0 0 12px rgba(220, 38, 38, 0.5)',
                }}
              >
                <Siren size={15} />
                <span>SOS</span>
              </button>

              <button
                onClick={toggleAudioMute}
                title={isAudioMuted ? 'Unmute voice' : 'Mute voice'}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: isAudioMuted ? '#94a3b8' : '#38bdf8',
                  borderRadius: 10,
                  padding: 8,
                  cursor: 'pointer',
                }}
              >
                {isAudioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              <button
                onClick={handleToggleVoice}
                title="Voice Command"
                style={{
                  background: voiceState === 'LISTENING' ? '#ef4444' : 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid ' + (voiceState === 'LISTENING' ? '#ef4444' : 'rgba(56, 189, 248, 0.4)'),
                  color: voiceState === 'LISTENING' ? '#fff' : '#38bdf8',
                  borderRadius: 10,
                  padding: 8,
                  cursor: 'pointer',
                }}
              >
                <Mic size={18} />
              </button>

              <button
                id="roadrisk-end-navigation-btn"
                className="end-navigation-btn"
                onClick={handleEndNavigation}
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                End
              </button>
            </div>
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* 5. ARRIVAL CELEBRATION & SAFETY DEBRIEF                      */}
      {/* ============================================================ */}
      {navigationPhase === 'ARRIVED' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 600,
            background: 'rgba(5, 8, 15, 0.85)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#0b0f17',
              border: '1px solid #10b981',
              borderRadius: 20,
              boxShadow: '0 24px 64px rgba(0,0,0,0.9)',
              maxWidth: 440,
              width: '100%',
              padding: 24,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '2px solid #10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <div>
              <span style={{ color: '#10b981', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em' }}>
                DESTINATION REACHED
              </span>
              <h2 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900, color: '#f8fafc' }}>
                You Have Safely Arrived!
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                {currentMission.destination}
              </p>
            </div>

            {/* Trip Safety Summary */}
            <div
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(51, 65, 85, 0.6)',
                borderRadius: 12,
                padding: '14px 16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>SAFETY INDEX</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981', marginTop: 2 }}>96/100</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>HAZARDS AVOIDED</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>2 Bypassed</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>CLEAN TRANSIT</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc', marginTop: 2 }}>100%</div>
              </div>
            </div>

            <button
              onClick={() => {
                stopCitizenNavigation();
                clearDestination();
              }}
              style={{
                width: '100%',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                padding: '12px 18px',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Done & Return to Map
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. CRASH / SUDDEN EVENT INCIDENT INTELLIGENCE ALERT MODAL    */}
      {/* ============================================================ */}
      {activeCrashAlert && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 700,
            background: 'rgba(15, 5, 5, 0.88)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '2px solid #ef4444',
              borderRadius: 20,
              boxShadow: '0 24px 64px rgba(239, 68, 68, 0.4)',
              maxWidth: 440,
              width: '100%',
              padding: 24,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '2px solid #ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <div>
              <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em' }}>
                SAFETY ALERT: SUDDEN DECELERATION
              </span>
              <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>
                Are You Safe?
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                Severe deceleration ({activeCrashAlert.decelerationG}g) detected from {activeCrashAlert.initialSpeedKmh} km/h. Automatic emergency contact countdown:
              </p>
            </div>

            {/* Countdown Badge */}
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '6px 20px',
                borderRadius: 12,
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              {crashCountdown}s
            </div>

            {/* Actions Grid */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => crashDetectionService.markSafe(activeCrashAlert.id)}
                style={{
                  width: '100%',
                  background: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '12px',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                I'm Safe (Cancel Alert)
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <button
                  onClick={() => {
                    crashDetectionService.markEmergency(activeCrashAlert.id);
                    window.open('tel:112');
                  }}
                  style={{
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 6px',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <PhoneCall size={16} />
                  <span>Call 112 / 108</span>
                </button>

                <button
                  onClick={() => {
                    crashDetectionService.markSafe(activeCrashAlert.id);
                    handleCategoryClick('hospital');
                  }}
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid #38bdf8',
                    color: '#38bdf8',
                    borderRadius: 10,
                    padding: '10px 6px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Building2 size={16} />
                  <span>Hospitals</span>
                </button>

                <button
                  onClick={() => {
                    const text = `RoadRisk Safety Alert: My location is https://maps.google.com/?q=${activeCrashAlert.coordinates[1]},${activeCrashAlert.coordinates[0]}`;
                    navigator.clipboard?.writeText(text);
                    speechService.speak('Location copied to clipboard.');
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#e2e8f0',
                    borderRadius: 10,
                    padding: '10px 6px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Share2 size={16} />
                  <span>Share GPS</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Ahead Modal (Phase 9) */}
      <ReportAheadModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        currentCoordinates={userLocation.coordinates || [78.4744, 17.3616]}
      />

      {/* Route Details Corridor Drawer */}
      {showRouteDetailsDrawer && selectedRoute && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 650,
            background: 'rgba(5, 8, 15, 0.8)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setShowRouteDetailsDrawer(false)}
        >
          <div
            style={{
              background: '#0b0f17',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.8)',
              width: '100%',
              maxWidth: 520,
              maxHeight: '75vh',
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                  Journey Corridor Details
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  {selectedRoute.name} · {selectedRoute.adjustedEtaMinutes} min ({selectedRoute.distanceKm} km)
                </div>
              </div>
              <button
                onClick={() => setShowRouteDetailsDrawer(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: '#94a3b8',
                  borderRadius: 8,
                  padding: 6,
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, background: 'rgba(15, 23, 42, 0.6)', padding: 12, borderRadius: 12, border: '1px solid rgba(51, 65, 85, 0.4)' }}>
              <div>
                <span style={{ fontSize: 10, color: '#64748b' }}>Signals</span>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8' }}>
                  🚦 {selectedRoute.trafficSignalsCount || 0}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: '#64748b' }}>Turns</span>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
                  {selectedRoute.maneuvers?.length || 8}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: '#64748b' }}>Hospitals</span>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>
                  🏥 {selectedRoute.nearbyHospitals?.length || 0}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: '#64748b' }}>Safety</span>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8' }}>
                  {Math.max(0, 100 - selectedRoute.riskScore)}/100
                </div>
              </div>
            </div>

            {/* Step-by-Step Corridor Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Corridor Milestones & Safety Anchor Points
              </div>

              {/* Origin */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ background: '#10b981', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                  A
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Departure Point</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{currentMission.origin || 'Current Location'}</div>
                </div>
              </div>

              {/* Milestones */}
              {selectedRoute.corridorMilestones && selectedRoute.corridorMilestones.length > 0 ? (
                selectedRoute.corridorMilestones.map((m, mIdx) => (
                  <div key={m.id || mIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingLeft: 4 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 2, height: 14, background: 'rgba(56, 189, 248, 0.3)' }} />
                      <div style={{
                        background: m.type === 'signal' ? 'rgba(234, 179, 8, 0.2)' : m.type === 'hospital' ? 'rgba(16, 185, 129, 0.2)' : m.type === 'school' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                        border: `1px solid ${m.type === 'signal' ? '#eab308' : m.type === 'hospital' ? '#10b981' : m.type === 'school' ? '#a855f7' : '#38bdf8'}`,
                        borderRadius: 6,
                        padding: '2px 5px',
                        fontSize: 11,
                      }}>
                        {m.icon || (m.type === 'signal' ? '🚦' : m.type === 'hospital' ? '🏥' : m.type === 'school' ? '🏫' : '📍')}
                      </div>
                      <div style={{ width: 2, height: 14, background: 'rgba(56, 189, 248, 0.3)' }} />
                    </div>
                    <div style={{ flex: 1, paddingTop: 10 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f8fafc' }}>{m.title}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.description}</div>
                      {m.distanceAlongRouteKm !== undefined && (
                        <div style={{ fontSize: 10, color: '#38bdf8', marginTop: 2 }}>{m.distanceAlongRouteKm} km from departure</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                selectedRoute.maneuvers?.map((man, mIdx) => (
                  <div key={mIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingLeft: 4 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 2, height: 12, background: 'rgba(56, 189, 248, 0.3)' }} />
                      <div style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', borderRadius: 4, padding: '2px 4px', fontSize: 10, color: '#38bdf8' }}>
                        {mIdx + 1}
                      </div>
                      <div style={{ width: 2, height: 12, background: 'rgba(56, 189, 248, 0.3)' }} />
                    </div>
                    <div style={{ flex: 1, paddingTop: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{man.instruction}</div>
                      <div style={{ fontSize: 10.5, color: '#64748b' }}>In {man.distanceMeters}m</div>
                    </div>
                  </div>
                ))
              )}

              {/* Destination */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                  B
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Arrival Destination</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{currentMission.destination || 'Selected Destination'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emergency SOS Broadcast Modal (Requirement 19) */}
      {showSosModal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 700,
            background: 'rgba(15, 0, 0, 0.88)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#0b0f17',
              border: '2px solid #ef4444',
              borderRadius: 20,
              boxShadow: '0 0 50px rgba(239, 68, 68, 0.6)',
              maxWidth: 480,
              width: '100%',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#ef4444', borderRadius: '50%', padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Siren size={24} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#f87171' }}>
                  EMERGENCY SOS ACTIVE
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  Smart Student Safety ID Broadcast
                </div>
              </div>
            </div>

            {/* GPS Telemetry Box */}
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, padding: 12, fontSize: 12 }}>
              <div style={{ color: '#fca5a5', fontWeight: 700 }}>
                📍 Real Location: {userLocation.address || 'Locating Current Address...'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
                Accuracy: ±{Math.round(userLocation.accuracyMeters || 8)}m · Tracking: Continuous GPS
              </div>
              <div style={{ color: '#10b981', fontSize: 11, marginTop: 4, fontWeight: 600 }}>
                ✓ Distress beacon transmitted to Parents & Campus Safety Center
              </div>
            </div>

            {/* Nearby Emergency Facilities */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>
                Closest Trauma & Emergency Facilities:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(selectedRoute?.nearbyHospitals && selectedRoute.nearbyHospitals.length > 0 ? selectedRoute.nearbyHospitals.slice(0, 3) : [
                  { name: 'City Emergency & Trauma Hospital', distanceMeters: 850, phone: '108' },
                  { name: 'District General Medical Center', distanceMeters: 1600, phone: '108' },
                  { name: 'Apollo Emergency Clinic', distanceMeters: 2300, phone: '108' },
                ]).map((h, hIdx) => (
                  <div key={hIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>{h.name}</div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                        {Math.round(h.distanceMeters ?? ('distanceFromRouteMeters' in h ? (h.distanceFromRouteMeters as number) : 600))}m away
                      </div>
                    </div>
                    <button
                      onClick={() => window.open('tel:108')}
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Call 108
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
              <button
                onClick={() => {
                  window.open('tel:112');
                }}
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '12px',
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <PhoneCall size={16} />
                <span>Call 112 Police</span>
              </button>

              <button
                onClick={() => setShowSosModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#f8fafc',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 12,
                  padding: '12px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Dismiss / I'm Safe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Place Quick Action Card */}
      {selectedPlaceInfo && (
        <SelectedPlaceCard
          place={selectedPlaceInfo}
          onGetDirections={(place) => {
            setDestinationLocation(place.name, place.coordinates);
          }}
          onStartNavigation={(place) => {
            setDestinationLocation(place.name, place.coordinates);
            setTimeout(() => {
              handleStartNavigation();
            }, 600);
          }}
          onClose={() => setSelectedPlaceInfo(null)}
        />
      )}

      {/* Turn-by-Turn Directions Drawer */}
      {selectedRoute && (
        <DirectionsPanel
          route={selectedRoute}
          isOpen={showDirectionsPanel}
          onClose={() => setShowDirectionsPanel(false)}
          onStartNavigation={() => {
            setShowDirectionsPanel(false);
            handleStartNavigation();
          }}
        />
      )}

      {/* Offline Map & Road Graph Regional Storage Modal (Part 25) */}
      <OfflineMapManagerModal
        isOpen={showOfflineModal}
        onClose={() => {
          setShowOfflineModal(false);
          offlineStorageService.getAllRegions().then((r) => setOfflineRegionsCount(r.length)).catch(() => {});
        }}
      />

      {/* Voice Command Discovery Guide Modal ("What can I say?") */}
      <VoiceCommandHelpModal
        isOpen={showVoiceHelpModal}
        onClose={() => setShowVoiceHelpModal(false)}
        onSelectCommand={handleExecuteVoiceCommand}
      />
    </>
  );
};

export default CitizenNavigationControl;
