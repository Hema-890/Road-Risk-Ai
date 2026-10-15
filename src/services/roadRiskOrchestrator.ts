// ==============================================================================
// ROADRISK AI — SINGLE UNIFIED SYSTEM ORCHESTRATOR
// Master coordination engine connecting Search, Routing, Traffic, Risk,
// Incidents, Weather, Flood, GPS, Navigation, Voice, Emergency, Events & ETA.
// Guarantees SINGLE SOURCE OF TRUTH across Cost Intelligence, AI Trip Planner,
// Public Transport (GTFS), and Fleet Logistics Optimization.
// ==============================================================================

import { eventBus } from './eventBus.ts';
import { searchService, type SearchResult } from './searchService.ts';
import { routingService } from './routingService.ts';
import { trafficService } from './trafficService.ts';
import { incidentService } from './incidentService.ts';
import { locationService } from './locationService.ts';
import { navigationVoiceService } from './navigationVoiceService.ts';
import { transitService } from './transitService.ts';
import { weatherService } from './weatherService.ts';
import { floodService } from './floodService.ts';
import { etaService } from './etaService.ts';
import { mobilityIntelligenceService, type TripCostBreakdown } from './mobilityIntelligenceService.ts';
import { aiTripPlannerService } from './aiTripPlannerService.ts';
import { logisticsService } from './logisticsService.ts';
import { modeService } from './modeService.ts';
import type { RoadRiskMode } from '../types/modes.ts';
import type {
  Route,
  TransportMode,
  RouteObjective,
  Incident,
  WeatherCondition,
  FloodRiskLevel,
  GpsSignalState,
  RoadRiskTripState,
  TripLocation,
  JourneyCost,
  TransitPlan,
  LogisticsPlan,
  Itinerary,
  TripPlanRequest,
  DeliveryStop,
  FleetVehicle,
} from '../types/index.ts';

export type NavigationStatus = 'IDLE' | 'ROUTING' | 'NAVIGATING' | 'ARRIVED';

export interface OrchestratorState {
  navigationStatus: NavigationStatus;
  currentGpsState: GpsSignalState;
  activeTransportMode: TransportMode;
  activeObjective: RouteObjective;
  userMode: RoadRiskMode;
  originCoordinates: [number, number] | null;
  destinationCoordinates: [number, number] | null;
  destinationName: string;
  calculatedRoutes: Route[];
  selectedRoute: Route | null;
  activeIncidents: Incident[];
  activeWeather: WeatherCondition | null;
  activeFloodRisk: FloodRiskLevel | null;
  lastRerouteTimestamp: number;
  tripState: RoadRiskTripState;
}

class RoadRiskOrchestrator {
  private state: OrchestratorState;
  private listeners: Set<(state: OrchestratorState) => void> = new Set();
  private initialized: boolean = false;

  constructor() {
    const defaultOrigin: TripLocation = {
      id: 'origin_vja_center',
      name: 'Vijayawada Central Hub',
      coordinates: [80.6480, 16.5062],
    };

    const initialTripState: RoadRiskTripState = {
      origin: defaultOrigin,
      destinations: [],
      waypoints: [],
      transportMode: 'CAR',
      status: 'planning',
    };

    this.state = {
      navigationStatus: 'IDLE',
      currentGpsState: 'AVAILABLE',
      activeTransportMode: 'CAR',
      activeObjective: 'FASTEST',
      userMode: modeService.getActiveMode(),
      originCoordinates: [80.6480, 16.5062],
      destinationCoordinates: null,
      destinationName: '',
      calculatedRoutes: [],
      selectedRoute: null,
      activeIncidents: [],
      activeWeather: null,
      activeFloodRisk: null,
      lastRerouteTimestamp: 0,
      tripState: initialTripState,
    };

    this.bindInternalEvents();
  }

  public initialize() {
    if (this.initialized) return;
    this.initialized = true;

    // Synchronize initial GPS
    const currentLoc = locationService.getCurrentPacket();
    if (currentLoc) {
      this.state.originCoordinates = currentLoc.coordinates;
      this.state.currentGpsState = currentLoc.state;
      this.state.tripState.origin = {
        id: 'gps_origin',
        name: 'Current GPS Location',
        coordinates: currentLoc.coordinates,
      };
    }
  }

  public getState(): OrchestratorState {
    return { ...this.state };
  }

  public getUserMode(): RoadRiskMode {
    return this.state.userMode;
  }

  public setUserMode(mode: RoadRiskMode): void {
    if (this.state.userMode === mode) return;
    this.state.userMode = mode;
    modeService.setMode(mode);
    if (this.state.calculatedRoutes.length > 0) {
      const reRanked = modeService.rankRoutesForMode(this.state.calculatedRoutes, mode);
      this.state.calculatedRoutes = reRanked;
      this.state.selectedRoute = reRanked[0] || null;
      if (this.state.selectedRoute) {
        this.state.tripState.route = this.state.selectedRoute;
      }
    }
    this.notify();
  }

  public getTripState(): RoadRiskTripState {
    return { ...this.state.tripState };
  }

  public updateTripState(updates: Partial<RoadRiskTripState>): RoadRiskTripState {
    this.state.tripState = {
      ...this.state.tripState,
      ...updates,
    };
    this.notify();
    return { ...this.state.tripState };
  }

  public subscribe(listener: (state: OrchestratorState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snap = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(snap);
      } catch (err) {
        console.error('RoadRiskOrchestrator: Listener error:', err);
      }
    });
  }

  // --------------------------------------------------------------------------
  // 1. UNIFIED SEARCH PIPELINE
  // --------------------------------------------------------------------------
  public async searchPlaces(query: string, origin?: [number, number]): Promise<SearchResult[]> {
    const originCoords = origin || this.state.originCoordinates || [80.6480, 16.5062];
    const { results } = await searchService.searchNaturalLanguage(query, { originCoords });
    return results;
  }

  // --------------------------------------------------------------------------
  // 2. UNIFIED ROUTE PLANNING PIPELINE
  // --------------------------------------------------------------------------
  public async planCorridors(
    origin: [number, number],
    destination: [number, number],
    mode: TransportMode = this.state.activeTransportMode,
    objective: RouteObjective = this.state.activeObjective,
    destinationName: string = 'Destination'
  ): Promise<Route[]> {
    this.state.navigationStatus = 'ROUTING';
    this.state.originCoordinates = origin;
    this.state.destinationCoordinates = destination;
    this.state.activeTransportMode = mode;
    this.state.activeObjective = objective;
    this.state.destinationName = destinationName;

    // Update canonical trip state
    this.state.tripState.origin = {
      id: 'trip_origin',
      name: 'Origin',
      coordinates: origin,
    };
    this.state.tripState.destinations = [
      {
        id: 'trip_destination',
        name: destinationName,
        coordinates: destination,
      },
    ];
    this.state.tripState.transportMode = mode;
    this.state.tripState.status = 'planning';
    this.notify();

    try {
      // 1. Fetch live contextual hazards & environmental data
      const [weather, floodRes] = await Promise.all([
        weatherService.getLiveWeather(destination[1], destination[0]).catch(() => null),
        floodService.assessFloodRisk(destination[1], destination[0]).catch(() => null),
      ]);
      this.state.activeWeather = weather
        ? {
            temperatureC: weather.temperatureCelsius,
            condition: weather.weatherConditionDescription,
            precipitationMm: weather.precipitationMm,
            windSpeedKmh: weather.windSpeedKmh,
            visibilityKm: weather.visibilityMeters / 1000,
            isSevere: weather.isAdverseDrivingCondition,
            description: weather.weatherConditionDescription,
          }
        : null;
      this.state.activeFloodRisk = floodRes ? floodRes.overallLevel : null;

      // 2. Calculate multi-modal corridors
      const routingRes = await routingService.calculateRoutes(origin, destination, {
        profile: mode,
      });
      const corridors = modeService.rankRoutesForMode(routingRes.routes, this.state.userMode);
      this.state.calculatedRoutes = corridors;
      const topRoute = corridors[0] || null;
      this.state.selectedRoute = topRoute;

      // 3. Compute Canonical Journey Cost for selected corridor
      if (topRoute) {
        const costRes = mobilityIntelligenceService.calculateJourneyCost(
          topRoute.distanceKm,
          mode,
          {
            routeSummary: topRoute.summary,
            hasTolls: (topRoute.summary || '').toLowerCase().includes('toll'),
          }
        );
        this.state.tripState.cost = costRes;
        this.state.tripState.route = topRoute;
        this.state.tripState.alternatives = corridors.slice(1);
        this.state.tripState.status = 'ready';
        this.state.tripState.risk = {
          score: topRoute.riskScore,
          level: topRoute.riskLevel,
          hazardsCount: topRoute.hazardCount || 0,
          summary: topRoute.recommendationReason || `${topRoute.riskLevel} risk corridor.`,
        };
      }

      eventBus.publish('ROUTE_CHANGED', { routes: corridors, selectedRoute: this.state.selectedRoute }, {
        source: 'RoadRiskOrchestrator',
        status: 'LIVE',
        updatedAt: new Date().toISOString(),
        freshness: 'LIVE',
        latencyMs: 15,
        confidence: 0.98,
      });

      this.state.navigationStatus = 'IDLE';
      this.notify();
      return corridors;
    } catch (err) {
      this.state.navigationStatus = 'IDLE';
      this.notify();
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // 3. AI TRIP PLANNER INTEGRATION (SECTION 10 - 17)
  // --------------------------------------------------------------------------
  public async planAiTrip(prompt: string, origin?: [number, number]): Promise<Itinerary> {
    const originCoords = origin || this.state.originCoordinates || [80.6480, 16.5062];
    const parsedRequest = aiTripPlannerService.parseNaturalLanguagePrompt(prompt, originCoords);
    const itinerary = await aiTripPlannerService.generateItinerary(parsedRequest);

    // Synchronize canonical trip state
    this.state.tripState.itinerary = itinerary;
    this.state.tripState.destinations = parsedRequest.destinations;
    this.state.tripState.budget = parsedRequest.budget;
    this.state.tripState.transportMode = (parsedRequest.transportPreference && parsedRequest.transportPreference[0]) || 'CAR';
    this.state.tripState.status = 'ready';

    if (itinerary.allStops.length > 0) {
      const firstStop = itinerary.allStops[0];
      this.state.destinationName = firstStop.location.name;
      this.state.destinationCoordinates = firstStop.location.coordinates;
    }

    this.notify();
    return itinerary;
  }

  // --------------------------------------------------------------------------
  // 4. PUBLIC TRANSPORT INTELLIGENCE INTEGRATION (SECTION 18 - 24)
  // --------------------------------------------------------------------------
  public async planPublicTransit(
    origin?: [number, number],
    destination?: [number, number]
  ): Promise<TransitPlan> {
    const orig = origin || this.state.originCoordinates || [80.6200, 16.5185];
    const dest = destination || this.state.destinationCoordinates || [80.7950, 16.5280];

    const transitPlan = await transitService.planPublicTransportRoute(orig, dest);
    this.state.tripState.transit = transitPlan;
    this.state.tripState.transportMode = 'TRANSIT';

    // Update canonical cost from transit plan
    const transitCost = mobilityIntelligenceService.calculateJourneyCost(
      transitPlan.totalWalkingDistanceMeters / 1000 + 15,
      'TRANSIT'
    );
    this.state.tripState.cost = transitCost;
    this.notify();
    return transitPlan;
  }

  // --------------------------------------------------------------------------
  // 5. LOGISTICS & DELIVERY INTELLIGENCE INTEGRATION (SECTION 25 - 34)
  // --------------------------------------------------------------------------
  public planLogisticsDeliveries(
    stops?: DeliveryStop[],
    vehicle?: FleetVehicle
  ): LogisticsPlan {
    const plan = logisticsService.createLogisticsPlan(stops, vehicle);
    this.state.tripState.logistics = plan;
    this.state.tripState.status = 'ready';
    this.notify();
    return plan;
  }

  // --------------------------------------------------------------------------
  // 6. NAVIGATION LIFECYCLE MANAGEMENT
  // --------------------------------------------------------------------------
  public startNavigation(routeId?: string): boolean {
    const targetRoute = (routeId && this.state.calculatedRoutes.find((r) => r.id === routeId)) || this.state.selectedRoute;
    if (!targetRoute) return false;

    this.state.selectedRoute = targetRoute;
    this.state.navigationStatus = 'NAVIGATING';
    this.state.tripState.status = 'navigating';

    const firstManeuver = targetRoute.maneuvers && targetRoute.maneuvers.length > 0 ? targetRoute.maneuvers[0] : undefined;
    navigationVoiceService.startNavigation(this.state.destinationName || targetRoute.name, firstManeuver);

    this.notify();
    return true;
  }

  public stopNavigation(): void {
    this.state.navigationStatus = 'ARRIVED';
    this.state.tripState.status = 'completed';
    navigationVoiceService.announceArrival();
    navigationVoiceService.stopNavigation();
    this.notify();
  }

  // --------------------------------------------------------------------------
  // 7. MOBILITY & COST EVALUATION
  // --------------------------------------------------------------------------
  public getTripCostEstimate(route?: Route): TripCostBreakdown | null {
    const target = route || this.state.selectedRoute;
    if (!target) return null;
    return mobilityIntelligenceService.calculateTripCost(target.distanceKm, this.state.activeTransportMode, {
      hasTolls: (target.summary || target.name || '').toLowerCase().includes('toll'),
      destinationParkingPaid: true,
    });
  }

  public getCanonicalJourneyCost(route?: Route): JourneyCost | null {
    const target = route || this.state.selectedRoute;
    if (!target) return null;
    return mobilityIntelligenceService.calculateJourneyCost(target.distanceKm, this.state.activeTransportMode, {
      routeSummary: target.summary,
      hasTolls: (target.summary || '').toLowerCase().includes('toll'),
      destinationParkingType: 'paid',
    });
  }

  // --------------------------------------------------------------------------
  // 8. INTERNAL EVENT SUBSCRIPTIONS & CORRIDOR DEFENSE
  // --------------------------------------------------------------------------
  private bindInternalEvents() {
    eventBus.subscribe('GPS_UPDATED', (payload) => {
      if (payload.data?.coordinates) {
        this.state.originCoordinates = payload.data.coordinates;
      }
    });

    eventBus.subscribe('ROUTE_INVALIDATED', () => {
      this.triggerDynamicReroute('Critical corridor hazard blocking active path');
    });

    eventBus.subscribe('REROUTE_SUGGESTED', () => {
      this.triggerDynamicReroute('Off-route deviation detected');
    });

    eventBus.subscribe('ROAD_CLOSED', (payload) => {
      if (this.state.navigationStatus === 'NAVIGATING') {
        this.triggerDynamicReroute(`Road closure reported: ${payload.data?.title || 'active hazard'}`);
      }
    });
  }

  private async triggerDynamicReroute(reason: string) {
    if (this.state.navigationStatus !== 'NAVIGATING') return;
    const now = Date.now();
    // 60-second cooldown gate against thrashing
    if (now - this.state.lastRerouteTimestamp < 60000) return;

    const origin = this.state.originCoordinates;
    const dest = this.state.destinationCoordinates;
    if (!origin || !dest) return;

    this.state.lastRerouteTimestamp = now;
    navigationVoiceService.announceOffRoute();

    try {
      const routingRes = await routingService.calculateRoutes(origin, dest, {
        profile: this.state.activeTransportMode,
      });
      const newCorridors = routingRes.routes;
      if (newCorridors.length > 0) {
        this.state.calculatedRoutes = newCorridors;
        this.state.selectedRoute = newCorridors[0];
        navigationVoiceService.announceRerouteConfirmed();
        this.notify();
      }
    } catch (err) {
      console.warn('RoadRiskOrchestrator: Dynamic reroute failed:', err);
    }
  }
}

export const roadRiskOrchestrator = new RoadRiskOrchestrator();
export default roadRiskOrchestrator;
