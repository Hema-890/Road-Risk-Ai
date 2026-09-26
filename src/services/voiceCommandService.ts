/**
 * RoadRisk AI - Multilingual Voice Command & Speech Recognition Service
 * Supports English (en-US), Telugu (te-IN), Hindi (hi-IN), Tamil (ta-IN), and Kannada (kn-IN)
 * Translates spoken utterances into navigation actions and search queries.
 */

export type VoiceLanguage = 'en-US' | 'te-IN' | 'hi-IN' | 'ta-IN' | 'kn-IN';

export interface VoiceIntentResult {
  rawTranscript: string;
  intent: 'NAVIGATE' | 'SEARCH_CATEGORY' | 'CANCEL_NAV' | 'RECENTER' | 'REROUTE' | 'UNKNOWN';
  payload?: string; // destination query or category name
  confidence: number;
}

export interface VoiceCommandCallbacks {
  onStart?: () => void;
  onInterimResult?: (text: string) => void;
  onFinalResult?: (result: VoiceIntentResult) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

class VoiceCommandService {
  private recognition: any = null;
  private isListening: boolean = false;
  private currentLanguage: VoiceLanguage = 'en-US';

  constructor() {
    this.initRecognition();
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    );
  }

  private initRecognition() {
    if (!this.isSupported()) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;
    this.recognition.lang = this.currentLanguage;
  }

  public setLanguage(lang: VoiceLanguage) {
    this.currentLanguage = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public getLanguage(): VoiceLanguage {
    return this.currentLanguage;
  }

  public startListening(callbacks: VoiceCommandCallbacks): boolean {
    if (!this.isSupported()) {
      callbacks.onError?.('Speech recognition is not supported in this browser. Please use keyboard search.');
      return false;
    }

    if (this.isListening) {
      this.stopListening();
    }

    try {
      this.initRecognition();
      if (!this.recognition) return false;

      this.recognition.onstart = () => {
        this.isListening = true;
        callbacks.onStart?.();
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript) {
          callbacks.onInterimResult?.(interimTranscript);
        }

        if (finalTranscript) {
          const parsed = this.parseIntent(finalTranscript.trim());
          callbacks.onFinalResult?.(parsed);
        }
      };

      this.recognition.onerror = (event: any) => {
        let msg = 'Voice recognition error.';
        if (event.error === 'not-allowed') {
          msg = 'Microphone permission denied. Please allow microphone access.';
        } else if (event.error === 'no-speech') {
          msg = 'No speech detected. Please try again.';
        } else if (event.error === 'network') {
          msg = 'Network error during speech recognition.';
        }
        this.isListening = false;
        callbacks.onError?.(msg);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        callbacks.onEnd?.();
      };

      this.recognition.start();
      return true;
    } catch (e: any) {
      this.isListening = false;
      callbacks.onError?.(e.message || 'Could not start voice recognition.');
      return false;
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
      this.isListening = false;
    }
  }

  /**
   * Translates spoken sentences in English, Telugu, and Hindi to structured navigation actions
   */
  public parseIntent(text: string): VoiceIntentResult {
    const lower = text.toLowerCase().trim();

    // 1. Cancel / Stop Navigation
    if (
      lower.includes('cancel navigation') ||
      lower.includes('stop navigation') ||
      lower.includes('end navigation') ||
      lower.includes('stop directions') ||
      lower.includes('aapu') || // Telugu
      lower.includes('band karo') || // Hindi
      lower.includes('ruk jao') ||
      lower.includes('nirthu') || // Tamil
      lower.includes('nillisu') // Kannada
    ) {
      return { rawTranscript: text, intent: 'CANCEL_NAV', confidence: 0.95 };
    }

    // 2. Recenter / Where Am I
    if (
      lower.includes('where am i') ||
      lower.includes('recenter') ||
      lower.includes('my location') ||
      lower.includes('current location') ||
      lower.includes('ekkada unnanu') || // Telugu
      lower.includes('main kahan hoon') || // Hindi
      lower.includes('engae irukiren') || // Tamil
      lower.includes('elli iddini') // Kannada
    ) {
      return { rawTranscript: text, intent: 'RECENTER', confidence: 0.95 };
    }

    // 3. Reroute / Safer Route
    if (
      lower.includes('reroute') ||
      lower.includes('change route') ||
      lower.includes('alternate route') ||
      lower.includes('safer route') ||
      lower.includes('hazard') ||
      lower.includes('marpu') || // Telugu
      lower.includes('rasta badlo') || // Hindi
      lower.includes('maruvali') || // Tamil
      lower.includes('bere dari') // Kannada
    ) {
      return { rawTranscript: text, intent: 'REROUTE', confidence: 0.9 };
    }

    // 4. Category Searches
    if (lower.includes('restaurant') || lower.includes('food') || lower.includes('tiffin') || lower.includes('khana')) {
      return { rawTranscript: text, intent: 'SEARCH_CATEGORY', payload: 'restaurant', confidence: 0.9 };
    }
    if (lower.includes('petrol') || lower.includes('fuel') || lower.includes('gas station') || lower.includes('diesel')) {
      return { rawTranscript: text, intent: 'SEARCH_CATEGORY', payload: 'fuel', confidence: 0.9 };
    }
    if (lower.includes('ev charging') || lower.includes('electric vehicle') || lower.includes('charging station')) {
      return { rawTranscript: text, intent: 'SEARCH_CATEGORY', payload: 'ev', confidence: 0.9 };
    }
    if (lower.includes('hospital') || lower.includes('doctor') || lower.includes('clinic') || lower.includes('asupathri') || lower.includes('davakhana')) {
      return { rawTranscript: text, intent: 'SEARCH_CATEGORY', payload: 'hospital', confidence: 0.9 };
    }
    if (lower.includes('pharmacy') || lower.includes('medical store') || lower.includes('chemist') || lower.includes('dawai')) {
      return { rawTranscript: text, intent: 'SEARCH_CATEGORY', payload: 'pharmacy', confidence: 0.9 };
    }
    if (lower.includes('parking')) {
      return { rawTranscript: text, intent: 'SEARCH_CATEGORY', payload: 'parking', confidence: 0.9 };
    }

    // 5. Navigate to specific place
    // Matches patterns like "navigate to [Place]", "take me to [Place]", "directions to [Place]", "go to [Place]"
    const navMatch = lower.match(/(?:navigate to|take me to|directions to|go to|vellu|chalo)\s+(.+)/i);
    if (navMatch && navMatch[1]) {
      return {
        rawTranscript: text,
        intent: 'NAVIGATE',
        payload: navMatch[1].trim(),
        confidence: 0.92,
      };
    }

    // Fallback: If utterance is a place name (e.g. "Benz Circle", "Vijayawada Station", "Cyber Towers")
    return {
      rawTranscript: text,
      intent: 'NAVIGATE',
      payload: text,
      confidence: 0.75,
    };
  }
}

export const voiceCommandService = new VoiceCommandService();
export default voiceCommandService;
