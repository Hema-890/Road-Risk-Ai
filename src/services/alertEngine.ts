// ==============================================================================
// ROADRISK AI — CENTRALIZED REAL-TIME ALERT PIPELINE ENGINE
// Implements the full pipeline:
// DATA EVENT -> VALIDATION -> RELEVANCE CHECK -> DISTANCE CHECK
// -> ROUTE INTERSECTION -> SEVERITY -> DEDUPLICATION -> COOLDOWN -> DISPATCH
// ==============================================================================

import type { DataProvenance } from '../types/dataStatus.ts';
import { eventBus } from './eventBus.ts';
import { voiceAlertService } from './voiceAlertService.ts';
import { calculateDistanceMeters } from '../utils/geoUtils.ts';

export type AlertType =
  | 'TRAFFIC'
  | 'ACCIDENT'
  | 'CONSTRUCTION'
  | 'FLOOD'
  | 'ROAD_CLOSED'
  | 'HIGH_RISK'
  | 'EMERGENCY_VEHICLE'
  | 'ROUTE_UPDATED'
  | 'WEATHER'
  | 'GPS_LOW_ACCURACY'
  | 'OFFLINE'
  | 'OFFLINE_ROUTING';

export type AlertUrgency = 'CRITICAL' | 'IMMEDIATE' | 'IMPORTANT' | 'EARLY_WARNING' | 'INFO';

export interface ActiveSafetyAlert {
  id: string;
  type: AlertType;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  urgency: AlertUrgency;
  urgencyLevel?: AlertUrgency;
  title: string;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
    roadName?: string;
  };
  distanceMeters?: number;
  estimatedDelayMinutes?: number;
  createdAt: string;   // ISO-8601
  expiresAt: string;   // ISO-8601
  isExpired: boolean;
  provenance: DataProvenance;
}

export interface PipelineEvaluationContext {
  userLocation?: [number, number]; // [lng, lat]
  userSpeedKmh?: number;
  userHeading?: number;
  routeGeometry?: [number, number][]; // [lng, lat][]
}

class AlertEngine {
  private activeAlerts: Map<string, ActiveSafetyAlert> = new Map();
  private lastAlertedTimes: Map<string, number> = new Map(); // alertKey -> timestamp
  private readonly ALERT_COOLDOWN_MS = 60_000; // 60s cooldown per unique hazard event
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startLifecycleSweeper();
  }

  /**
   * Main Alert Pipeline Entrypoint
   * Ingests any data event and evaluates whether an alert should be raised to the driver
   */
  public processPipelineAlert(
    rawAlert: {
      id: string;
      type: AlertType;
      severity: 'low' | 'moderate' | 'high' | 'critical';
      title: string;
      description: string;
      latitude?: number;
      longitude?: number;
      roadName?: string;
      estimatedDelayMinutes?: number;
      ttlSeconds?: number;
      provenance?: DataProvenance;
    },
    context: PipelineEvaluationContext = {}
  ): ActiveSafetyAlert | null {
    const now = Date.now();
    const alertKey = `${rawAlert.type}_${rawAlert.id}`;

    // 1. DEDUPLICATION & COOLDOWN CHECK
    const lastAlerted = this.lastAlertedTimes.get(alertKey);
    if (lastAlerted && now - lastAlerted < this.ALERT_COOLDOWN_MS) {
      return null; // Suppress duplicate alert during cooldown
    }

    // 2. DISTANCE & RELEVANCE CHECK
    let distanceMeters: number | undefined;
    let urgency: AlertUrgency = 'INFO';

    if (rawAlert.latitude !== undefined && rawAlert.longitude !== undefined && context.userLocation) {
      distanceMeters = Math.round(
        calculateDistanceMeters(context.userLocation, [rawAlert.longitude, rawAlert.latitude])
      );

      // Relevance gate: discard events farther than 5km unless critical road closure or emergency vehicle
      if (distanceMeters > 5000 && rawAlert.severity !== 'critical' && rawAlert.type !== 'EMERGENCY_VEHICLE') {
        return null;
      }

      // Distance Levels:
      // <100m -> CRITICAL
      // 100-500m -> IMMEDIATE
      // 500m-1km -> IMPORTANT
      // 1-2km -> EARLY_WARNING
      // >2km -> INFO
      if (distanceMeters < 100) {
        urgency = 'CRITICAL';
      } else if (distanceMeters <= 500) {
        urgency = 'IMMEDIATE';
      } else if (distanceMeters <= 1000) {
        urgency = 'IMPORTANT';
      } else if (distanceMeters <= 2000) {
        urgency = 'EARLY_WARNING';
      } else {
        urgency = 'INFO';
      }

      // Route Corridor relevance check if route is active
      if (context.routeGeometry && context.routeGeometry.length > 0) {
        const isNearRoute = this.isCoordNearRoute(
          [rawAlert.longitude, rawAlert.latitude],
          context.routeGeometry,
          150 // 150m buffer off corridor
        );
        if (!isNearRoute && distanceMeters > 800) {
          return null; // Ignore off-corridor hazards beyond immediate visual range
        }
      }
    } else {
      // System-level alerts (offline mode, GPS degraded)
      if (rawAlert.severity === 'critical') urgency = 'CRITICAL';
      else if (rawAlert.severity === 'high') urgency = 'IMMEDIATE';
      else urgency = 'IMPORTANT';
    }

    // 3. ASSEMBLE ACTIVE ALERT
    const ttlMs = (rawAlert.ttlSeconds || 300) * 1000;
    const alert: ActiveSafetyAlert = {
      id: rawAlert.id,
      type: rawAlert.type,
      severity: rawAlert.severity,
      urgency,
      urgencyLevel: urgency,
      title: rawAlert.title,
      description: rawAlert.description,
      location: rawAlert.latitude !== undefined && rawAlert.longitude !== undefined ? {
        latitude: rawAlert.latitude,
        longitude: rawAlert.longitude,
        roadName: rawAlert.roadName,
      } : undefined,
      distanceMeters,
      estimatedDelayMinutes: rawAlert.estimatedDelayMinutes,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      isExpired: false,
      provenance: rawAlert.provenance || {
        source: 'RoadRisk AI Central Alert Engine',
        status: 'LIVE',
        updatedAt: new Date().toISOString(),
        freshness: 'LIVE',
      },
    };

    this.activeAlerts.set(alert.id, alert);
    this.lastAlertedTimes.set(alertKey, now);

    // 4. DISPATCH MULTILINGUAL VOICE & VISUAL NOTIFICATION
    this.dispatchVoice(alert);
    eventBus.emit('SAFETY_ALERT_TRIGGERED', alert);

    return alert;
  }

  /**
   * Processes an incoming raw data event through the central pipeline
   */
  public processDataEvent(event: {
    id: string;
    type: string;
    source?: string;
    latitude?: number;
    longitude?: number;
    severity?: string;
    title: string;
    description?: string;
    roadName?: string;
    userCoordinates?: [number, number];
  }): ActiveSafetyAlert | null {
    let alertType: AlertType = 'ACCIDENT';
    if (event.type === 'INCIDENT') alertType = 'ACCIDENT';
    else if (event.type === 'CONSTRUCTION') alertType = 'CONSTRUCTION';
    else if (event.type === 'FLOOD') alertType = 'FLOOD';
    else if (event.type === 'CLOSURE' || event.type === 'ROAD_CLOSED') alertType = 'ROAD_CLOSED';
    else if (event.type === 'TRAFFIC') alertType = 'TRAFFIC';
    else if (event.type === 'WEATHER') alertType = 'WEATHER';
    else if (event.type === 'EMERGENCY') alertType = 'EMERGENCY_VEHICLE';

    // Relevance distance filter: discard non-critical events farther than 2km (2000m)
    if (event.latitude !== undefined && event.longitude !== undefined && event.userCoordinates) {
      const dist = calculateDistanceMeters(event.userCoordinates, [event.longitude, event.latitude]);
      if (dist > 2000 && event.severity !== 'critical') {
        return null;
      }
    }

    return this.processPipelineAlert(
      {
        id: event.id,
        type: alertType,
        severity: (event.severity as any) || 'moderate',
        title: event.title,
        description: event.description || event.title,
        latitude: event.latitude,
        longitude: event.longitude,
        roadName: event.roadName,
        provenance: {
          source: (event.source as any) || 'TomTom',
          status: 'LIVE',
          updatedAt: new Date().toISOString(),
          freshness: 'LIVE',
        },
      },
      {
        userLocation: event.userCoordinates,
      }
    );
  }

  /**
   * Translates safety alert to voice synthesis
   */
  private dispatchVoice(alert: ActiveSafetyAlert) {
    if (alert.severity !== 'critical' && alert.severity !== 'high' && alert.urgency !== 'CRITICAL' && alert.urgency !== 'IMMEDIATE') {
      return;
    }

    const dist = alert.distanceMeters;
    const road = alert.location?.roadName;

    switch (alert.type) {
      case 'ACCIDENT':
        voiceAlertService.dispatchVoiceAlert({
          templateKey: 'ACCIDENT_AHEAD',
          params: { distanceMeters: dist, roadName: road },
        });
        break;
      case 'ROAD_CLOSED':
        voiceAlertService.dispatchVoiceAlert({
          templateKey: 'ROAD_CLOSED_DETOUR',
          params: { distanceMeters: dist },
        });
        break;
      case 'FLOOD':
        voiceAlertService.dispatchVoiceAlert({
          templateKey: 'FLOODING_AHEAD',
          params: { distanceMeters: dist, delayMinutes: alert.estimatedDelayMinutes },
        });
        break;
      case 'TRAFFIC':
        voiceAlertService.dispatchVoiceAlert({
          templateKey: 'HEAVY_CONGESTION',
          params: { delayMinutes: alert.estimatedDelayMinutes },
        });
        break;
      case 'EMERGENCY_VEHICLE':
        voiceAlertService.dispatchVoiceAlert({
          templateKey: 'AMBULANCE_APPROACHING_BEHIND',
          params: { distanceMeters: dist },
        });
        break;
      case 'ROUTE_UPDATED':
        voiceAlertService.dispatchVoiceAlert({
          templateKey: 'REROUTE_OPTIMIZED',
          params: {},
        });
        break;
      default:
        break;
    }
  }

  /**
   * Helper: checks if coordinate is within corridor buffer of polyline
   */
  private isCoordNearRoute(coord: [number, number], route: [number, number][], bufferMeters: number): boolean {
    for (let i = 0; i < route.length - 1; i += 2) {
      const d = calculateDistanceMeters(coord, route[i]);
      if (d <= bufferMeters) return true;
    }
    return false;
  }

  /**
   * Returns all active, unexpired alerts sorted by urgency
   */
  public getActiveAlerts(): ActiveSafetyAlert[] {
    const now = Date.now();
    const result: ActiveSafetyAlert[] = [];

    this.activeAlerts.forEach((a) => {
      if (new Date(a.expiresAt).getTime() > now) {
        result.push(a);
      } else {
        a.isExpired = true;
      }
    });

    const rank: Record<AlertUrgency, number> = {
      CRITICAL: 5,
      IMMEDIATE: 4,
      IMPORTANT: 3,
      EARLY_WARNING: 2,
      INFO: 1,
    };

    return result.sort((a, b) => rank[b.urgency] - rank[a.urgency]);
  }

  /**
   * Manually expires an alert
   */
  public expireAlert(alertId: string) {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.isExpired = true;
      this.activeAlerts.delete(alertId);
      eventBus.emit('SAFETY_ALERT_EXPIRED', alert);
    }
  }

  private startLifecycleSweeper() {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];

      this.activeAlerts.forEach((a, id) => {
        if (new Date(a.expiresAt).getTime() <= now) {
          expiredKeys.push(id);
        }
      });

      expiredKeys.forEach((k) => this.expireAlert(k));
    }, 15000);
  }
}

export const alertEngine = new AlertEngine();
export default alertEngine;
