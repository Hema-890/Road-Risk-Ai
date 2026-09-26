// Centralized Event Bus & Realtime Payload Types for RoadRisk AI
// Prevents different services from inventing incompatible event structures

export type EventType =
  | 'TELEMETRY_UPDATED'
  | 'HAZARD_CREATED'
  | 'HAZARD_UPDATED'
  | 'RISK_UPDATED'
  | 'MISSION_STATE_CHANGED'
  | 'ROUTE_CHANGED'
  | 'REROUTE_STARTED'
  | 'REROUTE_COMPLETED'
  | 'MISSION_COMPLETED'
  | 'CRITICAL_INCIDENT';

export interface BaseEvent {
  eventId: string;
  eventType: EventType;
  timestamp: string; // ISO-8601 UTC
  isSimulation: boolean;
}

export interface TelemetryEvent extends BaseEvent {
  eventType: 'TELEMETRY_UPDATED';
  vehicleId: string;
  missionId: string | null;
  latitude: number;
  longitude: number;
  heading: number;
  speedKmh: number;
  accuracy?: number;
  source: 'gps' | 'simulation' | 'sensor_probe';
}

export interface HazardEvent extends BaseEvent {
  eventType: 'HAZARD_CREATED' | 'HAZARD_UPDATED';
  hazardId: string;
  category: string;
  title: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  latitude: number;
  longitude: number;
  locationName: string;
  description?: string;
  affectedRouteIds: string[];
}

export interface RiskEvent extends BaseEvent {
  eventType: 'RISK_UPDATED';
  missionId: string;
  routeId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  factors: Array<{
    name: string;
    contribution: number;
    severity: 'low' | 'moderate' | 'high' | 'critical';
    description: string;
  }>;
}

export interface RerouteEvent extends BaseEvent {
  eventType: 'REROUTE_STARTED' | 'REROUTE_COMPLETED';
  missionId: string;
  oldRouteId: string;
  newRouteId: string;
  reason: string;
  triggerHazardId?: string;
  oldRisk: number;
  newRisk: number;
  currentPosition: [number, number]; // [lng, lat]
}

export interface MissionStateEvent extends BaseEvent {
  eventType: 'MISSION_STATE_CHANGED' | 'MISSION_COMPLETED';
  missionId: string;
  vehicleId?: string;
  previousState: string;
  newState: string;
  activeRouteId?: string;
}

export interface CriticalIncidentEvent extends BaseEvent {
  eventType: 'CRITICAL_INCIDENT';
  incidentId: string;
  title: string;
  description: string;
  severity: 'critical';
  location: [number, number];
  missionId?: string;
}

export type RoadRiskEvent =
  | TelemetryEvent
  | HazardEvent
  | RiskEvent
  | RerouteEvent
  | MissionStateEvent
  | CriticalIncidentEvent;

export interface NotificationPayload {
  id?: string;
  title: string;
  body: string;
  type?: 'CRITICAL_HAZARD' | 'ROUTE_REROUTED' | 'MISSION_STATUS' | 'DESTINATION_REACHED' | 'SYSTEM_ALERT' | string;
  severity: 'critical' | 'high' | 'normal' | 'CRITICAL' | 'HIGH' | 'NORMAL';
  missionId?: string;
  mission_id?: string;
  event_type?: string;
  event_id?: string;
  timestamp: string | number;
  deepLink?: string;
  deduplicationKey?: string;
  data?: Record<string, any>;
}

