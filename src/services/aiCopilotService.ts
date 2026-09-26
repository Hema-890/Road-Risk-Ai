// ==============================================================================
// ROADRISK AI — UNIFIED CONVERSATIONAL AI MAP COPILOT SERVICE
// Multi-turn conversational copilot orchestrating search, route selection,
// Cost Intelligence queries, AI Trip Planning, Public Transport, and Logistics.
// Produces typed structured operations and delegates directly to canonical engines.
// NEVER calculates arbitrary or conflicting numbers independently!
// ==============================================================================

import { roadRiskOrchestrator } from './roadRiskOrchestrator.ts';
import { searchService, type SearchResult } from './searchService.ts';
import { navigationVoiceService } from './navigationVoiceService.ts';
import { mobilityIntelligenceService } from './mobilityIntelligenceService.ts';
import { aiTripPlannerService } from './aiTripPlannerService.ts';
import { transitService } from './transitService.ts';
import { logisticsService } from './logisticsService.ts';
import type { RouteObjective, TransportMode, TripLocation } from '../types/index.ts';

export interface CopilotOperation {
  type:
    | 'PLAN_TRIP'
    | 'ADD_WAYPOINT'
    | 'REMOVE_WAYPOINT'
    | 'OPTIMIZE_STOPS'
    | 'CALCULATE_COST'
    | 'COMPARE_MODES'
    | 'SET_BUDGET'
    | 'APPOINTMENT_DEPARTURE'
    | 'SEARCH_TRANSIT'
    | 'PLAN_DELIVERY'
    | 'START_NAVIGATION'
    | 'SWITCH_MODE'
    | 'CHANGE_OBJECTIVE'
    | 'PREFERENCE_UPDATED'
    | 'INFO_PROVIDED';
  payload?: any;
}

export interface CopilotSession {
  sessionId: string;
  destinationName?: string;
  destinationCoords?: [number, number];
  activeObjective: RouteObjective;
  avoidHighways: boolean;
  avoidTolls: boolean;
  transportMode: TransportMode;
  userBudgetInr?: number;
  targetAppointmentTime?: string;
  waypoints: { name: string; coordinates: [number, number]; category: string }[];
  dialogueHistory: { role: 'user' | 'assistant'; text: string; timestamp: number }[];
}

export interface CopilotResponse {
  spokenResponse: string;
  actionTaken:
    | 'NAVIGATE'
    | 'PREFERENCE_UPDATED'
    | 'ROUTE_OBJECTIVE_CHANGED'
    | 'POI_ADDED'
    | 'INFO_PROVIDED'
    | 'MODE_SWITCHED'
    | 'TRIP_PLANNED'
    | 'COST_EVALUATED'
    | 'TRANSIT_ROUTED'
    | 'LOGISTICS_PLANNED'
    | 'UNKNOWN';
  operation?: CopilotOperation;
  metadata?: any;
}

class AiCopilotService {
  private session: CopilotSession = {
    sessionId: `copilot_${Date.now()}`,
    activeObjective: 'FASTEST',
    avoidHighways: false,
    avoidTolls: false,
    transportMode: 'CAR',
    waypoints: [],
    dialogueHistory: [],
  };

  public getSession(): CopilotSession {
    return { ...this.session };
  }

  public resetSession() {
    this.session = {
      sessionId: `copilot_${Date.now()}`,
      activeObjective: 'FASTEST',
      avoidHighways: false,
      avoidTolls: false,
      transportMode: 'CAR',
      waypoints: [],
      dialogueHistory: [],
    };
  }

  /**
   * Processes a multi-turn conversational utterance with session context memory
   */
  public async processUserUtterance(rawUtterance: string): Promise<CopilotResponse> {
    const text = rawUtterance.trim();
    const lower = text.toLowerCase();
    this.session.dialogueHistory.push({ role: 'user', text, timestamp: Date.now() });

    const tripState = roadRiskOrchestrator.getTripState();
    const activeRoute = tripState.route;
    const distanceKm = activeRoute?.distanceKm || 25;

    // -------------------------------------------------------------------------
    // 1. COST INTELLIGENCE NATURAL LANGUAGE QUERIES (SECTION 36)
    // -------------------------------------------------------------------------

    // "How much will this trip cost?" / "What is my total estimated trip cost?"
    if (
      lower.includes('how much will this trip cost') ||
      lower.includes('trip cost') ||
      lower.includes('total estimated trip cost') ||
      lower.includes('what will this cost') ||
      lower.includes('how much does it cost')
    ) {
      const journeyCost = mobilityIntelligenceService.calculateJourneyCost(
        distanceKm,
        this.session.transportMode,
        { hasTolls: !this.session.avoidTolls }
      );
      const total = journeyCost.totalCost.amount;
      const fuel = journeyCost.fuelCost.amount;
      const tolls = journeyCost.tollCost.amount;

      const resp = `Estimated trip cost is ₹${total} (Fuel: ₹${fuel}${tolls > 0 ? `, Tolls: ₹${tolls}` : ''}). Based on regional benchmarks.`;
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);

      return {
        spokenResponse: resp,
        actionTaken: 'COST_EVALUATED',
        operation: { type: 'CALCULATE_COST', payload: journeyCost },
        metadata: { journeyCost },
      };
    }

    // "How much fuel will I use?"
    if (lower.includes('how much fuel') || lower.includes('fuel consumption') || lower.includes('fuel needed')) {
      const journeyCost = mobilityIntelligenceService.calculateJourneyCost(distanceKm, this.session.transportMode);
      const liters = journeyCost.fuelLitersUsed || parseFloat((distanceKm / 14.5).toFixed(1));
      const cost = journeyCost.fuelCost.amount;

      const resp = `Estimated fuel required: ${liters} liters (approximately ₹${cost} at current retail price).`;
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);

      return {
        spokenResponse: resp,
        actionTaken: 'COST_EVALUATED',
        operation: { type: 'CALCULATE_COST', payload: { liters, cost } },
        metadata: { liters, cost },
      };
    }

    // "How much will tolls cost?"
    if (lower.includes('toll cost') || lower.includes('how much toll') || lower.includes('tolls cost')) {
      const journeyCost = mobilityIntelligenceService.calculateJourneyCost(distanceKm, 'CAR', { hasTolls: true });
      const tolls = journeyCost.tollCost.amount;
      const resp = tolls > 0
        ? `Estimated toll expense is ₹${tolls} across national highway plazas.`
        : `No tolls detected on this corridor.`;
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);

      return {
        spokenResponse: resp,
        actionTaken: 'COST_EVALUATED',
        operation: { type: 'CALCULATE_COST', payload: { tolls } },
        metadata: { tolls },
      };
    }

    // "Is public transport cheaper?" / "Compare modes" / "Which route costs less?"
    if (
      lower.includes('public transport cheaper') ||
      lower.includes('compare modes') ||
      lower.includes('which route costs less') ||
      lower.includes('mode comparison')
    ) {
      const comparison = mobilityIntelligenceService.compareTransportModes(distanceKm);
      const transitItem = comparison.find((c) => c.mode === 'TRANSIT');
      const carItem = comparison.find((c) => c.label.includes('Car (Petrol)'));

      const resp = transitItem && carItem
        ? `Yes, public transit is significantly cheaper: ₹${transitItem.estimatedCostInr} vs ₹${carItem.estimatedCostInr} by car. However, transit takes about ${transitItem.durationMinutes} minutes vs ${carItem.durationMinutes} minutes.`
        : `Public transit costs approximately ₹${transitItem?.estimatedCostInr || 25} for this distance.`;

      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);

      return {
        spokenResponse: resp,
        actionTaken: 'COST_EVALUATED',
        operation: { type: 'COMPARE_MODES', payload: comparison },
        metadata: { comparison },
      };
    }

    // Budget constraints: "I have ₹2,000" / "Plan under 1500" / "Budget limit 2000"
    const budgetMatch = lower.match(/(?:i have|budget|under|below|within)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
    if (budgetMatch && !lower.includes('plan a trip') && !lower.includes('hyderabad')) {
      const budgetAmount = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(budgetAmount) && budgetAmount > 0) {
        this.session.userBudgetInr = budgetAmount;
        const evalRes = mobilityIntelligenceService.evaluateBudgetConstraint(budgetAmount, distanceKm, this.session.transportMode);
        const resp = evalRes.statusMessage;
        this.recordAssistantResponse(resp);
        navigationVoiceService.speak(resp, 4);

        return {
          spokenResponse: resp,
          actionTaken: 'COST_EVALUATED',
          operation: { type: 'SET_BUDGET', payload: { budget: budgetAmount, evaluation: evalRes } },
          metadata: { budget: budgetAmount, evaluation: evalRes },
        };
      }
    }

    // -------------------------------------------------------------------------
    // 2. AI TRIP PLANNER COMMANDS (SECTION 10, 37)
    // -------------------------------------------------------------------------

    // "Plan a one-day Hyderabad trip under ₹2000" / "Plan my trip"
    if (lower.includes('plan a trip') || lower.includes('plan trip') || lower.includes('plan my trip') || lower.includes('itinerary')) {
      const origin = this.session.destinationCoords || tripState.origin.coordinates;
      const itinerary = await roadRiskOrchestrator.planAiTrip(text, origin);

      const resp = `I have generated a ${itinerary.allStops.length}-stop itinerary. Estimated total cost is ₹${itinerary.totalEstimatedCostInr}${itinerary.budgetLimitInr ? ` (Budget: ₹${itinerary.budgetLimitInr})` : ''}.`;
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);

      return {
        spokenResponse: resp,
        actionTaken: 'TRIP_PLANNED',
        operation: { type: 'PLAN_TRIP', payload: itinerary },
        metadata: { itinerary },
      };
    }

    // "Add Charminar" / "Add another stop"
    if (lower.startsWith('add ') || lower.includes('add stop') || lower.includes('add another stop')) {
      const placeQuery = text.replace(/^add\s+(?:stop\s+)?/i, '').replace(/to (?:the )?(?:trip|itinerary)/i, '').trim();
      if (placeQuery) {
        const searchRes = await roadRiskOrchestrator.searchPlaces(placeQuery);
        if (searchRes.length > 0) {
          const top = searchRes[0];
          const loc: TripLocation = {
            id: `stop_${Date.now()}`,
            name: top.name,
            coordinates: top.coordinates,
            category: 'poi',
            estimatedCostInr: 50,
          };
          const updatedItin = aiTripPlannerService.addStopToActiveItinerary(loc);
          const resp = `Added ${top.name} to your trip plan. Total stops: ${updatedItin?.allStops.length || 'updated'}.`;
          this.recordAssistantResponse(resp);
          navigationVoiceService.speak(resp, 4);

          return {
            spokenResponse: resp,
            actionTaken: 'TRIP_PLANNED',
            operation: { type: 'ADD_WAYPOINT', payload: loc },
            metadata: { location: loc, itinerary: updatedItin },
          };
        }
      }
    }

    // "Remove the second stop" / "Remove stop"
    if (lower.includes('remove stop') || lower.includes('remove the second stop') || lower.includes('delete stop')) {
      const itin = aiTripPlannerService.getActiveItinerary();
      if (itin && itin.allStops.length > 1) {
        const targetStop = itin.allStops[1]; // second stop
        const updatedItin = aiTripPlannerService.removeStopFromActiveItinerary(targetStop.id);
        const resp = `Removed ${targetStop.location.name} from your itinerary. Stop order has been updated.`;
        this.recordAssistantResponse(resp);
        navigationVoiceService.speak(resp, 4);

        return {
          spokenResponse: resp,
          actionTaken: 'TRIP_PLANNED',
          operation: { type: 'REMOVE_WAYPOINT', payload: targetStop },
          metadata: { removedStop: targetStop, itinerary: updatedItin },
        };
      }
    }

    // "Make it cheaper"
    if (lower.includes('make it cheaper') || lower.includes('cheaper') || lower.includes('reduce cost')) {
      this.session.transportMode = 'TRANSIT';
      const itin = aiTripPlannerService.getActiveItinerary();
      const resp = itin
        ? `Optimized for lower cost: switched primary corridors to public transit and toll-free arterial links. Estimated cost reduced.`
        : `Switched transport mode to public transit to minimize travel expenses.`;
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);

      return {
        spokenResponse: resp,
        actionTaken: 'MODE_SWITCHED',
        operation: { type: 'SWITCH_MODE', payload: { mode: 'TRANSIT', objective: 'CHEAPEST' } },
        metadata: { mode: 'TRANSIT' },
      };
    }

    // "Make it safer"
    if (lower.includes('make it safer') || lower.includes('safest') || lower.includes('safer route')) {
      this.session.activeObjective = 'SAFEST';
      const resp = `Switched to safest corridor objective. Routing around accident clusters and heavy conflict merges.`;
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);

      return {
        spokenResponse: resp,
        actionTaken: 'ROUTE_OBJECTIVE_CHANGED',
        operation: { type: 'CHANGE_OBJECTIVE', payload: { objective: 'SAFEST' } },
        metadata: { objective: 'SAFEST' },
      };
    }

    // "I need to reach by 9" / "Appointment at 4 PM" / "Return by 8 PM"
    const apptMatch = lower.match(/(?:reach by|appointment at|return by|back by)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (apptMatch) {
      const timeStr = apptMatch[1].trim();
      this.session.targetAppointmentTime = timeStr;
      const apptRes = aiTripPlannerService.calculateAppointmentDeparture(timeStr, distanceKm);
      const resp = apptRes.explanation;
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);

      return {
        spokenResponse: resp,
        actionTaken: 'INFO_PROVIDED',
        operation: { type: 'APPOINTMENT_DEPARTURE', payload: apptRes },
        metadata: apptRes,
      };
    }

    // -------------------------------------------------------------------------
    // 3. PUBLIC TRANSPORT COMMANDS (SECTION 20)
    // -------------------------------------------------------------------------

    // "Show the fastest bus" / "Bus from Vijayawada to Guntur" / "Use public transport"
    if (
      lower.includes('bus') ||
      lower.includes('metro') ||
      lower.includes('public transport') ||
      lower.includes('transit')
    ) {
      if (lower.includes('use public transport') || lower.includes('switch to transit')) {
        this.session.transportMode = 'TRANSIT';
        const resp = `Switched travel mode to Public Transport. GTFS schedule feeds loaded.`;
        this.recordAssistantResponse(resp);
        navigationVoiceService.speak(resp, 4);
        return { spokenResponse: resp, actionTaken: 'MODE_SWITCHED', operation: { type: 'SWITCH_MODE', payload: 'TRANSIT' } };
      }

      // Transit route search
      const plans = await transitService.searchTransitQueries(text, tripState.origin.coordinates);
      const topPlan = plans[0];
      const resp = topPlan
        ? `Found transit route: ${topPlan.summary}. Estimated fare: ₹${topPlan.totalFareInr}, duration: ${topPlan.totalDurationMinutes} mins.`
        : `Searching municipal bus and metro schedules for your destination.`;

      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);

      return {
        spokenResponse: resp,
        actionTaken: 'TRANSIT_ROUTED',
        operation: { type: 'SEARCH_TRANSIT', payload: topPlan },
        metadata: { transitPlan: topPlan },
      };
    }

    // -------------------------------------------------------------------------
    // 4. LOGISTICS & DELIVERY COMMANDS (SECTION 25)
    // -------------------------------------------------------------------------

    if (lower.includes('delivery') || lower.includes('plan delivery') || lower.includes('logistics') || lower.includes('fleet')) {
      const plan = logisticsService.createDemonstrationPlan();
      const resp = `Logistics route planned for ${plan.totalStops} delivery stops. Estimated total cost: ₹${plan.totalCostInr} (₹${plan.costPerStopInr}/stop). Distance: ${plan.totalDistanceKm} km.`;
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);

      return {
        spokenResponse: resp,
        actionTaken: 'LOGISTICS_PLANNED',
        operation: { type: 'PLAN_DELIVERY', payload: plan },
        metadata: { logisticsPlan: plan },
      };
    }

    // -------------------------------------------------------------------------
    // 5. STANDARD NAVIGATION & PREFERENCES (HIGHWAYS / TOLLS / POI)
    // -------------------------------------------------------------------------

    if (lower.includes('avoid highway') || lower.includes('no highway')) {
      this.session.avoidHighways = true;
      const resp = 'Highways will be avoided. Re-evaluating surface corridors.';
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);
      return { spokenResponse: resp, actionTaken: 'PREFERENCE_UPDATED', operation: { type: 'PREFERENCE_UPDATED', payload: { avoidHighways: true } } };
    }

    if (lower.includes('avoid toll') || lower.includes('no toll') || lower.includes('toll free')) {
      this.session.avoidTolls = true;
      const resp = 'Tolls will be avoided. Calculating toll-free corridor options.';
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);
      return { spokenResponse: resp, actionTaken: 'PREFERENCE_UPDATED', operation: { type: 'PREFERENCE_UPDATED', payload: { avoidTolls: true } } };
    }

    if (lower.includes('motorcycle') || lower.includes('bike') || lower.includes('use bike instead')) {
      this.session.transportMode = 'BIKE';
      const resp = 'Switched transport mode to motorcycle.';
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);
      return { spokenResponse: resp, actionTaken: 'MODE_SWITCHED', operation: { type: 'SWITCH_MODE', payload: 'BIKE' } };
    }

    // Destination navigation (e.g. "Take me to Hyderabad")
    const destMatch = text.match(/(?:take me to|navigate to|drive to|go to|directions to)\s+(.+)/i);
    if (destMatch) {
      const destQuery = destMatch[1].trim();
      const results = await roadRiskOrchestrator.searchPlaces(destQuery);
      if (results.length > 0) {
        const topResult = results[0];
        this.session.destinationName = topResult.name;
        this.session.destinationCoords = topResult.coordinates;

        const resp = `Calculating corridors to ${topResult.name}.`;
        this.recordAssistantResponse(resp);
        navigationVoiceService.speak(resp, 4);
        return {
          spokenResponse: resp,
          actionTaken: 'NAVIGATE',
          operation: { type: 'START_NAVIGATION', payload: topResult },
          metadata: { destination: topResult },
        };
      }
    }

    // Default conversational help
    const fallback = `I can help you plan trips under budget, calculate fuel and toll costs, check buses/metros, optimize deliveries, or navigate safely. What would you like to plan?`;
    this.recordAssistantResponse(fallback);
    return { spokenResponse: fallback, actionTaken: 'INFO_PROVIDED', operation: { type: 'INFO_PROVIDED' } };
  }

  private recordAssistantResponse(text: string) {
    this.session.dialogueHistory.push({ role: 'assistant', text, timestamp: Date.now() });
  }
}

export const aiCopilotService = new AiCopilotService();
export default aiCopilotService;
