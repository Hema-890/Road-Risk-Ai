// ==============================================================================
// ROADRISK AI — UNIFIED USER MODES DATA ARCHITECTURE
// Standardized schemas for:
// 1. Accessibility Mode (♿)
// 2. Campus Mode (🎓)
// 3. Tourist Mode (🧳)
// 4. Standard Mode (🗺)
// Guarantees SINGLE UNIFIED ARCHITECTURE across Search, Routing, Risk, POI, Voice,
// Map Layers, Copilot, and Real-Time Events.
// ==============================================================================

import type { TransportMode, RiskLevel, RouteOption } from './index.ts';

export type RoadRiskMode = 'STANDARD' | 'ACCESSIBILITY' | 'CAMPUS' | 'TOURIST';

// -----------------------------------------------------------------------------
// 1. ACCESSIBILITY MODE SCHEMAS
// -----------------------------------------------------------------------------

export interface AccessibilityPreferences {
  wheelchairUser: boolean;
  avoidStairs: boolean;
  preferElevators: boolean;
  accessibleEntrancesOnly: boolean;
  accessibleParkingRequired: boolean;
  accessibleToiletsRequired: boolean;
  stepFreeRoute: boolean;
  lowGradientRequired: boolean;
  maxGradientPct: number; // e.g. 5% max slope for manual/power wheelchair
  saferPedestrianCrossings: boolean;
  audioGuidance: boolean;
  highContrastUI: boolean;
  largeControls: boolean;
  reducedMotion: boolean;
  simplifiedNavigationInterface: boolean;
}

export type AccessibilityVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'UNAVAILABLE';

export interface AccessibleFeature {
  id: string;
  type: 'entrance' | 'ramp' | 'elevator' | 'restroom' | 'parking' | 'crossing' | 'stairs';
  name: string;
  coordinates: [number, number]; // [lng, lat]
  status: AccessibilityVerificationStatus;
  notes?: string;
  hasAutomaticDoor?: boolean;
  hasBraille?: boolean;
  hasAudioBeacons?: boolean;
  slopeGradientPct?: number;
  widthCm?: number;
}

export interface RouteAccessibilityScore {
  isStepFree: boolean;
  stairsDetectedCount: number;
  elevatorsAvailableCount: number;
  rampsAvailableCount: number;
  maxSlopeGradientPct: number;
  accessibleEntranceVerified: boolean;
  curbCutsAvailable: boolean;
  tactilePavingPresent: boolean;
  accessibilityConfidence: number; // 0.0 to 1.0
  verificationStatus: AccessibilityVerificationStatus;
  accessibilityPenaltyScore: number; // Lower is more accessible
  summary: string;
}

// -----------------------------------------------------------------------------
// 2. CAMPUS MODE SCHEMAS
// -----------------------------------------------------------------------------

export type CampusPOICategory =
  | 'department'
  | 'classroom'
  | 'laboratory'
  | 'library'
  | 'hostel'
  | 'cafeteria'
  | 'parking'
  | 'restroom'
  | 'medical_center'
  | 'security'
  | 'bus_stop'
  | 'sports_facility'
  | 'auditorium'
  | 'administrative_office'
  | 'gate';

export interface CampusEntrance {
  id: string;
  name: string;
  coordinates: [number, number];
  isVehicleAccessible: boolean;
  isPedestrianAccessible: boolean;
  isWheelchairAccessible: boolean;
  gatesSchedule?: string;
}

export interface CampusEmergencyContact {
  role: 'Security Control' | 'Health Center / Ambulance' | 'Fire Safety' | 'Dean Student Welfare';
  phone: string;
  locationName: string;
  coordinates?: [number, number];
}

export interface Campus {
  id: string;
  name: string;
  shortName: string;
  city: string;
  centerCoordinates: [number, number]; // [lng, lat]
  defaultZoom: number;
  boundaries?: [number, number][]; // Polygon geometry
  entrances: CampusEntrance[];
  emergencyContacts: CampusEmergencyContact[];
  transitSupported: boolean;
  transitNotes?: string;
}

export interface BuildingEntrance {
  id: string;
  name: string;
  coordinates: [number, number];
  isMainEntrance: boolean;
  isWheelchairAccessible: boolean;
  hasRamp: boolean;
  hasElevatorNearby: boolean;
  doorType?: 'automatic' | 'manual' | 'revolving';
}

export interface CampusBuilding {
  id: string;
  campusId: string;
  name: string;
  code: string;
  category: 'academic' | 'administrative' | 'residential' | 'amenity' | 'sports' | 'medical';
  coordinates: [number, number]; // Center / main coordinate
  polygon?: [number, number][]; // Footprint
  floorsCount: number;
  entrances: BuildingEntrance[];
  departments: string[];
  accessibilityVerified: boolean;
  notes?: string;
}

export interface CampusPOI {
  id: string;
  campusId: string;
  buildingId?: string;
  buildingName?: string;
  name: string;
  code?: string;
  category: CampusPOICategory;
  floor?: number | string;
  coordinates: [number, number];
  isAccessible: boolean;
  accessibilityNotes?: string;
  contactPhone?: string;
  operatingHours?: string;
  tags?: string[];
}

export interface CampusPath {
  id: string;
  campusId: string;
  name: string;
  type: 'walking_path' | 'internal_road' | 'restricted_path' | 'accessible_path' | 'stairs' | 'ramp';
  coordinates: [number, number][];
  isAccessible: boolean;
  isCovered: boolean;
  surfaceType: 'asphalt' | 'concrete' | 'paver' | 'gravel' | 'grass';
  isBlocked: boolean;
  blockageReason?: string;
}

export interface CampusEvent {
  id: string;
  campusId: string;
  title: string;
  description: string;
  type: 'path_closure' | 'construction' | 'seminar' | 'emergency' | 'sports' | 'crowd';
  coordinates: [number, number];
  radiusMeters: number;
  startTime: string;
  endTime?: string;
  isTemporaryClosure: boolean;
  affectsPedestrians: boolean;
  affectsVehicles: boolean;
}

export interface CampusPreferences {
  activeCampusId: string | null;
  preferPedestrianPaths: boolean;
  avoidConstructionZones: boolean;
  showEmergencyFacilitiesOnly: boolean;
}

// -----------------------------------------------------------------------------
// 3. TOURIST MODE SCHEMAS
// -----------------------------------------------------------------------------

export type TouristTravelerType =
  | 'solo'
  | 'family'
  | 'student'
  | 'business'
  | 'photography'
  | 'food'
  | 'religious'
  | 'culture'
  | 'budget'
  | 'sightseeing';

export interface TouristPreferences {
  travelerType: TouristTravelerType;
  budgetInr: number;
  durationDays: number;
  transportMode: TransportMode;
  preferredCategories: string[];
  maxWalkingDistanceKm: number;
  riskTolerance: 'low' | 'balanced' | 'high';
  language: string;
  activeCategoryFilter: string[];
}

export interface TouristAttraction {
  id: string;
  name: string;
  city: string;
  category: 'heritage' | 'sightseeing' | 'culture' | 'food' | 'nature' | 'religious' | 'photography' | 'shopping';
  coordinates: [number, number];
  address: string;
  description: string;
  recommendedDurationMinutes: number;
  entryFeeInr: number;
  isEntryFeeVerified: boolean;
  openingHours?: string;
  isOpeningHoursVerified: boolean;
  rating: number; // 0 - 5
  bestTimeToVisit?: string;
  accessibilityStatus: AccessibilityVerificationStatus;
  wheelchairAccessible: boolean;
  parkingAvailable: boolean;
  tags: string[];
}

// -----------------------------------------------------------------------------
// 4. UNIFIED MODE CONFIGURATION & MAP LAYERS
// -----------------------------------------------------------------------------

export interface ModeMapLayersConfig {
  showAccessibleEntrances: boolean;
  showAccessibleParking: boolean;
  showElevatorsAndRamps: boolean;
  showStairsIndicators: boolean;
  showCampusBuildings: boolean;
  showCampusPaths: boolean;
  showCampusEmergency: boolean;
  showCampusPOIs: boolean;
  showTouristAttractions: boolean;
  showTouristCategoryFilter: boolean;
}

export interface ModeRouteConstraints {
  avoidStairs: boolean;
  requireStepFree: boolean;
  maxSlopeGradientPct?: number;
  preferCampusPedestrianPaths: boolean;
  campusId?: string;
  budgetLimitInr?: number;
  preferScenicTouristCorridors: boolean;
  accessibilityWeight: number; // Weight in route ranking
}

export interface ModeConfiguration {
  mode: RoadRiskMode;
  routeConstraints: ModeRouteConstraints;
  preferredPOIs: string[];
  avoidedFeatures: string[];
  mapLayers: ModeMapLayersConfig;
  accessibilityPreferences: AccessibilityPreferences;
  campusPreferences: CampusPreferences;
  touristPreferences: TouristPreferences;
}

// Default initial state
export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  wheelchairUser: false,
  avoidStairs: true,
  preferElevators: true,
  accessibleEntrancesOnly: false,
  accessibleParkingRequired: false,
  accessibleToiletsRequired: false,
  stepFreeRoute: false,
  lowGradientRequired: false,
  maxGradientPct: 6,
  saferPedestrianCrossings: true,
  audioGuidance: true,
  highContrastUI: false,
  largeControls: false,
  reducedMotion: false,
  simplifiedNavigationInterface: false,
};

export const DEFAULT_CAMPUS_PREFERENCES: CampusPreferences = {
  activeCampusId: 'iit_hyderabad',
  preferPedestrianPaths: true,
  avoidConstructionZones: true,
  showEmergencyFacilitiesOnly: false,
};

export const DEFAULT_TOURIST_PREFERENCES: TouristPreferences = {
  travelerType: 'sightseeing',
  budgetInr: 2500,
  durationDays: 1,
  transportMode: 'CAR',
  preferredCategories: ['heritage', 'culture', 'food', 'sightseeing'],
  maxWalkingDistanceKm: 3.5,
  riskTolerance: 'balanced',
  language: 'en',
  activeCategoryFilter: ['heritage', 'culture', 'food', 'sightseeing'],
};
