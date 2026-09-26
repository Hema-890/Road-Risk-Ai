// ==============================================================================
// ROADRISK AI — REAL-WORLD TRAFFIC INTELLIGENCE SERVICE
// Sourced from TomTom Traffic API (Worldwide Traffic Flow & Incident Coverage)
// Strictly enforces Rule 27: Never labels simulated data as LIVE.
// ==============================================================================

export type TrafficDataSource = 'LIVE' | 'DEMO' | 'NOT_CONFIGURED';

export type TrafficCongestionLevel = 'free' | 'moderate' | 'heavy' | 'severe';

export interface TrafficSegmentFlow {
  status: TrafficDataSource;
  currentSpeedKmh?: number;
  freeFlowSpeedKmh?: number;
  currentTravelTimeSec?: number;
  freeFlowTravelTimeSec?: number;
  delaySec?: number;
  congestionLevel: TrafficCongestionLevel;
  color: string; // '#22c55e' (green), '#eab308' (yellow), '#f97316' (orange), '#ef4444' (red)
  confidence?: number;
  roadClosure?: boolean;
  provider: string;
  sourceNotice?: string;
}

import { computeFreshness, type DataStatus, type FreshnessState } from '../types/dataStatus.ts';

export interface TrafficSegment {
  segmentId: string;
  geometry: [number, number][]; // [[lng, lat], ...]
  currentSpeed: number; // km/h
  freeFlowSpeed: number; // km/h
  congestionRatio: number; // 0 (free) - 1.0 (standstill)
  status: DataStatus; // LIVE | STALE | UNAVAILABLE | ERROR
  source: string; // 'TomTom Traffic API'
  timestamp: string;
  freshness: FreshnessState; // LIVE | RECENT | STALE | EXPIRED
  confidence: number; // 0 - 1.0
  roadClosure?: boolean;
}

export interface TrafficRoutingResult {
  trafficDataSource: TrafficDataSource;
  trafficDelaySeconds: number;
  travelTimeSeconds: number;
  lengthMeters: number;
  coordinates: [number, number][]; // [lng, lat]
  congestionScore: number; // 0 (free) - 100 (severe)
}

// In-memory cache for road point traffic flow queries to avoid redundant network hits
const FLOW_CACHE = new Map<string, { data: TrafficSegmentFlow; timestamp: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute freshness

class TrafficService {
  /**
   * Resolves configured API key for TomTom Traffic
   */
  getApiKey(): string | null {
    try {
      const key =
        (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_TRAFFIC_API_KEY : '') ||
        (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_TOMTOM_API_KEY : '') ||
        '';
      if (key && !key.includes('placeholder') && key.trim().length > 5) {
        return key.trim();
      }
    } catch {
      // In node or non-browser environments
    }

    if (typeof process !== 'undefined' && process.env) {
      const key = process.env.VITE_TRAFFIC_API_KEY || process.env.TRAFFIC_API_KEY || process.env.TOMTOM_API_KEY || '';
      if (key && !key.includes('placeholder') && key.trim().length > 5) {
        return key.trim();
      }
    }
    return null;
  }

  /**
   * Returns whether live external traffic data is genuinely configured
   */
  isLiveTrafficConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  /**
   * Returns current active traffic provider name
   */
  getTrafficProviderName(): string {
    return this.isLiveTrafficConfigured() ? 'TomTom Real-Time Traffic' : 'None';
  }

  /**
   * Resolves authoritative data source indicator
   */
  getTrafficStatus(isDemoScenario = false): TrafficDataSource {
    if (this.isLiveTrafficConfigured()) {
      return 'LIVE';
    }
    if (isDemoScenario) {
      return 'DEMO';
    }
    return 'NOT_CONFIGURED';
  }

  /**
   * Translates congestion state into authoritative traffic color scheme:
   * green = free flow
   * yellow = moderate delay
   * orange = heavy congestion
   * red = severe standstill
   */
  getTrafficColor(level: TrafficCongestionLevel | 'sparse' | 'jammed'): string {
    switch (level) {
      case 'free':
      case 'sparse':
        return '#22c55e'; // Green: free flow
      case 'moderate':
        return '#eab308'; // Yellow: moderate
      case 'heavy':
        return '#f97316'; // Orange: heavy
      case 'severe':
      case 'jammed':
        return '#ef4444'; // Red: severe delay / jam
      default:
        return '#22c55e';
    }
  }

  /**
   * URL template for TomTom Traffic Flow Raster Tiles
   * Uses 'relative-delay' style by default to prevent oversized green coverage over entire regions,
   * showing yellow/orange/red delay indicators while leaving free-flowing roads clean and legible.
   */
  getTrafficFlowTileUrl(style: 'relative-delay' | 'relative' | 'reduced-sensitivity' = 'relative-delay', thickness: number = 2): string | null {
    const key = this.getApiKey();
    if (!key) return null;
    const clampedThickness = Math.max(1, Math.min(10, Math.round(thickness)));
    return `https://api.tomtom.com/traffic/map/4/tile/flow/${style}/{z}/{x}/{y}.png?key=${key}&thickness=${clampedThickness}`;
  }

  /**
   * URL template for TomTom Traffic Incidents Tiles
   */
  getTrafficIncidentsTileUrl(): string | null {
    const key = this.getApiKey();
    if (!key) return null;
    return `https://api.tomtom.com/traffic/map/4/tile/incidents/s1/{z}/{x}/{y}.png?key=${key}`;
  }

  /**
   * Queries real-time TomTom Flow Segment Data API for an exact geographic coordinate
   * Returns speed, delay, road closure, and congestion classification.
   * If not configured, returns clean NOT_CONFIGURED state without inventing numbers.
   */
  async getLiveSegmentTraffic(
    lat: number,
    lng: number,
    isDemoScenario = false
  ): Promise<TrafficSegmentFlow> {
    const key = this.getApiKey();

    if (!key) {
      if (isDemoScenario) {
        return {
          status: 'DEMO',
          congestionLevel: 'moderate',
          color: this.getTrafficColor('moderate'),
          provider: 'Simulated Engine',
          sourceNotice: 'Simulated traffic profile for offline / demo scenario testing.',
        };
      }
      return {
        status: 'NOT_CONFIGURED',
        congestionLevel: 'free',
        color: '#94a3b8', // Neutral Slate
        provider: 'None',
        sourceNotice: 'Live traffic requires VITE_TRAFFIC_API_KEY (TomTom Traffic API) in .env',
      };
    }

    const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const cached = FLOW_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/10/json?key=${key}&point=${lat},${lng}&unit=KMPH`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`TomTom Traffic API returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const flow = data?.flowSegmentData;

      if (!flow) {
        throw new Error('No flowSegmentData returned for coordinates');
      }

      const currentSpeed = flow.currentSpeed;
      const freeFlowSpeed = flow.freeFlowSpeed;
      const currentTravelTime = flow.currentTravelTime;
      const freeFlowTravelTime = flow.freeFlowTravelTime;
      const delaySec = Math.max(0, currentTravelTime - freeFlowTravelTime);

      let congestionLevel: TrafficCongestionLevel = 'free';
      const speedRatio = freeFlowSpeed > 0 ? currentSpeed / freeFlowSpeed : 1.0;

      if (flow.roadClosure || speedRatio < 0.25) {
        congestionLevel = 'severe';
      } else if (speedRatio < 0.55) {
        congestionLevel = 'heavy';
      } else if (speedRatio < 0.8) {
        congestionLevel = 'moderate';
      } else {
        congestionLevel = 'free';
      }

      const result: TrafficSegmentFlow = {
        status: 'LIVE',
        currentSpeedKmh: currentSpeed,
        freeFlowSpeedKmh: freeFlowSpeed,
        currentTravelTimeSec: currentTravelTime,
        freeFlowTravelTimeSec: freeFlowTravelTime,
        delaySec,
        congestionLevel,
        color: this.getTrafficColor(congestionLevel),
        confidence: flow.confidence,
        roadClosure: Boolean(flow.roadClosure),
        provider: 'TomTom Live Traffic',
        sourceNotice: 'Real-time vehicle flow measurements from TomTom Traffic.',
      };

      FLOW_CACHE.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (err: any) {
      console.warn('RoadRisk AI: Live traffic flow query fallback:', err.message);
      return {
        status: 'NOT_CONFIGURED',
        congestionLevel: 'free',
        color: '#94a3b8',
        provider: 'TomTom API Error',
        sourceNotice: `Traffic query error: ${err.message}`,
      };
    }
  }

  /**
   * Calculates route with real traffic delays if TomTom is configured
   */
  async calculateTrafficRoute(
    origin: [number, number], // [lng, lat]
    destination: [number, number] // [lng, lat]
  ): Promise<TrafficRoutingResult | null> {
    const key = this.getApiKey();
    if (!key) return null;

    try {
      const locations = `${origin[1]},${origin[0]}:${destination[1]},${destination[0]}`;
      const url = `https://api.tomtom.com/routing/1/calculateRoute/${locations}/json?key=${key}&traffic=true&departAt=now`;

      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      const route = data?.routes?.[0];
      if (!route) return null;

      const summary = route.summary;
      const legs = route.legs || [];
      const points: [number, number][] = [];

      legs.forEach((leg: any) => {
        if (Array.isArray(leg.points)) {
          leg.points.forEach((pt: any) => {
            points.push([pt.longitude, pt.latitude]);
          });
        }
      });

      const trafficDelaySec = summary.trafficDelayInSeconds || 0;
      const travelTimeSec = summary.travelTimeInSeconds || 0;
      const lengthMeters = summary.lengthInMeters || 0;

      // Congestion score (0 - 100) based on delay ratio
      const delayRatio = travelTimeSec > 0 ? trafficDelaySec / travelTimeSec : 0;
      const congestionScore = Math.min(100, Math.round(delayRatio * 150));

      return {
        trafficDataSource: 'LIVE',
        trafficDelaySeconds: trafficDelaySec,
        travelTimeSeconds: travelTimeSec,
        lengthMeters,
        coordinates: points,
        congestionScore,
      };
    } catch (err) {
      console.warn('RoadRisk AI: TomTom traffic route error:', err);
      return null;
    }
  }

  /**
   * Queries real-time TomTom Incident Details API for a geographic bounding box
   * Identifies accidents, road works, closures, flooding, and hazards with full fields
   */
  async getLiveIncidentsBoundingBox(
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number
  ): Promise<Array<{
    id: string;
    providerId: string;
    category: string;
    type: 'ACCIDENT' | 'ROAD_CLOSURE' | 'LANE_CLOSURE' | 'ROAD_WORKS' | 'CONGESTION' | 'FLOODING' | 'HAZARD';
    severity: 'low' | 'moderate' | 'high' | 'critical';
    latitude: number;
    longitude: number;
    geometry?: any;
    roadName?: string;
    from?: string;
    to?: string;
    description: string;
    delaySeconds: number;
    lengthMeters: number;
    startTime?: string;
    endTime?: string;
  }>> {
    const key = this.getApiKey();
    if (!key) return [];

    try {
      const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
      const fields = '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay,roadNumbers}}}';
      const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&fields=${encodeURIComponent(fields)}&key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return [];

      const data = await res.json();
      const incidents = data?.incidents || [];

      return incidents.map((inc: any) => {
        const props = inc.properties || {};
        const geom = inc.geometry || {};
        const coords = geom.coordinates || [];

        // For LineString or MultiLineString, get the representative midpoint
        let point: [number, number] = [minLng, minLat];
        if (Array.isArray(coords) && coords.length > 0) {
          if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
            const midIndex = Math.floor(coords.length / 2);
            point = coords[midIndex] as [number, number];
          } else if (typeof coords[0] === 'number') {
            point = coords as [number, number];
          }
        }

        // Map magnitude of delay: 0=unknown, 1=minor, 2=moderate, 3=major, 4=undefined
        let severity: 'low' | 'moderate' | 'high' | 'critical' = 'moderate';
        if (props.iconCategory === 8 || props.iconCategory === 11 || props.magnitudeOfDelay === 3) {
          severity = 'critical';
        } else if (props.magnitudeOfDelay === 2 || props.iconCategory === 1) {
          severity = 'high';
        } else if (props.magnitudeOfDelay === 1) {
          severity = 'low';
        }

        const events = props.events || [];
        const desc = events.map((e: any) => e.description).join('; ') || 'Traffic incident';

        // Precise category mapping based on TomTom iconCategory
        let type: 'ACCIDENT' | 'ROAD_CLOSURE' | 'LANE_CLOSURE' | 'ROAD_WORKS' | 'CONGESTION' | 'FLOODING' | 'HAZARD' = 'HAZARD';
        let category = 'Hazard';

        switch (props.iconCategory) {
          case 1:
            type = 'ACCIDENT';
            category = 'Accident';
            break;
          case 6:
            type = 'CONGESTION';
            category = 'Congestion';
            break;
          case 7:
            type = 'LANE_CLOSURE';
            category = 'Lane Closed';
            break;
          case 8:
            type = 'ROAD_CLOSURE';
            category = 'Road Closure';
            break;
          case 9:
            type = 'ROAD_WORKS';
            category = 'Road Works';
            break;
          case 11:
            type = 'FLOODING';
            category = 'Flooding';
            break;
          default:
            type = 'HAZARD';
            category = 'Road Hazard';
        }

        const providerId = props.id || inc.id || `inc_${point[0]}_${point[1]}`;
        const roadName = props.roadNumbers?.length
          ? props.roadNumbers.join(', ')
          : props.from && props.to
          ? `${props.from} ➔ ${props.to}`
          : props.from || props.to || undefined;

        return {
          id: `TOMTOM:${providerId}`,
          providerId,
          category,
          type,
          severity,
          latitude: point[1] || minLat,
          longitude: point[0] || minLng,
          geometry: geom,
          roadName,
          from: props.from,
          to: props.to,
          description: desc,
          delaySeconds: props.delay || 0,
          lengthMeters: Math.round(props.length || 0),
          startTime: props.startTime,
          endTime: props.endTime,
        };
      });
    } catch (err: any) {
      console.warn('RoadRisk AI: TomTom incident query error:', err.message);
      return [];
    }
  }
}

export const trafficService = new TrafficService();
export default trafficService;
