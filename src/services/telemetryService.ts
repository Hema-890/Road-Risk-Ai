import { realtimeService } from './realtimeService';
import { getSupabaseClient } from '../lib/supabaseClient';
import { TelemetryEvent } from '../types/events';
import { calculateDistanceMeters } from '../utils/geoUtils';

export interface TelemetryValidationResult {
  valid: boolean;
  reason?: string;
}

const env = (import.meta as any).env || {};
const PERSIST_INTERVAL_MS = Number(env.TELEMETRY_PERSIST_INTERVAL_MS || 5000);

class TelemetryService {
  private lastTelemetryByVehicle: Map<string, TelemetryEvent> = new Map();
  private pendingBatch: TelemetryEvent[] = [];
  private persistTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startPeriodicPersistence();
  }

  /**
   * Validates incoming telemetry against geospatial and physical sanity bounds
   */
  public validateTelemetry(packet: {
    vehicleId: string;
    latitude: number;
    longitude: number;
    heading: number;
    speedKmh: number;
    timestamp?: string;
  }): TelemetryValidationResult {
    const { vehicleId, latitude, longitude, heading, speedKmh, timestamp } = packet;

    if (!vehicleId || typeof vehicleId !== 'string') {
      return { valid: false, reason: 'Invalid vehicle ID' };
    }

    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return { valid: false, reason: `Latitude out of range [-90, 90]: ${latitude}` };
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return { valid: false, reason: `Longitude out of range [-180, 180]: ${longitude}` };
    }

    if (isNaN(speedKmh) || speedKmh < 0) {
      return { valid: false, reason: `Negative or invalid speed: ${speedKmh}` };
    }

    if (isNaN(heading) || heading < 0 || heading > 360) {
      return { valid: false, reason: `Heading out of range [0, 360]: ${heading}` };
    }

    // Timestamp sanity checks
    const now = Date.now();
    const packetTime = timestamp ? new Date(timestamp).getTime() : now;
    if (isNaN(packetTime)) {
      return { valid: false, reason: 'Malformed timestamp format' };
    }
    if (packetTime > now + 10000) {
      return { valid: false, reason: 'Future timestamp detected (>10s in future)' };
    }
    if (packetTime < now - 300000) {
      return { valid: false, reason: 'Stale telemetry packet (>5m old)' };
    }

    // Physical movement sanity check (prevent impossible jumps)
    const prev = this.lastTelemetryByVehicle.get(vehicleId);
    if (prev) {
      const prevTime = new Date(prev.timestamp).getTime();
      const deltaSec = Math.max(0.1, (packetTime - prevTime) / 1000);
      const distanceMeters = calculateDistanceMeters([prev.longitude, prev.latitude], [longitude, latitude]);
      const impliedSpeedKmh = (distanceMeters / 1000) / (deltaSec / 3600);

      // Maximum reasonable emergency vehicle speed with GPS jitter allowance is 200 km/h
      if (impliedSpeedKmh > 200 && distanceMeters > 500) {
        return {
          valid: false,
          reason: `Impossible movement jump: ${distanceMeters.toFixed(0)}m in ${deltaSec.toFixed(1)}s (implied ${impliedSpeedKmh.toFixed(0)} km/h)`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Process and ingest live telemetry: validate, broadcast, and queue for durable persistence
   */
  public async ingestTelemetry(packet: {
    vehicleId: string;
    missionId: string | null;
    latitude: number;
    longitude: number;
    heading: number;
    speedKmh: number;
    isSimulation: boolean;
    source?: 'gps' | 'simulation' | 'sensor_probe';
  }): Promise<boolean> {
    const timestamp = new Date().toISOString();
    const validation = this.validateTelemetry({ ...packet, timestamp });

    if (!validation.valid) {
      console.warn(`[TelemetryService] Rejected malformed telemetry for ${packet.vehicleId}:`, validation.reason);
      return false;
    }

    const event: TelemetryEvent = {
      eventId: `tel_${packet.vehicleId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      eventType: 'TELEMETRY_UPDATED',
      vehicleId: packet.vehicleId,
      missionId: packet.missionId,
      latitude: packet.latitude,
      longitude: packet.longitude,
      heading: packet.heading,
      speedKmh: packet.speedKmh,
      source: packet.source || (packet.isSimulation ? 'simulation' : 'gps'),
      isSimulation: packet.isSimulation,
      timestamp,
    };

    this.lastTelemetryByVehicle.set(packet.vehicleId, event);

    // 1. Broadcast immediately to Realtime channel if associated with a mission
    if (packet.missionId) {
      realtimeService.broadcastTelemetry(packet.missionId, event);
    }

    // 2. Queue for batched database persistence
    this.pendingBatch.push(event);
    return true;
  }

  public getLastPosition(vehicleId: string): [number, number] | null {
    const last = this.lastTelemetryByVehicle.get(vehicleId);
    if (!last) return null;
    return [last.longitude, last.latitude];
  }

  private startPeriodicPersistence() {
    if (this.persistTimer) clearInterval(this.persistTimer);
    this.persistTimer = setInterval(() => {
      this.flushPendingTelemetry();
    }, PERSIST_INTERVAL_MS);
  }

  /**
   * Flushes queued telemetry to Supabase in a single batch
   */
  public async flushPendingTelemetry(): Promise<void> {
    if (this.pendingBatch.length === 0) return;

    const toPersist = [...this.pendingBatch];
    this.pendingBatch = [];

    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const rows = toPersist.map((t) => ({
        vehicle_id: t.vehicleId,
        mission_id: t.missionId,
        latitude: t.latitude,
        longitude: t.longitude,
        heading: t.heading,
        speed_kmh: t.speedKmh,
        source: t.source,
        is_simulation: t.isSimulation,
        recorded_at: t.timestamp,
      }));

      await supabase.from('telemetry_stream').insert(rows as any);
    } catch (err) {
      console.warn('[TelemetryService] Periodic flush error:', err);
    }
  }

  public cleanup() {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
    this.flushPendingTelemetry();
    this.lastTelemetryByVehicle.clear();
  }
}

export const telemetryService = new TelemetryService();
export default telemetryService;
