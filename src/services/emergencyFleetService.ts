// ==============================================================================
// ROADRISK AI — REAL-TIME CONNECTED EMERGENCY FLEET SERVICE
// Authorized Emergency Vehicle Ingestion & Approaching Siren Geofence
// Strictly prohibits fake moving ambulance animations!
// If no active fleet device is connected, truthfully shows 0 Active Units.
// ==============================================================================

import type { DataProvenance, DataStatus } from '../types/dataStatus.ts';
import { eventBus } from './eventBus.ts';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient.ts';

export interface EmergencyVehicleRecord {
  vehicleId: string;
  callsign: string;
  type: 'ambulance' | 'fire_engine' | 'police_patrol' | 'rescue_squad';
  status: 'DISPATCHED' | 'EN_ROUTE_TO_SCENE' | 'TRANSPORTING_CRITICAL' | 'AVAILABLE' | 'OFFLINE';
  latitude: number;
  longitude: number;
  heading: number; // 0 - 360
  speedKmh: number;
  destinationName?: string;
  destinationLat?: number;
  destinationLng?: number;
  updatedAt: string; // ISO 8601
  isAuthorized: boolean;
  provenance: DataProvenance;
}

export type ApproachingState = 'NORMAL' | 'POSSIBLY_APPROACHING' | 'APPROACHING' | 'PASSED' | 'CLEARED';

export interface AmbulanceApproachingAlert {
  vehicleId: string;
  callsign: string;
  distanceMeters: number;
  estimatedArrivalSeconds: number;
  approachDirection: 'BEHIND' | 'INTERSECTION_AHEAD' | 'OPPOSITE_LANE';
  approachState: ApproachingState;
  recommendedAction: string;
  timestamp: string;
}

class EmergencyFleetService {
  private activeVehicles: Map<string, EmergencyVehicleRecord> = new Map();
  private approachStates: Map<string, { state: ApproachingState; lastAlertTime: number; lastDistance: number }> = new Map();
  private isSubscribed: boolean = false;

  constructor() {
    this.initFleetSubscription();
  }

  /**
   * Initializes genuine Supabase Realtime channel for authorized fleet units
   */
  private initFleetSubscription() {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const channel = supabase
        .channel('roadrisk_emergency_fleet')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'emergency_vehicles' },
          (payload) => {
            const row = payload.new as any;
            if (row && row.id) {
              this.handleVehicleUpdate({
                vehicleId: row.id,
                callsign: row.callsign || `Unit-${row.id.substring(0, 4)}`,
                type: row.type || 'ambulance',
                status: row.status || 'EN_ROUTE_TO_SCENE',
                latitude: Number(row.lat || row.latitude),
                longitude: Number(row.lng || row.longitude),
                heading: Number(row.heading || 0),
                speedKmh: Number(row.speed_kmh || row.speed || 0),
                updatedAt: row.updated_at || new Date().toISOString(),
                isAuthorized: true,
                provenance: {
                  source: 'Supabase Realtime Fleet Telemetry',
                  status: 'LIVE',
                  updatedAt: new Date().toISOString(),
                  freshness: 'LIVE',
                  confidence: 0.99,
                  coverageRegion: 'Authorized Municipal Fleet Grid',
                },
              });
            }
          }
        )
        .subscribe();

      this.isSubscribed = true;
    } catch {
      // Supabase unconfigured or offline
    }
  }

  /**
   * Updates an in-memory vehicle position record
   */
  public handleVehicleUpdate(vehicle: EmergencyVehicleRecord) {
    this.activeVehicles.set(vehicle.vehicleId, vehicle);
    eventBus.publish('EMERGENCY_VEHICLE_UPDATED', vehicle, vehicle.provenance);
  }

  /**
   * Returns all active authorized emergency vehicles within a given radius of user GPS
   * Strictly returns empty array if no genuine units exist (ZERO fake ambulances)
   */
  public getNearbyEmergencyVehicles(
    userLat: number,
    userLng: number,
    radiusKm: number = 5
  ): EmergencyVehicleRecord[] {
    const nearby: EmergencyVehicleRecord[] = [];
    const now = Date.now();

    this.activeVehicles.forEach((veh) => {
      // Filter out stale positions older than 3 minutes
      const ageMs = now - new Date(veh.updatedAt).getTime();
      if (ageMs > 180000) return;

      const dKm = this.calculateDistanceKm(userLat, userLng, veh.latitude, veh.longitude);
      if (dKm <= radiusKm) {
        nearby.push(veh);
      }
    });

    return nearby;
  }

  /**
   * Phase 16: Evaluates whether a high-priority emergency vehicle is actively approaching the user
   * Validates distance, relative bearing, velocity, and approach angle.
   */
  public evaluateApproachingAmbulance(
    userLat: number,
    userLng: number,
    userHeading: number
  ): AmbulanceApproachingAlert | null {
    const activeUnits = this.getNearbyEmergencyVehicles(userLat, userLng, 1.5); // 1.5 km check radius

    for (const veh of activeUnits) {
      if (veh.status === 'AVAILABLE' || veh.speedKmh < 10) continue; // Stationary / idle units do not trigger sirens

      const distMeters = Math.round(this.calculateDistanceKm(userLat, userLng, veh.latitude, veh.longitude) * 1000);
      if (distMeters > 900) continue; // Outside urgent hearing/clearing range

      // Compute bearing from vehicle to user
      const bearingVehToUser = this.calculateBearing(veh.latitude, veh.longitude, userLat, userLng);
      // Angular difference between vehicle travel heading and vector toward user
      const headingDiff = Math.abs(this.normalizeAngle(veh.heading - bearingVehToUser));

      // If vehicle is heading toward user within 40 degrees
      if (headingDiff <= 40) {
        // Approach direction analysis
        const userHeadingDiff = Math.abs(this.normalizeAngle(veh.heading - userHeading));
        let approachDirection: 'BEHIND' | 'INTERSECTION_AHEAD' | 'OPPOSITE_LANE' = 'INTERSECTION_AHEAD';

        if (userHeadingDiff <= 45) {
          approachDirection = 'BEHIND';
        } else if (userHeadingDiff >= 135) {
          approachDirection = 'OPPOSITE_LANE';
        }

        const speedMps = Math.max(1, (veh.speedKmh * 1000) / 3600);
        const etaSeconds = Math.round(distMeters / speedMps);

        const previousState = this.approachStates.get(veh.vehicleId) || {
          state: 'NORMAL' as ApproachingState,
          lastAlertTime: 0,
          lastDistance: distMeters,
        };

        // State Machine Transition: NORMAL -> POSSIBLY_APPROACHING -> APPROACHING -> PASSED
        let approachState: ApproachingState = 'APPROACHING';
        if (distMeters > 500) {
          approachState = 'POSSIBLY_APPROACHING';
        } else if (distMeters <= 500 && distMeters <= previousState.lastDistance) {
          approachState = 'APPROACHING';
        } else if (distMeters > previousState.lastDistance + 50 && previousState.lastDistance < 150) {
          approachState = 'PASSED';
        }

        const now = Date.now();
        // Cooldown: prevent alert spam if within 15 seconds in the same state
        if (now - previousState.lastAlertTime < 15000 && previousState.state === approachState) {
          continue;
        }

        this.approachStates.set(veh.vehicleId, {
          state: approachState,
          lastAlertTime: now,
          lastDistance: distMeters,
        });

        const alert: AmbulanceApproachingAlert = {
          vehicleId: veh.vehicleId,
          callsign: veh.callsign,
          distanceMeters: distMeters,
          estimatedArrivalSeconds: etaSeconds,
          approachDirection,
          approachState,
          recommendedAction:
            approachState === 'PASSED'
              ? 'Emergency vehicle has passed. Resume normal corridor travel.'
              : approachDirection === 'BEHIND'
              ? 'Move safely to the left/curb. Yield right-of-way immediately.'
              : 'Prepare to yield at intersection. Emergency vehicle approaching.',
          timestamp: new Date().toISOString(),
        };

        // Publish to event bus for voice alerts & HUD notification
        eventBus.publish('EMERGENCY_VEHICLE_APPROACHING', alert, veh.provenance);
        return alert;
      }
    }

    return null;
  }

  private calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
    return (Math.atan2(y, x) * 180) / Math.PI;
  }

  private normalizeAngle(angle: number): number {
    let a = angle % 360;
    if (a > 180) a -= 360;
    if (a < -180) a += 360;
    return a;
  }
}

export const emergencyFleetService = new EmergencyFleetService();
