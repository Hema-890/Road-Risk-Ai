// Centralized Place & Geocoding Service for RoadRisk AI
// Provides Google-Maps-grade geographic entity resolution, Wikimedia photo enrichment,
// OpenStreetMap Photon reverse geocoding, nearby POI discovery, and live weather telemetry.
import trafficService from './trafficService.ts';

export type PlaceType =
  | 'city'
  | 'town'
  | 'village'
  | 'road'
  | 'highway'
  | 'street'
  | 'landmark'
  | 'hospital'
  | 'fuel'
  | 'transit'
  | 'railway_station'
  | 'bus_stop'
  | 'restaurant'
  | 'hotel'
  | 'airport'
  | 'university'
  | 'ev_charging'
  | 'poi';

export interface PlaceWeather {
  temperatureC: number;
  windSpeedKmh: number;
  condition: string;
  isDay: boolean;
  timeString: string;
  source: 'open_meteo_live';
}

export interface NormalizedPlace {
  id: string;
  name: string;
  type: PlaceType;
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
  population?: string;
  description?: string;
  extract?: string;
  image?: string;
  photos: string[];
  rating?: number;
  reviewsCount?: number;
  categories?: string[];
  openingHours?: string;
  website?: string;
  phone?: string;
  wikipediaUrl?: string;
  distanceKm?: number;
  roadInfo?: {
    roadClass?: string;
    trafficDensity?: 'low' | 'moderate' | 'heavy' | 'jammed';
    riskIndex?: number;
    riskLevel?: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
    trafficDataSource: 'DEMO' | 'LIVE' | 'STATIC' | 'NOT_CONFIGURED';
    currentSpeedKmh?: number;
    freeFlowSpeedKmh?: number;
    delaySec?: number;
    sourceNotice?: string;
  };
  weather?: PlaceWeather;
  metadata?: Record<string, any>;
}

export interface PlaceCategoryItem {
  key: string;
  label: string;
  iconName: string;
  query: string;
}

const PLACE_CACHE = new Map<string, NormalizedPlace>();
const PHOTO_CACHE = new Map<string, string[]>();

/**
 * Calculates Haversine distance in km between [lng1, lat1] and [lng2, lat2]
 */
export function calculateDistanceKm(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371;
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
 * Maps OpenStreetMap tag values to normalized PlaceType
 */
export function mapOsmTagToPlaceType(osmKey?: string, osmValue?: string, type?: string): PlaceType {
  if (osmValue === 'city') return 'city';
  if (osmValue === 'town') return 'town';
  if (osmValue === 'village') return 'village';
  if (osmValue === 'hospital' || osmKey === 'healthcare') return 'hospital';
  if (osmValue === 'fuel') return 'fuel';
  if (osmValue === 'charging_station') return 'ev_charging';
  if (osmValue === 'station' || osmValue === 'railway') return 'railway_station';
  if (osmValue === 'bus_stop' || osmValue === 'bus_station') return 'bus_stop';
  if (osmValue === 'restaurant' || osmValue === 'cafe' || osmValue === 'fast_food') return 'restaurant';
  if (osmValue === 'hotel' || osmValue === 'motel' || osmValue === 'guest_house') return 'hotel';
  if (osmValue === 'aerodrome' || osmValue === 'airport') return 'airport';
  if (osmValue === 'university' || osmValue === 'college') return 'university';
  if (osmKey === 'highway') {
    if (osmValue === 'motorway' || osmValue === 'trunk' || osmValue === 'primary') return 'highway';
    return 'road';
  }
  if (osmValue === 'monument' || osmValue === 'attraction' || osmValue === 'viewpoint') return 'landmark';
  if (type === 'city') return 'city';
  return 'poi';
}

/**
 * Fetch live weather from free open-meteo API
 */
async function fetchLiveWeather(lat: number, lon: number): Promise<PlaceWeather | undefined> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current_weather=true`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return undefined;
    const data = await res.json();
    const cw = data.current_weather;
    if (!cw) return undefined;

    const weatherCodes: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      51: 'Light drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      80: 'Rain showers',
      95: 'Thunderstorm',
    };

    return {
      temperatureC: Math.round(cw.temperature),
      windSpeedKmh: Math.round(cw.windspeed),
      condition: weatherCodes[cw.weathercode] || 'Clear',
      isDay: cw.is_day === 1,
      timeString: cw.time ? new Date(cw.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now',
      source: 'open_meteo_live',
    };
  } catch {
    return undefined;
  }
}

/**
 * Sourced Wikipedia & Wikimedia enrichment for legitimate, legal place info & photography
 */
async function fetchWikipediaEnrichment(
  name: string,
  coords: [number, number]
): Promise<{
  extract?: string;
  description?: string;
  image?: string;
  photos: string[];
  wikipediaUrl?: string;
}> {
  const cacheKey = `${name.toLowerCase()}_${coords[0].toFixed(2)}_${coords[1].toFixed(2)}`;
  if (PHOTO_CACHE.has(cacheKey)) {
    const cachedPhotos = PHOTO_CACHE.get(cacheKey) || [];
    return {
      photos: cachedPhotos,
      image: cachedPhotos[0],
    };
  }

  // 1. Clean query for Wikipedia lookup
  const cleanName = name
    .replace(/\s+(Railway Station|Bus Stop|Airport|Junction|Center|Centre|Circle|Highway|Bridge)$/i, '')
    .trim();

  let articleTitle = cleanName;
  let summaryData: any = null;

  try {
    // Attempt exact or cleaned title
    const summaryRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`,
      { headers: { Accept: 'application/json', 'User-Agent': 'RoadRiskAI/3.0 (info@roadrisk.ai)' } }
    );
    if (summaryRes.ok) {
      summaryData = await summaryRes.json();
    }
  } catch {}

  // 2. If title lookup fails or returns disambiguation, use GeoSearch to find closest Wikipedia article within 8km
  if (!summaryData || summaryData.type === 'disambiguation') {
    try {
      const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${coords[1]}|${coords[0]}&gsradius=8000&gslimit=3&format=json&origin=*`;
      const geoRes = await fetch(geoUrl);
      if (geoRes.ok) {
        const geoJson = await geoRes.json();
        const topGeo = geoJson.query?.geosearch?.[0];
        if (topGeo?.title) {
          articleTitle = topGeo.title;
          const sumRes = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(articleTitle)}`
          );
          if (sumRes.ok) {
            summaryData = await sumRes.json();
          }
        }
      }
    } catch {}
  }

  const photos: string[] = [];
  let mainImage: string | undefined = undefined;

  if (summaryData) {
    if (summaryData.originalimage?.source) {
      mainImage = summaryData.originalimage.source;
      if (mainImage) photos.push(mainImage);
    } else if (summaryData.thumbnail?.source) {
      mainImage = summaryData.thumbnail.source;
      if (mainImage) photos.push(mainImage);
    }
  }

  // 3. Fetch gallery images from Wikipedia article
  if (articleTitle) {
    try {
      const imagesUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
        articleTitle
      )}&generator=images&gimlimit=8&prop=imageinfo&iiprop=url|mime&format=json&origin=*`;
      const imgRes = await fetch(imagesUrl);
      if (imgRes.ok) {
        const imgJson = await imgRes.json();
        const pages = imgJson.query?.pages || {};
        for (const pid of Object.keys(pages)) {
          const info = pages[pid]?.imageinfo?.[0];
          if (
            info?.url &&
            (info.mime === 'image/jpeg' || info.mime === 'image/png' || info.mime === 'image/webp') &&
            !info.url.toLowerCase().includes('icon') &&
            !info.url.toLowerCase().includes('logo') &&
            !info.url.toLowerCase().includes('flag') &&
            !info.url.toLowerCase().includes('stub')
          ) {
            if (!photos.includes(info.url)) {
              photos.push(info.url);
            }
          }
        }
      }
    } catch {}
  }

  PHOTO_CACHE.set(cacheKey, photos);

  return {
    extract: summaryData?.extract,
    description: summaryData?.description,
    image: mainImage || photos[0],
    photos: photos.slice(0, 6),
    wikipediaUrl: summaryData?.content_urls?.desktop?.page,
  };
}

export class PlaceService {
  /**
   * Search places globally via OpenStreetMap Photon API
   */
  static async searchPlaces(
    query: string,
    referenceCoords?: [number, number],
    limit: number = 10
  ): Promise<NormalizedPlace[]> {
    const clean = query.trim();
    if (!clean) return [];

    const results: NormalizedPlace[] = [];

    // 1. Coordinate check
    const coordMatch = clean.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const p1 = parseFloat(coordMatch[1]);
      const p2 = parseFloat(coordMatch[3]);
      const coords: [number, number] = Math.abs(p1) <= 90 ? [p2, p1] : [p1, p2];
      const rev = await this.reverseGeocode(coords);
      return [rev];
    }

    // 2. Query Photon
    try {
      const lat = referenceCoords ? referenceCoords[1] : 16.5062;
      const lon = referenceCoords ? referenceCoords[0] : 80.648;
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(clean)}&lat=${lat}&lon=${lon}&limit=${limit}`;

      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'RoadRiskAI/3.0' },
      });
      if (res.ok) {
        const data = await res.json();
        const features = data.features || [];

        for (let i = 0; i < features.length; i++) {
          const f = features[i];
          const props = f.properties || {};
          const geom = f.geometry || {};
          if (!geom.coordinates || geom.coordinates.length < 2) continue;

          const coords: [number, number] = [
            parseFloat(geom.coordinates[0].toFixed(6)),
            parseFloat(geom.coordinates[1].toFixed(6)),
          ];
          const dist = referenceCoords ? calculateDistanceKm(referenceCoords, coords) : undefined;
          const name = props.name || props.street || props.city || clean;
          const addressParts = [
            props.housenumber,
            props.street,
            props.district,
            props.city,
            props.state,
            props.country,
          ].filter(Boolean);
          const address = addressParts.join(', ') || 'Geocoded Address';
          const placeType = mapOsmTagToPlaceType(props.osm_key, props.osm_value, props.type);

          results.push({
            id: `osm_${props.osm_id || i}_${i}`,
            name,
            type: placeType,
            latitude: coords[1],
            longitude: coords[0],
            address,
            city: props.city,
            state: props.state,
            country: props.country,
            postcode: props.postcode,
            photos: [],
            distanceKm: dist,
            metadata: {
              osmKey: props.osm_key,
              osmValue: props.osm_value,
              type: props.type,
            },
          });
        }
      }
    } catch (err) {
      console.warn('[PlaceService] Search failed:', err);
    }

    return results;
  }

  /**
   * Enrich place with Wikipedia sourced description, real Wikimedia photos, and live weather
   */
  static async getPlaceDetails(
    id: string,
    name: string,
    coords: [number, number],
    type?: PlaceType,
    address?: string
  ): Promise<NormalizedPlace> {
    const cacheKey = `place_${id}_${coords.join('_')}`;
    if (PLACE_CACHE.has(cacheKey)) {
      return PLACE_CACHE.get(cacheKey)!;
    }

    const [wikiData, weatherData, trafficData] = await Promise.all([
      fetchWikipediaEnrichment(name, coords),
      fetchLiveWeather(coords[1], coords[0]),
      (type === 'road' || type === 'highway')
        ? trafficService.getLiveSegmentTraffic(coords[1], coords[0])
        : Promise.resolve(null),
    ]);

    // Risk / Traffic computation for roads
    let roadInfo: NormalizedPlace['roadInfo'] = undefined;
    if ((type === 'road' || type === 'highway') && trafficData) {
      if (trafficData.status === 'LIVE') {
        const density =
          trafficData.congestionLevel === 'severe'
            ? 'jammed'
            : trafficData.congestionLevel === 'heavy'
            ? 'heavy'
            : trafficData.congestionLevel === 'moderate'
            ? 'moderate'
            : 'low';
        roadInfo = {
          roadClass: type === 'highway' ? 'National / Arterial Highway' : 'Major Urban Roadway',
          trafficDensity: density,
          riskIndex: trafficData.congestionLevel === 'severe' ? 75 : trafficData.congestionLevel === 'heavy' ? 55 : 25,
          riskLevel: trafficData.congestionLevel === 'severe' ? 'HIGH' : trafficData.congestionLevel === 'heavy' ? 'ELEVATED' : 'LOW',
          trafficDataSource: 'LIVE',
          currentSpeedKmh: trafficData.currentSpeedKmh,
          freeFlowSpeedKmh: trafficData.freeFlowSpeedKmh,
          delaySec: trafficData.delaySec,
          sourceNotice: trafficData.sourceNotice,
        };
      } else if (trafficData.status === 'DEMO') {
        roadInfo = {
          roadClass: type === 'highway' ? 'National / Arterial Highway' : 'Major Urban Roadway',
          trafficDensity: 'moderate',
          riskIndex: 38,
          riskLevel: 'MODERATE',
          trafficDataSource: 'DEMO',
          sourceNotice: 'Simulated baseline road profile',
        };
      } else {
        // NOT_CONFIGURED — strict compliance with Rule 27, zero fabrication
        roadInfo = {
          roadClass: type === 'highway' ? 'National / Arterial Highway' : 'Major Urban Roadway',
          trafficDataSource: 'NOT_CONFIGURED',
          sourceNotice: 'Live road flow requires VITE_TRAFFIC_API_KEY (TomTom Traffic API) in .env',
        };
      }
    }

    const normalized: NormalizedPlace = {
      id,
      name,
      type: type || 'poi',
      latitude: coords[1],
      longitude: coords[0],
      address: address || `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}`,
      description: wikiData.description || (type === 'city' ? `Metropolis in ${coords[1].toFixed(2)}°N, ${coords[0].toFixed(2)}°E` : undefined),
      extract: wikiData.extract,
      image: wikiData.image,
      photos: wikiData.photos,
      wikipediaUrl: wikiData.wikipediaUrl,
      weather: weatherData,
      roadInfo,
      metadata: {
        lastUpdated: new Date().toISOString(),
      },
    };

    PLACE_CACHE.set(cacheKey, normalized);
    return normalized;
  }

  /**
   * Reverse geocode a coordinate to get street, city, or place entity
   */
  static async reverseGeocode(coords: [number, number]): Promise<NormalizedPlace> {
    const lon = coords[0];
    const lat = coords[1];
    const defaultName = `Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;

    try {
      const url = `https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'RoadRiskAI/3.0' } });
      if (res.ok) {
        const data = await res.json();
        const feat = data.features?.[0];
        if (feat) {
          const props = feat.properties || {};
          const name = props.name || props.street || props.locality || props.city || defaultName;
          const placeType = mapOsmTagToPlaceType(props.osm_key, props.osm_value, props.type);
          const addressParts = [
            props.housenumber,
            props.street,
            props.locality,
            props.district,
            props.city,
            props.state,
            props.country,
          ].filter(Boolean);
          const address = addressParts.join(', ') || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

          return await this.getPlaceDetails(
            `rev_${coords.join('_')}`,
            name,
            coords,
            placeType,
            address
          );
        }
      }
    } catch (err) {
      console.warn('[PlaceService] Reverse geocode error:', err);
    }

    return {
      id: `coord_${coords.join('_')}`,
      name: defaultName,
      type: 'poi',
      latitude: lat,
      longitude: lon,
      address: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      photos: [],
    };
  }

  /**
   * Find nearby places (restaurants, fuel stations, hospitals, transit, hotels)
   */
  static async getNearbyPlaces(
    coords: [number, number],
    categoryQuery: string = 'amenity',
    limit: number = 6
  ): Promise<NormalizedPlace[]> {
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        categoryQuery
      )}&lat=${coords[1]}&lon=${coords[0]}&limit=${limit}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'RoadRiskAI/3.0' } });
      if (!res.ok) return [];
      const data = await res.json();
      const features = data.features || [];

      const nearby: NormalizedPlace[] = [];
      for (const f of features) {
        const props = f.properties || {};
        const geom = f.geometry || {};
        if (!geom.coordinates) continue;
        const pCoords: [number, number] = geom.coordinates;
        const dist = calculateDistanceKm(coords, pCoords);
        const name = props.name || props.street || 'Nearby Facility';
        const type = mapOsmTagToPlaceType(props.osm_key, props.osm_value, props.type);

        nearby.push({
          id: `nearby_${props.osm_id || Math.random().toString(36).substring(7)}`,
          name,
          type,
          latitude: pCoords[1],
          longitude: pCoords[0],
          address: [props.street, props.city, props.state].filter(Boolean).join(', ') || 'Local Point',
          photos: [],
          distanceKm: dist,
        });
      }
      return nearby.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    } catch {
      return [];
    }
  }

  /**
   * Supported quick search categories
   */
  static getPlaceCategories(): PlaceCategoryItem[] {
    return [
      { key: 'city', label: 'Cities', iconName: 'Building', query: 'city town' },
      { key: 'restaurant', label: 'Restaurants', iconName: 'Utensils', query: 'restaurant cafe food' },
      { key: 'fuel', label: 'Petrol Pumps', iconName: 'Fuel', query: 'fuel petrol station' },
      { key: 'ev', label: 'EV Charging', iconName: 'Zap', query: 'ev charging station' },
      { key: 'hospital', label: 'Hospitals', iconName: 'Building2', query: 'hospital emergency trauma' },
      { key: 'transit', label: 'Transit / Trains', iconName: 'Train', query: 'railway station bus stop' },
      { key: 'hotel', label: 'Hotels', iconName: 'Bed', query: 'hotel lodging resort' },
      { key: 'landmark', label: 'Landmarks', iconName: 'MapPin', query: 'tourism attraction monument' },
    ];
  }
}

export default PlaceService;
