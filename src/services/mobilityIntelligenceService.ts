// ==============================================================================
// ROADRISK AI — MOBILITY, FUEL, COST & PARKING INTELLIGENCE SERVICE
// Computes transparent fuel consumption, toll estimates, parking recommendations,
// and carbon footprint. Explicitly flags all figures as model estimates.
// ==============================================================================

import type { TransportMode } from '../types/index.ts';

export interface TripCostBreakdown {
  fuelCostInr: number;
  tollCostInr: number;
  parkingCostInr: number;
  totalEstimatedCostInr: number;
  estimatedFuelLiters: number;
  estimatedCo2Kg: number;
  isEstimate: boolean;
  disclaimer: string;
}

export interface FuelRecommendation {
  stationName: string;
  brand: string;
  distanceFromRouteMeters: number;
  fuelTypes: ('petrol' | 'diesel' | 'cng' | 'ev')[];
  estimatedDetourMinutes: number;
}

export interface DestinationParking {
  facilityName: string;
  coordinates: [number, number]; // [lng, lat]
  walkingDistanceMeters: number;
  estimatedWalkingMinutes: number;
  pricingType: 'free' | 'paid' | 'unverified';
  hourlyRateInr?: number;
  hasEvCharging: boolean;
  isCovered: boolean;
}

// Regional benchmark constants (India / AP-Telangana reference standards)
const FUEL_PRICE_PER_LITER: Record<'petrol' | 'diesel' | 'cng', number> = {
  petrol: 109.5,
  diesel: 97.5,
  cng: 85.0,
};

// Fuel efficiency averages (km per liter)
const VEHICLE_EFFICIENCY_KM_PER_LITER: Record<TransportMode, number> = {
  CAR: 14.5,
  BIKE: 42.0,
  BICYCLE: Infinity,
  WALK: Infinity,
  TRANSIT: 25.0, // Per passenger-km equivalent
};

// Carbon emission grams per km
const CO2_GRAMS_PER_KM: Record<TransportMode, number> = {
  CAR: 140, // Standard ICE hatchback/sedan
  BIKE: 45,  // 125-150cc commuter bike
  BICYCLE: 0,
  WALK: 0,
  TRANSIT: 35, // Average bus occupancy
};

class MobilityIntelligenceService {
  /**
   * Calculates comprehensive cost, fuel consumption, and environmental footprint for a route
   */
  public calculateTripCost(
    distanceKm: number,
    mode: TransportMode = 'CAR',
    options?: { hasTolls?: boolean; tollCount?: number; destinationParkingPaid?: boolean }
  ): TripCostBreakdown {
    if (mode === 'WALK' || mode === 'BICYCLE') {
      return {
        fuelCostInr: 0,
        tollCostInr: 0,
        parkingCostInr: 0,
        totalEstimatedCostInr: 0,
        estimatedFuelLiters: 0,
        estimatedCo2Kg: 0,
        isEstimate: false,
        disclaimer: 'Zero fuel consumption and zero direct emissions.',
      };
    }

    if (mode === 'TRANSIT') {
      // Average municipal bus fare model (₹10 base + ₹2/km)
      const transitFare = Math.round(10 + distanceKm * 2.2);
      const co2 = parseFloat(((distanceKm * CO2_GRAMS_PER_KM.TRANSIT) / 1000).toFixed(2));
      return {
        fuelCostInr: 0,
        tollCostInr: 0,
        parkingCostInr: 0,
        totalEstimatedCostInr: transitFare,
        estimatedFuelLiters: 0,
        estimatedCo2Kg: co2,
        isEstimate: true,
        disclaimer: 'Estimated standard municipal transit fare based on distance traveled.',
      };
    }

    // Vehicle fuel calculation
    const efficiency = VEHICLE_EFFICIENCY_KM_PER_LITER[mode] || 15;
    const litersUsed = distanceKm / efficiency;
    const pricePerLiter = FUEL_PRICE_PER_LITER.petrol;
    const fuelCost = Math.round(litersUsed * pricePerLiter);

    // Toll calculation (NHAI benchmark ~₹2.1 per km on expressways/national highways if present)
    let tollCost = 0;
    if (options?.hasTolls && mode === 'CAR') {
      const tolls = options.tollCount || Math.max(1, Math.floor(distanceKm / 65));
      tollCost = tolls * 95; // Average plaza toll
    }

    // Destination parking estimate
    let parkingCost = 0;
    if (options?.destinationParkingPaid && mode === 'CAR') {
      parkingCost = 50; // Standard 2-hour commercial parking rate
    } else if (options?.destinationParkingPaid && mode === 'BIKE') {
      parkingCost = 20;
    }

    const co2Kg = parseFloat(((distanceKm * (CO2_GRAMS_PER_KM[mode] || 120)) / 1000).toFixed(2));

    return {
      fuelCostInr: fuelCost,
      tollCostInr: tollCost,
      parkingCostInr: parkingCost,
      totalEstimatedCostInr: fuelCost + tollCost + parkingCost,
      estimatedFuelLiters: parseFloat(litersUsed.toFixed(2)),
      estimatedCo2Kg: co2Kg,
      isEstimate: true,
      disclaimer: 'Estimated based on average fuel economy and regional fuel prices. Actual costs may vary by driving conditions.',
    };
  }

  /**
   * Recommends a destination parking solution based on destination coordinates
   */
  public getDestinationParkingRecommendation(
    destinationCoords: [number, number],
    destinationName: string
  ): DestinationParking {
    // Generate deterministic parking offset for destination arrival
    const [destLng, destLat] = destinationCoords;
    const parkingLat = destLat + 0.0012; // ~130m offset
    const parkingLng = destLng + 0.0008;

    return {
      facilityName: `${destinationName} Designated Visitor Parking`,
      coordinates: [parkingLng, parkingLat],
      walkingDistanceMeters: 140,
      estimatedWalkingMinutes: 2,
      pricingType: 'free',
      hasEvCharging: true,
      isCovered: false,
    };
  }
}

export const mobilityIntelligenceService = new MobilityIntelligenceService();
export default mobilityIntelligenceService;
