# RoadRisk AI — Multilingual Turn-by-Turn Voice & Navigation Matrix
**Document ID:** RRAI-VOICE-2026-V1  
**Classification:** Core Voice Engineering Specification  
**Component:** `src/services/navigationVoiceService.ts`  

---

## 1. Executive Summary

RoadRisk AI features a zero-spam, context-aware, low-latency background navigation voice assistant supporting **5 languages** (English, Telugu, Hindi, Tamil, and Kannada). The service integrates dynamic female/male voice discovery, strict priority preemption, and structured localized maneuver templates, ensuring that the citizen driver receives clear, timely auditory guidance without cognitive overload.

---

## 2. Supported Languages & BCP-47 Code Matrix

| Language | Native Name | Code | Preferred Voices (India & Global) | TTS Fallback Locale | Speech Recognition Locale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **English** | English | `en` | Veena, Samantha, David, Rishi, Karen | `en-US` / `en-IN` | `en-IN` / `en-US` |
| **Telugu** | తెలుగు | `te` | Lekha, Soumya, te-IN-Standard-A | `te-IN` | `te-IN` |
| **Hindi** | हिंदी | `hi` | Geeta, Swara, Madhav, Hemant | `hi-IN` | `hi-IN` |
| **Tamil** | தமிழ் | `ta` | Valluvar, Pallavi, ta-IN-Standard-A | `ta-IN` | `ta-IN` |
| **Kannada** | ಕನ್ನಡ | `kn` | Sapna, kn-IN-Standard-A | `kn-IN` | `kn-IN` |

---

## 3. Maneuver Direction Matrix Across Languages

The engine maps 15 distinct maneuver directions into natural, idiomatic phrases for each language:

| Direction Key | English (`en`) | Telugu (`te`) | Hindi (`hi`) | Tamil (`ta`) | Kannada (`kn`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `straight` | continue straight | సూటిగా సాగండి | सीधे चलें | நேராக செல்லவும் | ನೇರವಾಗಿ ಮುಂದುವರಿಯಿರಿ |
| `left` | turn left | ఎడమ వైపు తిరగండి | बाएं मुड़ें | இடதுபுறம் திரும்பவும் | ಎಡಕ್ಕೆ ತಿರುಗಿ |
| `right` | turn right | కుడి వైపు తిరగండి | दाएं मुड़ें | வலதுபுறம் திரும்பவும் | ಬಲಕ್ಕೆ ತಿರುಗಿ |
| `slight-left` | take a slight left | స్వల్పంగా ఎడమ వైపు | हल्का बाएं मुड़ें | லேசான இடதுபுறம் | ಸ್ವಲ್ಪ ಎಡಕ್ಕೆ ಚಲಿಸಿ |
| `slight-right` | take a slight right | స్వల్పంగా కుడి వైపు | हल्का दाएं मुड़ें | லேசான வலதுபுறம் | ಸ್ವಲ್ಪ ಬಲಕ್ಕೆ ಚಲಿಸಿ |
| `sharp-left` | make a sharp left | తీవ్రమైన ఎడమ మలుపు | तेज़ बाएं मुड़ें | கூர்மையான இடதுபுறம் | ತೀಕ್ಷ್ಣ ಎಡಕ್ಕೆ ತಿರುಗಿ |
| `sharp-right` | make a sharp right | తీవ్రమైన కుడి మలుపు | तेज़ दाएं मुड़ें | கூர்மையான வலதுபுறம் | ತೀಕ್ಷ್ಣ ಬಲಕ್ಕೆ ತಿರುಗಿ |
| `uturn` | make a U-turn | యూ-టర్న్ తీసుకోండి | यू-टर्न लें | யூ-டர்ன் எடுக்கவும் | ಯು-ಟರ್ನ್ ತೆಗೆದುಕೊಳ್ಳಿ |
| `keep-left` | keep left | ఎడమ వైపునే ఉండండి | बाईं ओर रहें | இடதுபுறமாகவே செல்லவும் | ಎಡಭಾಗದಲ್ಲೇ ಇರಿ |
| `keep-right` | keep right | కుడి వైపునే ఉండండి | दाईं ओर रहें | வலதுபுறமாகவே செல்லவும் | ಬಲಭಾಗದಲ್ಲೇ ಇರಿ |
| `merge` | merge with traffic | ట్రాఫిక్‌లో కలవండి | ट्रैफिक में शामिल हों | சாலையில் இணையவும் | ಸಂಚಾರದಲ್ಲಿ ವಿಲೀನಗೊಳ್ಳಿ |
| `roundabout` | enter the roundabout | రౌండ్‌ఎబౌట్ లోకి ప్రవేశించండి| गोलचक्कर में प्रवेश करें | சுற்றுவட்டத்தில் நுழையவும் | ವೃತ್ತ ಪ್ರವೇಶಿಸಿ |
| `exit` | take the exit | ఎగ్జిట్ తీసుకోండి | निकास लें | வெளியேறும் வழி | ನಿರ್ಗಮನ ರಸ್ತೆ |
| `highway-entry`| enter the highway | హైవే పైకి ఎక్కండి | राजमार्ग पर प्रवेश करें | நெடுஞ்சாலையில் நுழையவும் | ಹೆದ್ದಾರಿಗೆ ಪ್ರವೇಶಿಸಿ |
| `highway-exit` | take the highway exit | హైవే నుండి దిగండి | राजमार्ग से बाहर निकलें | நெடுஞ்சாலையிலிருந்து வெளியேறவும்| ಹೆದ್ದಾರಿಯಿಂದ ನಿರ್ಗಮಿಸಿ |

---

## 4. Distance Gating & Lifecycle Audio Thresholds

To eliminate dead zones where instructions were historically dropped, `navigationVoiceService.ts` enforces four contiguous distance stages per maneuver:

```
[Distance to Maneuver]
  > 350 meters:     STAGE "DISTANT"     -> "In [dist], turn [dir] onto [road]" (Announced once)
  85m - 350m:       STAGE "APPROACHING" -> "In [dist], turn [dir] onto [road]"
  25m - 85m:        STAGE "NEAR"        -> "Turn [dir] ahead onto [road]"
  0m - 25m:         STAGE "NOW"         -> "Turn [dir] now onto [road]"
```

Each stage generates a deduplicated announcement key (`maneuver_${stage}_${maneuverId}`), preventing repeated spam while ensuring drivers receive timely preparation warnings.

---

## 5. Directions Button → Voice Immediate Trigger (Zero-Tolerance Fix)

### The Problem
Previously, selecting a destination and clicking Directions/Start Navigation triggered route selection, but the first voice maneuver was silently omitted if the initial distance exceeded 350 meters, creating a perceived audio failure.

### The Solution
`AppContext.tsx` now passes the resolved route and its initial maneuver into `navigationVoiceService.startNavigation(targetRoute.name, firstManeuver)`. 

When navigation begins:
1. `navigationVoiceService` immediately synthesizes `phrases.startRoute(destination, firstInstruction)`.
2. Example (English): *"Starting navigation to Amaravati Secretariat. Head north along Bandar Road for 1.2 kilometers."*
3. Example (Telugu): *"అమరావతి సెక్రటేరియట్ కు నావిగేషన్ ప్రారంభమవుతోంది. బందర్ రోడ్ పై ముందుకు సాగండి."*
4. Example (Hindi): *"अमरावती सचिवालय के लिए नेविगेशन शुरू हो रहा है. बंदर रोड पर आगे बढ़ें."*
5. Utterance creation, locale binding, and speech synthesis start synchronously with <15ms latency.
6. When the user stops navigation or reaches their destination, `window.speechSynthesis.cancel()` is synchronously invoked to prevent lingering speech queues.

---

## 6. Voice Priority Preemption Hierarchy

| Priority Level | Category | Interruption Rule | Cooldown Window |
| :--- | :--- | :--- | :--- |
| **P0** | Emergency Vehicle Approaching | Preempts all lower priority speech instantly | 8 seconds |
| **P1** | Critical Safety Hazard / Flood Inundation | Preempts maneuvers, reroutes, traffic | 8 seconds |
| **P2** | Road Closure Detour | Preempts normal turn maneuvers | 25 seconds |
| **P3** | Off-Route / Reroute Recalculation | Preempts regular informational prompts | 25 seconds |
| **P4** | Turn-by-Turn Maneuver Guidance | Preempts traffic and weather announcements | 0 seconds (Distance-driven) |
| **P5** | Traffic Congestion Delay (>4 min) | Only speaks during straight cruising segments | 60 seconds |
| **P6** | Weather Advisory (Heavy Rain/Fog) | Informational only | 120 seconds |
| **P7** | General Status Info | Lowest priority | 120 seconds |

---

## 7. Verification Results
- **Unit Architecture Suite 6:** 5/5 Language coverage tests passed cleanly (100%).
- **Headed Chrome Golden Regression Test 10/12:** Voice Intent parsing verified (`SWITCH_MODE`, `FIND_POI`).
- **Headed Chrome Golden Regression Test 11/12:** Start Navigation & Live Guidance speech synthesis verified.
- **Headed Chrome Golden Regression Test 12/12:** Navigation stop & synchronous speech cancellation verified.
