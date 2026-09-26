// ==============================================================================
// ROADRISK AI — ENTERPRISE SPEECH RECOGNITION & VOICE COMMAND INTENT ENGINE
// Built on browser Web Speech API (SpeechRecognition / webkitSpeechRecognition)
// Supports: English (en-US), Telugu (te-IN), Hindi (hi-IN), Tamil (ta-IN), Kannada (kn-IN)
// Features: Microphone permission handling, live audio waveform tracking,
// multi-language intent parsing, and natural feedback execution.
// ==============================================================================

export type VoiceInputLanguage = 'en-US' | 'te-IN' | 'hi-IN' | 'ta-IN' | 'kn-IN';

export type VoiceIntentType =
  | 'NAVIGATE_TO'
  | 'SEARCH_PLACE'
  | 'FIND_POI'
  | 'START_NAVIGATION'
  | 'STOP_NAVIGATION'
  | 'REROUTE'
  | 'CURRENT_LOCATION'
  | 'RECENTER_MAP'
  | 'ROUTE_INFO'
  | 'SWITCH_MODE'
  | 'FASTEST_ROUTE'
  | 'SAFEST_ROUTE'
  | 'ZOOM_IN'
  | 'ZOOM_OUT'
  | 'MUTE'
  | 'UNMUTE'
  | 'REPEAT_INSTRUCTION'
  | 'SET_DEPARTURE'
  | 'SHOW_TRAFFIC'
  | 'AVOID_HIGHWAYS'
  | 'AVOID_TOLLS'
  | 'UNKNOWN';

export interface VoiceIntent {
  type: VoiceIntentType;
  intent?: VoiceIntentType; // Alias for test compatibility
  rawTranscript: string;
  normalizedQuery?: string;
  payload?: any;
  slots?: { mode?: string; category?: string; query?: string; time?: string };
  confidence: number;
}

export type VoiceInputState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'LISTENING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'ERROR'
  | 'UNSUPPORTED';

export interface VoiceInputListener {
  onStateChange?: (state: VoiceInputState, message?: string) => void;
  onInterimTranscript?: (text: string) => void;
  onIntentRecognized?: (intent: VoiceIntent) => void;
  onAudioLevel?: (level: number) => void; // 0.0 to 1.0 for dynamic waveform
}

class VoiceInputService {
  private recognition: any = null;
  private state: VoiceInputState = 'IDLE';
  private currentLanguage: VoiceInputLanguage = 'en-US';
  private listeners: Set<VoiceInputListener> = new Set();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private animFrameId: number | null = null;

  constructor() {
    this.initSpeechRecognition();
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public getState(): VoiceInputState {
    return this.state;
  }

  public getLanguage(): VoiceInputLanguage {
    return this.currentLanguage;
  }

  public setLanguage(lang: VoiceInputLanguage) {
    this.currentLanguage = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public subscribe(listener: VoiceInputListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyState(state: VoiceInputState, message?: string) {
    this.state = state;
    this.listeners.forEach((l) => l.onStateChange?.(state, message));
  }

  private initSpeechRecognition() {
    if (!this.isSupported()) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 3;
      this.recognition.lang = this.currentLanguage;

      this.recognition.onstart = () => {
        this.notifyState('LISTENING', 'Listening... Speak your command');
      };

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += trans;
          } else {
            interim += trans;
          }
        }

        if (interim) {
          this.listeners.forEach((l) => l.onInterimTranscript?.(interim));
        }

        if (final) {
          this.notifyState('PROCESSING', 'Understanding command...');
          const intent = this.parseIntent(final.trim());
          this.listeners.forEach((l) => l.onIntentRecognized?.(intent));
          this.notifyState('SUCCESS', `Recognized: "${final.trim()}"`);
          setTimeout(() => {
            if (this.state === 'SUCCESS') {
              this.notifyState('IDLE');
            }
          }, 3500);
        }
      };

      this.recognition.onerror = (event: any) => {
        this.stopAudioAnalysis();
        let errorMsg = 'Voice recognition error.';
        if (event.error === 'not-allowed') {
          errorMsg = 'Microphone permission denied. Please allow microphone access.';
        } else if (event.error === 'no-speech') {
          errorMsg = 'No speech detected. Please speak clearly.';
        } else if (event.error === 'network') {
          errorMsg = 'Network error during speech recognition.';
        }
        this.notifyState('ERROR', errorMsg);
        setTimeout(() => {
          if (this.state === 'ERROR') {
            this.notifyState('IDLE');
          }
        }, 4000);
      };

      this.recognition.onend = () => {
        this.stopAudioAnalysis();
        if (this.state === 'LISTENING') {
          this.notifyState('IDLE');
        }
      };
    } catch (e: any) {
      console.warn('SpeechRecognition initialization error:', e);
    }
  }

  /**
   * Request microphone permission and start listening
   */
  public async startListening(): Promise<boolean> {
    if (!this.isSupported()) {
      this.notifyState('UNSUPPORTED', 'Speech recognition is not supported in this browser.');
      return false;
    }

    if (this.state === 'LISTENING') {
      this.stopListening();
      return true;
    }

    this.notifyState('REQUESTING_PERMISSION', 'Accessing microphone...');

    try {
      // Start audio waveform analyzer if MediaDevices is supported
      await this.startAudioAnalysis();

      this.initSpeechRecognition();
      if (!this.recognition) {
        throw new Error('Recognition object could not be created.');
      }

      this.recognition.start();
      return true;
    } catch (err: any) {
      this.stopAudioAnalysis();
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone permission denied.'
        : err.message || 'Could not start voice recognition.';
      this.notifyState('ERROR', msg);
      return false;
    }
  }

  public stopListening() {
    this.stopAudioAnalysis();
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.notifyState('IDLE');
  }

  // --------------------------------------------------------------------------
  // Real Audio Waveform / Level Tracking (MediaStream + AnalyserNode)
  // --------------------------------------------------------------------------
  private async startAudioAnalysis() {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.micStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudioLevel = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(1.0, avg / 128); // 0.0 to 1.0

        this.listeners.forEach((l) => l.onAudioLevel?.(normalized));

        if (this.state === 'LISTENING') {
          this.animFrameId = requestAnimationFrame(checkAudioLevel);
        }
      };

      checkAudioLevel();
    } catch {
      // Non-fatal if audio context or waveform analyzer cannot start
    }
  }

  private stopAudioAnalysis() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.listeners.forEach((l) => l.onAudioLevel?.(0));
  }

  // --------------------------------------------------------------------------
  // Structured Intent Engine
  // --------------------------------------------------------------------------
  public parseIntent(raw: string): VoiceIntent {
    const text = raw.trim();
    const lower = text.toLowerCase();

    const buildIntent = (
      type: VoiceIntentType,
      confidence: number,
      opts: { payload?: any; normalizedQuery?: string; slots?: { mode?: string; category?: string; query?: string; time?: string } } = {}
    ): VoiceIntent => ({
      type,
      intent: type,
      rawTranscript: text,
      normalizedQuery: opts.normalizedQuery,
      payload: opts.payload,
      slots: opts.slots || (opts.payload ? { mode: opts.payload, category: opts.payload } : undefined),
      confidence,
    });

    // 1. START NAVIGATION
    if (
      lower === 'start' ||
      lower === 'start navigation' ||
      lower.includes('start nav') ||
      lower.includes('start journey') ||
      lower.includes('begin navigation') ||
      lower.includes('modalu pettu') || // Telugu
      lower.includes('shuru karo') || // Hindi
      lower.includes('thodangu') // Tamil
    ) {
      return buildIntent('START_NAVIGATION', 0.95);
    }

    // 2. STOP / CANCEL NAVIGATION
    if (
      lower.includes('stop navigation') ||
      lower.includes('cancel navigation') ||
      lower.includes('end navigation') ||
      lower.includes('stop directions') ||
      lower === 'stop' ||
      lower === 'cancel' ||
      lower.includes('aapu') || // Telugu
      lower.includes('band karo') || // Hindi
      lower.includes('nirthu') // Tamil
    ) {
      return buildIntent('STOP_NAVIGATION', 0.95);
    }

    // 3. REPEAT INSTRUCTION
    if (
      lower.includes('repeat that') ||
      lower.includes('repeat instruction') ||
      lower.includes('repeat') ||
      lower.includes('say that again') ||
      lower.includes('say again') ||
      lower.includes('malli cheppu') // Telugu
    ) {
      return buildIntent('REPEAT_INSTRUCTION', 0.95);
    }

    // 4. DEPARTURE TIME
    if (lower.includes('depart now') || lower.includes('leave now') || lower.includes('start now')) {
      return buildIntent('SET_DEPARTURE', 0.95, { payload: 'now', slots: { time: 'now' } });
    }
    const departMatch = lower.match(/(?:depart at|leave at|starting at)\s+(.+)/i);
    if (departMatch && departMatch[1]) {
      return buildIntent('SET_DEPARTURE', 0.92, { payload: departMatch[1].trim(), slots: { time: departMatch[1].trim() } });
    }

    // 5. REROUTE / DYNAMIC PATH / RECALCULATE
    if (
      lower.includes('reroute') ||
      lower.includes('recalculate route') ||
      lower.includes('recalculate') ||
      lower.includes('change route') ||
      lower.includes('alternate route') ||
      lower.includes('avoid traffic') ||
      lower.includes('rasta badlo') || // Hindi
      lower.includes('marpu') // Telugu
    ) {
      return buildIntent('REROUTE', 0.92);
    }

    // 6. FASTEST ROUTE
    if (lower.includes('fastest route') || lower.includes('show fastest') || lower.includes('quickest')) {
      return buildIntent('FASTEST_ROUTE', 0.95);
    }

    // 7. SAFEST ROUTE
    if (lower.includes('safer route') || lower.includes('safest route') || lower.includes('show safer') || lower.includes('avoid hazards')) {
      return buildIntent('SAFEST_ROUTE', 0.95);
    }

    if (lower.includes('show traffic') || lower.includes('traffic conditions') || lower.includes('how is traffic') || lower === 'traffic') {
      return buildIntent('SHOW_TRAFFIC', 0.95);
    }

    if (lower.includes('avoid highways') || lower.includes('no highways') || lower.includes('avoid highway')) {
      return buildIntent('AVOID_HIGHWAYS', 0.95);
    }

    if (lower.includes('avoid tolls') || lower.includes('no tolls') || lower.includes('toll free')) {
      return buildIntent('AVOID_TOLLS', 0.95);
    }

    // 8. CURRENT LOCATION / RECENTER MAP / WHERE AM I
    if (
      lower.includes('where am i') ||
      lower.includes('recenter map') ||
      lower.includes('recenter') ||
      lower.includes('current location') ||
      lower.includes('my location') ||
      lower.includes('ekkada unnanu') || // Telugu
      lower.includes('main kahan hoon') // Hindi
    ) {
      return buildIntent('CURRENT_LOCATION', 0.95);
    }

    // 9. ROUTE INFO / ETA / DISTANCE
    if (
      lower.includes('how far') ||
      lower.includes('how long') ||
      lower.includes('remaining distance') ||
      lower.includes('what is my eta') ||
      lower.includes('time to destination')
    ) {
      return buildIntent('ROUTE_INFO', 0.9);
    }

    // 10. TRAVEL MODE SWITCHING
    if (lower.includes('switch to bike') || lower.includes('switch to motorcycle') || lower.includes('bike mode') || lower.includes('motorcycle mode')) {
      return buildIntent('SWITCH_MODE', 0.95, { payload: 'BIKE', slots: { mode: 'BIKE' } });
    }
    if (lower.includes('switch to bicycle') || lower.includes('cycle mode') || lower.includes('bicycle mode')) {
      return buildIntent('SWITCH_MODE', 0.95, { payload: 'BICYCLE', slots: { mode: 'BICYCLE' } });
    }
    if (lower.includes('switch to walk') || lower.includes('switch to walking') || lower.includes('walk mode') || lower.includes('walking route') || lower.includes('pedestrian mode')) {
      return buildIntent('SWITCH_MODE', 0.95, { payload: 'WALK', slots: { mode: 'WALK' } });
    }
    if (lower.includes('switch to car') || lower.includes('drive mode') || lower.includes('car mode') || lower.includes('driving mode')) {
      return buildIntent('SWITCH_MODE', 0.95, { payload: 'CAR', slots: { mode: 'CAR' } });
    }
    if (lower.includes('switch to transit') || lower.includes('train mode') || lower.includes('bus mode') || lower.includes('public transit')) {
      return buildIntent('SWITCH_MODE', 0.95, { payload: 'TRANSIT', slots: { mode: 'TRANSIT' } });
    }

    // 11. ZOOM CONTROLS
    if (lower.includes('zoom in') || lower === 'closer') {
      return buildIntent('ZOOM_IN', 0.95);
    }
    if (lower.includes('zoom out') || lower === 'wider') {
      return buildIntent('ZOOM_OUT', 0.95);
    }

    // 12. MUTE / UNMUTE
    if (lower.includes('mute navigation') || lower.includes('mute voice') || lower.includes('mute audio') || lower === 'mute') {
      return buildIntent('MUTE', 0.95);
    }
    if (lower.includes('unmute navigation') || lower.includes('unmute voice') || lower.includes('unmute audio') || lower === 'unmute') {
      return buildIntent('UNMUTE', 0.95);
    }

    // 13. DIRECT NAVIGATION TO SPECIFIC PLACE (e.g. "navigate to ...", "take me to ...")
    const navMatch = lower.match(/(?:navigate to|take me to|directions to|go to|chalo|vellu)\s+(.+)/i);
    if (navMatch && navMatch[1]) {
      return buildIntent('NAVIGATE_TO', 0.95, {
        normalizedQuery: navMatch[1].trim(),
        slots: { query: navMatch[1].trim() },
      });
    }

    // 14. POI CATEGORY SEARCHES
    if (lower.includes('hospital') || lower.includes('clinic') || lower.includes('asupathri') || lower.includes('doctor')) {
      return buildIntent('FIND_POI', 0.92, { payload: 'hospital', slots: { category: 'hospital' } });
    }
    if (lower.includes('petrol') || lower.includes('fuel') || lower.includes('gas station') || lower.includes('diesel')) {
      return buildIntent('FIND_POI', 0.92, { payload: 'fuel', slots: { category: 'fuel' } });
    }
    if (lower.includes('charging station') || lower.includes('ev charging') || lower.includes('electric vehicle')) {
      return buildIntent('FIND_POI', 0.92, { payload: 'ev', slots: { category: 'ev' } });
    }
    if (lower.includes('police station') || lower.includes('police')) {
      return buildIntent('FIND_POI', 0.92, { payload: 'police', slots: { category: 'police' } });
    }
    if (lower.includes('fire station') || lower.includes('fire rescue')) {
      return buildIntent('FIND_POI', 0.92, { payload: 'fire', slots: { category: 'fire' } });
    }
    if (lower.includes('restaurant') || lower.includes('food') || lower.includes('tiffin') || lower.includes('hotel')) {
      return buildIntent('FIND_POI', 0.9, { payload: 'restaurant', slots: { category: 'restaurant' } });
    }
    if (lower.includes('railway station') || lower.includes('train station') || lower.includes('bus stand') || lower.includes('bus station')) {
      return buildIntent('FIND_POI', 0.92, { payload: 'station', slots: { category: 'station' } });
    }
    if (lower.includes('pharmacy') || lower.includes('medical shop') || lower.includes('chemist')) {
      return buildIntent('FIND_POI', 0.92, { payload: 'pharmacy', slots: { category: 'pharmacy' } });
    }

    const searchMatch = lower.match(/(?:search for|find|look up)\s+(.+)/i);
    if (searchMatch && searchMatch[1]) {
      return buildIntent('SEARCH_PLACE', 0.92, {
        normalizedQuery: searchMatch[1].trim(),
        slots: { query: searchMatch[1].trim() },
      });
    }

    // Default: treat as place navigation query
    return buildIntent('NAVIGATE_TO', 0.8, {
      normalizedQuery: text,
      slots: { query: text },
    });
  }
}

export const voiceInputService = new VoiceInputService();
export default voiceInputService;
