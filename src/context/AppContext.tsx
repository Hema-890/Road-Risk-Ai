import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  PortalType,
  VehicleProfile,
  MissionSetupData,
  MissionStatus,
  RouteOption,
  HazardAlert,
  GreenCorridorStatus,
  GreenCorridorSignal,
  NavigationTelemetry,
  DebriefReport,
  RiskLevel,
  ManualHazardReport,
  NearMissEvent,
  UserLocationState,
  NavigationPhase,
  NavigationManeuver,
} from '../types';
import { locationService } from '../services/locationService';
import { VEHICLE_PROFILES } from '../data/vehicleProfiles';
import {
  MOCK_ROUTES,
  GREEN_CORRIDOR_SIGNALS,
  INITIAL_HAZARDS,
  DEFAULT_ORIGIN,
  DEFAULT_DESTINATION,
  DISPATCH_ORIGINS,
  DISPATCH_DESTINATIONS,
  CITY_PRESETS,
  DEFAULT_CITY,
} from '../data/mockScenarios';
import { AUTHORITY_HOTSPOTS } from '../data/authorityData';
import { evaluateRoutesForMission, evaluateDynamicReroute, RerouteRecommendation } from '../engines/routingEngine';
import { interpolatePositionAlongPolyline, calculateDistanceMeters } from '../utils/geoUtils';
import { speechService } from '../services/speechService';
import { audioSynth } from '../services/audioSynth';
import { fetchOsrmRoutes } from '../services/osrmService';
import { routingService, type RoutingProfile } from '../services/routingService';
import { dataService } from '../services/dataService';
import { realtimeService } from '../services/realtimeService';
import { calculateDistanceKm } from '../services/geocodingService';
import { PlaceService, NormalizedPlace, PlaceType } from '../services/placeService';
import { eventBus } from '../services/eventBus';
import { voiceAlertService } from '../services/voiceAlertService';
import navigationVoiceService from '../services/navigationVoiceService';

export type CameraMode = 'free' | 'birds_eye' | 'cockpit';

interface AppContextType {
  // Navigation & View
  activePortal: PortalType;
  setActivePortal: (p: PortalType) => void;
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  mapFocusCoords: [number, number] | null;
  mapFocusZoom: number;
  flyToLocation: (coords: [number, number], zoom?: number) => void;

  // Real-World City & Regional Presets
  currentCityId: string;
  changeCityPreset: (cityId: string) => void;

  // Map Engine & Style Preferences
  mapEnginePreference: 'auto' | 'webgl' | 'leaflet_2d';
  setMapEnginePreference: (pref: 'auto' | 'webgl' | 'leaflet_2d') => void;
  mapTileStyle: 'tactical_dark' | 'osm_standard' | 'positron_light';
  setMapTileStyle: (style: 'tactical_dark' | 'osm_standard' | 'positron_light') => void;

  // Sound
  isAudioMuted: boolean;
  toggleAudioMute: () => void;

  // Vehicles & Fleet
  vehicles: VehicleProfile[];
  selectedVehicle: VehicleProfile;
  setSelectedVehicleId: (id: string) => void;

  // Travel Mode (Car, Motorcycle, Bicycle, Walk, Transit) & Authoritative Timing
  travelMode: RoutingProfile;
  setTravelMode: (mode: RoutingProfile) => void;
  routeErrorNotice: string | null;
  clearRouteError: () => void;
  departureTime: Date;
  setRequestedDepartureTime: (time: Date | 'now') => void;
  routesByMode: Partial<Record<RoutingProfile, RouteOption[]>>;

  // Mission
  currentMission: MissionSetupData;
  updateMissionSetup: (updates: Partial<MissionSetupData>) => void;
  setMissionOrigin: (locId: string) => void;
  setMissionDestination: (locId: string) => void;
  startRouteSelection: () => void;
  startNavigationMission: () => void;
  completeMission: () => void;
  resetToMissionSetup: () => void;

  // Routes
  routes: RouteOption[];
  selectedRoute: RouteOption | null;
  setSelectedRouteId: (id: string | null) => void;
  clearDestination: () => void;
  setDestinationLocation: (name: string, coords: [number, number], mode?: RoutingProfile, explicitDepTime?: Date) => Promise<void>;
  setOriginLocation: (name: string, coords: [number, number]) => Promise<void>;
  clearOrigin: () => void;
  stopHackathonDemo: () => void;
  activeHazards: HazardAlert[];
  triggerHazardInjection: (hazardType?: 'BRAKING_CLUSTER' | 'FLOOD_RISK' | 'ROAD_BLOCKAGE') => void;
  clearHazards: () => void;

  // Dynamic Rerouting
  rerouteRecommendation: RerouteRecommendation | null;
  acceptReroute: () => void;
  dismissReroute: () => void;

  // Green Corridor
  greenCorridor: GreenCorridorStatus;
  toggleGreenCorridorSignal: (signalId: string) => void;

  // Live Navigation Telemetry
  telemetry: NavigationTelemetry;

  // Simulation Controls
  isSimulationPlaying: boolean;
  setIsSimulationPlaying: (play: boolean) => void;
  simulationSpeed: number;
  setSimulationSpeed: (speed: number) => void;
  stepSimulation: (stepFraction?: number) => void;
  weatherState: 'clear' | 'monsoon_rain';
  setWeatherState: (w: 'clear' | 'monsoon_rain') => void;
  loadDemoScenario: (scenarioNumber: 1 | 2 | 3 | 4 | 5) => void;

  // Debrief & Exporting
  debriefReport: DebriefReport | null;
  closeDebrief: () => void;
  exportDebriefReport: () => void;
  exportAuthorityAuditReport: () => void;
  missionLogs: { timestamp: string; message: string; type: 'info' | 'alert' | 'route' | 'green' }[];

  // Manual Hazard Reporting
  manualHazardReports: ManualHazardReport[];
  addManualHazardReport: (report: ManualHazardReport) => void;

  // Near-Miss Simulation Events
  nearMissEvents: NearMissEvent[];
  generateSimulatedEvent: (type: NearMissEvent['eventType'] | 'FLOOD' | 'BLOCKAGE' | 'TRAFFIC' | 'ACCIDENT', count?: number, severity?: NearMissEvent['severity']) => void;
  clearAllSimulatedEvents: () => void;

  // Routing Preference Slider (0 = Fastest, 50 = Balanced, 100 = Safest)
  routingPreference: number;
  setRoutingPreference: (val: number) => void;

  // Real OSRM Calculation
  isCalculatingRoute: boolean;
  calculateRouteWithOsrm: () => Promise<void>;
  whyThisRouteExplanation: string;

  // 1-Click Hackathon Demo
  runHackathonDemoScenario: () => void;
  isDemoRunning: boolean;

  // Explainable Road-Risk Engine Configurable Weights
  riskWeights: Record<string, number>;
  updateRiskWeight: (key: string, val: number) => void;

  // Real Browser/Device User Location
  userLocation: UserLocationState;
  requestUserLocation: () => Promise<[number, number] | null>;
  isWatchingLocation: boolean;
  toggleWatchLocation: () => void;

  // Citizen Navigation State Machine
  navigationPhase: NavigationPhase;
  setNavigationPhase: (phase: NavigationPhase) => void;
  startCitizenNavigation: (routeId?: string) => void;
  stopCitizenNavigation: () => void;
  navigationManeuver: NavigationManeuver | null;

  // Google-Maps-Style Place & City Exploration
  selectedPlace: NormalizedPlace | null;
  setSelectedPlace: (place: NormalizedPlace | null) => void;
  openPlaceDetails: (coords: [number, number], name?: string, type?: PlaceType) => Promise<void>;
  closePlacePanel: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Global View State (Default to Modern Citizen Navigation)
  const [activePortal, setActivePortal] = useState<PortalType>('navigation');
  const [cameraMode, setCameraMode] = useState<CameraMode>('cockpit');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [mapFocusCoords, setMapFocusCoords] = useState<[number, number] | null>(null);
  const [mapFocusZoom, setMapFocusZoom] = useState<number>(14.5);

  // Real Device User Location
  const [userLocation, setUserLocation] = useState<UserLocationState>({
    coordinates: null,
    accuracyMeters: null,
    heading: null,
    speedKmh: null,
    status: 'idle',
  });
  const [isWatchingLocation, setIsWatchingLocation] = useState<boolean>(false);
  const locationWatchUnsubRef = useRef<(() => void) | null>(null);
  const lastRerouteTimeRef = useRef<number>(0);
  const offRouteCounterRef = useRef<number>(0);

  // Citizen Navigation Phase & Maneuver State
  const [navigationPhase, setNavigationPhase] = useState<NavigationPhase>('IDLE');
  const [navigationManeuver, setNavigationManeuver] = useState<NavigationManeuver | null>(null);

  // Google-Maps-Style Place & City Exploration State
  const [selectedPlace, setSelectedPlace] = useState<NormalizedPlace | null>(null);

  // Real-World City Presets & Map Engine Preferences
  const [currentCityId, setCurrentCityId] = useState<string>('vijayawada');
  const [mapEnginePreference, setMapEnginePreference] = useState<'auto' | 'webgl' | 'leaflet_2d'>('auto');
  const [mapTileStyle, setMapTileStyle] = useState<'tactical_dark' | 'osm_standard' | 'positron_light'>('osm_standard');

  // Vehicles State
  const [vehicles, setVehicles] = useState<VehicleProfile[]>(VEHICLE_PROFILES);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(VEHICLE_PROFILES[0].id);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  // Hazards State — Starts completely clean on fresh load (Real event-driven only)
  const [activeHazards, setActiveHazards] = useState<HazardAlert[]>([]);

  // Routes State - Starts completely empty (Clean Normal Map First)
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const selectedRoute: RouteOption | null = routes.find((r) => r.id === selectedRouteId) || null;

  // Mission State - Starts with NO selected destination or active route
  const [currentMission, setCurrentMission] = useState<MissionSetupData>({
    id: 'MSN-2026-0914',
    vehicleId: selectedVehicle.id,
    emergencyType: 'Critical Cardiac Emergency',
    urgency: 'CRITICAL',
    origin: 'Current Location',
    originCoords: DEFAULT_ORIGIN,
    destination: '',
    destinationCoords: null,
    notes: 'Priority 1 Patient — Standby for emergency dispatch.',
    patientVitals: 'Standby',
    status: 'SETUP',
    initialEtaMinutes: 0,
    timeSavedMinutes: 0,
    hazardsEncountered: 0,
    rerouteCount: 0,
    greenCorridorPasses: 0,
    maxRiskIndex: 0,
    averageRiskIndex: 0,
  });

  // Dynamic Rerouting state
  const [rerouteRecommendation, setRerouteRecommendation] = useState<RerouteRecommendation | null>(null);

  // Green Corridor State
  const [greenCorridor, setGreenCorridor] = useState<GreenCorridorStatus>({
    active: false,
    totalSignals: GREEN_CORRIDOR_SIGNALS.length,
    greenLockedSignals: 0,
    timeSavedSeconds: 0,
    signals: GREEN_CORRIDOR_SIGNALS,
  });

  // Telemetry State - Standby at origin with 0 remaining distance/ETA
  const [telemetry, setTelemetry] = useState<NavigationTelemetry>({
    currentCoordinates: DEFAULT_ORIGIN,
    speedKmh: 0,
    headingDegrees: 45,
    distanceRemainingKm: 0,
    etaRemainingMinutes: 0,
    progressFraction: 0.0,
    currentSegmentIndex: 0,
    currentSegmentRisk: 0,
    nextManeuver: {
      type: 'straight',
      instruction: 'Standby at Origin Hub — Search destination to route',
      distanceToMeters: 0,
    },
  });

  // Simulation Controls
  const [isSimulationPlaying, setIsSimulationPlaying] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1.5);
  const [weatherState, setWeatherState] = useState<'clear' | 'monsoon_rain'>('clear');

  // Debrief Report
  const [debriefReport, setDebriefReport] = useState<DebriefReport | null>(null);

  // Mission Activity Logs
  const [missionLogs, setMissionLogs] = useState<{ timestamp: string; message: string; type: 'info' | 'alert' | 'route' | 'green' }[]>([
    { timestamp: '19:42:10', message: 'RoadRisk AI initialized. Multi-agency telemetry calibrated.', type: 'info' },
  ]);

  // Manual Hazard Reports
  const [manualHazardReports, setManualHazardReports] = useState<ManualHazardReport[]>([]);

  // Near-Miss Simulation Events
  const [nearMissEvents, setNearMissEvents] = useState<NearMissEvent[]>([]);

  // Routing Preference Slider (0 = Fastest, 50 = Balanced, 100 = Safest)
  const [routingPreference, setRoutingPreference] = useState<number>(50);

  // Travel Mode, Authoritative Timing & Isolated Mode Route Cache
  const [travelMode, setTravelModeState] = useState<RoutingProfile>('CAR');
  const [departureTime, setDepartureTimeState] = useState<Date>(new Date());
  const [routesByMode, setRoutesByMode] = useState<Partial<Record<RoutingProfile, RouteOption[]>>>({});
  const routeRequestIdRef = useRef<number>(0);
  const [routeErrorNotice, setRouteErrorNotice] = useState<string | null>(null);
  const clearRouteError = useCallback(() => setRouteErrorNotice(null), []);

  // OSRM Calculation state & "Why this route?"
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const [whyThisRouteExplanation, setWhyThisRouteExplanation] = useState<string>('');

  // Hackathon Demo State
  const [isDemoRunning, setIsDemoRunning] = useState<boolean>(false);

  // Explainable Road-Risk Engine Configurable Weights
  const [riskWeights, setRiskWeights] = useState<Record<string, number>>({
    hardBraking: 35,
    suddenSwerving: 25,
    abnormalSlowdown: 20,
    trafficCongestion: 20,
    accidentReports: 40,
    floodingDepth: 45,
    roadBlockage: 50,
    historicalRisk: 15,
  });

  const updateRiskWeight = useCallback((key: string, val: number) => {
    setRiskWeights((prev) => ({ ...prev, [key]: val }));
  }, []);

  // Animation Frame Ref
  const animFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(Date.now());
  const progressRef = useRef<number>(0);
  const hasSpokenRerouteRef = useRef<boolean>(false);
  const hasSpokenGreenLockRef = useRef<boolean>(false);

  const addLog = useCallback((message: string, type: 'info' | 'alert' | 'route' | 'green' = 'info') => {
    const time = new Date().toTimeString().split(' ')[0];
    setMissionLogs((prev) => [{ timestamp: time, message, type }, ...prev.slice(0, 35)]);
  }, []);

  // Fly camera to specific location on map
  const flyToLocation = useCallback((coords: [number, number], zoom = 15.5) => {
    setMapFocusCoords([...coords]);
    setMapFocusZoom(zoom);
  }, []);

  // Sync Audio Mute
  const toggleAudioMute = useCallback(() => {
    setIsAudioMuted((prev) => {
      const next = !prev;
      audioSynth.setMuted(next);
      speechService.setMuted(next);
      return next;
    });
  }, []);

  // Update Mission Setup
  const updateMissionSetup = useCallback((updates: Partial<MissionSetupData>) => {
    setCurrentMission((prev) => ({ ...prev, ...updates }));
  }, []);

  // Select Origin Dispatch Location
  // Change City Preset handler
  const changeCityPreset = useCallback((cityId: string) => {
    const preset = CITY_PRESETS[cityId] || CITY_PRESETS.hyderabad;
    setCurrentCityId(preset.id);

    // Update routes and selected route ONLY IF routes were already active
    if (routes.length > 0) {
      setRoutes(preset.routes);
      if (preset.routes.length > 0) {
        const rec = preset.routes.find((r) => r.isRecommended) || preset.routes[0];
        setSelectedRouteId(rec.id);
      }
    }

    // Update hazards & signals
    setActiveHazards(preset.hazards);
    setGreenCorridor({
      active: false,
      totalSignals: preset.signals.length,
      greenLockedSignals: 0,
      timeSavedSeconds: 0,
      signals: preset.signals,
    });

    // Update mission origin
    if (preset.origins.length > 0) {
      const originLoc = preset.origins[0];
      setCurrentMission((prev) => ({
        ...prev,
        origin: originLoc.name,
        originCoords: originLoc.coords,
      }));

      setTelemetry((prev) => ({
        ...prev,
        currentCoordinates: originLoc.coords,
      }));
    }

    // Fly camera smoothly to city center
    flyToLocation(preset.center, preset.defaultZoom);

    addLog(`Theater switched to ${preset.name}, ${preset.stateCountry}. Real geographic coordinates loaded.`, 'info');
    speechService.speak(`Geographic theater transferred to ${preset.name}. Real world road telemetry active.`);
  }, [routes.length, flyToLocation, addLog]);

  // Select Dispatch Origin Depot
  const setMissionOrigin = useCallback((locId: string) => {
    const city = CITY_PRESETS[currentCityId] || DEFAULT_CITY;
    const loc = city.origins.find((l) => l.id === locId) || DISPATCH_ORIGINS.find((l) => l.id === locId);
    if (!loc) return;

    setCurrentMission((prev) => ({
      ...prev,
      origin: loc.name,
      originCoords: loc.coords,
    }));

    if (routes.length > 0) {
      setRoutes((prev) =>
        prev.map((r) => {
          const coords = [...r.fullCoordinates];
          coords[0] = loc.coords;
          return { ...r, fullCoordinates: coords };
        })
      );
    }

    setTelemetry((prev) => ({
      ...prev,
      currentCoordinates: loc.coords,
    }));

    flyToLocation(loc.coords, 14.5);
    addLog(`Origin updated to ${loc.name}`, 'info');
  }, [currentCityId, routes.length, flyToLocation, addLog]);

  // Select Destination Hospital Facility (Emergency Hub)
  const setMissionDestination = useCallback((locId: string) => {
    const city = CITY_PRESETS[currentCityId] || DEFAULT_CITY;
    const loc = city.destinations.find((l) => l.id === locId) || DISPATCH_DESTINATIONS.find((l) => l.id === locId);
    if (!loc) return;

    setCurrentMission((prev) => ({
      ...prev,
      destination: loc.name,
      destinationCoords: loc.coords,
      status: 'ROUTE_SELECTION',
    }));

    // Update last point of all routes and evaluate
    const updatedRoutes = city.routes.map((r) => {
      const coords = [...r.fullCoordinates];
      coords[coords.length - 1] = loc.coords;
      return { ...r, fullCoordinates: coords };
    });

    const evaluated = evaluateRoutesForMission(
      updatedRoutes,
      selectedVehicle,
      currentMission.urgency,
      activeHazards,
      routingPreference
    );

    setRoutes(evaluated.evaluatedRoutes);
    setSelectedRouteId(evaluated.recommendedRouteId);
    setWhyThisRouteExplanation(evaluated.comparisonExplanation);

    const recRoute = evaluated.evaluatedRoutes.find((r) => r.id === evaluated.recommendedRouteId) || evaluated.evaluatedRoutes[0];
    if (recRoute) {
      setTelemetry((prev) => ({
        ...prev,
        distanceRemainingKm: recRoute.distanceKm,
        etaRemainingMinutes: recRoute.adjustedEtaMinutes,
        currentSegmentRisk: recRoute.segments[0]?.riskScore || recRoute.riskScore,
      }));
    }

    flyToLocation(loc.coords, 14.5);
    addLog(`Destination trauma facility set to ${loc.name}`, 'info');
    speechService.speak(`Emergency corridor configured for ${loc.name.split(',')[0]}.`);
  }, [currentCityId, selectedVehicle, currentMission.urgency, activeHazards, routingPreference, flyToLocation, addLog]);

  // Set Arbitrary Destination Location (from real geocoder or search) and compute route
  const setDestinationLocation = useCallback(
    async (name: string, coords: [number, number], mode?: RoutingProfile, explicitDepTime?: Date) => {
      const activeMode = mode || travelMode;
      const activeDepTime = explicitDepTime || departureTime;
      const thisRequestId = ++routeRequestIdRef.current;

      setCurrentMission((prev) => ({
        ...prev,
        destination: name,
        destinationCoords: coords,
        status: 'ROUTE_SELECTION',
      }));

      flyToLocation(coords, 14.5);
      addLog(`Destination selected: ${name}. Calculating ${activeMode} route...`, 'info');
      speechService.speak(`Destination set to ${name.split(',')[0]}. Calculating road risk corridor.`);

      setIsCalculatingRoute(true);
      setRouteErrorNotice(null);

      if (activeMode === 'TRANSIT') {
        setIsCalculatingRoute(false);
        setRoutes([]);
        setSelectedRouteId(null);
        setRouteErrorNotice('TRANSIT DATA UNAVAILABLE: Municipal transit agency has not published a public GTFS or GTFS-Realtime feed for this corridor.');
        addLog('Transit mode selected: No verified GTFS feed published for this corridor.', 'alert');
        return;
      }

      try {
        const originCoords = userLocation.coordinates || currentMission.originCoords;
        const response = await fetchOsrmRoutes(
          originCoords,
          coords,
          nearMissEvents,
          activeHazards,
          selectedVehicle.id,
          activeMode,
          activeDepTime
        );

        // Race condition protection: Discard obsolete response if a later request was fired
        if (thisRequestId !== routeRequestIdRef.current) {
          return;
        }

        if (!response.routes || response.routes.length === 0) {
          throw new Error('No navigable roadway geometry returned for this travel mode.');
        }

        const evaluated = evaluateRoutesForMission(
          response.routes,
          selectedVehicle,
          currentMission.urgency,
          activeHazards,
          routingPreference
        );

        setRoutes(evaluated.evaluatedRoutes);
        setRoutesByMode((prev) => ({
          ...prev,
          [activeMode]: evaluated.evaluatedRoutes,
        }));
        setSelectedRouteId(evaluated.recommendedRouteId);
        setWhyThisRouteExplanation(evaluated.comparisonExplanation);
        setNavigationPhase('ROUTE_SELECTED');

        const recRoute = evaluated.evaluatedRoutes.find((r) => r.id === evaluated.recommendedRouteId) || evaluated.evaluatedRoutes[0];
        if (recRoute) {
          setTelemetry((prev) => ({
            ...prev,
            distanceRemainingKm: recRoute.distanceKm,
            etaRemainingMinutes: recRoute.adjustedEtaMinutes,
            currentSegmentRisk: recRoute.segments[0]?.riskScore || recRoute.riskScore,
          }));
        }

        addLog(`Real route generated via ${response.source}: ${response.note}`, 'route');
      } catch (err: any) {
        if (thisRequestId !== routeRequestIdRef.current) return;
        console.warn('Route query failed:', err);
        setRoutes([]);
        setSelectedRouteId(null);
        const errMsg = err.message || 'ROUTE UNAVAILABLE: Routing engines could not find a navigable road connection.';
        setRouteErrorNotice(errMsg);
        addLog(`Route calculation failed: ${errMsg}`, 'alert');
      } finally {
        if (thisRequestId === routeRequestIdRef.current) {
          setIsCalculatingRoute(false);
        }
      }
    },
    [
      travelMode,
      departureTime,
      userLocation.coordinates,
      currentMission.originCoords,
      nearMissEvents,
      activeHazards,
      selectedVehicle,
      currentMission.urgency,
      routingPreference,
      flyToLocation,
      addLog,
    ]
  );

  // Authoritative Departure Time Control
  const setRequestedDepartureTime = useCallback(
    (time: Date | 'now') => {
      const newDate = time === 'now' ? new Date() : time;
      setDepartureTimeState(newDate);
      addLog(`Departure time set to: ${time === 'now' ? 'Depart now' : newDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, 'info');
      
      // Clear mode cache to recompute timing across modes
      setRoutesByMode({});
      if (currentMission.destinationCoords && currentMission.destination) {
        setDestinationLocation(currentMission.destination, currentMission.destinationCoords, travelMode, newDate);
      }
    },
    [currentMission.destination, currentMission.destinationCoords, travelMode, setDestinationLocation, addLog]
  );

  // Travel Mode Selector with Independent Mode Isolation & Cache Activation
  const setTravelMode = useCallback(
    (mode: RoutingProfile) => {
      setTravelModeState(mode);
      setRouteErrorNotice(null);

      if (mode === 'TRANSIT') {
        setRoutes([]);
        setSelectedRouteId(null);
        setRouteErrorNotice('TRANSIT DATA UNAVAILABLE: Municipal transit agency has not published a public GTFS or GTFS-Realtime feed for this corridor.');
        addLog('Transit mode selected: No verified GTFS feed published for this corridor.', 'alert');
        return;
      }

      // If mode was already computed for current destination, activate it instantly without network delay
      if (routesByMode[mode] && routesByMode[mode]!.length > 0) {
        const cached = routesByMode[mode]!;
        setRoutes(cached);
        setSelectedRouteId(cached[0]?.id || null);
        setNavigationPhase('ROUTE_SELECTED');
        setTelemetry((prev) => ({
          ...prev,
          distanceRemainingKm: cached[0]?.distanceKm || 0,
          etaRemainingMinutes: cached[0]?.adjustedEtaMinutes || 0,
          currentSegmentRisk: cached[0]?.segments[0]?.riskScore || cached[0]?.riskScore || 0,
        }));
        addLog(`Switched to cached ${mode} route (${cached[0]?.distanceKm} km, ${cached[0]?.adjustedEtaMinutes} min)`, 'route');
        return;
      }

      if (currentMission.destinationCoords && currentMission.destination) {
        setDestinationLocation(currentMission.destination, currentMission.destinationCoords, mode);
      }
    },
    [currentMission.destination, currentMission.destinationCoords, routesByMode, setDestinationLocation, addLog]
  );

  // Set Arbitrary Source Location (Part 2: Custom Source field)
  const setOriginLocation = useCallback(
    async (name: string, coords: [number, number]) => {
      setCurrentMission((prev) => ({
        ...prev,
        origin: name,
        originCoords: coords,
      }));
      setTelemetry((prev) => ({
        ...prev,
        currentCoordinates: coords,
      }));
      addLog(`Source updated to: ${name}`, 'info');

      // If destination is already selected, recalculate route immediately
      if (currentMission.destinationCoords) {
        setIsCalculatingRoute(true);
        try {
          const response = await fetchOsrmRoutes(
            coords,
            currentMission.destinationCoords,
            nearMissEvents,
            activeHazards,
            selectedVehicle.id
          );
          const evaluated = evaluateRoutesForMission(
            response.routes,
            selectedVehicle,
            currentMission.urgency,
            activeHazards,
            routingPreference
          );
          setRoutes(evaluated.evaluatedRoutes);
          setSelectedRouteId(evaluated.recommendedRouteId);
          setWhyThisRouteExplanation(evaluated.comparisonExplanation);
          setNavigationPhase('ROUTE_SELECTED');
        } catch (err) {
          console.warn('Failed to calculate route with new origin:', err);
        } finally {
          setIsCalculatingRoute(false);
        }
      }
    },
    [
      currentMission.destinationCoords,
      nearMissEvents,
      activeHazards,
      selectedVehicle,
      currentMission.urgency,
      routingPreference,
      addLog,
    ]
  );

  // Reset Source to Current GPS Location
  const clearOrigin = useCallback(() => {
    const coords = userLocation.coordinates || DEFAULT_ORIGIN;
    setCurrentMission((prev) => ({
      ...prev,
      origin: 'Current Location',
      originCoords: coords,
    }));
    setTelemetry((prev) => ({
      ...prev,
      currentCoordinates: coords,
    }));
    addLog('Source reset to Current GPS Location', 'info');
  }, [userLocation.coordinates, addLog]);

  // Clear Destination and Return to Clean Normal Map Mode
  const clearDestination = useCallback(() => {
    setCurrentMission((prev) => ({
      ...prev,
      destination: '',
      destinationCoords: null,
      status: 'SETUP',
      selectedRouteId: undefined,
    }));
    setRoutes([]);
    setRoutesByMode({});
    setSelectedRouteId(null);
    setRerouteRecommendation(null);
    setIsSimulationPlaying(false);
    setWhyThisRouteExplanation('');
    setNavigationPhase('IDLE');
    setNavigationManeuver(null);
    setTelemetry((prev) => ({
      ...prev,
      distanceRemainingKm: 0,
      etaRemainingMinutes: 0,
      progressFraction: 0,
      currentSegmentIndex: 0,
      currentSegmentRisk: 0,
      nextManeuver: {
        type: 'straight',
        instruction: 'Standby at Origin Hub — Search destination to route',
        distanceToMeters: 0,
      },
    }));
    addLog('Destination and routes cleared. Map returned to normal mode.', 'info');
    speechService.speak('Route cleared. Returning to normal map view.');
  }, [addLog]);

  // Request browser/device GPS location
  const requestUserLocation = useCallback(async (): Promise<[number, number] | null> => {
    setUserLocation((prev) => ({ ...prev, status: 'prompting', error: undefined }));
    try {
      let packet = locationService.getCurrentPacket();
      if (!packet) {
        const coords = await locationService.getCurrentLocation();
        if (coords) {
          packet = locationService.getCurrentPacket() || {
            coordinates: coords,
            accuracyMeters: 10,
            heading: null,
            speedKmh: null,
            timestamp: Date.now(),
            state: 'LIVE',
            statusMessage: 'Live Location',
          };
        }
      }

      if (packet) {
        setUserLocation({
          coordinates: packet.coordinates,
          accuracyMeters: packet.accuracyMeters,
          heading: packet.heading,
          speedKmh: packet.speedKmh,
          status: 'granted',
        });
        // Center map view on user's real GPS position
        flyToLocation(packet.coordinates, 15.5);
        addLog(`Real GPS coordinates acquired: [${packet.coordinates[0].toFixed(4)}, ${packet.coordinates[1].toFixed(4)}]`, 'info');
        speechService.speak('Current location acquired.');
        return packet.coordinates;
      }
      return null;
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to acquire device location.';
      setUserLocation((prev) => ({
        ...prev,
        status: 'denied',
        error: errMsg,
      }));
      addLog(`Location error: ${errMsg}`, 'alert');
      return null;
    }
  }, [flyToLocation, addLog]);

  // Central Real-Time EventBus Subscriptions (Incidents, Weather, Floods, Siren Radar, Hazards)
  useEffect(() => {
    // 1. Live incidents from TomTom / municipal feed
    const unsubIncident = eventBus.subscribe('INCIDENT_CREATED', (payload) => {
      const inc = payload.data;
      if (!inc) return;
      setActiveHazards((prev) => {
        if (prev.some((h) => h.id === inc.id)) return prev;
        const newHazard: HazardAlert = {
          id: inc.id || `inc_${Date.now()}`,
          type: inc.type === 'ROAD_CLOSED' ? 'ROAD_BLOCKAGE' : 'ACCIDENT_AHEAD',
          title: inc.title || inc.description || 'Live Incident Reported',
          severity: inc.severity === 'critical' ? 'critical' : inc.severity === 'moderate' ? 'warning' : 'high',
          locationName: inc.road_name || inc.locationName || 'Monitored Corridor',
          coordinates: inc.geometry?.coordinates || [inc.longitude || 0, inc.latitude || 0],
          riskImpactPoints: inc.severity === 'critical' ? 35 : 18,
          detectedAt: 'Live',
          description: inc.description || 'Active road incident verified by live traffic telemetry.',
          affectedRouteIds: [],
          recommendedAction: 'Reduce speed and monitor detour indicators.',
          active: true,
        };
        return [newHazard, ...prev];
      });
    });

    // 2. Numerical weather updates from Open-Meteo
    const unsubWeather = eventBus.subscribe('WEATHER_UPDATED', (payload) => {
      const weather = payload.data;
      if (weather) {
        if (weather.precipitationMm > 4 || weather.isAdverse) {
          setWeatherState('monsoon_rain');
        } else {
          setWeatherState('clear');
        }
      }
    });

    // 3. Hydrological flood alerts from Open-Meteo GloFAS / citizen reports
    const unsubFlood = eventBus.subscribe('FLOOD_UPDATED', (payload) => {
      const alerts = payload.data;
      if (Array.isArray(alerts) && alerts.length > 0) {
        setActiveHazards((prev) => {
          const merged = [...prev];
          for (const alert of alerts) {
            if (!merged.some((h) => h.id === alert.id)) {
              merged.unshift(alert);
            }
          }
          return merged;
        });
      }
    });

    // 4. Siren approach radar / authorized emergency fleet
    const unsubEmergency = eventBus.subscribe('EMERGENCY_VEHICLE_APPROACHING', (payload) => {
      const alert = payload.data;
      if (alert) {
        addLog(`🚨 EMERGENCY VEHICLE RADAR: ${alert.callsign || 'Emergency Vehicle'} approaching (${alert.relativeDirection || 'BEHIND'}) at ${alert.distanceMeters || 300}m!`, 'alert');
        voiceAlertService.dispatchVoiceAlert({
          templateKey: alert.relativeDirection === 'INTERSECTION' ? 'AMBULANCE_APPROACHING_INTERSECTION' : 'AMBULANCE_APPROACHING_BEHIND',
          params: { distanceMeters: alert.distanceMeters },
          priority: 0,
        });
      }
    });

    // 5. Citizen hazard reports
    const unsubHazard = eventBus.subscribe('HAZARD_REPORTED', (payload) => {
      const hazard = payload.data;
      if (hazard) {
        setActiveHazards((prev) => {
          if (prev.some((h) => h.id === hazard.id)) return prev;
          return [hazard, ...prev];
        });
        addLog(`Citizen hazard reported: ${hazard.title || hazard.category} at ${hazard.locationName || 'corridor'}`, 'alert');
      }
    });

    return () => {
      unsubIncident();
      unsubWeather();
      unsubFlood();
      unsubEmergency();
      unsubHazard();
    };
  }, [addLog]);

  // First-Open Experience: Automatic live-location startup
  useEffect(() => {
    let initialCentered = false;
    const unsub = locationService.autoStartTracking(
      (packet) => {
        setUserLocation({
          coordinates: packet.coordinates,
          accuracyMeters: packet.accuracyMeters,
          heading: packet.heading,
          speedKmh: packet.speedKmh,
          status: packet.state === 'LOW_ACCURACY' ? 'low_accuracy' : 'granted',
          address: packet.address,
          lastUpdated: packet.timestamp,
        });
        setIsWatchingLocation(true);
        if (!initialCentered) {
          initialCentered = true;
          flyToLocation(packet.coordinates, 15.5);
          addLog(
            `Auto-acquired live GPS location: [${packet.coordinates[0].toFixed(4)}, ${packet.coordinates[1].toFixed(4)}]${
              packet.address ? ` (${packet.address})` : ''
            } (±${packet.accuracyMeters}m)`,
            'info'
          );
        }

        // Navigation Progress, Turn Maneuver Tracking & Dynamic Reroute (Requirements 20, 21, 22, 25, 26)
        if (currentMission.destinationCoords && navigationPhase === 'NAVIGATING' && selectedRoute) {
          const distToDest = calculateDistanceMeters(packet.coordinates, currentMission.destinationCoords);

          // Arrival detection threshold (<30m)
          if (distToDest <= 30) {
            setNavigationPhase('ARRIVED');
            voiceAlertService.dispatchVoiceAlert({
              templateKey: 'ARRIVAL',
              params: { roadName: currentMission.destination },
              priority: 2,
            });
            addLog('Arrived at destination.', 'info');
            return;
          }

          // Calculate precise route progress using route geometry snapping
          const progress = routingService.calculateRouteProgress(packet.coordinates, selectedRoute);

          if (progress.nextManeuver) {
            setNavigationManeuver(progress.nextManeuver);
            // Voice announcement for upcoming turn
            if (progress.nextManeuver.distanceMeters && progress.nextManeuver.distanceMeters <= 200) {
              const maneuverType = progress.nextManeuver.type?.toLowerCase() || '';
              const templateKey = maneuverType.includes('left') ? 'TURN_LEFT'
                : maneuverType.includes('right') ? 'TURN_RIGHT'
                : maneuverType.includes('roundabout') ? 'ROUNDABOUT'
                : 'CONTINUE';
              voiceAlertService.dispatchVoiceAlert({
                templateKey,
                params: {
                  distanceMeters: progress.nextManeuver.distanceMeters,
                  roadName: progress.nextManeuver.instruction,
                },
                priority: 2,
              });
            }
          }

          // Update telemetry without thrashing complete route
          setTelemetry((prev) => ({
            ...prev,
            currentCoordinates: packet.coordinates,
            speedKmh: packet.speedKmh != null ? packet.speedKmh : prev.speedKmh,
            distanceRemainingKm: parseFloat((progress.distanceRemainingMeters / 1000).toFixed(2)),
            etaRemainingMinutes: Math.max(
              1,
              Math.round(
                (progress.distanceRemainingMeters /
                  Math.max(12, ((packet.speedKmh || 35) * 1000) / 3600)) /
                  60
              )
            ),
            progressFraction: progress.progressPercentage / 100,
          }));

          // Off-route detection and dynamic reroute with 60s cooldown
          if (progress.isOffRoute) {
            offRouteCounterRef.current += 1;
            const now = Date.now();
            if (offRouteCounterRef.current >= 2 && now - lastRerouteTimeRef.current >= 30000) {
              lastRerouteTimeRef.current = now;
              offRouteCounterRef.current = 0;
              addLog(
                `Route deviation detected (${progress.deviationMeters}m off corridor). Recalculating ${travelMode} route...`,
                'alert'
              );
              speechService.speak('Rerouting. Recalculating optimal path from current location.');

              routingService
                .calculateRoutes(packet.coordinates, currentMission.destinationCoords, {
                  profile: travelMode,
                  vehicleId: selectedVehicle.id,
                  activeEvents: nearMissEvents,
                  activeHazards,
                })
                .then((rerouteRes) => {
                  if (rerouteRes.routes.length > 0) {
                    setRoutes(rerouteRes.routes);
                    setSelectedRouteId(rerouteRes.routes[0].id);
                    setRoutesByMode((prev) => ({
                      ...prev,
                      [travelMode]: rerouteRes.routes,
                    }));
                    addLog(`Dynamic reroute recalculated successfully for ${travelMode}.`, 'route');
                  }
                })
                .catch((err) => {
                  console.warn('Dynamic reroute calculation failed:', err);
                });
            }
          } else {
            offRouteCounterRef.current = 0;
          }
        }
      },
      (state, msg) => {
        if (state === 'PERMISSION_DENIED') {
          setUserLocation((prev) => ({ ...prev, status: 'denied', error: msg, gpsSignalState: state }));
        } else if (state === 'UNAVAILABLE') {
          setUserLocation((prev) => ({ ...prev, status: 'unavailable', error: msg, gpsSignalState: state }));
        } else if (state === 'INITIALIZING' || state === 'LOCATING') {
          setUserLocation((prev) => ({ ...prev, status: 'prompting', gpsSignalState: state }));
        } else if (state === 'LOW_ACCURACY') {
          setUserLocation((prev) => ({ ...prev, status: 'low_accuracy', gpsSignalState: state }));
        } else if (state === 'STALE') {
          setUserLocation((prev) => ({ ...prev, status: 'stale', gpsSignalState: state }));
        } else if (state === 'LOST') {
          setUserLocation((prev) => ({ ...prev, status: 'lost', error: msg, gpsSignalState: state }));
          addLog('GPS signal lost. Retaining last known position and attempting reconnection...', 'alert');
        } else if (state === 'RECOVERING' || state === 'RECOVERED') {
          setUserLocation((prev) => ({ ...prev, status: 'recovering', gpsSignalState: state }));
          addLog('GPS signal re-acquired. Resuming active navigation telemetry.', 'info');
        } else if (state === 'AVAILABLE' || state === 'LIVE') {
          setUserLocation((prev) => ({ ...prev, status: 'granted', gpsSignalState: state }));
        }
      }
    );

    locationWatchUnsubRef.current = unsub;
    return () => {
      if (locationWatchUnsubRef.current) {
        locationWatchUnsubRef.current();
        locationWatchUnsubRef.current = null;
      }
    };
  }, [
    flyToLocation,
    addLog,
    currentMission.destinationCoords,
    navigationPhase,
    selectedRoute,
    travelMode,
    selectedVehicle.id,
    nearMissEvents,
    activeHazards,
  ]);

  // Continuous live GPS watch toggle
  const toggleWatchLocation = useCallback(() => {
    if (isWatchingLocation) {
      if (locationWatchUnsubRef.current) {
        locationWatchUnsubRef.current();
        locationWatchUnsubRef.current = null;
      }
      setIsWatchingLocation(false);
      addLog('Live GPS tracking paused.', 'info');
    } else {
      const unsub = locationService.startWatching(
        (pos) => {
          setUserLocation({
            coordinates: pos.coordinates,
            accuracyMeters: pos.accuracyMeters,
            heading: pos.heading,
            speedKmh: pos.speedKmh,
            status: 'granted',
          });
        },
        (errMsg) => {
          addLog(`GPS tracking notice: ${errMsg}`, 'alert');
        }
      );
      locationWatchUnsubRef.current = unsub;
      setIsWatchingLocation(true);
      addLog('Continuous live GPS tracking active.', 'info');
    }
  }, [isWatchingLocation, addLog]);

  // Citizen Navigation Start & Stop
  const startCitizenNavigation = useCallback((routeId?: string) => {
    const targetRoute = (routeId && routes.find((r) => r.id === routeId)) || selectedRoute || routes[0];
    if (!targetRoute) {
      addLog('Cannot start navigation: No route calculated.', 'alert');
      return;
    }

    setSelectedRouteId(targetRoute.id);
    setNavigationPhase('NAVIGATING');

    const firstManeuver: NavigationManeuver =
      targetRoute.maneuvers && targetRoute.maneuvers.length > 0
        ? targetRoute.maneuvers[0]
        : {
            id: 'step_start',
            instruction: `Head along ${targetRoute.name}`,
            distanceMeters: Math.max(100, Math.round(targetRoute.distanceKm * 1000 * 0.1)),
            type: 'straight',
            coordinates: targetRoute.fullCoordinates[0] || [0, 0],
          };
    setNavigationManeuver(firstManeuver);
    navigationVoiceService.startNavigation(targetRoute.name, firstManeuver);

    const safetyScore = Math.max(10, 100 - targetRoute.riskScore);
    addLog(`Citizen navigation started along ${targetRoute.name} (Safety Score: ${safetyScore})`, 'info');

    if (userLocation.coordinates) {
      flyToLocation(userLocation.coordinates, 16.0);
    } else if (targetRoute.fullCoordinates[0]) {
      flyToLocation(targetRoute.fullCoordinates[0], 16.0);
    }
  }, [routes, selectedRoute, userLocation.coordinates, flyToLocation, addLog]);

  const stopCitizenNavigation = useCallback(() => {
    setNavigationPhase('ROUTE_SELECTED');
    navigationVoiceService.stopNavigation();
    addLog('Navigation ended. Returned to route overview.', 'info');
  }, [addLog]);

  // Google-Maps-Style Place & City Exploration
  const openPlaceDetails = useCallback(
    async (coords: [number, number], name?: string, type?: PlaceType) => {
      // Smoothly fly camera to clicked/selected coordinate
      const targetZoom = type === 'city' ? 12.5 : type === 'highway' || type === 'road' ? 14.5 : 15.5;
      flyToLocation(coords, targetZoom);

      // Instant optimistic placeholder while fetching rich Wikipedia & geocoding data
      const initialPlace: NormalizedPlace = {
        id: `loc_${coords[0].toFixed(4)}_${coords[1].toFixed(4)}`,
        name: name || 'Resolving location...',
        type: type || 'poi',
        latitude: coords[1],
        longitude: coords[0],
        address: `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`,
        photos: [],
      };
      setSelectedPlace(initialPlace);

      try {
        let resolved: NormalizedPlace;
        if (name && name !== 'Resolving location...') {
          resolved = await PlaceService.getPlaceDetails(initialPlace.id, name, coords, type);
        } else {
          resolved = await PlaceService.reverseGeocode(coords);
        }
        setSelectedPlace(resolved);
        addLog(`Place explored: ${resolved.name} (${resolved.type})`, 'info');
      } catch (e) {
        console.warn('Failed to resolve place details:', e);
      }
    },
    [flyToLocation, addLog]
  );

  const closePlacePanel = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  // Re-evaluate routes when vehicle, urgency, weather, or hazards change
  useEffect(() => {
    if (routes.length === 0 || !selectedRouteId) return; // Do not auto-generate routes on clean startup!
    const city = CITY_PRESETS[currentCityId] || DEFAULT_CITY;
    const effectiveHazards = [...activeHazards];
    if (weatherState === 'monsoon_rain') {
      effectiveHazards.push({
        id: 'weather_monsoon_global',
        type: 'FLOOD_RISK',
        title: 'Monsoon Precipitation Surface Degrade',
        severity: 'warning',
        locationName: `${city.name} Corridors`,
        coordinates: city.center,
        riskImpactPoints: 16,
        detectedAt: 'Active Live',
        description: 'Reduced tire adhesion and water film standing depth.',
        affectedRouteIds: city.routes.map((r) => r.id),
        recommendedAction: 'Engage high-clearance smart transit corridor.',
        active: true,
      });
    }

    const { evaluatedRoutes, comparisonExplanation } = evaluateRoutesForMission(
      routes,
      selectedVehicle,
      currentMission.urgency,
      effectiveHazards,
      routingPreference
    );
    setRoutes(evaluatedRoutes);
    setWhyThisRouteExplanation(comparisonExplanation);
    addLog(`Route intelligence re-evaluated: ${comparisonExplanation.split('\n')[0]}`, 'route');
  }, [currentCityId, selectedVehicle, currentMission.urgency, activeHazards, weatherState, routingPreference, addLog]);

  // Real OSRM Route Calculation Handler
  const calculateRouteWithOsrm = useCallback(async () => {
    if (!currentMission.destinationCoords) {
      addLog('Select or search a destination to calculate route.', 'alert');
      return;
    }

    setIsCalculatingRoute(true);
    addLog(`Querying OpenStreetMap road geometry via OSRM engine...`, 'info');
    speechService.speak('Calculating optimal corridor using OpenStreetMap road network and Road-Risk Engine.');

    try {
      const response = await fetchOsrmRoutes(
        currentMission.originCoords,
        currentMission.destinationCoords,
        nearMissEvents,
        activeHazards,
        selectedVehicle.id
      );

      const evaluated = evaluateRoutesForMission(
        response.routes,
        selectedVehicle,
        currentMission.urgency,
        activeHazards,
        routingPreference
      );

      setRoutes(evaluated.evaluatedRoutes);
      setSelectedRouteId(evaluated.recommendedRouteId);
      setWhyThisRouteExplanation(evaluated.comparisonExplanation);
      addLog(`Route calculation complete: ${response.note}`, 'route');
    } catch (err) {
      console.warn('OSRM calculation error:', err);
      addLog('OSRM API query timed out. Utilizing calibrated geographic emergency corridor.', 'alert');
    } finally {
      setIsCalculatingRoute(false);
    }
  }, [currentMission.originCoords, currentMission.destinationCoords, nearMissEvents, activeHazards, selectedVehicle, currentMission.urgency, routingPreference, addLog]);

  // Manual Hazard Reporting Handler
  const addManualHazardReport = useCallback((report: ManualHazardReport) => {
    setManualHazardReports((prev) => [report, ...prev]);

    const mappedType: HazardAlert['type'] =
      report.category === 'flooding'
        ? 'FLOOD_RISK'
        : report.category === 'road_blockage'
        ? 'ROAD_BLOCKAGE'
        : report.category === 'accident'
        ? 'ACCIDENT_AHEAD'
        : 'BRAKING_CLUSTER';

    const impact = report.severity === 'critical' ? 45 : report.severity === 'high' ? 30 : 18;

    const newHazard: HazardAlert = {
      id: `manual_hz_${Date.now()}`,
      type: mappedType,
      title: `[Field Report] ${report.title}`,
      severity: report.severity === 'critical' ? 'critical' : report.severity === 'high' ? 'high' : 'warning',
      locationName: report.locationName,
      coordinates: report.coordinates,
      riskImpactPoints: impact,
      detectedAt: 'Just now',
      description: report.description,
      affectedRouteIds: routes.map((r) => r.id),
      recommendedAction: 'Validate with field sensors. Alternative corridors evaluated.',
      active: true,
    };

    setActiveHazards((prev) => [newHazard, ...prev]);
    addLog(`Manual field hazard reported: "${report.title}" (+${impact} risk index impact).`, 'alert');
    audioSynth.playPing();
  }, [routes, addLog]);

  // Near-Miss Event Simulator Handler
  const generateSimulatedEvent = useCallback((
    type: NearMissEvent['eventType'] | 'FLOOD' | 'BLOCKAGE' | 'TRAFFIC' | 'ACCIDENT',
    count: number = 5,
    severity: NearMissEvent['severity'] = 'high'
  ) => {
    const activeRouteCoords = selectedRoute?.fullCoordinates || [];
    const targetCoord = activeRouteCoords.length > 5
      ? activeRouteCoords[Math.floor(activeRouteCoords.length * 0.45)]
      : currentMission.originCoords;

    const newEvents: NearMissEvent[] = [];
    for (let i = 0; i < count; i++) {
      const offsetLng = (Math.random() - 0.5) * 0.003;
      const offsetLat = (Math.random() - 0.5) * 0.003;
      newEvents.push({
        id: `evt_${Date.now()}_${i}`,
        vehicleId: `PROBE-${Math.floor(100 + Math.random() * 900)}`,
        eventType: (type === 'FLOOD' || type === 'BLOCKAGE' || type === 'TRAFFIC' || type === 'ACCIDENT') ? 'HARD_BRAKE' : type,
        coordinates: [targetCoord[0] + offsetLng, targetCoord[1] + offsetLat],
        speedBefore: 55,
        speedAfter: type === 'HARD_BRAKE' ? 12 : 28,
        timestamp: new Date().toLocaleTimeString(),
        severity,
        sourceType: 'SIMULATED',
      });
    }

    setNearMissEvents((prev) => [...newEvents, ...prev]);

    let hazardType: HazardAlert['type'] = 'BRAKING_CLUSTER';
    let title = `${count}x Severe Deceleration Events Clustered`;
    let impact = count >= 15 ? 48 : 25;

    if (type === 'SUDDEN_SWERVE') {
      title = `${count}x Sudden Swerving Anomalies Detected`;
      impact = 28;
    } else if (type === 'FLOOD') {
      hazardType = 'FLOOD_RISK';
      title = 'Flash Flooding (35cm) Detected';
      impact = 42;
    } else if (type === 'BLOCKAGE') {
      hazardType = 'ROAD_BLOCKAGE';
      title = 'Multi-lane Road Blockage / Obstruction';
      impact = 55;
    } else if (type === 'ACCIDENT') {
      hazardType = 'ACCIDENT_AHEAD';
      title = 'Multi-Vehicle Collision Ahead';
      impact = 50;
    }

    const newHazard: HazardAlert = {
      id: `sim_haz_${Date.now()}`,
      type: hazardType,
      title,
      severity: impact >= 40 ? 'critical' : 'high',
      locationName: `Corridor Sector near [${targetCoord[0].toFixed(3)}, ${targetCoord[1].toFixed(3)}]`,
      coordinates: targetCoord,
      riskImpactPoints: impact,
      detectedAt: 'Just now',
      description: `Explainable Road-Risk Engine detected cluster of ${count} events.`,
      affectedRouteIds: [selectedRoute?.id || ''],
      recommendedAction: 'Reroute active emergency vehicle immediately to avoid bottleneck delay.',
      active: true,
    };

    setActiveHazards((prev) => [newHazard, ...prev]);
    audioSynth.playHazardWarning();
    speechService.speak(`Alert: Emerging road hazard detected. Explainable Road-Risk Engine recommends dynamic reroute.`);
    addLog(`[Simulator] Injected ${count}x ${type} events on ${selectedRoute?.name}. Risk score elevated by +${impact} points.`, 'alert');
  }, [selectedRoute, currentMission.originCoords, addLog]);

  const clearAllSimulatedEvents = useCallback(() => {
    setNearMissEvents([]);
    setActiveHazards([]);
    setManualHazardReports([]);
    setRerouteRecommendation(null);
    addLog('All simulated near-miss telemetry and hazards cleared. Baseline risk restored.', 'info');
  }, [addLog]);

  // One-Click Hackathon Demo Scenario Execution
  const runHackathonDemoScenario = useCallback(() => {
    setIsDemoRunning(true);
    addLog('⚡ [HACKATHON DEMO] Launching automated predictive routing demonstration...', 'alert');
    speechService.speak('Initiating RoadRisk AI demonstration. Loading Route Bravo emergency corridor.');

    // Load Demo Destination & Routes
    const city = CITY_PRESETS[currentCityId] || DEFAULT_CITY;
    const dest = city.destinations[0] || DISPATCH_DESTINATIONS[0];
    const demoRoutes = city.routes;

    setCurrentMission((prev) => ({
      ...prev,
      destination: dest.name,
      destinationCoords: dest.coords,
      status: 'EN_ROUTE',
      selectedRouteId: 'route_bravo',
      startTime: Date.now(),
    }));

    setRoutes(demoRoutes);
    setSelectedRouteId('route_bravo');
    setIsSimulationPlaying(true);
    setCameraMode('cockpit');

    // Step 2: At 2.5 seconds, inject near-miss braking cluster on Route Alpha
    setTimeout(() => {
      addLog('⚡ [DEMO Step 2] Emerging risk detected: 20 hard-braking events on Route Alpha.', 'alert');
      generateSimulatedEvent('HARD_BRAKE', 20, 'critical');
    }, 2500);

    // Step 3: Complete demo state reset after 20 seconds
    setTimeout(() => {
      setIsDemoRunning(false);
    }, 20000);
  }, [currentCityId, generateSimulatedEvent, addLog]);

  const stopHackathonDemo = useCallback(() => {
    setIsDemoRunning(false);
    setActiveHazards([]);
    setNearMissEvents([]);
    clearDestination();
    addLog('Demo stopped. All simulated events cleared. Clean live map restored.', 'info');
  }, [clearDestination, addLog]);

  // Start Route Selection Phase
  const startRouteSelection = useCallback(() => {
    setCurrentMission((prev) => ({
      ...prev,
      status: 'ROUTE_SELECTION',
      vehicleId: selectedVehicle.id,
    }));
    audioSynth.playPing();
    speechService.speak(`Mission dispatch configured for ${selectedVehicle.callsign}. Analyzing safest corridor.`);
    addLog(`Operator opened route intelligence for ${selectedVehicle.callsign}.`, 'info');
  }, [selectedVehicle, addLog]);

  // Start Live Navigation
  const startNavigationMission = useCallback(() => {
    if (!selectedRoute) return;
    progressRef.current = 0.0;
    lastTickTimeRef.current = Date.now();
    hasSpokenRerouteRef.current = false;
    hasSpokenGreenLockRef.current = false;

    setCurrentMission((prev) => ({
      ...prev,
      status: 'EN_ROUTE',
      selectedRouteId,
      startTime: Date.now(),
    }));

    // Update vehicle status in fleet
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === selectedVehicle.id
          ? { ...v, status: 'EN_ROUTE', missionId: currentMission.id }
          : v
      )
    );

    setIsSimulationPlaying(true);
    setCameraMode('cockpit');
    audioSynth.playMissionDispatch();
    speechService.speak(`Emergency navigation active on ${selectedRoute.name}. All signals coordinating.`);
    addLog(`Navigation commenced on ${selectedRoute.name} for ${selectedVehicle.callsign}`, 'route');
  }, [selectedRoute, selectedVehicle, selectedRouteId, currentMission.id, addLog]);

  // Complete Mission & Generate Debrief
  const completeMission = useCallback(() => {
    setIsSimulationPlaying(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (!selectedRoute) return;

    const finishTime = Date.now();
    const durationMinutes = currentMission.startTime
      ? Math.max(1, Math.round((finishTime - currentMission.startTime) / 60000))
      : 8;

    setCurrentMission((prev) => ({
      ...prev,
      status: 'COMPLETED',
      completedTime: finishTime,
    }));

    // Free vehicle in fleet
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === selectedVehicle.id
          ? { ...v, status: 'AT_SCENE', currentSpeedKmh: 0 }
          : v
      )
    );

    const report: DebriefReport = {
      missionId: currentMission.id,
      vehicleCallsign: selectedVehicle.callsign,
      emergencyType: currentMission.emergencyType,
      totalDurationMinutes: durationMinutes,
      plannedEtaMinutes: currentMission.initialEtaMinutes,
      actualArrivalMinutes: 7.8,
      timeSavedMinutes: 2.0,
      distanceTraveledKm: selectedRoute.distanceKm,
      averageRiskIndex: Math.round(selectedRoute.riskScore * 0.8),
      maxRiskIndex: selectedRoute.riskScore,
      riskPointsAvoided: 58,
      hazardsDetectedCount: currentMission.hazardsEncountered || 1,
      reroutesExecutedCount: currentMission.rerouteCount,
      greenCorridorEfficiencyPct: 92,
      timeline: [
        { timestamp: '19:43:00', event: 'Emergency dispatch call received and prioritized', type: 'info' },
        { timestamp: '19:43:15', event: `${selectedVehicle.callsign} en route via Smart Corridor`, type: 'info' },
        { timestamp: '19:44:20', event: 'Severe deceleration anomaly detected on arterial flyover (Risk 84)', type: 'hazard' },
        { timestamp: '19:44:45', event: 'Dynamic Reroute engaged to protect patient transit stability', type: 'reroute' },
        { timestamp: '19:45:50', event: 'Green Corridor pre-empted 4 sequential signals (Saved 1m 45s)', type: 'green_corridor' },
        { timestamp: '19:48:30', event: `Safe arrival at ${currentMission.destination || 'Hospital'} emergency bay`, type: 'complete' },
      ],
    };

    setDebriefReport(report);
    audioSynth.playRerouteConfirmed();
    speechService.speak('Emergency transit successfully completed. Arrival registered at medical facility.');
    addLog(`Emergency mission concluded for ${selectedVehicle.callsign}. Debrief dossier generated.`, 'info');
  }, [selectedRoute, selectedVehicle, currentMission.id, currentMission.emergencyType, currentMission.startTime, currentMission.initialEtaMinutes, currentMission.destination, currentMission.hazardsEncountered, currentMission.rerouteCount, addLog]);

  const closeDebrief = useCallback(() => {
    setDebriefReport(null);
  }, []);

  // Export Mission Debrief as JSON file download
  const exportDebriefReport = useCallback(() => {
    if (!debriefReport) return;
    const json = JSON.stringify(debriefReport, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debrief-${debriefReport.missionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog(`Debrief dossier exported for ${debriefReport.missionId}`, 'info');
  }, [debriefReport, addLog]);

  // Export City Authority Audit Report as CSV file download
  const exportAuthorityAuditReport = useCallback(() => {
    const csvContent =
      'timestamp,vehicle_id,event_type,severity,risk_index,mitigation_action\n' +
      missionLogs.map((l) => `${l.timestamp},AMB-BRAVO-02,TELEMETRY_LOG,INFO,18,"${l.message.replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `civil-corridor-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('City Civil Audit Dossier exported successfully as CSV.', 'info');
  }, [missionLogs, addLog]);

  const resetToMissionSetup = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsSimulationPlaying(false);
    progressRef.current = 0.0;
    setRerouteRecommendation(null);
    setDebriefReport(null);
    setCurrentMission((prev) => ({
      ...prev,
      status: 'SETUP',
      startTime: undefined,
      completedTime: undefined,
      rerouteCount: 0,
      hazardsEncountered: 0,
    }));
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === selectedVehicle.id ? { ...v, status: 'AVAILABLE', currentSpeedKmh: 0 } : v
      )
    );
    setTelemetry({
      currentCoordinates: currentMission.originCoords || DEFAULT_ORIGIN,
      speedKmh: 0,
      headingDegrees: 45,
      distanceRemainingKm: selectedRoute?.distanceKm || 0,
      etaRemainingMinutes: selectedRoute?.adjustedEtaMinutes || 0,
      progressFraction: 0.0,
      currentSegmentIndex: 0,
      currentSegmentRisk: selectedRoute?.segments?.[0]?.riskScore || 0,
      nextManeuver: {
        type: 'straight',
        instruction: 'Standby at Origin Hub',
        distanceToMeters: 0,
      },
    });
    addLog('Mission reset to initial setup state.', 'info');
  }, [selectedRoute, selectedVehicle, currentMission.originCoords, addLog]);

  // Inject a real-time hazard (Braking cluster, Flooding, or Road Blockage)
  const triggerHazardInjection = useCallback((hazardType: 'BRAKING_CLUSTER' | 'FLOOD_RISK' | 'ROAD_BLOCKAGE' = 'BRAKING_CLUSTER') => {
    audioSynth.playHazardWarning();

    let newHazard: HazardAlert;
    if (hazardType === 'BRAKING_CLUSTER') {
      newHazard = {
        id: `haz_${Date.now()}`,
        type: 'BRAKING_CLUSTER',
        title: 'Abrupt Braking Cluster (+48 Risk)',
        severity: 'critical',
        locationName: 'Junction 17 Overpass Descent',
        coordinates: [77.6085, 12.9860],
        riskImpactPoints: 48,
        detectedAt: 'Just now',
        description: '28 sharp vehicle decelerations detected in last 45 seconds. Significant accordion collision hazard.',
        affectedRouteIds: ['route_alpha'],
        recommendedAction: 'Immediate reroute to Route Bravo (Smart Corridor) recommended.',
        active: true,
      };
    } else if (hazardType === 'FLOOD_RISK') {
      newHazard = {
        id: `haz_${Date.now()}`,
        type: 'FLOOD_RISK',
        title: 'Flash Waterlogging (42cm)',
        severity: 'critical',
        locationName: 'Railway Underpass Sector 9',
        coordinates: [77.6020, 12.9810],
        riskImpactPoints: 52,
        detectedAt: 'Just now',
        description: 'Stormwater backflow exceeded drain threshold. Impassable for low chassis vehicles.',
        affectedRouteIds: ['route_alpha'],
        recommendedAction: 'Divert heavy units and ambulances to elevated Ring Expressway.',
        active: true,
      };
    } else {
      newHazard = {
        id: `haz_${Date.now()}`,
        type: 'ROAD_BLOCKAGE',
        title: 'Severe Multi-Vehicle Collision Blockage',
        severity: 'critical',
        locationName: 'Central Flyover Mile 2.4',
        coordinates: [77.6050, 12.9790],
        riskImpactPoints: 65,
        detectedAt: 'Just now',
        description: 'Multi-car stationary obstruction completely blocking both northbound lanes.',
        affectedRouteIds: ['route_alpha'],
        recommendedAction: 'Switch route immediately to bypass bottleneck.',
        active: true,
      };
    }

    setActiveHazards((prev) => [newHazard, ...prev]);
    setCurrentMission((prev) => ({
      ...prev,
      hazardsEncountered: (prev.hazardsEncountered || 0) + 1,
      status: prev.status === 'EN_ROUTE' ? 'HAZARD_DETECTED' : prev.status,
    }));

    // Update fleet vehicle status
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === selectedVehicle.id ? { ...v, status: 'HAZARD_ALERT' } : v
      )
    );

    addLog(`Hazard alert triggered: ${newHazard.title} at ${newHazard.locationName}`, 'alert');

    // Trigger dynamic reroute recommendation if currently navigating on affected route
    const currentRouteObj = routes.find((r) => r.id === selectedRouteId) || routes[0];
    const reroute = evaluateDynamicReroute(
      currentRouteObj,
      routes,
      currentRouteObj.riskScore + newHazard.riskImpactPoints,
      newHazard
    );
    if (reroute) {
      setRerouteRecommendation(reroute);
      setCurrentMission((prev) => ({
        ...prev,
        status: 'REROUTING',
      }));
      speechService.speak('Warning! High hazard detected ahead. Recalculating safer route recommendation.', true);
    }
  }, [routes, selectedRouteId, selectedVehicle.id, addLog]);

  const clearHazards = useCallback(() => {
    setActiveHazards([]);
    setRerouteRecommendation(null);
    setCurrentMission((prev) => ({
      ...prev,
      status: prev.status === 'REROUTING' || prev.status === 'HAZARD_DETECTED' ? 'EN_ROUTE' : prev.status,
    }));
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === selectedVehicle.id && v.status === 'HAZARD_ALERT' ? { ...v, status: 'EN_ROUTE' } : v
      )
    );
    addLog('All active hazard alerts cleared by authority command.', 'info');
  }, [selectedVehicle.id, addLog]);

  // Accept Reroute Recommendation (Phase 9: Strictly originates from current vehicle coordinates)
  const acceptReroute = useCallback(() => {
    if (!rerouteRecommendation) return;

    const newRoute = rerouteRecommendation.alternativeRoute;
    const currentCoords = telemetry?.currentCoordinates;
    let finalRoute = { ...newRoute };

    // If ambulance has already moved along original route, splice from current position forward
    if (currentCoords && progressRef.current > 0.005) {
      const fullCoords = newRoute.fullCoordinates;
      let closestIdx = 0;
      let minDistance = Infinity;

      fullCoords.forEach((pt, idx) => {
        const d = calculateDistanceKm(currentCoords, pt);
        if (d < minDistance) {
          minDistance = d;
          closestIdx = idx;
        }
      });

      // Rerouted path starts strictly at current vehicle coordinates, NOT the original origin
      const remainingWaypoints = fullCoords.slice(Math.max(1, closestIdx));
      const updatedCoordinates: [number, number][] = [currentCoords, ...remainingWaypoints];

      finalRoute = {
        ...newRoute,
        fullCoordinates: updatedCoordinates,
      };

      // Replace route in routes state
      setRoutes((prev) =>
        prev.map((r) => (r.id === newRoute.id ? finalRoute : r))
      );

      // Reset progress along the newly spliced trajectory
      progressRef.current = 0;
    }

    setSelectedRouteId(finalRoute.id);
    setRerouteRecommendation(null);

    const nextRerouteCount = currentMission.rerouteCount + 1;
    setCurrentMission((prev) => ({
      ...prev,
      rerouteCount: nextRerouteCount,
      selectedRouteId: finalRoute.id,
      status: 'ROUTE_UPDATED',
    }));

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === selectedVehicle.id ? { ...v, status: 'EN_ROUTE' } : v
      )
    );

    // Broadcast Realtime Reroute Events (Phase 9 & Phase 12)
    const pos: [number, number] = currentCoords || currentMission.originCoords || [0, 0];
    const nowIso = new Date().toISOString();

    realtimeService.broadcastReroute(currentMission.id, {
      eventId: `reroute_start_${Date.now()}`,
      eventType: 'REROUTE_STARTED',
      timestamp: nowIso,
      isSimulation: true,
      missionId: currentMission.id,
      oldRouteId: selectedRoute?.id || '',
      newRouteId: finalRoute.id,
      reason: rerouteRecommendation.triggerReason,
      oldRisk: selectedRoute?.riskScore || 20,
      newRisk: finalRoute.riskScore,
      currentPosition: pos,
    }).catch(console.warn);

    realtimeService.broadcastReroute(currentMission.id, {
      eventId: `reroute_comp_${Date.now()}`,
      eventType: 'REROUTE_COMPLETED',
      timestamp: nowIso,
      isSimulation: true,
      missionId: currentMission.id,
      oldRouteId: selectedRoute?.id || '',
      newRouteId: finalRoute.id,
      reason: rerouteRecommendation.triggerReason,
      oldRisk: selectedRoute?.riskScore || 20,
      newRisk: finalRoute.riskScore,
      currentPosition: pos,
    }).catch(console.warn);

    // Persist Route History (Durable Tracking)
    dataService.recordRouteHistory({
      mission_id: currentMission.id,
      route_id: finalRoute.id,
      reroute_sequence: nextRerouteCount,
      trigger_reason: rerouteRecommendation.triggerReason,
      start_lat: pos[1],
      start_lng: pos[0],
      distance_meters: Math.round((finalRoute.distanceKm || 0) * 1000),
      duration_seconds: Math.round((finalRoute.adjustedEtaMinutes || 0) * 60),
      risk_score: finalRoute.riskScore,
    }).catch(console.warn);

    audioSynth.playRerouteConfirmed();
    speechService.speak(`Reroute confirmed. Diverting to ${finalRoute.name} from current position. Hazard bypassed safely.`, true);
    addLog(`Reroute accepted: Vehicle transitioned to ${finalRoute.name} originating from live position`, 'route');
  }, [rerouteRecommendation, selectedVehicle.id, addLog, telemetry, currentMission, selectedRoute]);

  const dismissReroute = useCallback(() => {
    setRerouteRecommendation(null);
    setCurrentMission((prev) => ({
      ...prev,
      status: prev.status === 'REROUTING' ? 'EN_ROUTE' : prev.status,
    }));
    addLog('Operator dismissed reroute recommendation, maintaining current trajectory.', 'alert');
  }, [addLog]);

  // Toggle individual signal in Green Corridor
  const toggleGreenCorridorSignal = useCallback((signalId: string) => {
    setGreenCorridor((prev) => {
      const updated = prev.signals.map((s) =>
        s.id === signalId
          ? { ...s, state: (s.state === 'GREEN_LOCKED' ? 'STANDBY' : 'GREEN_LOCKED') as GreenCorridorSignal['state'], timeUntilGreenSec: 0 }
          : s
      );
      const lockedCount = updated.filter((s) => s.state === 'GREEN_LOCKED').length;
      return {
        ...prev,
        signals: updated,
        greenLockedSignals: lockedCount,
      };
    });
    audioSynth.playGreenCorridorLock();
  }, []);

  // Step simulation forward manually (for testing / stepping)
  const stepSimulation = useCallback((stepFraction = 0.1) => {
    if (!selectedRoute) return;
    progressRef.current = Math.min(1.0, progressRef.current + stepFraction);
    const polyline = selectedRoute.fullCoordinates;
    if (!polyline || polyline.length < 2) return;

    const t = progressRef.current;
    const { position, heading, segmentIndex } = interpolatePositionAlongPolyline(polyline, t);

    setTelemetry((prev) => ({
      ...prev,
      currentCoordinates: position,
      headingDegrees: heading,
      progressFraction: t,
      distanceRemainingKm: parseFloat(((1 - t) * selectedRoute.distanceKm).toFixed(1)),
      etaRemainingMinutes: parseFloat(((1 - t) * selectedRoute.adjustedEtaMinutes).toFixed(1)),
      currentSegmentIndex: segmentIndex,
    }));

    if (t >= 1.0) {
      completeMission();
    }
  }, [selectedRoute, completeMission]);

  // Demo Scenario Presets
  const loadDemoScenario = useCallback((scenarioNumber: 1 | 2 | 3 | 4 | 5) => {
    resetToMissionSetup();

    if (scenarioNumber === 1) {
      setSelectedVehicleId('veh_amb_01');
      setSelectedRouteId('route_bravo');
      updateMissionSetup({
        emergencyType: 'Critical Cardiac Emergency (ALS)',
        urgency: 'CRITICAL',
        notes: 'Cardiac arrest in transit. Telemedicine ICU streaming active.',
      });
      addLog('Loaded Demo Scenario 1: Critical Cardiac Ambulance via Smart Corridor', 'info');
    } else if (scenarioNumber === 2) {
      setSelectedVehicleId('veh_fire_01');
      setSelectedRouteId('route_charlie');
      updateMissionSetup({
        emergencyType: '4-Alarm Commercial Structure Fire',
        urgency: 'CRITICAL',
        notes: 'High water tender requirement. Route selected for 24m wide arterial clearance.',
      });
      addLog('Loaded Demo Scenario 2: Heavy Fire Engine Arterial Clearance', 'info');
    } else if (scenarioNumber === 3) {
      setSelectedVehicleId('veh_ndrf_01');
      setSelectedRouteId('route_bravo');
      setWeatherState('monsoon_rain');
      updateMissionSetup({
        emergencyType: 'Flash Flood Inundation & Rescue',
        urgency: 'HIGH',
        notes: 'Sector 9 underpass flooded. Amphibious carrier navigating designated waterlogged sectors.',
      });
      addLog('Loaded Demo Scenario 3: Monsoon Flood Inundation & Amphibious Routing', 'info');
    } else if (scenarioNumber === 4) {
      setSelectedVehicleId('veh_police_01');
      setSelectedRouteId('route_charlie');
      updateMissionSetup({
        emergencyType: 'Tactical Incident Response & Intercept',
        urgency: 'CRITICAL',
        notes: 'High-speed interceptor deployed. Expressway median clearance authorized.',
      });
      addLog('Loaded Demo Scenario 4: High-Speed Police Tactical Intercept', 'info');
    } else {
      setSelectedVehicleId('veh_hazmat_01');
      setSelectedRouteId('route_charlie');
      updateMissionSetup({
        emergencyType: 'Industrial Chemical Vapor Leakage',
        urgency: 'HIGH',
        notes: 'Class 3 Corrosive plume containment. Dense residential corridors prohibited.',
      });
      addLog('Loaded Demo Scenario 5: Hazmat Response with Density Exclusion Zone', 'info');
    }
  }, [resetToMissionSetup, updateMissionSetup, addLog]);

  // Main 60fps Navigation Loop
  useEffect(() => {
    const isNavigating = ['EN_ROUTE', 'HAZARD_DETECTED', 'REROUTING', 'ROUTE_UPDATED', 'GREEN_CORRIDOR_ACTIVE'].includes(currentMission.status);
    if (!isNavigating || !isSimulationPlaying || !selectedRoute) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const polyline = selectedRoute.fullCoordinates;
    if (!polyline || polyline.length < 2) return;

    const tick = () => {
      const now = Date.now();
      const deltaMs = now - lastTickTimeRef.current;
      lastTickTimeRef.current = now;

      // Rate of progress along route (scaled by speed multiplier)
      const progressDelta = (deltaMs / 45000) * simulationSpeed;
      progressRef.current = Math.min(1.0, progressRef.current + progressDelta);

      const t = progressRef.current;
      const { position, heading, segmentIndex } = interpolatePositionAlongPolyline(polyline, t);

      // Determine current segment risk
      const currentSegment = selectedRoute.segments[Math.min(segmentIndex, selectedRoute.segments.length - 1)];
      const segmentRisk = currentSegment ? currentSegment.riskScore : selectedRoute.riskScore;

      // Dynamic Speed calculation (40 - 75 km/h)
      const baseSpeed = selectedVehicle.category === 'police' ? 78 : selectedVehicle.category === 'fire_rescue' ? 52 : 64;
      const speedKmh = Math.round(baseSpeed + Math.sin(t * Math.PI * 6) * 6);

      const distanceRemainingKm = parseFloat(((1 - t) * selectedRoute.distanceKm).toFixed(1));
      const etaRemainingMinutes = parseFloat(((1 - t) * selectedRoute.adjustedEtaMinutes).toFixed(1));

      // Calculate next maneuver instruction
      let nextInstruction = 'Continue straight on priority corridor';
      let maneuverType: NavigationTelemetry['nextManeuver']['type'] = 'straight';
      let distToTurn = 350;

      if (t < 0.25) {
        nextInstruction = 'In 250m, merge right onto Old Madras Smart Corridor';
        maneuverType = 'turn_right';
        distToTurn = Math.round((0.25 - t) * 2000);
      } else if (t < 0.65) {
        nextInstruction = 'In 400m, keep left to enter Green Corridor Flyover Bypass';
        maneuverType = 'turn_left';
        distToTurn = Math.round((0.65 - t) * 2000);
      } else if (t < 0.9) {
        nextInstruction = 'In 300m, direct approach to Apex Trauma Emergency Gate';
        maneuverType = 'straight';
        distToTurn = Math.round((0.9 - t) * 1500);
      } else {
        nextInstruction = 'Approaching Emergency Bay. Prepare for patient handover';
        maneuverType = 'destination';
        distToTurn = Math.round((1.0 - t) * 500);
      }

      setTelemetry({
        currentCoordinates: position,
        speedKmh,
        headingDegrees: heading,
        distanceRemainingKm,
        etaRemainingMinutes,
        progressFraction: t,
        currentSegmentIndex: segmentIndex,
        currentSegmentRisk: segmentRisk,
        nextManeuver: {
          type: maneuverType,
          instruction: nextInstruction,
          distanceToMeters: Math.max(20, distToTurn),
        },
      });

      // Update vehicle position in fleet list
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === selectedVehicle.id
            ? { ...v, currentLocation: position, heading, currentSpeedKmh: speedKmh }
            : v
        )
      );

      // Trigger automatic demo hazard when t crosses 0.25 on Route Alpha
      if (selectedRoute.id === 'route_alpha' && t >= 0.25 && !hasSpokenRerouteRef.current) {
        hasSpokenRerouteRef.current = true;
        triggerHazardInjection('BRAKING_CLUSTER');
      }

      // Signal pre-emption voice call at t=0.4 on Route Bravo
      if (selectedRoute.id === 'route_bravo' && t >= 0.4 && !hasSpokenGreenLockRef.current) {
        hasSpokenGreenLockRef.current = true;
        audioSynth.playGreenCorridorLock();
        speechService.speak('Green corridor pre-emption verified. Signal 2 and 3 locked.');
        addLog('Green corridor: 100ft and Metro Interchange signals pre-empted to Green.', 'green');
      }

      // Mission Completion check
      if (t >= 1.0) {
        completeMission();
        return;
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    currentMission.status,
    isSimulationPlaying,
    selectedRoute,
    selectedVehicle,
    simulationSpeed,
    completeMission,
    triggerHazardInjection,
    addLog,
  ]);

  return (
    <AppContext.Provider
      value={{
        activePortal,
        setActivePortal,
        cameraMode,
        setCameraMode,
        mapFocusCoords,
        mapFocusZoom,
        flyToLocation,
        currentCityId,
        changeCityPreset,
        mapEnginePreference,
        setMapEnginePreference,
        mapTileStyle,
        setMapTileStyle,
        isAudioMuted,
        toggleAudioMute,
        vehicles,
        selectedVehicle,
        setSelectedVehicleId,
        currentMission,
        updateMissionSetup,
        setMissionOrigin,
        setMissionDestination,
        startRouteSelection,
        startNavigationMission,
        completeMission,
        resetToMissionSetup,
        routes,
        selectedRoute,
        setSelectedRouteId,
        activeHazards,
        triggerHazardInjection,
        clearHazards,
        rerouteRecommendation,
        acceptReroute,
        dismissReroute,
        greenCorridor,
        toggleGreenCorridorSignal,
        telemetry,
        isSimulationPlaying,
        setIsSimulationPlaying,
        simulationSpeed,
        setSimulationSpeed,
        stepSimulation,
        weatherState,
        setWeatherState,
        loadDemoScenario,
        debriefReport,
        closeDebrief,
        exportDebriefReport,
        exportAuthorityAuditReport,
        missionLogs,
        manualHazardReports,
        addManualHazardReport,
        nearMissEvents,
        generateSimulatedEvent,
        clearAllSimulatedEvents,
        routingPreference,
        setRoutingPreference,
        travelMode,
        setTravelMode,
        departureTime,
        setRequestedDepartureTime,
        routesByMode,
        routeErrorNotice,
        clearRouteError,
        isCalculatingRoute,
        calculateRouteWithOsrm,
        whyThisRouteExplanation,
        clearDestination,
        setDestinationLocation,
        setOriginLocation,
        clearOrigin,
        stopHackathonDemo,
        runHackathonDemoScenario,
        isDemoRunning,
        riskWeights,
        updateRiskWeight,
        userLocation,
        requestUserLocation,
        isWatchingLocation,
        toggleWatchLocation,
        navigationPhase,
        setNavigationPhase,
        startCitizenNavigation,
        stopCitizenNavigation,
        navigationManeuver,
        selectedPlace,
        setSelectedPlace,
        openPlaceDetails,
        closePlacePanel,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
export default AppContext;
