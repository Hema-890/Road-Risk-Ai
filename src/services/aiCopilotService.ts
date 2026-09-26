// ==============================================================================
// ROADRISK AI — CONVERSATIONAL AI MAP COPILOT SERVICE
// Multi-turn conversational copilot orchestrating search, route selection,
// preference chaining, and POI discovery.
// Strictly delegates to RoadRiskOrchestrator without creating duplicate engines.
// ==============================================================================

import { roadRiskOrchestrator } from './roadRiskOrchestrator.ts';
import { searchService, type SearchResult } from './searchService.ts';
import { navigationVoiceService } from './navigationVoiceService.ts';
import type { RouteObjective, TransportMode } from '../types/index.ts';

export interface CopilotSession {
  sessionId: string;
  destinationName?: string;
  destinationCoords?: [number, number];
  activeObjective: RouteObjective;
  avoidHighways: boolean;
  avoidTolls: boolean;
  transportMode: TransportMode;
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
    | 'UNKNOWN';
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

    // 1. Chained Command: Avoid Highways
    if (lower.includes('avoid highway') || lower.includes('no highway') || lower.includes('avoid expressways')) {
      this.session.avoidHighways = true;
      const resp = 'Highways will be avoided. Re-evaluating optimal surface corridors.';
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);
      return { spokenResponse: resp, actionTaken: 'PREFERENCE_UPDATED', metadata: { avoidHighways: true } };
    }

    // 2. Chained Command: Avoid Tolls
    if (lower.includes('avoid toll') || lower.includes('no toll') || lower.includes('toll free')) {
      this.session.avoidTolls = true;
      const resp = 'Tolls will be avoided. Calculating toll-free corridor options.';
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);
      return { spokenResponse: resp, actionTaken: 'PREFERENCE_UPDATED', metadata: { avoidTolls: true } };
    }

    // 3. Chained Command: Switch to Safest Route
    if (lower.includes('safest') || lower.includes('safer route') || lower.includes('avoid risk')) {
      this.session.activeObjective = 'SAFEST';
      const resp = 'Switched to safest route objective. Routing around accident hotspots and hazardous segments.';
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);
      return { spokenResponse: resp, actionTaken: 'ROUTE_OBJECTIVE_CHANGED', metadata: { objective: 'SAFEST' } };
    }

    // 4. Chained Command: Switch to Fastest Route
    if (lower.includes('fastest') || lower.includes('quickest') || lower.includes('minimum time')) {
      this.session.activeObjective = 'FASTEST';
      const resp = 'Switched to fastest route objective.';
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);
      return { spokenResponse: resp, actionTaken: 'ROUTE_OBJECTIVE_CHANGED', metadata: { objective: 'FASTEST' } };
    }

    // 5. Chained Command: Mode Switch
    if (lower.includes('motorcycle') || lower.includes('bike') || lower.includes('two wheeler')) {
      this.session.transportMode = 'BIKE';
      const resp = 'Switched transport mode to motorcycle.';
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);
      return { spokenResponse: resp, actionTaken: 'MODE_SWITCHED', metadata: { mode: 'BIKE' } };
    } else if (lower.includes('walk') || lower.includes('pedestrian')) {
      this.session.transportMode = 'WALK';
      const resp = 'Switched transport mode to walking.';
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);
      return { spokenResponse: resp, actionTaken: 'MODE_SWITCHED', metadata: { mode: 'WALK' } };
    }

    // 6. Chained Command: Find Fuel along route / nearby
    if (lower.includes('fuel') || lower.includes('petrol') || lower.includes('gas station') || lower.includes('diesel')) {
      const origin = this.session.destinationCoords || [80.6480, 16.5062];
      const results = await searchService.searchCategory('fuel', origin, { limit: 3 });
      const top = results[0];
      const resp = top
        ? `Found ${top.name} located ${top.distanceKm ? top.distanceKm + ' km away' : 'nearby'}.`
        : 'Searching for fuel stations along your corridor.';
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);
      return { spokenResponse: resp, actionTaken: 'POI_ADDED', metadata: { category: 'fuel', results } };
    }

    // 7. Chained Command: Find Hospital nearby
    if (lower.includes('hospital') || lower.includes('emergency clinic') || lower.includes('doctor')) {
      const origin = this.session.destinationCoords || [80.6480, 16.5062];
      const results = await searchService.searchCategory('hospital', origin, { limit: 3 });
      const top = results[0];
      const resp = top
        ? `Nearest hospital is ${top.name}, ${top.distanceKm ? top.distanceKm + ' km away' : 'nearby'}.`
        : 'Locating emergency medical facilities in your vicinity.';
      this.recordAssistantResponse(resp);
      navigationVoiceService.speak(resp, 4);
      return { spokenResponse: resp, actionTaken: 'POI_ADDED', metadata: { category: 'hospital', results } };
    }

    // 8. Chained Command: Primary Destination Navigation (e.g. "Take me to Hyderabad")
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
        return { spokenResponse: resp, actionTaken: 'NAVIGATE', metadata: { destination: topResult } };
      }
    }

    // Fallback conversational answer
    const fallback = `I can help you navigate, avoid highways or tolls, find fuel, hospitals, or switch route objectives. How can I assist you?`;
    this.recordAssistantResponse(fallback);
    return { spokenResponse: fallback, actionTaken: 'INFO_PROVIDED' };
  }

  private recordAssistantResponse(text: string) {
    this.session.dialogueHistory.push({ role: 'assistant', text, timestamp: Date.now() });
  }
}

export const aiCopilotService = new AiCopilotService();
export default aiCopilotService;
