// ==============================================================================
// ROADRISK AI — ENTERPRISE MULTI-PROVIDER SEARCH & GEOCODING SERVICE
// Sourced from TomTom Search API (Primary) -> Photon Geocoder (Secondary) ->
// Nominatim / OpenStreetMap (Tertiary) -> Coordinate Parser.
// Supports: Cities, Villages, Towns, Streets, Highways, Landmarks, POIs,
// Hospitals, Fuel, EV, Universities, Airports, and GPS Coordinates worldwide.
// ==============================================================================

import trafficService from './trafficService.ts';

/**
 * Calculates Haversine distance in kilometers between two [lng, lat] coordinates
 */
export function calculateDistanceKm(coord1: [number, number], coord2: [number, number]): number {
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

export type SearchPlaceType =
  | 'city'
  | 'town'
  | 'village'
  | 'suburb'
  | 'street'
  | 'highway'
  | 'hospital'
  | 'fuel'
  | 'ev'
  | 'station'
  | 'airport'
  | 'university'
  | 'school'
  | 'restaurant'
  | 'landmark'
  | 'poi'
  | 'place';

export interface SearchResult {
  id: string;
  name: string;
  displayName: string;
  type: SearchPlaceType;
  category: string;
  latitude: number;
  longitude: number;
  coordinates: [number, number]; // [lng, lat]
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  provider: 'TomTom' | 'Photon' | 'Nominatim' | 'Coordinate' | 'Local';
  source: string;
  confidence: number;
  distanceKm?: number;
  boundingBox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

export interface SearchOptions {
  originCoords?: [number, number]; // [lng, lat]
  limit?: number;
  signal?: AbortSignal;
}

class SearchService {
  /**
   * Universal search supporting queries for cities, villages, roads, landmarks, POIs, and coordinates
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const origin = options.originCoords || [80.6480, 16.5062]; // Default Vijayawada if no GPS

    // 1. Direct Coordinate Parsing
    const parsedCoords = parseCoordinates(trimmed);
    if (parsedCoords) {
      const dist = options.originCoords ? calculateDistanceKm(options.originCoords, parsedCoords) : undefined;
      return [
        {
          id: `coord_${parsedCoords[0]}_${parsedCoords[1]}`,
          name: `Coordinates (${parsedCoords[1].toFixed(5)}, ${parsedCoords[0].toFixed(5)})`,
          displayName: `Direct GPS Pin ${dist ? `• ${dist} km away` : ''}`,
          type: 'place',
          category: 'Coordinates',
          latitude: parsedCoords[1],
          longitude: parsedCoords[0],
          coordinates: parsedCoords,
          address: `${parsedCoords[1].toFixed(5)}° N, ${parsedCoords[0].toFixed(5)}° E`,
          provider: 'Coordinate',
          source: 'GPS Coordinate Input',
          confidence: 1.0,
          distanceKm: dist,
        },
      ];
    }

    const collected: SearchResult[] = [];
    const limit = options.limit || 12;

    // 2. PRIMARY: TomTom Search API (Fuzzy & POI Search)
    const tomtomKey = trafficService.getApiKey();
    if (tomtomKey) {
      try {
        const tomtomResults = await this.queryTomTom(trimmed, origin, tomtomKey, limit, options.signal);
        collected.push(...tomtomResults);
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        console.warn('RoadRisk AI: TomTom Search API error, falling back to Photon:', err.message);
      }
    }

    // 3. SECONDARY: Photon Geocoder (OpenStreetMap Worldwide with lat/lon biasing)
    if (collected.length < 4) {
      try {
        const photonResults = await this.queryPhoton(trimmed, origin, limit, options.signal);
        collected.push(...photonResults);
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        console.warn('RoadRisk AI: Photon Search API error, falling back to Nominatim:', err.message);
      }
    }

    // 4. TERTIARY: OpenStreetMap Nominatim (High detail address & village resolution)
    if (collected.length < 3) {
      try {
        const nominatimResults = await this.queryNominatim(trimmed, origin, limit, options.signal);
        collected.push(...nominatimResults);
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        console.warn('RoadRisk AI: Nominatim Search API error:', err.message);
      }
    }

    // 5. Deduplicate by spatial proximity (within 150m) and similar names
    const deduplicated = this.deduplicateResults(collected);

    // 6. Proximity & Exact-match Ranking
    return this.rankResults(deduplicated, trimmed, options.originCoords);
  }

  /**
   * Search by category (e.g. 'hospital', 'fuel', 'ev', 'restaurant', 'station', 'pharmacy')
   */
  async searchCategory(
    category: 'hospital' | 'fuel' | 'ev' | 'restaurant' | 'station' | 'pharmacy' | 'parking',
    originCoords: [number, number],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const categoryKeywords: Record<string, string> = {
      hospital: 'hospital emergency clinic',
      fuel: 'petrol pump fuel station',
      ev: 'ev charging station electric vehicle',
      restaurant: 'restaurant food cafe',
      station: 'railway station train station bus station',
      pharmacy: 'pharmacy medical store chemist',
      parking: 'parking lot car park',
    };

    const query = categoryKeywords[category] || category;
    return this.search(query, { ...options, originCoords });
  }

  /**
   * Reverse geocode [lng, lat] coordinates to human readable place/street name
   */
  async reverseGeocode(coordinates: [number, number]): Promise<string> {
    const [lng, lat] = coordinates;
    const tomtomKey = trafficService.getApiKey();

    if (tomtomKey) {
      try {
        const url = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json?key=${tomtomKey}&radius=150`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (res.ok) {
          const data = await res.json();
          const address = data?.addresses?.[0]?.address;
          if (address) {
            const street = address.streetName || address.freeformAddress;
            const mun = address.municipality || address.countrySubdivision;
            return street ? `${street}, ${mun || ''}`.trim() : address.freeformAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          }
        }
      } catch (e) {
        console.warn('TomTom reverse geocoding failed:', e);
      }
    }

    // Fallback: Nominatim reverse geocode
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17`;
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'RoadRiskAI-CitizenNav/3.0',
        },
      });
      if (res.ok) {
        const data = await res.json();
        return data.display_name?.split(',').slice(0, 3).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    } catch {}

    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  // --------------------------------------------------------------------------
  // PROVIDER 1: TomTom Search API Implementation
  // --------------------------------------------------------------------------
  private async queryTomTom(
    query: string,
    origin: [number, number],
    apiKey: string,
    limit: number,
    signal?: AbortSignal
  ): Promise<SearchResult[]> {
    const [lng, lat] = origin;
    const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(
      query
    )}.json?key=${apiKey}&lat=${lat}&lon=${lng}&radius=60000&limit=${limit}&language=en-GB&idxSet=POI,PAD,Str,XStr,Geo`;

    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`TomTom search failed with status ${res.status}`);
    }

    const data = await res.json();
    const results: SearchResult[] = [];

    if (Array.isArray(data?.results)) {
      data.results.forEach((item: any, idx: number) => {
        const pos = item.position;
        if (!pos || pos.lat == null || pos.lon == null) return;

        const coords: [number, number] = [pos.lon, pos.lat];
        const dist = calculateDistanceKm(origin, coords);

        const poiName = item.poi?.name;
        const address = item.address || {};
        const name = poiName || address.streetName || address.freeformAddress || query;

        const detailParts = [
          address.municipalitySubdivision || address.streetName,
          address.municipality,
          address.countrySubdivision,
        ].filter(Boolean);
        const displayName = detailParts.length > 0 ? detailParts.join(', ') : address.freeformAddress || name;

        // Classify category & place type
        let type: SearchPlaceType = 'place';
        let category = 'Location';
        const poiCategories = (item.poi?.categories || []).map((c: string) => c.toLowerCase());

        if (item.type === 'Geography') {
          if (item.entityType === 'Municipality' || item.entityType === 'CountrySubdivision') type = 'city';
          else if (item.entityType === 'MunicipalitySubdivision') type = 'suburb';
          else type = 'town';
          category = 'Geographic Area';
        } else if (item.type === 'Street' || item.type === 'Cross Street') {
          type = 'street';
          category = 'Road / Street';
        } else if (poiCategories.some((c: string) => c.includes('hospital') || c.includes('health') || c.includes('doctor'))) {
          type = 'hospital';
          category = 'Healthcare Facility';
        } else if (poiCategories.some((c: string) => c.includes('petrol') || c.includes('gas station') || c.includes('fuel'))) {
          type = 'fuel';
          category = 'Fuel Station';
        } else if (poiCategories.some((c: string) => c.includes('electric') || c.includes('charging'))) {
          type = 'ev';
          category = 'EV Charging Station';
        } else if (poiCategories.some((c: string) => c.includes('railway') || c.includes('train') || c.includes('station'))) {
          type = 'station';
          category = 'Railway / Transit Hub';
        } else if (poiCategories.some((c: string) => c.includes('airport') || c.includes('aerodrome'))) {
          type = 'airport';
          category = 'Airport';
        } else if (poiCategories.some((c: string) => c.includes('university') || c.includes('college'))) {
          type = 'university';
          category = 'Higher Education';
        } else if (poiCategories.some((c: string) => c.includes('school'))) {
          type = 'school';
          category = 'Educational Institution';
        } else if (poiCategories.some((c: string) => c.includes('restaurant') || c.includes('cafe') || c.includes('food'))) {
          type = 'restaurant';
          category = 'Dining & Restaurant';
        } else if (item.poi) {
          type = 'poi';
          category = item.poi.classifications?.[0]?.code || 'Point of Interest';
        }

        results.push({
          id: `tt_${item.id || idx}`,
          name,
          displayName: `${displayName} (${dist} km)`,
          type,
          category,
          latitude: pos.lat,
          longitude: pos.lon,
          coordinates: coords,
          address: address.freeformAddress,
          city: address.municipality,
          state: address.countrySubdivision,
          country: address.country,
          postalCode: address.postalCode,
          provider: 'TomTom',
          source: 'TomTom Search v2',
          confidence: Math.min(1.0, (item.score || 5) / 10),
          distanceKm: dist,
        });
      });
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // PROVIDER 2: Photon Komoot API Implementation (OSM Data with Proximity Bias)
  // --------------------------------------------------------------------------
  private async queryPhoton(
    query: string,
    origin: [number, number],
    limit: number,
    signal?: AbortSignal
  ): Promise<SearchResult[]> {
    const [lng, lat] = origin;
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      query
    )}&lat=${lat}&lon=${lng}&limit=${limit}`;

    const res = await fetch(url, {
      signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RoadRiskAI-CitizenNav/3.0',
      },
    });

    if (!res.ok) {
      throw new Error(`Photon search failed with status ${res.status}`);
    }

    const data = await res.json();
    const results: SearchResult[] = [];

    if (Array.isArray(data?.features)) {
      data.features.forEach((feature: any, idx: number) => {
        const props = feature.properties || {};
        const geom = feature.geometry || {};
        if (!geom.coordinates || geom.coordinates.length < 2) return;

        const coords: [number, number] = [
          parseFloat(geom.coordinates[0].toFixed(6)),
          parseFloat(geom.coordinates[1].toFixed(6)),
        ];
        const dist = calculateDistanceKm(origin, coords);

        const primaryName = props.name || props.street || props.city || query;
        const detailParts = [
          props.street,
          props.district,
          props.city,
          props.state,
          props.country,
        ].filter(Boolean);
        const displayName = detailParts.length > 0 ? detailParts.join(', ') : 'Geocoded Location';

        let type: SearchPlaceType = 'place';
        let category = 'Location';

        if (props.osm_value === 'city' || props.type === 'city') {
          type = 'city';
          category = 'City';
        } else if (props.osm_value === 'town') {
          type = 'town';
          category = 'Town';
        } else if (props.osm_value === 'village') {
          type = 'village';
          category = 'Village';
        } else if (props.osm_value === 'suburb') {
          type = 'suburb';
          category = 'Locality / Neighborhood';
        } else if (props.osm_value === 'hospital' || props.osm_key === 'healthcare') {
          type = 'hospital';
          category = 'Hospital';
        } else if (props.osm_value === 'fuel') {
          type = 'fuel';
          category = 'Petrol Station';
        } else if (props.osm_value === 'station' || props.osm_value === 'railway') {
          type = 'station';
          category = 'Railway Station';
        } else if (props.osm_value === 'aerodrome' || props.osm_value === 'airport') {
          type = 'airport';
          category = 'Airport';
        } else if (props.osm_value === 'university' || props.osm_value === 'college') {
          type = 'university';
          category = 'College / University';
        } else if (props.osm_value === 'school') {
          type = 'school';
          category = 'School';
        } else if (props.osm_value === 'restaurant' || props.osm_value === 'cafe') {
          type = 'restaurant';
          category = 'Restaurant';
        } else if (props.osm_key === 'tourism' || props.osm_value === 'monument' || props.osm_value === 'attraction') {
          type = 'landmark';
          category = 'Landmark';
        } else if (props.osm_key === 'highway') {
          type = (props.osm_value === 'motorway' || props.osm_value === 'trunk' || props.osm_value === 'primary') ? 'highway' : 'street';
          category = 'Road / Highway';
        }

        results.push({
          id: `photon_${props.osm_id || idx}_${idx}`,
          name: primaryName,
          displayName: `${displayName} (${dist} km)`,
          type,
          category,
          latitude: coords[1],
          longitude: coords[0],
          coordinates: coords,
          city: props.city,
          district: props.district,
          state: props.state,
          country: props.country,
          provider: 'Photon',
          source: 'OpenStreetMap Photon API',
          confidence: 0.85,
          distanceKm: dist,
        });
      });
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // PROVIDER 3: OpenStreetMap Nominatim API Implementation
  // --------------------------------------------------------------------------
  private async queryNominatim(
    query: string,
    origin: [number, number],
    limit: number,
    signal?: AbortSignal
  ): Promise<SearchResult[]> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&addressdetails=1&limit=${limit}`;

    const res = await fetch(url, {
      signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RoadRiskAI-CitizenNav/3.0',
      },
    });

    if (!res.ok) {
      throw new Error(`Nominatim search failed with status ${res.status}`);
    }

    const data = await res.json();
    const results: SearchResult[] = [];

    if (Array.isArray(data)) {
      data.forEach((item: any, idx: number) => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (isNaN(lat) || isNaN(lon)) return;

        const coords: [number, number] = [lon, lat];
        const dist = calculateDistanceKm(origin, coords);
        const addr = item.address || {};

        let type: SearchPlaceType = 'place';
        let category = item.type || 'Location';

        if (item.type === 'city' || item.class === 'boundary') type = 'city';
        else if (item.type === 'town') type = 'town';
        else if (item.type === 'village') type = 'village';
        else if (item.type === 'suburb') type = 'suburb';
        else if (item.type === 'hospital') type = 'hospital';
        else if (item.type === 'fuel') type = 'fuel';
        else if (item.type === 'station') type = 'station';
        else if (item.type === 'university' || item.type === 'college') type = 'university';
        else if (item.type === 'school') type = 'school';

        const name = addr.hospital || addr.amenity || addr.building || addr.road || addr.village || addr.town || addr.city || item.display_name.split(',')[0];
        const displayParts = [
          addr.suburb || addr.neighbourhood,
          addr.city || addr.town || addr.village,
          addr.state,
        ].filter(Boolean);
        const displayName = displayParts.length > 0 ? displayParts.join(', ') : item.display_name.split(',').slice(1, 4).join(', ');

        results.push({
          id: `nom_${item.place_id || idx}`,
          name: name.trim(),
          displayName: `${displayName} (${dist} km)`,
          type,
          category,
          latitude: lat,
          longitude: lon,
          coordinates: coords,
          address: item.display_name,
          city: addr.city || addr.town || addr.village,
          state: addr.state,
          country: addr.country,
          postalCode: addr.postcode,
          provider: 'Nominatim',
          source: 'OpenStreetMap Nominatim',
          confidence: 0.8,
          distanceKm: dist,
        });
      });
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Deduplication & Multi-Factor Ranking
  // --------------------------------------------------------------------------
  private deduplicateResults(items: SearchResult[]): SearchResult[] {
    const deduped: SearchResult[] = [];

    for (const item of items) {
      const isDuplicate = deduped.some((existing) => {
        const spatialDist = calculateDistanceKm(item.coordinates, existing.coordinates);
        // If within 150 meters, consider duplicate and keep higher confidence provider
        if (spatialDist < 0.15) return true;

        // If same name and within 1.5 km
        const nameNorm1 = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const nameNorm2 = existing.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (nameNorm1.length > 3 && nameNorm1 === nameNorm2 && spatialDist < 1.5) {
          return true;
        }

        return false;
      });

      if (!isDuplicate) {
        deduped.push(item);
      }
    }

    return deduped;
  }

  private rankResults(items: SearchResult[], query: string, originCoords?: [number, number]): SearchResult[] {
    const lowerQuery = query.toLowerCase().trim();

    return items.sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();

      // 1. Exact match to place name has highest priority
      const exactA = nameA === lowerQuery ? 2 : nameA.startsWith(lowerQuery) ? 1 : 0;
      const exactB = nameB === lowerQuery ? 2 : nameB.startsWith(lowerQuery) ? 1 : 0;
      if (exactA !== exactB) return exactB - exactA;

      // 2. Query words contained in name
      const containsA = nameA.includes(lowerQuery) ? 1 : 0;
      const containsB = nameB.includes(lowerQuery) ? 1 : 0;
      if (containsA !== containsB) return containsB - containsA;

      // 3. Proximity to user if origin provided
      if (originCoords) {
        const distA = a.distanceKm ?? 99999;
        const distB = b.distanceKm ?? 99999;
        // Prioritize nearby matches if within 30km
        if (distA < 30 && distB >= 30) return -1;
        if (distB < 30 && distA >= 30) return 1;
        return distA - distB;
      }

      // 4. Fallback to confidence
      return b.confidence - a.confidence;
    });
  }
  // --------------------------------------------------------------------------
  // AI NATURAL LANGUAGE SEARCH & CONSTRAINT EXTRACTION PIPELINE (Section 8)
  // --------------------------------------------------------------------------

  /**
   * Identifies language, intent, category, and extracts multi-dimensional constraints
   * (e.g., "Find a vegetarian restaurant under ₹500 within 2 km with parking")
   */
  public parseNaturalLanguageQuery(rawQuery: string): NaturalLanguageQueryConstraints {
    const text = rawQuery.trim();
    const lower = text.toLowerCase();

    // 1. Language Identification
    let detectedLanguage: 'en' | 'te' | 'hi' | 'ta' | 'kn' = 'en';
    if (/[\u0C00-\u0C7F]/.test(text)) detectedLanguage = 'te';
    else if (/[\u0900-\u097F]/.test(text)) detectedLanguage = 'hi';
    else if (/[\u0B80-\u0BFF]/.test(text)) detectedLanguage = 'ta';
    else if (/[\u0C80-\u0CFF]/.test(text)) detectedLanguage = 'kn';

    // 2. Category Extraction
    let category: SearchPlaceType | undefined;
    if (
      lower.includes('restaurant') || lower.includes('food') || lower.includes('hotel') || lower.includes('cafe') || lower.includes('dhaba') || lower.includes('tiffin') ||
      text.includes('భోజనం') || text.includes('హోటల్') || text.includes('రెస్టారెంట్') || text.includes('रेस्टोरेंट') || text.includes('உணவகம்') || text.includes('ರೆಸ್ಟೋರೆಂಟ್')
    ) {
      category = 'restaurant';
    } else if (
      lower.includes('hospital') || lower.includes('clinic') || lower.includes('emergency') || lower.includes('doctor') ||
      text.includes('ఆసుపత్రి') || text.includes('హాస్పిటల్') || text.includes('అస్పత్ర') || text.includes('अस्पताल') || text.includes('மருத்துவமனை') || text.includes('ಆಸ್ಪತ್ರೆ')
    ) {
      category = 'hospital';
    } else if (
      lower.includes('petrol') || lower.includes('fuel') || lower.includes('diesel') || lower.includes('gas station') ||
      text.includes('పెట్రోల్') || text.includes('ఇంధనం') || text.includes('पेट्रोल') || text.includes('எரிபொருள்') || text.includes('ಪೆಟ್ರೋಲ್')
    ) {
      category = 'fuel';
    } else if (lower.includes('ev') || lower.includes('charging') || lower.includes('electric vehicle')) {
      category = 'ev';
    } else if (
      lower.includes('parking') || lower.includes('car park') ||
      text.includes('పార్కింగ్') || text.includes('पार्किंग') || text.includes('பார்க்கிங்') || text.includes('ಪಾರ್ಕಿಂಗ್')
    ) {
      category = 'parking' as any;
    } else if (
      lower.includes('pharmacy') || lower.includes('chemist') || lower.includes('medical store') ||
      text.includes('మందుల దుకాణం') || text.includes('दवाखाना') || text.includes('மருந்தகம்') || text.includes('ಔಷಧಾಲಯ')
    ) {
      category = 'pharmacy' as any;
    }

    // 3. Dietary Extraction
    let dietary: 'vegetarian' | 'vegan' | 'non-veg' | undefined;
    if (lower.includes('pure veg') || lower.includes('vegetarian') || lower.includes(' veg ') || lower.startsWith('veg ')) {
      dietary = 'vegetarian';
    } else if (lower.includes('vegan')) {
      dietary = 'vegan';
    } else if (lower.includes('non-veg') || lower.includes('non veg') || lower.includes('biryani')) {
      dietary = 'non-veg';
    }

    // 4. Budget Constraint Extraction (e.g. "under ₹500", "below 1000", "< 500")
    let maxBudgetInr: number | undefined;
    const budgetMatch = lower.match(/(?:under|below|less than|<|within budget of)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i) ||
                        lower.match(/(?:₹|rs\.?|inr)\s*(\d+)\s*(?:or less|budget|max)/i);
    if (budgetMatch) {
      maxBudgetInr = parseInt(budgetMatch[1], 10);
    }

    // 5. Distance Constraint Extraction (e.g. "within 2 km", "< 5km", "nearby")
    let maxDistanceKm: number | undefined;
    const distanceMatch = lower.match(/(?:within|<|under)\s*(\d+(?:\.\d+)?)\s*(?:km|kms|kilometers|kilometer)/i);
    if (distanceMatch) {
      maxDistanceKm = parseFloat(distanceMatch[1]);
    } else if (lower.includes('nearby') || lower.includes('near me') || lower.includes('close by')) {
      maxDistanceKm = 5.0;
    }

    // 6. Facilities & Amenities Extraction
    const facilities: string[] = [];
    if (lower.includes('parking') || lower.includes('valet')) facilities.push('parking');
    if (lower.includes('ev') || lower.includes('charging')) facilities.push('ev_charging');
    if (lower.includes('wifi') || lower.includes('wi-fi')) facilities.push('wifi');
    if (lower.includes('wheelchair') || lower.includes('accessible') || lower.includes('ramp')) facilities.push('wheelchair_accessible');
    if (lower.includes('outdoor') || lower.includes('open air') || lower.includes('rooftop')) facilities.push('outdoor_seating');

    // 7. Clean Query for Underlying Geospatial Search Engine
    let cleanedKeyword = text
      .replace(/(?:find|show|search|look for|get|where is|navigate to)\s+(?:a|an|the)?/gi, '')
      .replace(/(?:under|below|less than|<)\s*(?:₹|rs\.?|inr)?\s*\d+/gi, '')
      .replace(/(?:within|<|under)\s*\d+(?:\.\d+)?\s*(?:km|kms|kilometers|kilometer)/gi, '')
      .replace(/(?:with|having)\s+(?:parking|ev|charging|wifi|wheelchair)/gi, '')
      .replace(/(?:nearby|near me|close by)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedKeyword && category) {
      cleanedKeyword = dietary ? `${dietary} ${category}` : category;
    }

    return {
      originalQuery: text,
      cleanedKeyword: cleanedKeyword || text,
      detectedLanguage,
      category,
      dietary,
      maxBudgetInr,
      maxDistanceKm,
      facilities,
      amenities: facilities,
    };
  }

  /**
   * Executes multi-condition natural language search with constraint ranking and filtering
   */
  public async searchNaturalLanguage(
    query: string,
    options: SearchOptions = {}
  ): Promise<{ results: SearchResult[]; constraints: NaturalLanguageQueryConstraints }> {
    const constraints = this.parseNaturalLanguageQuery(query);
    const searchTarget = constraints.cleanedKeyword || query;

    let results = await this.search(searchTarget, options);

    // Apply distance constraint filter if specified and origin exists
    if (constraints.maxDistanceKm !== undefined && options.originCoords) {
      results = results.filter((r) => (r.distanceKm ?? 0) <= constraints.maxDistanceKm!);
    }

    // Annotate results with extracted metadata
    return {
      results,
      constraints,
    };
  }
}

export interface NaturalLanguageQueryConstraints {
  originalQuery: string;
  cleanedKeyword: string;
  detectedLanguage: 'en' | 'te' | 'hi' | 'ta' | 'kn';
  category?: SearchPlaceType | string;
  dietary?: 'vegetarian' | 'vegan' | 'non-veg';
  maxBudgetInr?: number;
  maxDistanceKm?: number;
  facilities: string[];
  amenities: string[];
}

export const searchService = new SearchService();
export default searchService;
