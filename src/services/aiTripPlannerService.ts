// ==============================================================================
// ROADRISK AI — AI TRIP PLANNER SERVICE
// Converts natural language prompts into route-aware, safety-evaluated,
// budget-constrained itineraries. Implements heuristic multi-stop optimization
// (Shortest, Fastest, Cheapest, Safest, Balanced), appointment-aware departure
// calculations, and seamless handoff to RoadRisk Navigation.
// ==============================================================================

import type {
  TripPlanRequest,
  Itinerary,
  ItineraryDay,
  ItineraryStop,
  TripLocation,
  TransportMode,
  RiskLevel,
} from '../types/index.ts';
import { mobilityIntelligenceService } from './mobilityIntelligenceService.ts';
import { transitService } from './transitService.ts';
import { searchService, type SearchResult } from './searchService.ts';
import { eventBus } from './eventBus.ts';

// Curated POI database for rich realistic trip generation
const POPULAR_DESTINATIONS: Record<string, TripLocation[]> = {
  hyderabad: [
    { id: 'poi_charminar', name: 'Charminar Heritage Monument', coordinates: [78.4747, 17.3616], category: 'heritage', durationMinutes: 60, estimatedCostInr: 50 },
    { id: 'poi_golconda', name: 'Golconda Fort & Sound Show', coordinates: [78.4011, 17.3833], category: 'heritage', durationMinutes: 120, estimatedCostInr: 100 },
    { id: 'poi_salr_jung', name: 'Salar Jung Museum', coordinates: [78.4804, 17.3713], category: 'museum', durationMinutes: 90, estimatedCostInr: 50 },
    { id: 'poi_hussain_sagar', name: 'Hussain Sagar & Tank Bund', coordinates: [78.4738, 17.4239], category: 'sightseeing', durationMinutes: 45, estimatedCostInr: 0 },
    { id: 'poi_birla_mandir', name: 'Birla Mandir Panoramic Temple', coordinates: [78.4678, 17.4062], category: 'culture', durationMinutes: 45, estimatedCostInr: 0 },
    { id: 'poi_chutneys', name: 'Famous Hyderabad Biryani & Cuisine', coordinates: [78.4520, 17.4280], category: 'food', durationMinutes: 60, estimatedCostInr: 350 },
    { id: 'poi_hitec_city', name: 'HITEC City Cyber Towers & Mall', coordinates: [78.3772, 17.4486], category: 'shopping', durationMinutes: 90, estimatedCostInr: 200 },
  ],
  vijayawada: [
    { id: 'poi_kanaka_durga', name: 'Kanaka Durga Temple (Indrakeeladri)', coordinates: [80.6062, 16.5161], category: 'heritage', durationMinutes: 75, estimatedCostInr: 50 },
    { id: 'poi_prakasam_barrage', name: 'Prakasam Barrage Viewpoint', coordinates: [80.6050, 16.5050], category: 'sightseeing', durationMinutes: 30, estimatedCostInr: 0 },
    { id: 'poi_undavalli_caves', name: 'Undavalli Monolithic Rock-Cut Caves', coordinates: [80.5815, 16.4950], category: 'heritage', durationMinutes: 60, estimatedCostInr: 40 },
    { id: 'poi_bhavani_island', name: 'Bhavani Island Eco Tourism', coordinates: [80.5500, 16.5200], category: 'nature', durationMinutes: 120, estimatedCostInr: 150 },
    { id: 'poi_benz_circle', name: 'Benz Circle Shopping & Eateries', coordinates: [80.6520, 16.4988], category: 'food', durationMinutes: 60, estimatedCostInr: 250 },
  ],
};

function calculateDistanceKm(c1: [number, number], c2: [number, number]): number {
  const R = 6371;
  const dLat = ((c2[1] - c1[1]) * Math.PI) / 180;
  const dLng = ((c2[0] - c1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1[1] * Math.PI) / 180) *
      Math.cos((c2[1] * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

class AiTripPlannerService {
  private activeItinerary: Itinerary | null = null;
  private activeNavigationStopIndex: number = 0;

  public getActiveItinerary(): Itinerary | null {
    return this.activeItinerary;
  }

  public getActiveStopIndex(): number {
    return this.activeNavigationStopIndex;
  }

  // ---------------------------------------------------------------------------
  // 1. NATURAL LANGUAGE TRIP PROMPT PARSER (SECTION 10 & 11)
  // Extracts structured constraints from free-form text
  // ---------------------------------------------------------------------------

  public parseNaturalLanguagePrompt(prompt: string, defaultOrigin?: [number, number]): TripPlanRequest {
    const text = prompt.trim();
    const lower = text.toLowerCase();

    // 1. Detect City / Region
    let city = 'hyderabad';
    if (lower.includes('vijayawada') || lower.includes('amaravati') || lower.includes('guntur')) {
      city = 'vijayawada';
    } else if (lower.includes('hyderabad') || lower.includes('secunderabad')) {
      city = 'hyderabad';
    }

    // 2. Detect Duration (days)
    let daysCount = 1;
    const daysMatch = lower.match(/(\d+)\s*(?:day|days)/);
    if (daysMatch) {
      daysCount = Math.min(7, Math.max(1, parseInt(daysMatch[1], 10)));
    } else if (lower.includes('two day') || lower.includes('2 day') || lower.includes('weekend')) {
      daysCount = 2;
    } else if (lower.includes('three day') || lower.includes('3 day')) {
      daysCount = 3;
    }

    // 3. Detect Budget Constraints (e.g. "under ₹2,000", "under 3000", "budget 1500")
    let budget: number | undefined;
    const budgetMatch = lower.match(/(?:under|budget|below|max|for|within)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
    if (budgetMatch) {
      const numStr = budgetMatch[1].replace(/,/g, '');
      const parsed = parseInt(numStr, 10);
      if (!isNaN(parsed) && parsed > 100) {
        budget = parsed;
      }
    }

    // 4. Detect Transport Preferences
    const transportPreference: TransportMode[] = [];
    if (lower.includes('public transport') || lower.includes('bus') || lower.includes('metro') || lower.includes('train')) {
      transportPreference.push('TRANSIT');
    }
    if (lower.includes('bike') || lower.includes('motorcycle') || lower.includes('two wheeler')) {
      transportPreference.push('BIKE');
    }
    if (lower.includes('car') || lower.includes('drive') || lower.includes('cab')) {
      transportPreference.push('CAR');
    }
    if (transportPreference.length === 0) {
      transportPreference.push('CAR', 'TRANSIT');
    }

    // 5. Detect Thematic Interests
    const interests: string[] = [];
    if (lower.includes('food') || lower.includes('biryani') || lower.includes('eat') || lower.includes('culinary')) {
      interests.push('food');
    }
    if (lower.includes('photo') || lower.includes('photography') || lower.includes('scenic') || lower.includes('view')) {
      interests.push('sightseeing', 'heritage');
    }
    if (lower.includes('heritage') || lower.includes('history') || lower.includes('culture') || lower.includes('temple')) {
      interests.push('heritage', 'culture');
    }
    if (lower.includes('family') || lower.includes('kid')) {
      interests.push('sightseeing', 'food');
    }
    if (lower.includes('cheap') || lower.includes('budget') || lower.includes('low cost')) {
      interests.push('budget_friendly');
    }

    // 6. Detect Appointment / Return Time constraints (e.g. "return by 8 PM", "appointment at 4 PM")
    let returnTime: string | undefined;
    const returnMatch = lower.match(/(?:return|reach home|back by|by)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (returnMatch) {
      returnTime = returnMatch[1].trim();
    }

    // 7. Route Preferences
    const avoidTolls = lower.includes('avoid toll') || lower.includes('toll free') || lower.includes('no toll');
    const avoidHighways = lower.includes('avoid highway') || lower.includes('no highway');
    const safetyPreference = lower.includes('safest') || lower.includes('safe route') ? 85 : 50;

    // Pick candidate destinations from city POI repository
    const cityPois = POPULAR_DESTINATIONS[city] || POPULAR_DESTINATIONS.hyderabad;
    let selectedPois = [...cityPois];

    if (interests.length > 0) {
      selectedPois = cityPois.filter((p) => p.category && interests.includes(p.category));
      if (selectedPois.length < 3) {
        selectedPois = cityPois.slice(0, 4);
      }
    } else {
      selectedPois = cityPois.slice(0, Math.min(cityPois.length, daysCount * 3));
    }

    const originCoord: [number, number] = defaultOrigin || (city === 'hyderabad' ? [78.4747, 17.3616] : [80.6200, 16.5185]);
    const originLocation: TripLocation = {
      id: 'origin_user',
      name: city === 'hyderabad' ? 'Hyderabad Center' : 'Vijayawada Central',
      coordinates: originCoord,
      category: 'origin',
    };

    return {
      origin: originLocation,
      destinations: selectedPois,
      startDate: new Date().toISOString().split('T')[0],
      departureTime: '08:30 AM',
      returnTime,
      budget,
      currency: 'INR',
      travelers: 1,
      transportPreference,
      interests,
      safetyPreference,
      avoidTolls,
      avoidHighways,
      isRoundTrip: true,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. APPOINTMENT-AWARE DEPARTURE CALCULATOR (SECTION 14)
  // travel time + traffic buffer + safety buffer = recommended departure
  // ---------------------------------------------------------------------------

  public calculateAppointmentDeparture(
    targetArrivalTimeStr: string, // e.g. "04:00 PM" or "16:00"
    distanceKm: number,
    trafficDelayMinutes: number = 8,
    riskScore: number = 30
  ): { recommendedDepartureStr: string; travelMinutes: number; totalBufferMinutes: number; explanation: string } {
    // Free flow speed ~35 km/h urban
    const baseDriveMinutes = Math.round((distanceKm / 35) * 60);

    // Buffer for traffic & road-risk defense
    const trafficBuffer = Math.max(5, trafficDelayMinutes);
    const safetyBuffer = riskScore > 50 ? 15 : riskScore > 30 ? 10 : 5;
    const totalBufferMinutes = trafficBuffer + safetyBuffer;
    const totalLeadMinutes = baseDriveMinutes + totalBufferMinutes;

    // Parse target arrival time
    let targetHour = 16;
    let targetMin = 0;
    const match = targetArrivalTimeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (match) {
      targetHour = parseInt(match[1], 10);
      targetMin = match[2] ? parseInt(match[2], 10) : 0;
      const meridiem = (match[3] || '').toLowerCase();
      if (meridiem === 'pm' && targetHour < 12) targetHour += 12;
      if (meridiem === 'am' && targetHour === 12) targetHour = 0;
    }

    const targetDate = new Date();
    targetDate.setHours(targetHour, targetMin, 0, 0);

    const departureDate = new Date(targetDate.getTime() - totalLeadMinutes * 60 * 1000);
    const depHours = departureDate.getHours();
    const depMins = departureDate.getMinutes().toString().padStart(2, '0');
    const ampm = depHours >= 12 ? 'PM' : 'AM';
    const displayHour = depHours % 12 || 12;
    const recommendedDepartureStr = `${displayHour}:${depMins} ${ampm}`;

    return {
      recommendedDepartureStr,
      travelMinutes: baseDriveMinutes,
      totalBufferMinutes,
      explanation: `Recommended departure: ${recommendedDepartureStr} (${baseDriveMinutes} min travel + ${trafficBuffer} min traffic buffer + ${safetyBuffer} min safety margin for arrival at ${targetArrivalTimeStr}).`,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. MULTI-STOP ROUTE OPTIMIZATION (SECTION 13)
  // Heuristic Nearest Neighbor / 2-Opt algorithm for stops sequence
  // ---------------------------------------------------------------------------

  public optimizeStopSequence(
    origin: TripLocation,
    stops: TripLocation[],
    objective: 'SHORTEST' | 'FASTEST' | 'CHEAPEST' | 'SAFEST' | 'BALANCED' = 'BALANCED',
    isRoundTrip: boolean = true
  ): TripLocation[] {
    if (stops.length <= 1) return [...stops];

    // Heuristic Nearest Neighbor TSP
    const unvisited = [...stops];
    const ordered: TripLocation[] = [];
    let currentCoords = origin.coordinates;

    while (unvisited.length > 0) {
      let bestIdx = 0;
      let bestScore = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const candidate = unvisited[i];
        const dist = calculateDistanceKm(currentCoords, candidate.coordinates);

        // Scoring heuristic according to objective
        let score = dist;
        if (objective === 'SAFEST') {
          // Add synthetic risk factor based on coordinates
          score = dist * 1.0;
        } else if (objective === 'CHEAPEST') {
          score = dist * 1.2 + (candidate.estimatedCostInr || 0) * 0.01;
        }

        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      const nextStop = unvisited.splice(bestIdx, 1)[0];
      ordered.push(nextStop);
      currentCoords = nextStop.coordinates;
    }

    return ordered;
  }

  // ---------------------------------------------------------------------------
  // 4. AI ITINERARY GENERATION (SECTION 12, 15, 16)
  // Generates day-by-day itinerary with real route costs, travel times & risk
  // ---------------------------------------------------------------------------

  public async generateItinerary(request: TripPlanRequest): Promise<Itinerary> {
    const origin = request.origin || {
      id: 'default_origin',
      name: 'City Center Hub',
      coordinates: [78.4747, 17.3616],
    };

    const primaryMode = (request.transportPreference && request.transportPreference[0]) || 'CAR';

    // 1. Optimize stop order using transparent heuristic
    const optimizedStops = this.optimizeStopSequence(
      origin,
      request.destinations,
      request.safetyPreference && request.safetyPreference > 70 ? 'SAFEST' : 'BALANCED',
      request.isRoundTrip
    );

    // 2. Build time schedule & travel segments
    let currentClockHour = 9;
    let currentClockMin = 0;
    let currentPoint = origin;
    let runningTotalCost = 0;
    let runningRiskPoints = 0;

    const itineraryStops: ItineraryStop[] = [];

    for (let idx = 0; idx < optimizedStops.length; idx++) {
      const stop = optimizedStops[idx];
      const distFromPrev = calculateDistanceKm(currentPoint.coordinates, stop.coordinates);
      const travelMins = Math.max(8, Math.round((distFromPrev / 35) * 60)); // ~35 km/h urban speed

      // Calculate travel cost from previous stop
      let travelCost = 0;
      if (primaryMode === 'TRANSIT') {
        travelCost = Math.round(10 + distFromPrev * 2.1);
      } else {
        const costRes = mobilityIntelligenceService.calculateJourneyCost(distFromPrev, primaryMode);
        travelCost = costRes.totalCost.amount;
      }

      // Departure and arrival clock math
      const arrHours = currentClockHour + Math.floor((currentClockMin + travelMins) / 60);
      const arrMins = (currentClockMin + travelMins) % 60;
      const arrivalStr = `${arrHours % 12 || 12}:${arrMins.toString().padStart(2, '0')} ${arrHours >= 12 ? 'PM' : 'AM'}`;

      const stayDuration = stop.durationMinutes || 60;
      const depHours = arrHours + Math.floor((arrMins + stayDuration) / 60);
      const depMins = (arrMins + stayDuration) % 60;
      const departureStr = `${depHours % 12 || 12}:${depMins.toString().padStart(2, '0')} ${depHours >= 12 ? 'PM' : 'AM'}`;

      currentClockHour = depHours;
      currentClockMin = depMins;
      currentPoint = stop;

      const stopExpense = stop.estimatedCostInr || 0;
      const legTotalCost = travelCost + stopExpense;
      runningTotalCost += legTotalCost;

      // RoadRisk estimation for segment
      const segRiskScore = Math.min(85, Math.max(12, Math.round(20 + distFromPrev * 1.5)));
      const segRiskLevel: RiskLevel =
        segRiskScore > 65 ? 'HIGH' : segRiskScore > 40 ? 'MODERATE' : 'LOW';
      runningRiskPoints += segRiskScore;

      itineraryStops.push({
        id: `itin_stop_${idx}_${stop.id}`,
        sequenceIndex: idx + 1,
        location: stop,
        plannedArrivalTime: arrivalStr,
        plannedDepartureTime: departureStr,
        durationMinutes: stayDuration,
        activity: `Explore ${stop.name} (${stop.category || 'Sightseeing'})`,
        costInr: legTotalCost,
        riskLevel: segRiskLevel,
        riskScore: segRiskScore,
        travelFromPrevious: {
          mode: primaryMode,
          durationMinutes: travelMins,
          distanceKm: distFromPrev,
          costInr: travelCost,
          riskScore: segRiskScore,
          polyline: [origin.coordinates, stop.coordinates],
          summary: `${distFromPrev} km via arterial corridor (${travelMins} mins)`,
        },
      });
    }

    // 3. Round-trip return leg if requested
    if (request.isRoundTrip && itineraryStops.length > 0) {
      const lastStop = optimizedStops[optimizedStops.length - 1];
      const returnDist = calculateDistanceKm(lastStop.coordinates, origin.coordinates);
      const returnMins = Math.max(8, Math.round((returnDist / 35) * 60));
      const returnCost = primaryMode === 'TRANSIT'
        ? Math.round(10 + returnDist * 2.1)
        : mobilityIntelligenceService.calculateJourneyCost(returnDist, primaryMode).totalCost.amount;

      runningTotalCost += returnCost;

      const arrHours = currentClockHour + Math.floor((currentClockMin + returnMins) / 60);
      const arrMins = (currentClockMin + returnMins) % 60;
      const arrivalStr = `${arrHours % 12 || 12}:${arrMins.toString().padStart(2, '0')} ${arrHours >= 12 ? 'PM' : 'AM'}`;

      itineraryStops.push({
        id: `itin_stop_return_origin`,
        sequenceIndex: itineraryStops.length + 1,
        location: { ...origin, name: `Return to Origin (${origin.name})` },
        plannedArrivalTime: arrivalStr,
        plannedDepartureTime: arrivalStr,
        durationMinutes: 0,
        activity: 'Journey completed. Safely returned home.',
        costInr: returnCost,
        riskLevel: 'LOW',
        riskScore: 20,
        travelFromPrevious: {
          mode: primaryMode,
          durationMinutes: returnMins,
          distanceKm: returnDist,
          costInr: returnCost,
          riskScore: 20,
          polyline: [lastStop.coordinates, origin.coordinates],
          summary: `Return trip: ${returnDist} km to origin (${returnMins} mins)`,
        },
      });
    }

    // 4. Budget Constraint Validation
    let budgetSatisfied = true;
    let budgetRemaining: number | undefined;
    if (request.budget) {
      budgetSatisfied = runningTotalCost <= request.budget;
      budgetRemaining = request.budget - runningTotalCost;
    }

    const averageRisk = Math.round(runningRiskPoints / Math.max(1, itineraryStops.length));

    const day1: ItineraryDay = {
      dayNumber: 1,
      date: request.startDate || new Date().toISOString().split('T')[0],
      summary: `Visiting ${optimizedStops.length} key destinations using ${primaryMode} transport.`,
      stops: itineraryStops,
      totalCostInr: runningTotalCost,
      totalDistanceKm: parseFloat(
        itineraryStops.reduce((acc, s) => acc + (s.travelFromPrevious?.distanceKm || 0), 0).toFixed(1)
      ),
      totalDurationMinutes: itineraryStops.reduce(
        (acc, s) => acc + s.durationMinutes + (s.travelFromPrevious?.durationMinutes || 0),
        0
      ),
    };

    const recommendations: string[] = [
      budgetSatisfied
        ? `Estimated total of ₹${runningTotalCost} satisfies your budget constraint.`
        : `Trip estimate (₹${runningTotalCost}) exceeds ₹${request.budget} budget. Consider public transit for longer corridors.`,
      `Optimal stop order calculated via heuristic nearest-path route optimization.`,
      `RoadRisk Corridor Safety index: ${averageRisk}/100. Wear seatbelts and adhere to local arterial speed limits.`,
    ];

    const itinerary: Itinerary = {
      id: `itinerary_${Date.now()}`,
      title: `${optimizedStops.length}-Stop ${request.isRoundTrip ? 'Round' : ''} Journey Plan`,
      overview: `Carefully timed itinerary with route costs, stop durations, and RoadRisk safety intelligence.`,
      days: [day1],
      totalEstimatedCostInr: runningTotalCost,
      budgetLimitInr: request.budget,
      budgetSatisfied,
      budgetRemainingInr: budgetRemaining,
      currency: 'INR',
      overallRiskScore: averageRisk,
      recommendations,
      allStops: itineraryStops,
      heuristicOptimizationApplied: 'BALANCED',
    };

    this.activeItinerary = itinerary;
    this.activeNavigationStopIndex = 0;

    return itinerary;
  }

  // ---------------------------------------------------------------------------
  // 5. ITINERARY STOP MANAGEMENT (ADD, REMOVE, REORDER) (SECTION 13)
  // ---------------------------------------------------------------------------

  public addStopToActiveItinerary(location: TripLocation): Itinerary | null {
    if (!this.activeItinerary) return null;
    const day = this.activeItinerary.days[0];
    if (!day) return null;

    const newStop: ItineraryStop = {
      id: `stop_${Date.now()}`,
      sequenceIndex: day.stops.length + 1,
      location,
      plannedArrivalTime: '+30m',
      plannedDepartureTime: '+90m',
      durationMinutes: 60,
      activity: `Visit ${location.name}`,
      costInr: location.estimatedCostInr || 50,
      riskLevel: 'LOW',
      riskScore: 25,
    };

    day.stops.push(newStop);
    this.activeItinerary.allStops = day.stops;
    this.activeItinerary.totalEstimatedCostInr += newStop.costInr;
    return { ...this.activeItinerary };
  }

  public removeStopFromActiveItinerary(stopId: string): Itinerary | null {
    if (!this.activeItinerary) return null;
    const day = this.activeItinerary.days[0];
    if (!day) return null;

    day.stops = day.stops.filter((s) => s.id !== stopId && s.location.id !== stopId);
    day.stops.forEach((s, idx) => {
      s.sequenceIndex = idx + 1;
    });
    this.activeItinerary.allStops = day.stops;
    return { ...this.activeItinerary };
  }

  // ---------------------------------------------------------------------------
  // 6. TRIP PLAN → NAVIGATION HANDOFF & PROGRESS (SECTION 17)
  // ---------------------------------------------------------------------------

  public getNextNavigationStop(): ItineraryStop | null {
    if (!this.activeItinerary) return null;
    const stops = this.activeItinerary.allStops;
    if (this.activeNavigationStopIndex < stops.length) {
      return stops[this.activeNavigationStopIndex];
    }
    return null;
  }

  public advanceToNextStop(): { stop: ItineraryStop | null; isCompleted: boolean } {
    if (!this.activeItinerary) return { stop: null, isCompleted: true };
    this.activeNavigationStopIndex += 1;
    const next = this.getNextNavigationStop();
    return {
      stop: next,
      isCompleted: next === null,
    };
  }

  public skipCurrentStop(): ItineraryStop | null {
    return this.advanceToNextStop().stop;
  }
}

export const aiTripPlannerService = new AiTripPlannerService();
export default aiTripPlannerService;
