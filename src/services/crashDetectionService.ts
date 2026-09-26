/**
 * RoadRisk AI - Sudden Event & Potential Incident Intelligence Service
 * Monitors high-rate speed changes and telemetry vectors with confidence scoring.
 * Prevents false positives by requiring sudden deceleration (>0.65g) from speeds >35 km/h.
 */

export interface CrashDetectionEvent {
  id: string;
  timestamp: number;
  initialSpeedKmh: number;
  finalSpeedKmh: number;
  decelerationG: number;
  confidenceScore: number; // 0 to 100
  coordinates: [number, number];
  status: 'PENDING_CONFIRMATION' | 'USER_CONFIRMED_SAFE' | 'EMERGENCY_DISPATCHED' | 'EXPIRED';
}

export type CrashAlertListener = (event: CrashDetectionEvent) => void;

class CrashDetectionService {
  private lastKnownSpeedKmh: number = 0;
  private lastSpeedTimestamp: number = Date.now();
  private activeEvent: CrashDetectionEvent | null = null;
  private listeners: Set<CrashAlertListener> = new Set();
  private cooldownUntil: number = 0;

  /**
   * Evaluates incoming GPS / sensor telemetry for abrupt decelerations
   */
  public evaluateTelemetry(currentSpeedKmh: number, coords: [number, number]): CrashDetectionEvent | null {
    const now = Date.now();
    if (now < this.cooldownUntil) {
      this.lastKnownSpeedKmh = currentSpeedKmh;
      this.lastSpeedTimestamp = now;
      return null;
    }

    const timeDeltaSec = Math.max(0.2, (now - this.lastSpeedTimestamp) / 1000);
    const speedDropKmh = this.lastKnownSpeedKmh - currentSpeedKmh;

    // Deceleration in m/s^2: (delta_v_m_s) / timeDeltaSec
    // 1 km/h = 0.27778 m/s; 1g ≈ 9.80665 m/s^2
    const speedDropMs = (speedDropKmh * 1000) / 3600;
    const decelMs2 = speedDropMs / timeDeltaSec;
    const decelG = decelMs2 / 9.80665;

    // Conditions for potential severe collision/event:
    // 1. Initial speed was above 35 km/h (rule out low-speed parking bumps)
    // 2. Abrupt deceleration exceeds 0.65g
    // 3. Final speed is near zero (< 5 km/h)
    if (this.lastKnownSpeedKmh >= 35 && decelG >= 0.65 && currentSpeedKmh <= 5) {
      // Calculate confidence score (80% to 98%)
      const confidence = Math.min(
        98,
        Math.round(75 + (decelG - 0.65) * 20 + (this.lastKnownSpeedKmh / 100) * 10)
      );

      if (confidence >= 80) {
        const event: CrashDetectionEvent = {
          id: `inc_${Date.now()}`,
          timestamp: now,
          initialSpeedKmh: Math.round(this.lastKnownSpeedKmh),
          finalSpeedKmh: Math.round(currentSpeedKmh),
          decelerationG: parseFloat(decelG.toFixed(2)),
          confidenceScore: confidence,
          coordinates: coords,
          status: 'PENDING_CONFIRMATION',
        };

        this.activeEvent = event;
        this.cooldownUntil = now + 120000; // 2 minute cooldown between triggers
        this.notifyListeners(event);
        return event;
      }
    }

    this.lastKnownSpeedKmh = currentSpeedKmh;
    this.lastSpeedTimestamp = now;
    return null;
  }

  public subscribe(listener: CrashAlertListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(event: CrashDetectionEvent) {
    this.listeners.forEach((l) => l(event));
  }

  public markSafe(eventId: string) {
    if (this.activeEvent && this.activeEvent.id === eventId) {
      this.activeEvent.status = 'USER_CONFIRMED_SAFE';
      this.notifyListeners(this.activeEvent);
      this.activeEvent = null;
    }
  }

  public markEmergency(eventId: string) {
    if (this.activeEvent && this.activeEvent.id === eventId) {
      this.activeEvent.status = 'EMERGENCY_DISPATCHED';
      this.notifyListeners(this.activeEvent);
    }
  }

  public getActiveEvent(): CrashDetectionEvent | null {
    return this.activeEvent;
  }

  public clearActiveEvent() {
    this.activeEvent = null;
  }
}

export const crashDetectionService = new CrashDetectionService();
export default crashDetectionService;
