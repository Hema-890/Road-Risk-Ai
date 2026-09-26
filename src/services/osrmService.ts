// ==============================================================================
// ROADRISK AI — ROUTING BRIDGE (OSRM & REAL-TIME PROVIDERS)
// Bridges legacy fetchOsrmRoutes calls into the clean unified routingService.
// Eliminates fake sinusoidal/bezier fallback curves completely.
// ==============================================================================

import type { RouteOption } from '../types/index.ts';
import {
  routingService,
  partitionPolylineIntoSegments,
  isEventNearSegment,
  isPointInRouteCorridor,
  type RoutingProfile,
} from './routingService.ts';

export { partitionPolylineIntoSegments, isEventNearSegment, isPointInRouteCorridor };

export interface OsrmRouteResponse {
  routes: RouteOption[];
  source: 'tomtom_live' | 'osrm_live' | 'offline_local_graph' | 'calibrated_geographic_fallback';
  note: string;
}

/**
 * Computes routes using the unified routing engine (TomTom -> OSRM -> Offline)
 * Zero synthetic or fabricated coordinates.
 */
export async function fetchOsrmRoutes(
  origin: [number, number], // [lng, lat]
  destination: [number, number], // [lng, lat]
  activeEvents: any[] = [],
  activeHazards: any[] = [],
  vehicleId: string = 'amb_bravo_02',
  profile: RoutingProfile = 'CAR',
  departureTime?: Date | string | number
): Promise<OsrmRouteResponse> {
  const result = await routingService.calculateRoutes(origin, destination, {
    profile,
    vehicleId,
    activeEvents,
    activeHazards,
    maxAlternatives: 3,
    corridorBufferMeters: 500,
    departureTime,
  });

  return {
    routes: result.routes,
    source: result.source,
    note: result.note,
  };
}
