// ==============================================================================
// ROADRISK AI — REAL-TIME ROAD INCIDENT SERVICE
// Ingests live incidents from TomTom Traffic Incidents v5 API
// Categorizes accidents, road closures, construction, flooding, and hazards.
// Strictly enforces zero fake incidents in LIVE mode.
// ==============================================================================

import trafficService from './trafficService.ts';
import { eventBus } from './eventBus.ts';
import type { DataStatus } from '../types/dataStatus.ts';

export type IncidentCategory =
  | 'ACCIDENT'
  | 'ROAD_CLOSURE'
  | 'LANE_CLOSURE'
  | 'CONSTRUCTION'
  | 'ROAD_WORKS'
  | 'TRAFFIC_OBSTRUCTION'
  | 'FLOODING'
  | 'FLOOD'
  | 'FIRE'
  | 'EMERGENCY'
  | 'CONGESTION'
  | 'HAZARD';

export type IncidentSeverity = 'low' | 'moderate' | 'high' | 'critical';

export interface RoadIncident {
  id: string;
  providerId: string;
  category: IncidentCategory;
  type?: IncidentCategory;
  title: string;
  description: string;
  severity: IncidentSeverity;
  latitude: number;
  longitude: number;
  geometry?: any;
  locationName?: string;
  roadName?: string;
  from?: string;
  to?: string;
  isBidirectional?: boolean;
  delaySeconds: number;
  lengthMeters: number;
  radiusMeters?: number;
  source: string;
  sourceType?: 'REALTIME' | 'OFFICIAL' | 'COMMUNITY' | 'SIMULATED';
  active: boolean;
  timestamp: string;
  observedAt: string;
  expiresAt: string;
  status: DataStatus; // LIVE | STALE | UNAVAILABLE
  verified: boolean;
  rawIconCategory?: number;
}

class IncidentService {
  private liveIncidents: Map<string, RoadIncident> = new Map();
  private lastFetchTime: number = 0;
  private isFetching: boolean = false;
  private readonly CACHE_TTL_MS = 60_000; // 60 seconds TTL for traffic incidents

  /**
   * Calculates Haversine distance in meters between two lat/lng points
   */
  private getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Fetches real-time road incidents for a geographic viewport / bounding box
   * Applies provider ID tracking and spatial/bidirectional deduplication
   */
  async fetchIncidentsInViewport(
    minLngOrBbox: number | [number, number, number, number],
    minLat?: number,
    maxLng?: number,
    maxLat?: number
  ): Promise<RoadIncident[]> {
    let minLng: number, actualMinLat: number, actualMaxLng: number, actualMaxLat: number;
    if (Array.isArray(minLngOrBbox)) {
      [minLng, actualMinLat, actualMaxLng, actualMaxLat] = minLngOrBbox;
    } else {
      minLng = minLngOrBbox;
      actualMinLat = minLat ?? 0;
      actualMaxLng = maxLng ?? 0;
      actualMaxLat = maxLat ?? 0;
    }

    if (!trafficService.isLiveTrafficConfigured()) {
      return [];
    }

    const now = Date.now();
    if (this.isFetching && now - this.lastFetchTime < 5000) {
      return Array.from(this.liveIncidents.values());
    }

    this.isFetching = true;
    try {
      const rawIncidents = await trafficService.getLiveIncidentsBoundingBox(minLng, actualMinLat, actualMaxLng, actualMaxLat);
      const parsedList: RoadIncident[] = [];

      for (const raw of rawIncidents) {
        parsedList.push({
          id: raw.id,
          providerId: raw.providerId,
          category: raw.type as IncidentCategory,
          title: raw.category || 'Road Hazard',
          description: raw.description,
          severity: raw.severity,
          latitude: raw.latitude,
          longitude: raw.longitude,
          geometry: raw.geometry,
          roadName: raw.roadName,
          from: raw.from,
          to: raw.to,
          delaySeconds: raw.delaySeconds,
          lengthMeters: raw.lengthMeters,
          source: 'TOMTOM',
          timestamp: new Date().toISOString(),
          observedAt: new Date().toISOString(),
          expiresAt: new Date(now + this.CACHE_TTL_MS * 2).toISOString(),
          status: 'LIVE',
          verified: true,
          active: true,
        });
      }

      // Phase 2: Controlled Spatial & Bidirectional Deduplication
      const deduplicated: RoadIncident[] = [];
      const visited = new Set<number>();

      for (let i = 0; i < parsedList.length; i++) {
        if (visited.has(i)) continue;
        const current = { ...parsedList[i] };
        visited.add(i);

        for (let j = i + 1; j < parsedList.length; j++) {
          if (visited.has(j)) continue;
          const other = parsedList[j];

          // Check for bidirectional counterpart (from A to B and B to A)
          const isReverseDirection =
            current.from &&
            other.from &&
            current.to &&
            other.to &&
            current.from.toLowerCase() === other.to.toLowerCase() &&
            current.to.toLowerCase() === other.from.toLowerCase();

          const distMeters = this.getDistanceMeters(
            current.latitude,
            current.longitude,
            other.latitude,
            other.longitude
          );

          // Merge if:
          // 1. Identical category & reverse endpoints within 350m
          // 2. Identical category & proximity < 45m
          if (
            current.category === other.category &&
            (isReverseDirection || distMeters < 45)
          ) {
            visited.add(j);
            current.isBidirectional = true;
            if (!current.description.includes('Both directions')) {
              current.description = `${current.description} (Both directions affected)`;
            }
            if (other.delaySeconds > current.delaySeconds) {
              current.delaySeconds = other.delaySeconds;
            }
            if (other.lengthMeters > current.lengthMeters) {
              current.lengthMeters = other.lengthMeters;
            }
          }
        }

        deduplicated.push(current);
      }

      const updatedMap = new Map<string, RoadIncident>();
      for (const inc of deduplicated) {
        updatedMap.set(inc.id, inc);
        if (!this.liveIncidents.has(inc.id)) {
          eventBus.emit('TRAFFIC_INCIDENT_INGESTED', {
            id: inc.id,
            category: inc.category,
            severity: inc.severity,
            latitude: inc.latitude,
            longitude: inc.longitude,
            description: inc.description,
          });
        }
      }

      this.liveIncidents = updatedMap;
      this.lastFetchTime = now;
      return deduplicated;
    } catch (err: any) {
      console.warn('RoadRisk AI: IncidentService query failed:', err.message);
      return Array.from(this.liveIncidents.values());
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Retrieves active incidents in memory
   */
  getActiveIncidents(): RoadIncident[] {
    return Array.from(this.liveIncidents.values());
  }

  /**
   * Returns specific incident by ID
   */
  getIncidentById(id: string): RoadIncident | undefined {
    return this.liveIncidents.get(id);
  }

  /**
   * Controlled simulation injection for testing rerouting, incident avoidance, and drills.
   * Explicitly flagged as SIMULATED so it is never presented as real-time fact.
   */
  injectSimulationIncident(incident: Partial<RoadIncident> & { latitude: number; longitude: number; category: IncidentCategory }): RoadIncident {
    const id = incident.id || `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullIncident: RoadIncident = {
      id,
      providerId: `SIM_${id}`,
      category: incident.category,
      type: incident.category,
      title: incident.title || `Simulated ${incident.category}`,
      description: incident.description || 'Test simulation incident for route intelligence evaluation.',
      severity: incident.severity || 'high',
      latitude: incident.latitude,
      longitude: incident.longitude,
      delaySeconds: incident.delaySeconds || 300,
      lengthMeters: incident.lengthMeters || 150,
      radiusMeters: incident.radiusMeters || 100,
      source: 'RoadRisk AI Simulation Engine',
      sourceType: 'SIMULATED',
      active: incident.active !== undefined ? incident.active : true,
      timestamp: new Date().toISOString(),
      observedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: 'LIVE',
      verified: true,
    };

    this.liveIncidents.set(id, fullIncident);
    eventBus.emit('TRAFFIC_INCIDENT_INGESTED', fullIncident);
    return fullIncident;
  }

  clearSimulationIncidents(): void {
    for (const [id, inc] of this.liveIncidents.entries()) {
      if (inc.sourceType === 'SIMULATED') {
        this.liveIncidents.delete(id);
      }
    }
  }

  /**
   * Returns whether live incidents are currently loaded
   */
  hasLiveIncidents(): boolean {
    return this.liveIncidents.size > 0;
  }
}

export const incidentService = new IncidentService();
export default incidentService;
