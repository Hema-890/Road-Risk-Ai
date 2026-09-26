// ==============================================================================
// ROADRISK AI — GLOBAL DATA STATUS & PROVENANCE SYSTEM
// Strictly enforces truthfulness: LIVE vs MODEL vs STATIC vs UNAVAILABLE
// No simulated or fabricated data permitted in LIVE production mode.
// ==============================================================================

export type DataStatus =
  | 'LIVE'          // Direct authenticated external feed or device sensor
  | 'MODEL'         // Machine Learning inference or scientific model output
  | 'REPORTED'      // Citizen or operator submitted report (unverified/verified)
  | 'STATIC'        // Static infrastructure reference (OSM nodes, hospital registries)
  | 'STALE'         // Once-valid live data whose TTL has expired
  | 'UNAVAILABLE'   // No feed, API unprovisioned, or regional data absent
  | 'ERROR'         // Network, upstream provider, or parser fault
  | 'SIMULATED';    // Permitted ONLY in isolated Demo Mode; STRICTLY prohibited in LIVE

export type FreshnessState = 'LIVE' | 'AGING' | 'STALE' | 'EXPIRED';

export interface DataProvenance {
  source: string;              // e.g., 'TomTom Traffic Flow API', 'Open-Meteo GloFAS', 'Browser Geolocation'
  status: DataStatus;
  updatedAt: string;           // ISO 8601 UTC
  freshness: FreshnessState;
  latencyMs?: number;
  confidence?: number;         // 0.0 to 1.0 (where statistically defensible)
  resolution?: string;         // e.g., '~5km grid' for GloFAS, 'segment-level' for TomTom
  coverageRegion?: string;     // Active bounding box or city name
  limitations?: string;        // Explicit limitations or caveats
  errorMessage?: string;
}

export function computeFreshness(updatedAtIso: string, maxAgeMs: number = 60000): FreshnessState {
  const diffMs = Date.now() - new Date(updatedAtIso).getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'EXPIRED';
  if (diffMs <= maxAgeMs * 0.5) return 'LIVE';
  if (diffMs <= maxAgeMs) return 'AGING';
  if (diffMs <= maxAgeMs * 2) return 'STALE';
  return 'EXPIRED';
}

export interface ProviderHealthRecord {
  id: string;
  name: string;
  tier: 'FACT' | 'MODEL' | 'REFERENCE';
  status: DataStatus;
  freshness: FreshnessState;
  lastSuccessfulSync?: string;
  latencyMs: number;
  error?: string;
  limitations?: string;
}
