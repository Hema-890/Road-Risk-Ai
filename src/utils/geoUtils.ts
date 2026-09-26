// Geographic and coordinate math utilities for RoadRisk AI

export function calculateDistanceMeters(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function calculateBearingDegrees(
  start: [number, number],
  end: [number, number]
): number {
  const [lon1, lat1] = start;
  const [lon2, lat2] = end;

  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);

  const θ = Math.atan2(y, x);
  const bearing = ((θ * 180) / Math.PI + 360) % 360;
  return Math.round(bearing);
}

// Compute cumulative lengths along a polyline
export function getPolylineDistances(coords: [number, number][]): number[] {
  const distances = [0];
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const dist = calculateDistanceMeters(coords[i], coords[i + 1]);
    total += dist;
    distances.push(total);
  }
  return distances;
}

// Interpolate position along polyline at fraction t (0.0 <= t <= 1.0)
export function interpolatePositionAlongPolyline(
  coords: [number, number][],
  t: number
): {
  position: [number, number];
  heading: number;
  segmentIndex: number;
} {
  if (!coords || coords.length === 0) {
    return { position: [77.5946, 12.9716], heading: 0, segmentIndex: 0 };
  }
  if (coords.length === 1 || t <= 0) {
    return { position: coords[0], heading: 0, segmentIndex: 0 };
  }
  if (t >= 1) {
    const last = coords[coords.length - 1];
    const prev = coords[coords.length - 2];
    return {
      position: last,
      heading: calculateBearingDegrees(prev, last),
      segmentIndex: coords.length - 2,
    };
  }

  const distances = getPolylineDistances(coords);
  const totalDistance = distances[distances.length - 1];
  const targetDistance = t * totalDistance;

  for (let i = 0; i < distances.length - 1; i++) {
    const startDist = distances[i];
    const endDist = distances[i + 1];

    if (targetDistance >= startDist && targetDistance <= endDist) {
      const segLength = endDist - startDist;
      const segFraction = segLength > 0 ? (targetDistance - startDist) / segLength : 0;

      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];

      const currentLng = lon1 + (lon2 - lon1) * segFraction;
      const currentLat = lat1 + (lat2 - lat1) * segFraction;
      const heading = calculateBearingDegrees([lon1, lat1], [lon2, lat2]);

      return {
        position: [currentLng, currentLat],
        heading,
        segmentIndex: i,
      };
    }
  }

  return {
    position: coords[coords.length - 1],
    heading: 0,
    segmentIndex: coords.length - 1,
  };
}

// Bounding box for MapLibre camera fit
export function getBoundsForCoordinates(coords: [number, number][]): [[number, number], [number, number]] {
  if (!coords.length) return [[77.58, 12.96], [77.63, 13.01]];

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/**
 * Validates whether coordinates fall within valid terrestrial WGS84 ranges
 */
export function validateCoordinates(coord: unknown): coord is [number, number] {
  if (!Array.isArray(coord) || coord.length < 2) return false;
  const [lng, lat] = coord;
  if (typeof lng !== 'number' || typeof lat !== 'number') return false;
  if (isNaN(lng) || isNaN(lat)) return false;
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

/**
 * Filters out impossible GPS jumps (e.g. simulated teleportation or GPS drift > 220 km/h)
 */
export function isRealisticGpsMovement(
  prevCoord: [number, number] | null,
  newCoord: [number, number],
  timeDeltaMs: number
): boolean {
  if (!prevCoord || timeDeltaMs <= 0) return true;
  const distMeters = calculateDistanceMeters(prevCoord, newCoord);
  const timeSeconds = timeDeltaMs / 1000;
  const speedKmh = (distMeters / timeSeconds) * 3.6;
  // Speed threshold for ground vehicles in urban navigation: 220 km/h
  return speedKmh <= 220;
}

/**
 * Standardized coordinate formatting
 */
export function formatCoordinates(coord: [number, number], precision = 4): string {
  const [lng, lat] = coord;
  const latStr = `${Math.abs(lat).toFixed(precision)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(precision)}° ${lng >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lngStr}`;
}

/**
 * Distance in kilometers
 */
export function calculateDistanceKm(
  coord1: [number, number],
  coord2: [number, number]
): number {
  return Number((calculateDistanceMeters(coord1, coord2) / 1000).toFixed(2));
}

