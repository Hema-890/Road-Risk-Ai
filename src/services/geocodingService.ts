// Geocoding and Location Search Service
// Powered by OpenStreetMap Photon API with natural proximity ranking and worldwide search support.
// General-purpose navigation: places, streets, cities, businesses, landmarks, addresses, and coordinates.

import { CITY_PRESETS, DEFAULT_CITY } from '../data/mockScenarios.ts';

export interface SearchLocationResult {
  id: string;
  name: string;
  label: string;
  coordinates: [number, number]; // [lng, lat]
  type:
    | 'place'
    | 'city'
    | 'street'
    | 'highway'
    | 'business'
    | 'hospital'
    | 'fuel'
    | 'transit'
    | 'railway'
    | 'bus_stop'
    | 'restaurant'
    | 'landmark'
    | 'airport';
  source: 'osm_geocoder' | 'coordinates_parsed' | 'curated_facility';
  distance_km?: number;
  is_local?: boolean;
}

const RECENT_SEARCHES_KEY = 'roadrisk_recent_searches_v2';

/**
 * Calculates Haversine distance in kilometers between two [lng, lat] points
 */
export function calculateDistanceKm(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

/**
 * Parses coordinate input strings (e.g., "16.5062, 80.6480" or "16.5062 80.6480")
 */
export function parseCoordinates(query: string): [number, number] | null {
  const clean = query.trim();
  const match = clean.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
  if (match) {
    const p1 = parseFloat(match[1]);
    const p2 = parseFloat(match[3]);
    // Check if lat, lng (lat is -90..90, lng is -180..180)
    if (Math.abs(p1) <= 90 && Math.abs(p2) <= 180) {
      return [p2, p1]; // [lng, lat]
    }
    // Check if lng, lat
    if (Math.abs(p2) <= 90 && Math.abs(p1) <= 180) {
      return [p1, p2];
    }
  }
  return null;
}

/**
 * Searches places globally using OpenStreetMap Photon Geocoding API.
 * Prioritizes natural search relevance without forcing hospital takeovers.
 */
export async function searchLocations(
  query: string,
  cityId: string = 'vijayawada',
  originCoords?: [number, number]
): Promise<SearchLocationResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // 1. Direct Coordinate Parsing
  const parsedCoords = parseCoordinates(trimmed);
  if (parsedCoords) {
    const dist = originCoords ? calculateDistanceKm(originCoords, parsedCoords) : undefined;
    return [
      {
        id: `coord_${parsedCoords.join('_')}`,
        name: `Coordinates: ${parsedCoords[1].toFixed(5)}, ${parsedCoords[0].toFixed(5)}`,
        label: `Direct GPS Pin ${dist ? `(${dist} km away)` : ''}`,
        coordinates: parsedCoords,
        type: 'place',
        source: 'coordinates_parsed',
        distance_km: dist,
      },
    ];
  }

  const results: SearchLocationResult[] = [];
  const city = CITY_PRESETS[cityId] || DEFAULT_CITY;
  const referenceCoords: [number, number] = originCoords || city.center;
  const lower = trimmed.toLowerCase();

  // 2. Query Photon OpenStreetMap Geocoder (Worldwide with proximity biasing)
  try {
    const [centerLng, centerLat] = referenceCoords;
    // Photon accepts lat & lon for relevance biasing without discarding distant locations
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      trimmed
    )}&lat=${centerLat}&lon=${centerLng}&limit=15`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(photonUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RoadRiskAI-CitizenNav/3.0',
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.features)) {
        data.features.forEach((feature: any, idx: number) => {
          const props = feature.properties || {};
          const geom = feature.geometry || {};
          if (!geom.coordinates || geom.coordinates.length < 2) return;

          const coords: [number, number] = [
            parseFloat(geom.coordinates[0].toFixed(6)),
            parseFloat(geom.coordinates[1].toFixed(6)),
          ];
          const dist = calculateDistanceKm(referenceCoords, coords);

          const primaryName = props.name || props.street || props.city || trimmed;
          const detailParts = [
            props.street,
            props.district,
            props.city,
            props.state,
            props.country,
          ].filter(Boolean);

          const label = detailParts.length > 0 ? detailParts.join(', ') : 'Geocoded Location';

          let placeType: SearchLocationResult['type'] = 'place';
          if (props.osm_value === 'city' || props.type === 'city') placeType = 'city';
          else if (props.osm_value === 'hospital' || props.osm_key === 'healthcare') placeType = 'hospital';
          else if (props.osm_value === 'fuel') placeType = 'fuel';
          else if (props.osm_value === 'station' || props.osm_value === 'railway') placeType = 'railway';
          else if (props.osm_value === 'bus_stop' || props.osm_value === 'bus_station') placeType = 'bus_stop';
          else if (props.osm_value === 'aerodrome' || props.osm_value === 'airport') placeType = 'airport';
          else if (props.osm_value === 'restaurant' || props.osm_value === 'cafe' || props.osm_value === 'fast_food') placeType = 'restaurant';
          else if (props.osm_key === 'tourism' || props.osm_value === 'monument' || props.osm_value === 'attraction') placeType = 'landmark';
          else if (props.osm_key === 'highway') {
            placeType = (props.osm_value === 'motorway' || props.osm_value === 'trunk' || props.osm_value === 'primary') ? 'highway' : 'street';
          }

          results.push({
            id: `osm_${props.osm_id || idx}_${idx}`,
            name: primaryName,
            label: `${label} (${dist} km)`,
            coordinates: coords,
            type: placeType,
            source: 'osm_geocoder',
            distance_km: dist,
          });
        });
      }
    }
  } catch (err) {
    console.warn('[GeocodingSearch] Photon search request failed or timed out:', err);
  }

  // 3. Only if user explicitly searches medical terms ("hospital", "clinic", "uphc", "trauma"),
  // include verified local emergency medical facilities if matched
  const isMedicalQuery =
    lower.includes('hospital') ||
    lower.includes('clinic') ||
    lower.includes('uphc') ||
    lower.includes('trauma') ||
    lower.includes('doctor') ||
    lower.includes('health centre');

  if (isMedicalQuery) {
    const matchingLocal = (city.destinations || []).filter(
      (d) => d.name.toLowerCase().includes(lower) || d.label.toLowerCase().includes(lower)
    );
    matchingLocal.forEach((dest) => {
      const dist = calculateDistanceKm(referenceCoords, dest.coords);
      const exists = results.some(
        (r) => calculateDistanceKm(r.coordinates, dest.coords) < 0.4
      );
      if (!exists) {
        results.unshift({
          id: `local_${dest.id}`,
          name: dest.name,
          label: `${dest.label} (${dist} km · Verified Emergency Hub)`,
          coordinates: dest.coords,
          type: 'hospital',
          source: 'curated_facility',
          distance_km: dist,
          is_local: true,
        });
      }
    });
  }

  // 4. Natural Ranking:
  // - Exact prefix matches to place name first
  // - Proximity (closer locations ranked higher when query relevance is equal)
  results.sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    const exactA = nameA.startsWith(lower) ? 1 : 0;
    const exactB = nameB.startsWith(lower) ? 1 : 0;

    if (exactA !== exactB) return exactB - exactA;

    // Sort by distance
    const distA = a.distance_km ?? 99999;
    const distB = b.distance_km ?? 99999;
    return distA - distB;
  });

  return results;
}

/**
 * Category-specific search (e.g. Restaurants, Fuel, EV Charging, Hospitals, Pharmacy)
 */
export async function searchCategory(
  category: 'restaurant' | 'fuel' | 'ev' | 'hospital' | 'pharmacy' | 'parking' | 'hotel',
  originCoords?: [number, number],
  cityId?: string
): Promise<SearchLocationResult[]> {
  const categoryQueries: Record<string, string> = {
    restaurant: 'restaurant cafe food',
    fuel: 'petrol pump fuel station',
    ev: 'ev charging station electric vehicle',
    hospital: 'hospital emergency clinic',
    pharmacy: 'pharmacy medical store chemist',
    parking: 'car parking area',
    hotel: 'hotel lodging',
  };

  const query = categoryQueries[category] || category;
  return searchLocations(query, cityId, originCoords);
}

/**
 * Recent Searches Management (localStorage)
 */
export function getRecentSearches(): SearchLocationResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(result: SearchLocationResult): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getRecentSearches();
    const filtered = existing.filter(
      (r) =>
        r.name.toLowerCase() !== result.name.toLowerCase() &&
        calculateDistanceKm(r.coordinates, result.coordinates) > 0.1
    );
    const updated = [result, ...filtered].slice(0, 8); // keep last 8 searches
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {}
}

export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {}
}

export interface ReverseGeocodeResult {
  formattedAddress: string;
  name: string;
  street?: string;
  locality?: string;
  city?: string;
  state?: string;
  country?: string;
}

const reverseGeocodeCache = new Map<string, { result: ReverseGeocodeResult; timestamp: number }>();

/**
 * Reverse geocodes [lng, lat] coordinates to meaningful street and area names
 */
export async function reverseGeocode(
  coordinates: [number, number]
): Promise<ReverseGeocodeResult | null> {
  const [lng, lat] = coordinates;
  const key = `${lng.toFixed(4)},${lat.toFixed(4)}`;

  const cached = reverseGeocodeCache.get(key);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    return cached.result;
  }

  try {
    const url = `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RoadRiskAI-Reverse/3.0',
      },
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const data = await res.json();
      const feat = data?.features?.[0];
      if (feat && feat.properties) {
        const p = feat.properties;
        const name = p.name || p.street || p.locality || p.district || 'Current Location';
        const parts = [p.name, p.street, p.locality || p.district, p.city || p.county, p.state]
          .filter(Boolean)
          .filter((item: any, idx: number, arr: any[]) => arr.indexOf(item) === idx);

        const result: ReverseGeocodeResult = {
          formattedAddress: parts.join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          name,
          street: p.street,
          locality: p.locality || p.district,
          city: p.city || p.county,
          state: p.state,
          country: p.country,
        };
        reverseGeocodeCache.set(key, { result, timestamp: Date.now() });
        return result;
      }
    }
  } catch (err) {
    // photon timeout or network offline
  }

  // Graceful fallback: return clean coordinates descriptor
  return {
    formattedAddress: `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`,
    name: 'Current GPS Location',
  };
}

export default searchLocations;
