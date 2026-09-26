// ==============================================================================
// ROADRISK AI — NAVIGATION-GRADE GEOLOCATION SERVICE
// Continuous GPS tracking with high accuracy, physical outlier rejection,
// impossible velocity filtering (>220 km/h), heading smoothing, and
// explicit location state modeling: LOCATING | LIVE | LOW_ACCURACY | PERMISSION_DENIED | UNAVAILABLE | STALE
// ==============================================================================

import { validateCoordinates, isRealisticGpsMovement, calculateDistanceMeters } from '../utils/geoUtils.ts';
import { reverseGeocode } from './geocodingService.ts';
import { eventBus } from './eventBus.ts';

export type LocationState =
  | 'INITIALIZING'
  | 'AVAILABLE'
  | 'STALE'
  | 'LOST'
  | 'RECOVERING'
  | 'RECOVERED'
  | 'PERMISSION_DENIED'
  | 'UNAVAILABLE'
  | 'LOW_ACCURACY'
  // Backwards compatibility aliases:
  | 'LOCATING'
  | 'LIVE';

export interface LocationPacket {
  coordinates: [number, number]; // [longitude, latitude]
  accuracyMeters: number;
  heading: number | null; // degrees 0..360 or null
  speedKmh: number | null;
  timestamp: number;
  state: LocationState;
  statusMessage: string;
  address?: string;
  isSimulated?: boolean;
}

class LocationService {
  private watchId: number | null = null;
  private currentPacket: LocationPacket | null = null;
  private listeners: Set<(packet: LocationPacket) => void> = new Set();
  private stateListeners: Set<(state: LocationState, msg: string) => void> = new Set();
  private currentState: LocationState = 'INITIALIZING';
  private lastUpdateTimestamp: number = 0;
  private stalenessTimer: ReturnType<typeof setInterval> | null = null;
  private currentAddress: string = '';
  private lastGeocodedCoords: [number, number] | null = null;
  private rejectedAnomalyCount: number = 0;

  constructor() {
    this.startStalenessCheck();
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'geolocation' in navigator;
  }

  /**
   * Initializes automatic live-location tracking on startup
   */
  public autoStartTracking(
    onInitialAcquire?: (packet: LocationPacket) => void,
    onStateChange?: (state: LocationState, msg: string) => void
  ): () => void {
    if (onStateChange) this.stateListeners.add(onStateChange);

    if (!this.isSupported()) {
      this.setState('UNAVAILABLE', 'Geolocation API is unsupported on this browser/device.');
      return () => {};
    }

    this.setState('INITIALIZING', 'Acquiring GPS satellite telemetry...');

    // Single trigger for initial resolve if requested
    let initialResolved = false;

    const unsub = this.startWatching(
      (packet) => {
        if (!initialResolved && onInitialAcquire) {
          initialResolved = true;
          onInitialAcquire(packet);
        }
      },
      (errState, errMsg) => {
        this.setState(errState, errMsg);
      }
    );

    return () => {
      unsub();
      if (onStateChange) this.stateListeners.delete(onStateChange);
    };
  }

  /**
   * Starts high-accuracy continuous geolocation watching
   */
  public startWatching(
    onLocation: (packet: LocationPacket) => void,
    onError?: (state: LocationState, err: string) => void
  ): () => void {
    this.listeners.add(onLocation);

    // If valid cached packet exists, emit immediately
    if (this.currentPacket) {
      onLocation(this.currentPacket);
    }

    if (this.watchId === null && this.isSupported()) {
      try {
        this.watchId = navigator.geolocation.watchPosition(
          (pos) => this.handleSuccess(pos),
          (err) => this.handleError(err, onError),
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 2000,
          }
        );
      } catch (e: any) {
        this.setState('UNAVAILABLE', e.message || 'Failed to start GPS watcher.');
      }
    }

    return () => {
      this.listeners.delete(onLocation);
      if (this.listeners.size === 0 && this.watchId !== null) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
    };
  }

  /**
   * Validates and ingests raw browser position update with rigorous physical anomaly protection
   */
  public handleSuccess(pos: GeolocationPosition | { coords: { latitude: number; longitude: number; accuracy?: number; speed?: number | null; heading?: number | null }; timestamp?: number }) {
    const rawCoords: [number, number] = [pos.coords.longitude, pos.coords.latitude];

    // 1. Coordinate Range Validation
    if (!validateCoordinates(rawCoords)) {
      console.warn('RoadRisk AI: Received invalid coordinates from device GPS:', rawCoords);
      this.rejectedAnomalyCount++;
      return;
    }

    // 2. Reject Null Island [0, 0] or near-zero origin anomalies unless intended
    if (Math.abs(rawCoords[0]) < 0.0001 && Math.abs(rawCoords[1]) < 0.0001) {
      console.warn('RoadRisk AI: Rejected null-island [0,0] GPS coordinate anomaly.');
      this.rejectedAnomalyCount++;
      return;
    }

    const now = pos.timestamp || Date.now();

    // 3. Timestamp Sanity: Reject future timestamps (>15s) or stale backwards timestamps (>5s older)
    const clockSkew = now - Date.now();
    if (clockSkew > 15000) {
      console.warn('RoadRisk AI: Rejected GPS packet with anomalous future timestamp:', clockSkew);
      this.rejectedAnomalyCount++;
      return;
    }
    if (this.lastUpdateTimestamp > 0 && now < this.lastUpdateTimestamp - 5000) {
      console.warn('RoadRisk AI: Rejected out-of-order stale GPS packet.');
      this.rejectedAnomalyCount++;
      return;
    }

    const timeDeltaMs = this.lastUpdateTimestamp > 0 ? now - this.lastUpdateTimestamp : 1000;

    // 4. Impossible Velocity / Teleportation Jump Rejection (>220 km/h or >350m within 1000ms)
    if (this.currentPacket && timeDeltaMs < 30000) {
      const isRealistic = isRealisticGpsMovement(
        this.currentPacket.coordinates,
        rawCoords,
        timeDeltaMs
      );
      if (!isRealistic) {
        console.warn('RoadRisk AI: Rejected unrealistic GPS teleport jump.', {
          from: this.currentPacket.coordinates,
          to: rawCoords,
          timeDeltaMs,
        });
        this.rejectedAnomalyCount++;
        return;
      }
    }

    const accuracy = Math.round(pos.coords.accuracy || 20);
    const speedKmh = pos.coords.speed !== null && !isNaN(pos.coords.speed as number)
      ? Math.round(Math.max(0, (pos.coords.speed as number) * 3.6))
      : null;

    // 5. Heading Handling: never invent heading if absent
    const heading = pos.coords.heading !== null && !isNaN(pos.coords.heading as number) && (pos.coords.heading as number) >= 0
      ? Math.round(pos.coords.heading as number)
      : null;

    // 6. Recovery Lifecycle: if previous state was LOST or STALE, transition through RECOVERING -> RECOVERED -> AVAILABLE
    const wasDegraded = this.currentState === 'LOST' || this.currentState === 'STALE';
    if (wasDegraded) {
      this.setState('RECOVERING', 'GPS signal re-acquired. Validating telemetry...');
      this.setState('RECOVERED', `GPS recovered (±${accuracy}m)`);
      eventBus.emit('GPS_RECOVERED', {
        coordinates: rawCoords,
        accuracyMeters: accuracy,
        previousState: this.currentState,
      });
    }

    // 7. Accuracy State Classification
    let state: LocationState = 'AVAILABLE';
    let statusMessage = this.currentAddress
      ? `📍 ${this.currentAddress} (±${accuracy}m)`
      : `📍 Live Location (±${accuracy}m)`;

    if (accuracy > 65) {
      state = 'LOW_ACCURACY';
      statusMessage = `⚠ Location accuracy is low (±${accuracy}m)`;
    }

    const packet: LocationPacket = {
      coordinates: rawCoords,
      accuracyMeters: accuracy,
      heading,
      speedKmh,
      timestamp: now,
      state,
      statusMessage,
      address: this.currentAddress || undefined,
    };

    this.currentPacket = packet;
    this.lastUpdateTimestamp = now;
    this.setState(state, statusMessage);

    // Trigger asynchronous reverse geocoding if address is empty or moved > 150m
    if (
      !this.currentAddress ||
      calculateDistanceMeters(this.lastGeocodedCoords || [0, 0], rawCoords) > 150
    ) {
      this.lastGeocodedCoords = [...rawCoords];
      reverseGeocode(rawCoords)
        .then((res) => {
          if (res && res.formattedAddress) {
            this.currentAddress = res.formattedAddress;
            if (this.currentPacket) {
              this.currentPacket.address = res.formattedAddress;
              this.currentPacket.statusMessage = `📍 ${res.formattedAddress} (±${accuracy}m)`;
              this.listeners.forEach((l) => l(this.currentPacket!));
              eventBus.emit('GPS_UPDATED', this.currentPacket);
            }
          }
        })
        .catch(() => {});
    }

    // Notify listeners
    this.listeners.forEach((l) => l(packet));
    eventBus.emit('GPS_UPDATED', packet);
  }

  private handleError(
    err: GeolocationPositionError,
    onError?: (state: LocationState, err: string) => void
  ) {
    let state: LocationState = 'UNAVAILABLE';
    let msg = 'Failed to acquire device location.';

    if (err.code === err.PERMISSION_DENIED) {
      state = 'PERMISSION_DENIED';
      msg = 'Location permission required for live navigation. Please allow location access in your browser.';
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      state = 'UNAVAILABLE';
      msg = 'Device GPS/Location signal is currently unavailable.';
    } else if (err.code === err.TIMEOUT) {
      state = this.currentPacket ? 'STALE' : 'UNAVAILABLE';
      msg = 'GPS signal acquisition timed out.';
    }

    this.setState(state, msg);
    if (onError) onError(state, msg);
  }

  private setState(state: LocationState, msg: string) {
    this.currentState = state;
    this.stateListeners.forEach((l) => l(state, msg));
  }

  /**
   * Detects staleness if no GPS update has been received for > 15 seconds, and lost if > 30 seconds
   */
  private startStalenessCheck() {
    if (typeof window === 'undefined') return;
    this.stalenessTimer = setInterval(() => {
      if (this.currentPacket && (this.currentState === 'AVAILABLE' || this.currentState === 'LIVE' || this.currentState === 'LOW_ACCURACY')) {
        const ageSec = (Date.now() - this.lastUpdateTimestamp) / 1000;
        if (ageSec > 30) {
          this.setState('LOST', `GPS signal lost (no telemetry for ${Math.round(ageSec)}s). Retaining last known position.`);
          if (this.currentPacket) {
            this.currentPacket.state = 'LOST';
          }
          eventBus.emit('GPS_LOST', { lastPacket: this.currentPacket, ageSec });
        } else if (ageSec > 15) {
          this.setState('STALE', `GPS signal stale (last updated ${Math.round(ageSec)}s ago)`);
          if (this.currentPacket) {
            this.currentPacket.state = 'STALE';
          }
        }
      }
    }, 5000);
  }

  /**
   * Controlled simulation injection for testing recovery, jumps, and off-route
   */
  public injectTestLocation(coords: [number, number], options: { accuracy?: number; speedKmh?: number; heading?: number; timestamp?: number } = {}) {
    this.handleSuccess({
      coords: {
        longitude: coords[0],
        latitude: coords[1],
        accuracy: options.accuracy || 15,
        speed: options.speedKmh ? options.speedKmh / 3.6 : 0,
        heading: options.heading !== undefined ? options.heading : 90,
      },
      timestamp: options.timestamp || Date.now(),
    });
  }

  public simulateSignalLoss() {
    this.lastUpdateTimestamp = Date.now() - 35000;
    this.setState('LOST', 'Simulated GPS signal loss. Retaining last known coordinates.');
    if (this.currentPacket) {
      this.currentPacket.state = 'LOST';
    }
    eventBus.emit('GPS_LOST', { lastPacket: this.currentPacket, ageSec: 35 });
  }

  public getRejectedAnomalyCount(): number {
    return this.rejectedAnomalyCount;
  }

  public getCurrentPacket(): LocationPacket | null {
    return this.currentPacket;
  }

  public getCurrentState(): LocationState {
    return this.currentState;
  }

  public async getCurrentLocation(): Promise<[number, number] | null> {
    if (this.currentPacket) {
      return this.currentPacket.coordinates;
    }
    if (!this.isSupported()) return null;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          if (validateCoordinates(coords)) {
            resolve(coords);
          } else {
            resolve(null);
          }
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    });
  }
}

export const locationService = new LocationService();
export default locationService;
