// ==============================================================================
// ROADRISK AI — CENTRAL REAL-TIME EVENT BUS
// Decoupled, type-safe Pub/Sub connecting sensors, providers, ML, and navigation
// ==============================================================================

import type { DataProvenance } from '../types/dataStatus.ts';

export type RealtimeEventType =
  | 'TRAFFIC_UPDATED'
  | 'TRAFFIC_CHANGED'
  | 'INCIDENT_CREATED'
  | 'INCIDENT_UPDATED'
  | 'INCIDENT_EXPIRED'
  | 'ACCIDENT_DETECTED'
  | 'ROAD_CLOSED'
  | 'FLOOD_UPDATED'
  | 'FLOOD_DETECTED'
  | 'WEATHER_UPDATED'
  | 'WEATHER_CHANGED'
  | 'RISK_UPDATED'
  | 'GPS_UPDATED'
  | 'GPS_LOST'
  | 'GPS_RECOVERED'
  | 'EMERGENCY_VEHICLE_UPDATED'
  | 'EMERGENCY_VEHICLE'
  | 'EMERGENCY_VEHICLE_APPROACHING'
  | 'TRANSIT_UPDATED'
  | 'HAZARD_REPORTED'
  | 'COMMUNITY_REPORT'
  | 'ROUTE_INVALIDATED'
  | 'ROUTE_CHANGED'
  | 'REROUTE_SUGGESTED'
  | 'VOICE_ALERT_DISPATCHED';

export interface RealtimeEventPayload<T = any> {
  eventId: string;
  type: RealtimeEventType;
  timestamp: string; // ISO-8601
  provenance: DataProvenance;
  data: T;
}

type EventListener<T = any> = (payload: RealtimeEventPayload<T>) => void;

class EventBus {
  private listeners: Map<RealtimeEventType, Set<EventListener>> = new Map();
  private history: RealtimeEventPayload[] = [];
  private maxHistory: number = 200;

  /**
   * Subscribe to a typed realtime event
   */
  public subscribe<T = any>(type: RealtimeEventType, listener: EventListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener as EventListener);

    return () => {
      this.listeners.get(type)?.delete(listener as EventListener);
    };
  }

  /**
   * Publish a typed event to all active subscribers
   */
  public publish<T = any>(type: RealtimeEventType, data: T, provenance: DataProvenance): void {
    const payload: RealtimeEventPayload<T> = {
      eventId: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type,
      timestamp: new Date().toISOString(),
      provenance,
      data,
    };

    // Store in circular history buffer for telemetry and audit
    this.history.push(payload);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (err) {
          console.error(`[EventBus] Error handling event ${type}:`, err);
        }
      });
    }
  }

  /**
   * Convenience emit method with default provenance
   */
  public emit<T = any>(type: RealtimeEventType | string, data: T, customProvenance?: Partial<DataProvenance>): void {
    const prov: DataProvenance = {
      source: customProvenance?.source || 'RoadRisk AI Core Engine',
      status: customProvenance?.status || 'LIVE',
      updatedAt: customProvenance?.updatedAt || new Date().toISOString(),
      freshness: customProvenance?.freshness || 'LIVE',
      latencyMs: customProvenance?.latencyMs || 5,
      confidence: customProvenance?.confidence || 0.95,
      limitations: customProvenance?.limitations,
    };
    this.publish(type as RealtimeEventType, data, prov);
  }

  /**
   * Returns recent event history
   */
  public getRecentEvents(limit: number = 50): RealtimeEventPayload[] {
    return this.history.slice(-limit);
  }

  /**
   * Clears all listeners (for testing/cleanup)
   */
  public clear(): void {
    this.listeners.clear();
    this.history = [];
  }
}

export const eventBus = new EventBus();
export default eventBus;
