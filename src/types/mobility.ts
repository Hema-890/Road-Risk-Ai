// ==============================================================================
// ROADRISK AI — MOBILITY, TRIP PLANNER, TRANSIT & LOGISTICS CANONICAL TYPES
// Standardized data models for Cost Intelligence, AI Trip Planner,
// Public Transport (GTFS/GTFS-RT), and Fleet Logistics Optimization.
// ==============================================================================

import type { RouteOption, TransportMode, RiskLevel, NavigationManeuver } from './index.ts';

// -----------------------------------------------------------------------------
// 1. COST INTELLIGENCE TYPES
// -----------------------------------------------------------------------------

export interface CostEstimate {
  amount: number;
  currency: 'INR';
  source: string;
  isEstimate: boolean;
  confidence?: number;
  lastUpdated?: string;
}

export interface UserVehicleProfile {
  id: string;
  name: string;
  vehicleType: 'car' | 'motorcycle' | 'scooter' | 'ev' | 'bicycle' | 'walk' | 'transit';
  fuelType: 'petrol' | 'diesel' | 'cng' | 'electric' | 'none';
  efficiencyKmPerUnit: number; // km/L or km/kWh
  unitCostInr: number; // ₹/L or ₹/kWh
  tankOrBatteryCapacity: number; // Liters or kWh
  tollTagActive: boolean;
}

export interface JourneyCost {
  totalCost: CostEstimate;
  fuelCost: CostEstimate;
  tollCost: CostEstimate;
  parkingCost: CostEstimate;
  transitCost: CostEstimate;
  chargingCost: CostEstimate;
  driverCost?: CostEstimate;
  otherExpenses?: CostEstimate;
  fuelLitersUsed?: number;
  electricityKwhUsed?: number;
  co2EmissionsKg: number;
  costPerKm: number;
  disclaimer: string;
  provenance: {
    fuelPriceSource: string;
    tollDataSource: 'PROVIDER' | 'ESTIMATED' | 'UNAVAILABLE' | 'FREE';
    parkingDataSource: 'VERIFIED' | 'ESTIMATED' | 'FREE';
    transitFareSource: 'GTFS_STATIC' | 'MUNICIPAL_STANDARD' | 'UNAVAILABLE';
    lastCalculated: string;
  };
}

export interface ModeComparisonItem {
  mode: TransportMode;
  label: string;
  durationMinutes: number;
  distanceKm: number;
  estimatedCostInr: number;
  riskScore: number; // 0 - 100
  co2Kg: number;
  trafficDelayMinutes: number;
  tradeoffSummary: string;
  isRecommended?: boolean;
}

// -----------------------------------------------------------------------------
// 2. AI TRIP PLANNER TYPES
// -----------------------------------------------------------------------------

export interface TripLocation {
  id: string;
  name: string;
  address?: string;
  coordinates: [number, number]; // [lng, lat]
  category?: string;
  targetArrivalTime?: string;
  durationMinutes?: number;
  estimatedCostInr?: number;
  notes?: string;
}

export interface TripPlanRequest {
  origin?: TripLocation;
  destinations: TripLocation[];
  startDate?: string;
  endDate?: string;
  departureTime?: string;
  returnTime?: string;
  budget?: number;
  currency: 'INR';
  travelers?: number;
  transportPreference?: TransportMode[];
  interests?: string[];
  dietaryPreferences?: string[];
  accessibilityRequirements?: string[];
  safetyPreference?: number; // 0 = fastest, 50 = balanced, 100 = safest
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  maxDrivingTimeMinutes?: number;
  isRoundTrip?: boolean;
}

export interface ItineraryStop {
  id: string;
  sequenceIndex: number;
  location: TripLocation;
  plannedArrivalTime: string;
  plannedDepartureTime: string;
  durationMinutes: number;
  activity: string;
  costInr: number;
  riskLevel: RiskLevel;
  riskScore: number;
  travelFromPrevious?: {
    mode: TransportMode;
    durationMinutes: number;
    distanceKm: number;
    costInr: number;
    riskScore: number;
    polyline?: [number, number][];
    summary: string;
    maneuvers?: NavigationManeuver[];
  };
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  summary: string;
  stops: ItineraryStop[];
  totalCostInr: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
}

export interface Itinerary {
  id: string;
  title: string;
  overview: string;
  days: ItineraryDay[];
  totalEstimatedCostInr: number;
  budgetLimitInr?: number;
  budgetSatisfied: boolean;
  budgetRemainingInr?: number;
  currency: 'INR';
  overallRiskScore: number;
  recommendations: string[];
  allStops: ItineraryStop[];
  heuristicOptimizationApplied?: 'NONE' | 'SHORTEST' | 'FASTEST' | 'CHEAPEST' | 'SAFEST' | 'BALANCED';
}

// -----------------------------------------------------------------------------
// 3. PUBLIC TRANSPORT (GTFS / GTFS-RT) INTELLIGENCE TYPES
// -----------------------------------------------------------------------------

export interface TransitLeg {
  type: 'WALK' | 'TRANSIT';
  transitType?: 'bus' | 'metro' | 'train' | 'tram' | 'ferry';
  routeShortName?: string;
  routeLongName?: string;
  routeColor?: string;
  headsign?: string;
  agencyName?: string;
  fromStopName: string;
  toStopName: string;
  fromCoordinates: [number, number];
  toCoordinates: [number, number];
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  distanceMeters: number;
  stopsCount?: number;
  fareInr?: number;
  polyline: [number, number][];
  isRealtime: boolean;
  roadRiskScore: number;
  safetyAdvisories?: string[];
}

export interface TransitPlan {
  id: string;
  originName: string;
  destinationName: string;
  totalDurationMinutes: number;
  totalWalkingDistanceMeters: number;
  totalFareInr: number;
  departureTime: string;
  arrivalTime: string;
  legs: TransitLeg[];
  transfersCount: number;
  hasTightTransfer: boolean;
  tightTransferWarning?: string;
  scheduleProvenance: 'GTFS_STATIC' | 'GTFS_REALTIME' | 'MUNICIPAL_ESTIMATE';
  summary: string;
}

// -----------------------------------------------------------------------------
// 4. LOGISTICS & DELIVERY INTELLIGENCE TYPES
// -----------------------------------------------------------------------------

export type DeliveryPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type DeliveryStatus = 'pending' | 'active' | 'completed' | 'failed' | 'skipped';

export interface DeliveryStop {
  id: string;
  customerName: string;
  address: string;
  location: {
    name: string;
    coordinates: [number, number]; // [lng, lat]
  };
  priority: DeliveryPriority;
  timeWindowStart?: string; // HH:MM
  timeWindowEnd?: string; // HH:MM
  serviceMinutes: number;
  packageWeightKg?: number;
  packageVolumeM3?: number;
  packageDescription?: string;
  status: DeliveryStatus;
  eta?: string;
  actualArrivalTime?: string;
  distanceFromPreviousKm?: number;
  estimatedCostInr?: number;
  riskScore?: number;
  riskExplanation?: string;
  failureReason?: string;
}

export interface FleetVehicle {
  id: string;
  name: string;
  type: 'van' | 'motorcycle' | 'electric_truck' | 'scooter';
  capacityWeightKg: number;
  capacityVolumeM3: number;
  currentLoadWeightKg: number;
  currentLoadVolumeM3: number;
  fuelType: 'diesel' | 'petrol' | 'ev' | 'cng';
  efficiencyKmPerUnit: number;
  currentLocation: [number, number];
  status: 'idle' | 'en_route' | 'delayed' | 'completed';
  driverName?: string;
  driverPhone?: string;
}

export interface LogisticsPlan {
  id: string;
  depotLocation: {
    name: string;
    coordinates: [number, number];
  };
  assignedVehicle: FleetVehicle;
  stops: DeliveryStop[];
  currentStopIndex: number;
  totalStops: number;
  completedStops: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  totalCostInr: number;
  costPerStopInr: number;
  costPerKmInr: number;
  overallRiskScore: number;
  optimizationObjective: 'MIN_DISTANCE' | 'MIN_TIME' | 'MIN_COST' | 'SAFEST' | 'PRIORITY_AWARE' | 'TIME_WINDOW';
  activeRoutePolyline: [number, number][];
  rerouteCount: number;
  lastRerouteReason?: string;
  status: 'planning' | 'en_route' | 'paused' | 'completed';
}

// -----------------------------------------------------------------------------
// 5. SHARED CANONICAL TRIP STATE (SECTION 38)
// -----------------------------------------------------------------------------

export interface RoadRiskTripState {
  origin: TripLocation;
  destinations: TripLocation[];
  waypoints: TripLocation[];
  transportMode: TransportMode;
  departureTime?: string;
  targetArrivalTime?: string;
  budget?: number;
  route?: RouteOption;
  alternatives?: RouteOption[];
  cost?: JourneyCost;
  transit?: TransitPlan;
  logistics?: LogisticsPlan;
  risk?: {
    score: number;
    level: RiskLevel;
    hazardsCount: number;
    summary: string;
  };
  traffic?: {
    delaySeconds: number;
    density: 'sparse' | 'moderate' | 'heavy' | 'jammed';
    congestionSummary: string;
  };
  itinerary?: Itinerary;
  status: 'planning' | 'ready' | 'navigating' | 'replanning' | 'completed';
}
