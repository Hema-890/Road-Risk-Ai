// ==============================================================================
// ROADRISK AI — AUTHORITATIVE ETA & TIME CALCULATION SERVICE
// Single Source of Truth for Travel Timing, Departures, Durations & Arrivals
// Eliminates decentralized, ad-hoc, or duplicate time arithmetic across UI panels.
// ==============================================================================

export interface RouteTimingDetails {
  requestedDepartureTime: Date;
  durationSeconds: number;
  freeFlowDurationSeconds: number;
  trafficDelaySeconds: number;
  arrivalTime: Date;
  formattedDuration: string;
  formattedDepartureTime: string;
  formattedArrivalTime: string;
  isMultiDay: boolean;
  dayOffset: number; // 0 = today, 1 = tomorrow, etc.
}

class ETAService {
  /**
   * Computes authoritative arrival timestamp from requested departure and provider-derived duration.
   * Formula: arrivalTime = departureTime + durationSeconds
   */
  public computeArrival(departureTime: Date | number | string, durationSeconds: number): Date {
    const depMs = typeof departureTime === 'object' ? departureTime.getTime() : new Date(departureTime).getTime();
    const safeDepMs = isNaN(depMs) ? Date.now() : depMs;
    const durMs = Math.max(0, Math.round(durationSeconds)) * 1000;
    return new Date(safeDepMs + durMs);
  }

  /**
   * Formats duration seconds into readable string (e.g., "5h 20m" or "18 min" or "48h")
   */
  public formatDuration(totalSeconds: number): string {
    const sec = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(sec / 3600);
    const minutes = Math.round((sec % 3600) / 60);

    if (hours === 0) {
      return `${Math.max(1, minutes)} min`;
    }
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  }

  /**
   * Formats arrival date with local time and day relative indicator (e.g., "3:20 PM" or "Tomorrow 2:45 PM")
   */
  public formatArrivalTime(arrivalDate: Date, departureDate: Date = new Date()): string {
    const timeStr = arrivalDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    
    // Calculate calendar day difference in local time
    const depDay = new Date(departureDate.getFullYear(), departureDate.getMonth(), departureDate.getDate());
    const arrDay = new Date(arrivalDate.getFullYear(), arrivalDate.getMonth(), arrivalDate.getDate());
    const diffDays = Math.round((arrDay.getTime() - depDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return timeStr;
    } else if (diffDays === 1) {
      return `Tomorrow, ${timeStr}`;
    } else {
      return `+${diffDays} days (${timeStr})`;
    }
  }

  /**
   * Formats departure date into human-readable string
   */
  public formatDepartureTime(departureDate: Date): string {
    const isNow = Math.abs(Date.now() - departureDate.getTime()) < 60_000;
    const timeStr = departureDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isNow) {
      return `Now (${timeStr})`;
    }
    return timeStr;
  }

  /**
   * Authoritative complete route timing breakdown
   * @param departureTime Requested departure time (Date, ISO string, or timestamp)
   * @param totalDurationSeconds Total duration reported by provider (includes traffic for traffic-aware modes)
   * @param trafficDelaySeconds Additional traffic delay identified by provider
   */
  public calculateRouteTiming(
    departureTime: Date | number | string,
    totalDurationSeconds: number,
    trafficDelaySeconds: number = 0
  ): RouteTimingDetails {
    const depDate = typeof departureTime === 'object' ? departureTime : new Date(departureTime);
    const safeDep = isNaN(depDate.getTime()) ? new Date() : depDate;
    
    const duration = Math.max(1, Math.round(totalDurationSeconds));
    const delay = Math.max(0, Math.round(trafficDelaySeconds));
    const freeFlow = Math.max(0, duration - delay);
    
    const arrivalDate = this.computeArrival(safeDep, duration);

    const depDay = new Date(safeDep.getFullYear(), safeDep.getMonth(), safeDep.getDate());
    const arrDay = new Date(arrivalDate.getFullYear(), arrivalDate.getMonth(), arrivalDate.getDate());
    const dayOffset = Math.max(0, Math.round((arrDay.getTime() - depDay.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      requestedDepartureTime: safeDep,
      durationSeconds: duration,
      freeFlowDurationSeconds: freeFlow,
      trafficDelaySeconds: delay,
      arrivalTime: arrivalDate,
      formattedDuration: this.formatDuration(duration),
      formattedDepartureTime: this.formatDepartureTime(safeDep),
      formattedArrivalTime: this.formatArrivalTime(arrivalDate, safeDep),
      isMultiDay: dayOffset > 0,
      dayOffset,
    };
  }
}

export const etaService = new ETAService();
export default etaService;
