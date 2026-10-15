// Core Domain Types for RoadRisk AI

export type PortalType = 
  | 'navigation' // Modern Citizen Safety Navigation (Default)
  | 'operator'   // Emergency Dispatch & Mission Command
  | 'authority'  // Road Infrastructure Authority
  | 'fleet'      // Fleet Command
  | 'simulation'
  | 'routing'
  | 'risk_map'
  | 'simulator'
  | 'analytics'
  | 'settings';

export interface UserLocationState {
  coordinates: [number, number] | null; // [lng, lat]
  accuracyMeters: number | null;
  heading: number | null;
  speedKmh: number | null;
  status: 'idle' | 'prompting' | 'granted' | 'low_accuracy' | 'denied' | 'unavailable' | 'stale' | 'lost' | 'recovering' | 'recovered';
  address?: string;
  lastUpdated?: number;
  isSimulated?: boolean;
  error?: string;
  gpsSignalState?: 'INITIALIZING' | 'AVAILABLE' | 'STALE' | 'LOST' | 'RECOVERING' | 'RECOVERED' | 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'LOW_ACCURACY' | 'LOCATING' | 'LIVE';
}

export type NavigationPhase = 
  | 'IDLE' 
  | 'SEARCHING' 
  | 'ROUTE_SELECTED' 
  | 'NAVIGATING' 
  | 'REROUTING' 
  | 'ARRIVED';

export interface NavigationManeuver {
  id: string;
  instruction: string;
  distanceMeters: number;
  type: 'turn-right' | 'turn-left' | 'straight' | 'merge' | 'roundabout' | 'arrive' | 'depart';
  modifier?: string;
  coordinates: [number, number];
}

export interface NearMissEvent {
  id: string;
  vehicleId: string;
  eventType: 'HARD_BRAKE' | 'SUDDEN_SWERVE' | 'ABNORMAL_STOP' | 'SUDDEN_ACCELERATION' | 'ABNORMAL_SLOWDOWN';
  coordinates: [number, number]; // [lng, lat]
  speedBefore: number;
  speedAfter: number;
  timestamp: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  roadSegmentId?: string;
  sourceType: 'SIMULATED' | 'REAL_PROBE';
}

export interface ManualHazardReport {
  id: string;
  category: 'pothole' | 'flooding' | 'accident' | 'road_blockage' | 'construction' | 'poor_visibility';
  title: string;
  description: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  coordinates: [number, number]; // [lng, lat]
  locationName: string;
  reportedBy: string;
  reportedAt: string;
  verified: boolean;
}

export type VehicleCategory = 
  | 'medical' 
  | 'fire_rescue' 
  | 'police' 
  | 'disaster' 
  | 'critical_govt';

export interface VehicleProfile {
  id: string;
  name: string;
  category: VehicleCategory;
  type: string;
  callsign: string;
  weightTons: number;
  widthMeters: number;
  heightMeters: number;
  turningRadiusMeters: number;
  maxSpeedKmh: number;
  emergencyPriority: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'STANDARD';
  roadSuitabilityNotes: string;
  status: 'AVAILABLE' | 'DISPATCHED' | 'EN_ROUTE' | 'HAZARD_ALERT' | 'REROUTING' | 'AT_SCENE' | 'RETURNING' | 'OFFLINE';
  currentLocation: [number, number]; // [lng, lat]
  heading: number; // 0 - 360 degrees
  currentSpeedKmh: number;
  missionId?: string;
  equipmentProfile: string[];
}

export type UrgencyLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export type MissionStatus =
  | 'SETUP'
  | 'DISPATCHED'
  | 'ROUTE_SELECTION'
  | 'EN_ROUTE'
  | 'HAZARD_DETECTED'
  | 'REROUTING'
  | 'ROUTE_UPDATED'
  | 'GREEN_CORRIDOR_ACTIVE'
  | 'ARRIVED'
  | 'COMPLETED';

export interface MissionSetupData {
  id: string;
  vehicleId: string;
  emergencyType: string;
  urgency: UrgencyLevel;
  origin: string;
  originCoords: [number, number];
  destination: string;
  destinationCoords: [number, number] | null;
  notes?: string;
  patientVitals?: string;
  status: MissionStatus;
  startTime?: number;
  completedTime?: number;
  initialEtaMinutes: number;
  selectedRouteId?: string | null;
  timeSavedMinutes: number;
  hazardsEncountered: number;
  rerouteCount: number;
  greenCorridorPasses: number;
  maxRiskIndex: number;
  averageRiskIndex: number;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface RiskFactor {
  name: string;
  contribution: number; // e.g., +15
  description: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
}

export interface RiskSegment {
  id: string;
  name: string;
  coordinates: [number, number][]; // [lng, lat]
  riskScore: number; // 0 - 100
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  roadWidthMeters: number;
  trafficDensity: 'sparse' | 'moderate' | 'heavy' | 'jammed';
  trafficColor?: string; // '#22c55e' (green = free), '#eab308' (yellow = moderate), '#f97316' (orange = heavy), '#ef4444' (red = severe)
  trafficDataSource?: 'LIVE' | 'DEMO' | 'NOT_CONFIGURED';
  hardBrakingCount: number;
  suddenSlowdownsCount: number;
  floodDepthCm: number;
  surfaceCondition: 'dry' | 'wet' | 'flooded' | 'damaged' | 'debris';
  speedLimitKmh: number;
  accessibilityStatus: 'PASSABLE' | 'RESTRICTED_FOR_HEAVY' | 'BLOCKED';
  affectedVehicleTypes: string[];
}

export interface RouteOption {
  id: string;
  name: string;
  summary: string;
  distanceKm: number;
  distanceMeters?: number;
  baseEtaMinutes: number;
  adjustedEtaMinutes: number;
  durationSeconds?: number;
  freeFlowDurationSeconds?: number;
  trafficDelaySeconds?: number;
  departureTime?: string;
  arrivalTime?: string;
  formattedDuration?: string;
  formattedArrivalTime?: string;
  provider?: string;
  riskScore: number; // 0 - 100 aggregate
  riskLevel: RiskLevel;
  missionSuitabilityScore: number; // 0 - 100
  vehicleSuitabilityScore: number; // 0 - 100
  hazardCount: number;
  greenCorridorCompatible: boolean;
  recommendationReason: string;
  isRecommended: boolean;
  segments: RiskSegment[];
  fullCoordinates: [number, number][]; // polyline
  maneuvers?: NavigationManeuver[];
  trafficDataSource?: 'LIVE' | 'DEMO' | 'NOT_CONFIGURED';
  trafficSignalsCount?: number;
  trafficSignals?: Array<{
    id: string;
    name: string;
    coordinates: [number, number];
    distanceAlongRouteMeters: number;
    signalNumber: number;
    intersectionRoad?: string;
  }>;
  nearbyHospitalsCount?: number;
  nearbyHospitals?: Array<{
    id: string;
    name: string;
    coordinates: [number, number];
    distanceMeters?: number;
    distanceFromRouteMeters?: number;
  }>;
  nearbySchoolsCount?: number;
  nearbySchools?: Array<{
    id: string;
    name: string;
    coordinates: [number, number];
    distanceMeters?: number;
    distanceFromRouteMeters?: number;
  }>;
  nearbyPoliceCount?: number;
  majorRoads?: string[];
  safetyBulletPoints?: string[];
  corridorMilestones?: Array<{
    id?: string;
    title: string;
    type: 'source' | 'road' | 'junction' | 'signal' | 'school' | 'hospital' | 'destination';
    detail: string;
    distanceMeters: number;
    icon?: string;
    description?: string;
    distanceAlongRouteKm?: number;
  }>;
  objective?: 'FASTEST' | 'SAFEST' | 'BALANCED';
  travelMode?: 'CAR' | 'BIKE' | 'BICYCLE' | 'WALK' | 'TRANSIT';
  modeNotice?: string;
  riskContributors?: Array<{
    factor: string;
    points: number;
    description: string;
  }>;
}

export type RouteResult = RouteOption;
export type Route = RouteOption;
export type TransportMode = 'CAR' | 'BIKE' | 'BICYCLE' | 'WALK' | 'TRANSIT';
export type RouteObjective = 'FASTEST' | 'SAFEST' | 'BALANCED';
export type GpsSignalState = 'INITIALIZING' | 'AVAILABLE' | 'STALE' | 'LOST' | 'RECOVERING' | 'RECOVERED' | 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'LOW_ACCURACY' | 'LOCATING' | 'LIVE';
export type FloodRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface Incident {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  coordinates: [number, number];
  locationName?: string;
  reportedAt?: string;
  expiresAt?: string;
  verified?: boolean;
  sourceType?: 'SIMULATED' | 'REAL_PROBE' | 'LIVE_FEED' | 'USER_REPORTED';
}

export interface WeatherCondition {
  temperatureC: number;
  condition: string;
  precipitationMm: number;
  windSpeedKmh: number;
  visibilityKm: number;
  isSevere: boolean;
  description: string;
}

export interface NavigationSession {
  origin: { name: string; coordinates: [number, number] };
  destination: { name: string; coordinates: [number, number] } | null;
  departureTime: Date;
  selectedMode: 'CAR' | 'BIKE' | 'BICYCLE' | 'WALK' | 'TRANSIT';
  selectedRouteId: string | null;
  routesByMode: Partial<Record<'CAR' | 'BIKE' | 'BICYCLE' | 'WALK' | 'TRANSIT', RouteOption[]>>;
  activeRoute: RouteOption | null;
  navigationState: 'IDLE' | 'SEARCHING' | 'ROUTE_SELECTED' | 'NAVIGATING' | 'REROUTING' | 'ARRIVED';
  voiceMuted: boolean;
  voiceLanguage: string;
}


export interface HazardAlert {
  id: string;
  type: 'BRAKING_CLUSTER' | 'SUDDEN_SLOWDOWN' | 'FLOOD_RISK' | 'ROAD_BLOCKAGE' | 'ACCIDENT_AHEAD' | 'WIDTH_BOTTLENECK';
  title: string;
  severity: 'warning' | 'high' | 'critical';
  locationName: string;
  coordinates: [number, number];
  riskImpactPoints: number;
  detectedAt: string;
  expiresAt?: string;
  description: string;
  affectedRouteIds: string[];
  recommendedAction: string;
  active: boolean;
}

export interface GreenCorridorSignal {
  id: string;
  intersectionName: string;
  coordinates: [number, number];
  distanceFromVehicleM: number;
  state: 'STANDBY' | 'REQUEST_SENT' | 'PREPARING_YELLOW' | 'GREEN_LOCKED' | 'CLEARED';
  timeUntilGreenSec: number;
}

export interface GreenCorridorStatus {
  active: boolean;
  totalSignals: number;
  greenLockedSignals: number;
  timeSavedSeconds: number;
  signals: GreenCorridorSignal[];
}

export interface AuthorityHotspot {
  id: string;
  junctionName: string;
  coordinates: [number, number];
  riskScore: number; // 0 - 100
  riskLevel: RiskLevel;
  category: string;
  nearMissCountWeekly: number;
  hardBrakingFrequency: number;
  suddenSlowdownEvents: number;
  peakRiskTime: string;
  primaryContributingFactors: string[];
  investigationRecommendation: string;
  roadCharacteristics: {
    lanes: number;
    widthMeters: number;
    sightlineObstruction: boolean;
    drainageQuality: 'good' | 'fair' | 'poor';
  };
}

export interface NavigationTelemetry {
  currentCoordinates: [number, number];
  speedKmh: number;
  headingDegrees: number;
  distanceRemainingKm: number;
  etaRemainingMinutes: number;
  progressFraction: number; // 0.0 to 1.0
  currentSegmentIndex: number;
  currentSegmentRisk: number;
  nextManeuver: {
    type: 'turn_left' | 'turn_right' | 'straight' | 'merge' | 'uturn' | 'destination';
    instruction: string;
    distanceToMeters: number;
  };
}

export interface DebriefReport {
  missionId: string;
  vehicleCallsign: string;
  emergencyType: string;
  totalDurationMinutes: number;
  plannedEtaMinutes: number;
  actualArrivalMinutes: number;
  timeSavedMinutes: number;
  distanceTraveledKm: number;
  averageRiskIndex: number;
  maxRiskIndex: number;
  riskPointsAvoided: number;
  hazardsDetectedCount: number;
  reroutesExecutedCount: number;
  greenCorridorEfficiencyPct: number;
  timeline: {
    timestamp: string;
    event: string;
    type: 'info' | 'hazard' | 'reroute' | 'green_corridor' | 'complete';
  }[];
}

export interface DispatchLocation {
  id: string;
  name: string;
  label: string;
  city: string;
  type: 'origin' | 'destination';
  coords: [number, number];
}

export interface CityPreset {
  id: string;
  name: string;
  stateCountry: string;
  center: [number, number];
  defaultZoom: number;
  origins: DispatchLocation[];
  destinations: DispatchLocation[];
  routes: RouteOption[];
  hazards: HazardAlert[];
  signals: GreenCorridorSignal[];
}

export * from './mobility.ts';
export * from './modes.ts';

