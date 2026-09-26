// ==============================================================================
// ROADRISK AI — ENTERPRISE MULTILINGUAL SPEECH SYNTHESIS ENGINE
// Native Web Speech API integration with priority interrupts, multilingual
// voice resolution (en, te, hi, ta, kn), and volume/playback controls.
// ==============================================================================

export interface SpeakOptions {
  force?: boolean;
  lang?: string;
  priority?: number; // 0 (P0: Emergency) to 5 (P5: Info)
  volume?: number;
  rate?: number;
}

class SpeechService {
  private isMuted: boolean = false;
  private volume: number = 0.95;
  private currentLanguage: string = 'en-US';
  private lastSpokenText: string = '';
  private lastSpokenTime: number = 0;
  private minCooldownMs: number = 2000;
  private currentPriority: number = 5;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private pendingTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      try {
        const savedMute = localStorage.getItem('roadrisk_voice_muted');
        if (savedMute !== null) this.isMuted = savedMute === 'true';
        const savedVol = localStorage.getItem('roadrisk_voice_volume');
        if (savedVol !== null) this.volume = parseFloat(savedVol);
        const savedLang = localStorage.getItem('roadrisk_voice_lang');
        if (savedLang) this.currentLanguage = savedLang;
      } catch {}
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('roadrisk_voice_muted', String(muted));
    } catch {}
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.activeUtterance = null;
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setLanguage(lang: string) {
    this.currentLanguage = lang;
    try {
      localStorage.setItem('roadrisk_voice_lang', lang);
    } catch {}
  }

  public getLanguage(): string {
    return this.currentLanguage;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('roadrisk_voice_volume', String(this.volume));
    } catch {}
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * Resolves the best available TTS voice in the browser for a given BCP-47 language tag
   */
  public getBestVoiceForLanguage(lang: string): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const targetPrefix = lang.toLowerCase().split('-')[0];

    // 1. Exact match (e.g. te-IN, hi-IN, ta-IN, kn-IN, en-US)
    const exact = voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase());
    if (exact) return exact;

    // 2. Prefix match (e.g. 'te' matching 'te_IN' or 'te-IN')
    const prefixMatch = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith(targetPrefix) ||
        v.lang.toLowerCase().replace('_', '-').startsWith(targetPrefix)
    );
    if (prefixMatch) return prefixMatch;

    // 3. Natural / high quality fallback for English
    if (targetPrefix === 'en') {
      const preferredEn = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Samantha') ||
            v.name.includes('Daniel') ||
            v.name.includes('Karen'))
      );
      if (preferredEn) return preferredEn;
    }

    return null;
  }

  /**
   * Checks if native browser voice exists for target language code
   */
  public hasVoiceForLanguage(lang: string): boolean {
    return this.getBestVoiceForLanguage(lang) !== null;
  }

  public speak(text: string, options: boolean | SpeakOptions = false) {
    if (this.isMuted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const opts: SpeakOptions = typeof options === 'boolean' ? { force: options } : options;
    const priority = opts.priority ?? 5;
    const force = opts.force ?? (priority <= 1); // P0 (Emergency) and P1 (Critical Hazard) auto-force
    const lang = opts.lang || this.currentLanguage || 'en-US';

    const now = Date.now();
    if (!force && text === this.lastSpokenText && now - this.lastSpokenTime < this.minCooldownMs) {
      return;
    }

    const isBusy = window.speechSynthesis.speaking || window.speechSynthesis.pending;
    let shouldCancel = false;

    // Priority preemption: High priority interrupts low priority
    if (priority < this.currentPriority || force) {
      shouldCancel = isBusy;
    } else if (isBusy && priority >= this.currentPriority) {
      // Don't interrupt higher priority speech with lower priority speech
      return;
    }

    this.lastSpokenText = text;
    this.lastSpokenTime = now;
    this.currentPriority = priority;

    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }

    const dispatch = () => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        this.activeUtterance = utterance;

        utterance.rate = opts.rate ?? (lang.startsWith('en') ? 1.0 : 0.95);
        utterance.pitch = 1.0;
        utterance.volume = opts.volume ?? this.volume;
        utterance.lang = lang;

        const voice = this.getBestVoiceForLanguage(lang);
        if (voice) {
          utterance.voice = voice;
        }

        utterance.onend = () => {
          if (this.activeUtterance === utterance) {
            this.activeUtterance = null;
          }
          this.currentPriority = 5;
        };

        utterance.onerror = () => {
          if (this.activeUtterance === utterance) {
            this.activeUtterance = null;
          }
          this.currentPriority = 5;
        };

        window.speechSynthesis.speak(utterance);
      } catch {
        this.activeUtterance = null;
        this.currentPriority = 5;
      }
    };

    if (shouldCancel) {
      window.speechSynthesis.cancel();
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        dispatch();
      }, 50);
    } else {
      dispatch();
    }
  }

  public cancel() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.activeUtterance = null;
      this.currentPriority = 5;
    }
  }
}

export const speechService = new SpeechService();
export default speechService;
