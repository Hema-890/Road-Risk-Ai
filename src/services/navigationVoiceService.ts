// ==============================================================================
// ROADRISK AI — AUTHORITATIVE MULTILINGUAL NAVIGATION VOICE SERVICE
// Context-aware, low-spam, respectful, multilingual navigation audio assistant.
// Features:
// - Pinned SpeechSynthesisUtterance references (fixes Chromium V8 GC drop bug)
// - Chromium cancel() -> speak() race condition mitigation
// - Dynamic async voice detection & fallback for all 5 languages (EN, TE, HI, TA, KN)
// - Full BCP-47 & 2-letter locale normalization
// - High-visibility development diagnostics & telemetry
// - Deduplication and priority preemption engine
// ==============================================================================

import { eventBus } from './eventBus.ts';

export type VoiceLanguage = 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'en-US' | 'te-IN' | 'hi-IN' | 'ta-IN' | 'kn-IN';
export type NormalizedVoiceLanguage = 'en' | 'te' | 'hi' | 'ta' | 'kn';
export type VoiceGender = 'female' | 'male';

export const VoicePriority = {
  P0_EMERGENCY: 0,
  P1_SAFETY_HAZARD: 1,
  P2_ROAD_CLOSURE: 2,
  P3_REROUTE: 3,
  P4_MANEUVER: 4,
  P5_TRAFFIC: 5,
  P6_WEATHER: 6,
  P7_INFO: 7,
} as const;

export type VoicePriority = typeof VoicePriority[keyof typeof VoicePriority];

export type VoiceNavigationState = 'IDLE' | 'NAVIGATION_ACTIVE' | 'MONITORING' | 'SPEAKING';

export interface VoiceDiagnostics {
  status: 'READY' | 'SPEAKING' | 'BLOCKED' | 'ERROR' | 'NO_VOICE_AVAILABLE' | 'STOPPED';
  locale: string;
  language: NormalizedVoiceLanguage;
  selectedVoice: string;
  voiceCount: number;
  speechQueueLength: number;
  isSpeaking: boolean;
  isPending: boolean;
  isPaused: boolean;
  volume: number;
  lastError: string | null;
  lastSpokenText: string | null;
  lastSpokenTime: number;
}

export type ManeuverDirection =
  | 'straight'
  | 'left'
  | 'right'
  | 'slight-left'
  | 'slight-right'
  | 'sharp-left'
  | 'sharp-right'
  | 'uturn'
  | 'keep-left'
  | 'keep-right'
  | 'merge'
  | 'roundabout'
  | 'exit'
  | 'highway-entry'
  | 'highway-exit';

export const DIRECTION_LABELS: Record<NormalizedVoiceLanguage, Record<ManeuverDirection, string>> = {
  en: {
    'straight': 'straight',
    'left': 'left',
    'right': 'right',
    'slight-left': 'slight left',
    'slight-right': 'slight right',
    'sharp-left': 'sharp left',
    'sharp-right': 'sharp right',
    'uturn': 'U-turn',
    'keep-left': 'keep left',
    'keep-right': 'keep right',
    'merge': 'merge',
    'roundabout': 'enter the roundabout',
    'exit': 'take the exit',
    'highway-entry': 'enter the highway',
    'highway-exit': 'take the highway exit',
  },
  te: {
    'straight': 'సూటిగా',
    'left': 'ఎడమ వైపు',
    'right': 'కుడి వైపు',
    'slight-left': 'స్వల్పంగా ఎడమ వైపు',
    'slight-right': 'స్వల్పంగా కుడి వైపు',
    'sharp-left': 'తీవ్రమైన ఎడమ మలుపు',
    'sharp-right': 'తీవ్రమైన కుడి మలుపు',
    'uturn': 'యూ-టర్న్',
    'keep-left': 'ఎడమ వైపునే',
    'keep-right': 'కుడి వైపునే',
    'merge': 'ట్రాఫిక్‌లో కలవండి',
    'roundabout': 'రౌండ్‌ఎబౌట్ లోకి',
    'exit': 'ఎగ్జిట్',
    'highway-entry': 'హైవే పైకి',
    'highway-exit': 'హైవే నుండి',
  },
  hi: {
    'straight': 'सीधे',
    'left': 'बाएं',
    'right': 'दाएं',
    'slight-left': 'हल्का बाएं',
    'slight-right': 'हल्का दाएं',
    'sharp-left': 'तेज़ बाएं',
    'sharp-right': 'तेज़ दाएं',
    'uturn': 'यू-टर्न',
    'keep-left': 'बाईं ओर',
    'keep-right': 'दाईं ओर',
    'merge': 'ट्रैफिक में शामिल हों',
    'roundabout': 'गोलचक्कर में',
    'exit': 'निकास',
    'highway-entry': 'राजमार्ग पर',
    'highway-exit': 'राजमार्ग से बाहर',
  },
  ta: {
    'straight': 'நேராக',
    'left': 'இடதுபுறம்',
    'right': 'வலதுபுறம்',
    'slight-left': 'லேசான இடதுபுறம்',
    'slight-right': 'லேசான வலதுபுறம்',
    'sharp-left': 'கூர்மையான இடதுபுறம்',
    'sharp-right': 'கூர்மையான வலதுபுறம்',
    'uturn': 'யூ-டர்ன்',
    'keep-left': 'இடதுபுறமாகவே',
    'keep-right': 'வலதுபுறமாகவே',
    'merge': 'சாலையில் இணையவும்',
    'roundabout': 'சுற்றுவட்டத்தில்',
    'exit': 'வெளியேறும் வழி',
    'highway-entry': 'நெடுஞ்சாலையில்',
    'highway-exit': 'நெடுஞ்சாலையிலிருந்து',
  },
  kn: {
    'straight': 'ನೇರವಾಗಿ',
    'left': 'ಎಡಕ್ಕೆ',
    'right': 'ಬಲಕ್ಕೆ',
    'slight-left': 'ಸ್ವಲ್ಪ ಎಡಕ್ಕೆ',
    'slight-right': 'ಸ್ವಲ್ಪ ಬಲಕ್ಕೆ',
    'sharp-left': 'ತೀಕ್ಷ್ಣ ಎಡಕ್ಕೆ',
    'sharp-right': 'ತೀಕ್ಷ್ಣ ಬಲಕ್ಕೆ',
    'uturn': 'ಯು-ಟರ್ನ್',
    'keep-left': 'ಎಡಭಾಗದಲ್ಲೇ',
    'keep-right': 'ಬಲಭಾಗದಲ್ಲೇ',
    'merge': 'ಸಂಚಾರದಲ್ಲಿ ವಿಲೀನಗೊಳ್ಳಿ',
    'roundabout': 'ವೃತ್ತ ಪ್ರವೇಶಿಸಿ',
    'exit': 'ನಿರ್ಗಮನ',
    'highway-entry': 'ಹೆದ್ದಾರಿಗೆ',
    'highway-exit': 'ಹೆದ್ದಾರಿಯಿಂದ',
  },
};

export interface VoicePhrases {
  startRoute: (dest: string, firstInst?: string) => string;
  maneuverApproaching: (dist: string, dir: ManeuverDirection | string, road: string) => string;
  maneuverNear: (dir: ManeuverDirection | string, road: string) => string;
  maneuverNow: (dir: ManeuverDirection | string, road: string) => string;
  continueStraight: (dist: string) => string;
  destinationAhead: (dist: string) => string;
  arrived: () => string;
  emergencyApproaching: () => string;
  hazardAhead: (desc?: string) => string;
  roadClosureRerouting: () => string;
  offRouteRecalculating: () => string;
  rerouteConfirmed: () => string;
  heavyTraffic: (min: number) => string;
  floodingAhead: () => string;
  takeTransit: (mode: string, route: string) => string;
  walkToStop: (dist: string, stop: string) => string;
  transitArriving: (route: string, min: number) => string;
  transitTransfer: (route: string, station: string) => string;
  tightTransfer: (min: number) => string;
  tripBudgetStatus: (cost: number, budget: number) => string;
  nextDeliveryStop: (customer: string) => string;
  deliveryArrived: () => string;
}

const PHRASES: Record<NormalizedVoiceLanguage, VoicePhrases> = {
  en: {
    startRoute: (dest, firstInst) => `Starting navigation to ${dest}. ${firstInst ? firstInst + '.' : 'Head toward route.'}`,
    maneuverApproaching: (dist, dir, road) => `In ${dist}, ${dir.includes('straight') ? 'continue straight' : dir.includes('turn') ? dir : 'turn ' + dir}${road ? ' onto ' + road : ''}.`,
    maneuverNear: (dir, road) => `${dir.includes('straight') ? 'Continue straight' : dir.includes('turn') ? dir : 'Turn ' + dir} ahead${road ? ' onto ' + road : ''}.`,
    maneuverNow: (dir, road) => `${dir.includes('straight') ? 'Continue straight' : dir.includes('turn') ? dir : 'Turn ' + dir} now${road ? ' onto ' + road : ''}.`,
    continueStraight: (dist) => `Continue straight for ${dist}.`,
    destinationAhead: (dist) => `Your destination is ahead in ${dist}.`,
    arrived: () => 'You have arrived at your destination.',
    emergencyApproaching: () => 'Emergency vehicle approaching from behind. Please move left when safe.',
    hazardAhead: (desc) => desc ? `Please slow down. ${desc} ahead.` : 'Please slow down. A road hazard is ahead.',
    roadClosureRerouting: () => 'Road closure ahead on your route. Recalculating safest detour.',
    offRouteRecalculating: () => "You're off route. Recalculating path.",
    rerouteConfirmed: () => 'New route confirmed. Continue ahead.',
    heavyTraffic: (min) => `Heavy traffic ahead. Expect approximately ${min} minutes delay.`,
    floodingAhead: () => 'Flooding reported ahead. Please exercise caution.',
    takeTransit: (mode, route) => `Take ${mode} ${route}.`,
    walkToStop: (dist, stop) => `Walk ${dist} to ${stop}.`,
    transitArriving: (route, min) => `Your ${route} arrives in ${min} minutes.`,
    transitTransfer: (route, station) => `Transfer to ${route} at ${station}.`,
    tightTransfer: (min) => `Caution: tight transfer window of ${min} minutes.`,
    tripBudgetStatus: (cost, budget) => `Estimated cost is ${cost} rupees, within your ${budget} rupees budget.`,
    nextDeliveryStop: (customer) => `Proceed to next delivery stop: ${customer}.`,
    deliveryArrived: () => 'Arrived at delivery destination.',
  },
  te: {
    startRoute: (dest, firstInst) => `${dest} కు నావిగేషన్ ప్రారంభమవుతోంది. ${firstInst ? firstInst + '.' : 'ముందుకు సాగండి.'}`,
    maneuverApproaching: (dist, dir, road) => `${dist} లో, ${road ? road + ' పైకి ' : ''}${dir} తిరగండి.`,
    maneuverNear: (dir, road) => `ముందు ${road ? road + ' పైకి ' : ''}${dir} తిరగండి.`,
    maneuverNow: (dir, road) => `ఇప్పుడు ${road ? road + ' పైకి ' : ''}${dir} తిరగండి.`,
    continueStraight: (dist) => `${dist} పాటు సూటిగా సాగండి.`,
    destinationAhead: (dist) => `మీ గమ్యస్థానం ${dist} లో ముందు ఉంది.`,
    arrived: () => 'మీరు మీ గమ్యస్థానానికి చేరుకున్నారు.',
    emergencyApproaching: () => 'అత్యవసర వాహనం వెనుక నుండి వస్తోంది. దయచేసి సురక్షితంగా ఎడమ వైపుకు మారండి.',
    hazardAhead: (desc) => desc ? `దయచేసి వేగాన్ని తగ్గించండి. ${desc} ముందు ఉంది.` : 'దయచేసి వేగాన్ని తగ్గించండి. ముందు రహదారిపై ప్రమాదం ఉంది.',
    roadClosureRerouting: () => 'ముందు రోడ్డు మూసివేయబడింది. సురక్షితమైన ప్రత్యామ్నాయ మార్గాన్ని లెక్కిస్తున్నాము.',
    offRouteRecalculating: () => 'మీరు మార్గం మారారు. కొత్త మార్గాన్ని లెక్కిస్తున్నాము.',
    rerouteConfirmed: () => 'కొత్త మార్గం ఖరారైంది. ముందుకు సాగండి.',
    heavyTraffic: (min) => `ముందు భారీ ట్రాఫిక్ ఉంది. సుమారు ${min} నిమిషాల ఆలస్యం కావచ్చు.`,
    floodingAhead: () => 'ముందు నీటి నిల్వ నివేదించబడింది. జాగ్రత్తగా నడపండి.',
    takeTransit: (mode, route) => `${route} ${mode} ఎక్కండి.`,
    walkToStop: (dist, stop) => `${stop} కు ${dist} నడవండి.`,
    transitArriving: (route, min) => `మీ ${route} ${min} నిమిషాల్లో వస్తుంది.`,
    transitTransfer: (route, station) => `${station} వద్ద ${route} కు మారండి.`,
    tightTransfer: (min) => `జాగ్రత్త: బదిలీకి కేవలం ${min} నిమిషాల సమయం మాత్రమే ఉంది.`,
    tripBudgetStatus: (cost, budget) => `అంచనా వ్యయం ${cost} రూపాయలు, మీ బడ్జెట్ పరిధిలోనే ఉంది.`,
    nextDeliveryStop: (customer) => `తదుపరి డెలివరీ స్టాప్: ${customer} కు వెళ్లండి.`,
    deliveryArrived: () => 'డెలివరీ గమ్యస్థానానికి చేరుకున్నారు.',
  },
  hi: {
    startRoute: (dest, firstInst) => `${dest} के लिए नेविगेशन शुरू हो रहा है. ${firstInst ? firstInst + '.' : 'आगे बढ़ें.'}`,
    maneuverApproaching: (dist, dir, road) => `${dist} में, ${road ? road + ' पर ' : ''}${dir} मुड़ें.`,
    maneuverNear: (dir, road) => `आगे ${road ? road + ' पर ' : ''}${dir} मुड़ें.`,
    maneuverNow: (dir, road) => `अब ${road ? road + ' पर ' : ''}${dir} मुड़ें.`,
    continueStraight: (dist) => `${dist} तक सीधे चलें.`,
    destinationAhead: (dist) => `आपकी मंजिल ${dist} आगे है.`,
    arrived: () => 'आप अपनी मंजिल पर पहुंच गए हैं.',
    emergencyApproaching: () => 'पीछे से आपातकालीन वाहन आ रहा है. कृपया सुरक्षित रूप से बाईं ओर हो जाएं.',
    hazardAhead: (desc) => desc ? `कृपया गति धीमी करें. ${desc} आगे है.` : 'कृपया गति धीमी करें. आगे सड़क पर खतरा है.',
    roadClosureRerouting: () => 'आगे सड़क बंद है. नया सुरक्षित मार्ग ढूंढा जा रहा है.',
    offRouteRecalculating: () => 'आप मार्ग से हट गए हैं. मार्ग की पुनर्गणना हो रही है.',
    rerouteConfirmed: () => 'नया मार्ग तैयार है. आगे बढ़ें.',
    heavyTraffic: (min) => `आगे भारी ट्रैफिक है. लगभग ${min} मिनट की देरी हो सकती है.`,
    floodingAhead: () => 'आगे जलभराव की सूचना है. कृपया सावधानी से चलें.',
    takeTransit: (mode, route) => `${route} ${mode} लें.`,
    walkToStop: (dist, stop) => `${stop} तक ${dist} पैदल चलें.`,
    transitArriving: (route, min) => `आपकी ${route} ${min} मिनट में आ रही है.`,
    transitTransfer: (route, station) => `${station} पर ${route} के लिए बदलें.`,
    tightTransfer: (min) => `चेतावनी: ट्रांसफर के लिए केवल ${min} मिनट हैं.`,
    tripBudgetStatus: (cost, budget) => `अनुमानित लागत ${cost} रुपये है, आपके बजट के भीतर.`,
    nextDeliveryStop: (customer) => `अगले डिलीवरी स्टॉप पर आगे बढ़ें: ${customer}.`,
    deliveryArrived: () => 'डिलीवरी स्थान पर पहुंच गए हैं.',
  },
  ta: {
    startRoute: (dest, firstInst) => `${dest} க்கான வழிசெலுத்தல் தொடங்குகிறது. ${firstInst ? firstInst + '.' : 'முன்னேறவும்.'}`,
    maneuverApproaching: (dist, dir, road) => `${dist} இல், ${road ? road + ' இல் ' : ''}${dir} திரும்பவும்.`,
    maneuverNear: (dir, road) => `முன்னால் ${road ? road + ' இல் ' : ''}${dir} திரும்பவும்.`,
    maneuverNow: (dir, road) => `இப்போது ${road ? road + ' இல் ' : ''}${dir} திரும்பவும்.`,
    continueStraight: (dist) => `${dist} நேராக தொடரவும்.`,
    destinationAhead: (dist) => `உங்கள் இலக்கு ${dist} தொலைவில் உள்ளது.`,
    arrived: () => 'உங்கள் இலக்கை அடைந்துவிட்டீர்கள்.',
    emergencyApproaching: () => 'அவசர சிகிச்சை வாகனம் பின்னால் இருந்து வருகிறது. பாதுகாப்பாக இடதுபுறம் செல்லவும்.',
    hazardAhead: (desc) => desc ? `தயவுசெய்து வேகத்தை குறைக்கவும். முன்னால் ${desc} உள்ளது.` : 'தயவுசெய்து வேகத்தை குறைக்கவும். முன்னால் சாலை ஆபத்து உள்ளது.',
    roadClosureRerouting: () => 'முன்னால் சாலை மூடப்பட்டுள்ளது. புதிய பாதை கணக்கிடப்படுகிறது.',
    offRouteRecalculating: () => 'பாதையை விட்டு விலகிவிட்டீர்கள். மீண்டும் கணக்கிடப்படுகிறது.',
    rerouteConfirmed: () => 'புதிய பாதை உறுதிசெய்யப்பட்டது. தொடரவும்.',
    heavyTraffic: (min) => `முன்னால் போக்குவரத்து நெரிசல். ${min} நிமிடங்கள் தாமதம் ஏற்படலாம்.`,
    floodingAhead: () => 'முன்னால் வெள்ளப்பெருக்கு எச்சரிக்கை. கவனமாக செல்லவும்.',
    takeTransit: (mode, route) => `${route} ${mode} செல்லவும்.`,
    walkToStop: (dist, stop) => `${stop} க்கு ${dist} நடக்கவும்.`,
    transitArriving: (route, min) => `${route} ${min} நிமிடங்களில் வரும்.`,
    transitTransfer: (route, station) => `${station} இல் ${route} க்கு மாறவும்.`,
    tightTransfer: (min) => `எச்சரிக்கை: மாற்று நேரம் ${min} நிமிடங்கள் மட்டுமே.`,
    tripBudgetStatus: (cost, budget) => `மதிப்பிடப்பட்ட செலவு ${cost} ரூபாய்.`,
    nextDeliveryStop: (customer) => `அடுத்த டெலிவரி: ${customer}.`,
    deliveryArrived: () => 'டெலிவரி இடத்தை அடைந்துவிட்டீர்கள்.',
  },
  kn: {
    startRoute: (dest, firstInst) => `${dest} ಗೆ ಮಾರ್ಗದರ್ಶನ ಪ್ರಾರಂಭವಾಗಿದೆ. ${firstInst ? firstInst + '.' : 'ಮುಂದುವರಿಯಿರಿ.'}`,
    maneuverApproaching: (dist, dir, road) => `${dist} ನಲ್ಲಿ, ${road ? road + ' ಕಡೆ ' : ''}${dir} ತಿರುಗಿ.`,
    maneuverNear: (dir, road) => `ಮುಂದೆ ${road ? road + ' ಕಡೆ ' : ''}${dir} ತಿರುಗಿ.`,
    maneuverNow: (dir, road) => `ಈಗ ${road ? road + ' ಕಡೆ ' : ''}${dir} ತಿರುಗಿ.`,
    continueStraight: (dist) => `${dist} ನೇರವಾಗಿ ಮುಂದುವರಿಯಿರಿ.`,
    destinationAhead: (dist) => `ನಿಮ್ಮ ಗಮ್ಯಸ್ಥಾನ ${dist} ಮುಂದೆ ಇದೆ.`,
    arrived: () => 'ನೀವು ನಿಮ್ಮ ಗಮ್ಯಸ್ಥಾನವನ್ನು ತಲುಪಿದ್ದೀರಿ.',
    emergencyApproaching: () => 'ತುರ್ತು ವಾಹನ ಹಿಂಬದಿಯಿಂದ ಬರುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಸುರಕ್ಷಿತವಾಗಿ ಎಡಕ್ಕೆ ಚಲಿಸಿ.',
    hazardAhead: (desc) => desc ? `ದಯವಿಟ್ಟು ವೇಗ ಕಡಿಮೆ ಮಾಡಿ. ಮುಂದೆ ${desc} ಇದೆ.` : 'ದಯವಿಟ್ಟು ವೇಗ ಕಡಿಮೆ ಮಾಡಿ. ಮುಂದೆ ರಸ್ತೆ ಅಪಾಯವಿದೆ.',
    roadClosureRerouting: () => 'ಮುಂದೆ ರಸ್ತೆ ಮುಚ್ಚಲಾಗಿದೆ. ಪರ್ಯಾಯ ಮಾರ್ಗ ಲೆಕ್ಕಾಚಾರ ಮಾಡಲಾಗುತ್ತಿದೆ.',
    offRouteRecalculating: () => 'ನೀವು ಮಾರ್ಗ ಬದಲಿಸಿದ್ದೀರಿ. ಹೊಸ ಮಾರ್ಗ ಹುಡುಕಲಾಗುತ್ತಿದೆ.',
    rerouteConfirmed: () => 'ಹೊಸ ಮಾರ್ಗ ಸಿದ್ಧವಾಗಿದೆ. ಮುಂದುವರಿಯಿರಿ.',
    heavyTraffic: (min) => `ಮುಂದೆ ಭಾರಿ ಟ್ರಾಫಿಕ್ ಇದೆ. ಸುಮಾರು ${min} ನಿಮಿಷ ವಿಳಂಬವಾಗಬಹುದು.`,
    floodingAhead: () => 'ಮುಂದೆ ನೀರು ನಿಂತಿದೆ. ಎಚ್ಚರಿಕೆಯಿಂದ ಚಲಿಸಿ.',
    takeTransit: (mode, route) => `${route} ${mode} ಹತ್ತಿ.`,
    walkToStop: (dist, stop) => `${stop} ಗೆ ${dist} ನಡೆಯಿರಿ.`,
    transitArriving: (route, min) => `${route} ${min} ನಿಮಿಷದಲ್ಲಿ ತಲುಪಲಿದೆ.`,
    transitTransfer: (route, station) => `${station} ನಲ್ಲಿ ${route} ಗೆ ಬದಲಾಯಿಸಿ.`,
    tightTransfer: (min) => `ಎಚ್ಚರಿಕೆ: ಬದಲಾವಣೆಗೆ ಕೇವಲ ${min} ನಿಮಿಷ ಮಾತ್ರ ಇದೆ.`,
    tripBudgetStatus: (cost, budget) => `ಅಂದಾಜು ವೆಚ್ಚ ${cost} ರೂಪಾಯಿಗಳು.`,
    nextDeliveryStop: (customer) => `ಮುಂದಿನ ಡೆಲಿವರಿ ನಿಲ್ದಾಣ: ${customer}.`,
    deliveryArrived: () => 'ಡೆಲಿವರಿ ಸ್ಥಳ ತಲುಪಿದ್ದೀರಿ.',
  },
};

const BCP47_LOOKUP: Record<NormalizedVoiceLanguage, string> = {
  en: 'en-US',
  te: 'te-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
};

export class NavigationVoiceService {
  private state: VoiceNavigationState = 'IDLE';
  private voiceEnabled: boolean = true;
  private language: NormalizedVoiceLanguage = 'en';
  private gender: VoiceGender = 'female';
  private volume: number = 0.95;
  private currentPriority: VoicePriority = VoicePriority.P7_INFO;

  // Active utterance pinned reference to prevent V8 Garbage Collector cutting off audio
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private activeSessionId: number = 0;
  private pendingSpeakTimer: any = null;

  // Maneuver deduplication state
  private lastManeuverId: string = '';
  private lastManeuverStage: 'none' | 'distant' | 'approaching' | 'near' | 'now' = 'none';

  // Event cooldown tracking
  private eventCooldowns: Map<string, number> = new Map();

  // Dynamic voices registry
  private availableVoices: SpeechSynthesisVoice[] = [];
  private diagnosticListeners: Set<(diag: VoiceDiagnostics) => void> = new Set();
  private lastError: string | null = null;
  private lastSpokenText: string | null = null;
  private lastSpokenTime: number = 0;

  constructor() {
    this.loadSettings();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.initVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.initVoices();
        this.notifyDiagnostics();
      };
    }
    this.bindEventBus();
  }

  private normalizeLang(input: VoiceLanguage | string): NormalizedVoiceLanguage {
    const clean = (input || '').toLowerCase().trim();
    if (clean.startsWith('te')) return 'te';
    if (clean.startsWith('hi')) return 'hi';
    if (clean.startsWith('ta')) return 'ta';
    if (clean.startsWith('kn')) return 'kn';
    return 'en';
  }

  private loadSettings() {
    if (typeof window === 'undefined' || !('localStorage' in window)) return;
    try {
      const en = localStorage.getItem('roadrisk_nav_voice_enabled');
      if (en !== null) this.voiceEnabled = en === 'true';

      const storedLang = localStorage.getItem('roadrisk_nav_voice_language');
      if (storedLang) this.language = this.normalizeLang(storedLang);

      const gen = localStorage.getItem('roadrisk_nav_voice_gender') as VoiceGender;
      if (gen === 'male' || gen === 'female') this.gender = gen;

      const vol = localStorage.getItem('roadrisk_nav_voice_volume');
      if (vol !== null) this.volume = Math.max(0, Math.min(1, parseFloat(vol)));
    } catch {}
  }

  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      this.availableVoices = voices;
      console.log(`[VOICE] initVoices: Loaded ${voices.length} voices from browser speech engine.`);
    }
  }

  public subscribeDiagnostics(listener: (diag: VoiceDiagnostics) => void): () => void {
    this.diagnosticListeners.add(listener);
    listener(this.getDiagnostics());
    return () => {
      this.diagnosticListeners.delete(listener);
    };
  }

  private notifyDiagnostics() {
    const diag = this.getDiagnostics();
    this.diagnosticListeners.forEach((fn) => {
      try {
        fn(diag);
      } catch {}
    });
  }

  public getDiagnostics(): VoiceDiagnostics {
    const hasApi = typeof window !== 'undefined' && 'speechSynthesis' in window;
    const speaking = hasApi ? window.speechSynthesis.speaking : false;
    const pending = hasApi ? window.speechSynthesis.pending : false;
    const paused = hasApi ? window.speechSynthesis.paused : false;
    const selected = this.getSelectedVoice();

    let status: VoiceDiagnostics['status'] = 'READY';
    if (!this.voiceEnabled) {
      status = 'STOPPED';
    } else if (!hasApi) {
      status = 'BLOCKED';
    } else if (this.lastError) {
      status = 'ERROR';
    } else if (speaking) {
      status = 'SPEAKING';
    } else if (!selected && this.availableVoices.length > 0 && this.language !== 'en') {
      status = 'NO_VOICE_AVAILABLE';
    }

    return {
      status,
      locale: BCP47_LOOKUP[this.language] || 'en-US',
      language: this.language,
      selectedVoice: selected ? `${selected.name} (${selected.lang})` : 'System Default',
      voiceCount: this.availableVoices.length,
      speechQueueLength: pending ? 1 : 0,
      isSpeaking: speaking,
      isPending: pending,
      isPaused: paused,
      volume: this.volume,
      lastError: this.lastError,
      lastSpokenText: this.lastSpokenText,
      lastSpokenTime: this.lastSpokenTime,
    };
  }

  public getAvailableVoicesForLanguage(lang: VoiceLanguage): { female: SpeechSynthesisVoice | null; male: SpeechSynthesisVoice | null } {
    const normLang = this.normalizeLang(lang);
    if (!this.availableVoices.length && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.availableVoices = window.speechSynthesis.getVoices();
    }

    const bcpMap: Record<NormalizedVoiceLanguage, string[]> = {
      en: ['en-IN', 'en-US', 'en-GB', 'en'],
      te: ['te-IN', 'te'],
      hi: ['hi-IN', 'hi'],
      ta: ['ta-IN', 'ta'],
      kn: ['kn-IN', 'kn'],
    };

    const targetLocales = bcpMap[normLang] || ['en-US'];
    const matching = this.availableVoices.filter((v) =>
      targetLocales.some((l) => v.lang.toLowerCase().replace('_', '-').startsWith(l.toLowerCase()))
    );

    // Explicit native voice name recognition for macOS / Chrome / Windows / Android
    const femaleKeywords = [
      'geeta', 'lekha', 'vani', 'soumya', 'sangeeta', 'veena', // Native Indian Chrome/Mac voices
      'female', 'zira', 'samantha', 'victoria', 'karen', 'natural'
    ];
    const maleKeywords = [
      'rishi', 'madhav', 'hemant', 'karthik', // Native Indian male voices
      'male', 'david', 'daniel', 'george'
    ];

    let female = matching.find((v) => femaleKeywords.some((k) => v.name.toLowerCase().includes(k))) || null;
    let male = matching.find((v) => maleKeywords.some((k) => v.name.toLowerCase().includes(k))) || null;

    // Fallbacks
    if (!female && matching.length > 0) female = matching[0];
    if (!male && matching.length > 1) male = matching[1];
    else if (!male && matching.length === 1) male = matching[0];

    return { female, male };
  }

  public getSelectedVoice(targetLang?: VoiceLanguage): SpeechSynthesisVoice | null {
    const lang = targetLang ? this.normalizeLang(targetLang) : this.language;
    const pair = this.getAvailableVoicesForLanguage(lang);
    return this.gender === 'female' ? pair.female || pair.male : pair.male || pair.female;
  }

  // Configuration API
  public setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
    try {
      localStorage.setItem('roadrisk_nav_voice_enabled', String(enabled));
    } catch {}
    if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.state = this.state === 'SPEAKING' ? 'MONITORING' : this.state;
    }
    this.notifyDiagnostics();
  }

  public isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  public setLanguage(lang: VoiceLanguage) {
    const norm = this.normalizeLang(lang);
    if (PHRASES[norm]) {
      this.language = norm;
      try {
        localStorage.setItem('roadrisk_nav_voice_language', norm);
      } catch {}
      console.log(`[VOICE] setLanguage: ${lang} -> normalized: ${norm} (${BCP47_LOOKUP[norm]})`);
      this.notifyDiagnostics();
    }
  }

  public getLanguage(): NormalizedVoiceLanguage {
    return this.language;
  }

  public setGender(gender: VoiceGender) {
    this.gender = gender;
    try {
      localStorage.setItem('roadrisk_nav_voice_gender', gender);
    } catch {}
    this.notifyDiagnostics();
  }

  public getGender(): VoiceGender {
    return this.gender;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('roadrisk_nav_voice_volume', String(this.volume));
    } catch {}
    this.notifyDiagnostics();
  }

  public getVolume(): number {
    return this.volume;
  }

  public getState(): VoiceNavigationState {
    return this.state;
  }

  // Navigation Lifecycle Triggers
  public startNavigation(destName?: string, firstManeuver?: { instruction?: string; distanceMeters?: number; type?: string; id?: string }) {
    this.state = 'NAVIGATION_ACTIVE';
    this.activeSessionId = Date.now();
    this.lastManeuverId = firstManeuver?.id || 'step_start';
    this.lastManeuverStage = 'none';
    this.eventCooldowns.clear();

    const phrases = PHRASES[this.language] || PHRASES.en;
    const dest = destName || 'destination';
    const firstInst = firstManeuver?.instruction;
    const initialText = phrases.startRoute(dest, firstInst);

    console.log(`[VOICE] startNavigation session=${this.activeSessionId} dest="${dest}" text="${initialText}"`);
    this.speak(initialText, VoicePriority.P4_MANEUVER, `nav_start_${this.activeSessionId}`, true);
  }

  public stopNavigation() {
    this.state = 'IDLE';
    this.activeSessionId = Date.now();
    this.lastManeuverId = '';
    this.lastManeuverStage = 'none';
    if (this.pendingSpeakTimer) {
      clearTimeout(this.pendingSpeakTimer);
      this.pendingSpeakTimer = null;
    }
    this.cancelSpeech();
    this.notifyDiagnostics();
  }

  // Authoritative Priority Speech Engine
  public speak(
    text: string,
    priority: VoicePriority = VoicePriority.P4_MANEUVER,
    eventId?: string,
    force: boolean = false,
    overrideLang?: VoiceLanguage
  ): boolean {
    if (!this.voiceEnabled) {
      console.log(`[VOICE] Speech skipped: voiceEnabled is false`);
      return false;
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn(`[VOICE] Speech unavailable: window.speechSynthesis not supported`);
      this.lastError = 'speechSynthesis not supported';
      this.notifyDiagnostics();
      return false;
    }

    const targetLang = overrideLang ? this.normalizeLang(overrideLang) : this.language;
    const locale = BCP47_LOOKUP[targetLang] || 'en-US';
    const now = Date.now();

    // Cooldown check
    if (eventId && !force) {
      const lastSpoken = this.eventCooldowns.get(eventId) || 0;
      const cooldownMs = priority <= VoicePriority.P1_SAFETY_HAZARD ? 8000 : 20000;
      if (now - lastSpoken < cooldownMs) {
        console.log(`[VOICE] Suppressed by event cooldown: ${eventId} (${now - lastSpoken}ms < ${cooldownMs}ms)`);
        return false;
      }
      this.eventCooldowns.set(eventId, now);
    }

    // Refresh voices if empty
    if (!this.availableVoices.length) {
      this.availableVoices = window.speechSynthesis.getVoices();
    }

    const voice = this.getSelectedVoice(targetLang);

    // Hard Diagnostic logging mandated by P0 spec
    console.log(`[VOICE] request`);
    console.log(`[VOICE] timestamp = ${new Date().toISOString()}`);
    console.log(`[VOICE] language = ${targetLang}`);
    console.log(`[VOICE] locale = ${locale}`);
    console.log(`[VOICE] instruction = "${text}"`);
    console.log(`[VOICE] voice requested = ${this.gender}`);
    console.log(`[VOICE] voice resolved = ${voice ? `${voice.name} (${voice.lang})` : 'none (fallback default)'}`);
    console.log(`[VOICE] speechSynthesis availability = true`);
    console.log(`[VOICE] voices.length = ${this.availableVoices.length}`);
    console.log(`[VOICE] speaking = ${window.speechSynthesis.speaking}`);
    console.log(`[VOICE] pending = ${window.speechSynthesis.pending}`);
    console.log(`[VOICE] paused = ${window.speechSynthesis.paused}`);

    // Preemption / Interruption logic
    const isSpeakingOrPending = window.speechSynthesis.speaking || window.speechSynthesis.pending;
    let shouldCancelPrior = false;

    if (isSpeakingOrPending) {
      if (force || priority < this.currentPriority) {
        shouldCancelPrior = true;
        console.log(`[VOICE] calling speechSynthesis.cancel() [priority preemption: ${priority} < ${this.currentPriority} or force=${force}]`);
      } else {
        console.log(`[VOICE] Speech skipped: busy with equal or higher priority speech (${this.currentPriority} <= ${priority})`);
        return false;
      }
    }

    this.currentPriority = priority;
    this.lastSpokenText = text;
    this.lastSpokenTime = now;
    this.lastError = null;

    if (this.pendingSpeakTimer) {
      clearTimeout(this.pendingSpeakTimer);
      this.pendingSpeakTimer = null;
    }

    const dispatchSpeak = () => {
      try {
        console.log(`[VOICE] creating utterance`);
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Pin reference to class instance to prevent Chromium V8 GC drop bug
        this.activeUtterance = utterance;

        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = locale;
        }

        utterance.volume = this.volume;
        utterance.rate = targetLang === 'en' ? 1.0 : 0.92; // Slightly deliberate pace for Indic languages
        utterance.pitch = 1.0;

        const sessionId = this.activeSessionId;

        utterance.onstart = () => {
          console.log(`[VOICE] utterance start: "${text.substring(0, 50)}..."`);
          this.state = 'SPEAKING';
          this.notifyDiagnostics();
        };

        utterance.onend = () => {
          console.log(`[VOICE] utterance end: "${text.substring(0, 50)}..."`);
          if (this.activeUtterance === utterance) {
            this.activeUtterance = null;
          }
          this.returnToMonitoring();
          this.notifyDiagnostics();
        };

        utterance.onerror = (e) => {
          console.error(`[VOICE] utterance error:`, e.error, e);
          this.lastError = `Utterance error: ${e.error || 'unknown'}`;
          if (this.activeUtterance === utterance) {
            this.activeUtterance = null;
          }
          this.returnToMonitoring();
          this.notifyDiagnostics();
        };

        console.log(`[VOICE] speak call`);
        window.speechSynthesis.speak(utterance);
        this.notifyDiagnostics();
        return true;
      } catch (err: any) {
        console.error(`[VOICE] Exception during speechSynthesis.speak:`, err);
        this.lastError = err?.message || 'Exception during speak';
        this.activeUtterance = null;
        this.returnToMonitoring();
        this.notifyDiagnostics();
        return false;
      }
    };

    if (shouldCancelPrior) {
      window.speechSynthesis.cancel();
      // Chromium race mitigation: allow 50ms for Blink's audio cancellation IPC before speaking
      this.pendingSpeakTimer = setTimeout(() => {
        this.pendingSpeakTimer = null;
        dispatchSpeak();
      }, 50);
      return true;
    } else {
      return dispatchSpeak();
    }
  }

  private returnToMonitoring() {
    this.currentPriority = VoicePriority.P7_INFO;
    const current: VoiceNavigationState = this.state;
    this.state = current === 'IDLE' ? 'IDLE' : 'MONITORING';
  }

  public cancelSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      console.log(`[VOICE] cancelSpeech called`);
      window.speechSynthesis.cancel();
      this.activeUtterance = null;
      this.returnToMonitoring();
      this.notifyDiagnostics();
    }
  }

  public normalizeDirection(dir?: string): string {
    const labels = DIRECTION_LABELS[this.language] || DIRECTION_LABELS.en;
    if (!dir) return labels.straight || 'straight';
    const clean = dir.toLowerCase().replace(/_/g, '-');

    if (clean.includes('sharp') && clean.includes('left')) return labels['sharp-left'];
    if (clean.includes('sharp') && clean.includes('right')) return labels['sharp-right'];
    if (clean.includes('slight') && clean.includes('left')) return labels['slight-left'];
    if (clean.includes('slight') && clean.includes('right')) return labels['slight-right'];
    if (clean.includes('uturn') || clean.includes('u-turn')) return labels['uturn'];
    if (clean.includes('keep') && clean.includes('left')) return labels['keep-left'];
    if (clean.includes('keep') && clean.includes('right')) return labels['keep-right'];
    if (clean.includes('roundabout')) return labels['roundabout'];
    if (clean.includes('merge')) return labels['merge'];
    if (clean.includes('exit')) return labels['exit'];
    if (clean.includes('highway') && clean.includes('entry')) return labels['highway-entry'];
    if (clean.includes('highway') && clean.includes('exit')) return labels['highway-exit'];
    if (clean.includes('left')) return labels['left'];
    if (clean.includes('right')) return labels['right'];
    return labels['straight'];
  }

  public getLocalizedPhrase(key: keyof VoicePhrases): any {
    const phrases = PHRASES[this.language] || PHRASES.en;
    return phrases[key];
  }

  // Real Maneuver Processor (Called by Navigation Engine as GPS advances)
  public handleManeuverUpdate(
    maneuverId: string,
    direction: ManeuverDirection | string,
    roadName: string,
    distanceMeters: number
  ) {
    if (this.state === 'IDLE') return;

    const phrases = PHRASES[this.language] || PHRASES.en;
    const cleanRoad = roadName ? roadName.split(',')[0].trim() : '';
    const dirText = this.normalizeDirection(direction);

    if (maneuverId !== this.lastManeuverId) {
      this.lastManeuverId = maneuverId;
      this.lastManeuverStage = 'none';
    }

    if (distanceMeters <= 25 && this.lastManeuverStage !== 'now') {
      this.lastManeuverStage = 'now';
      this.speak(phrases.maneuverNow(dirText, cleanRoad), VoicePriority.P4_MANEUVER, `maneuver_now_${maneuverId}`, true);
    } else if (distanceMeters <= 85 && distanceMeters > 25 && this.lastManeuverStage !== 'near') {
      this.lastManeuverStage = 'near';
      this.speak(phrases.maneuverNear(dirText, cleanRoad), VoicePriority.P4_MANEUVER, `maneuver_near_${maneuverId}`, true);
    } else if (distanceMeters <= 350 && distanceMeters > 85 && (this.lastManeuverStage === 'none' || this.lastManeuverStage === 'distant')) {
      this.lastManeuverStage = 'approaching';
      const distStr = distanceMeters > 1000 ? `${(distanceMeters / 1000).toFixed(1)} km` : `${Math.round(distanceMeters / 50) * 50} meters`;
      this.speak(phrases.maneuverApproaching(distStr, dirText, cleanRoad), VoicePriority.P4_MANEUVER, `maneuver_app_${maneuverId}`);
    } else if (distanceMeters > 350 && this.lastManeuverStage === 'none') {
      this.lastManeuverStage = 'distant';
      const distStr = distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)} km` : `${Math.round(distanceMeters / 100) * 100} meters`;
      this.speak(phrases.maneuverApproaching(distStr, dirText, cleanRoad), VoicePriority.P4_MANEUVER, `maneuver_dist_${maneuverId}`);
    }
  }

  // Priority Event Handlers
  public announceEmergencyVehicleApproaching(callsign?: string, distanceMeters?: number) {
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(
      phrases.emergencyApproaching(),
      VoicePriority.P0_EMERGENCY,
      'emergency_approaching',
      true
    );
  }

  public announceRoadClosureAhead() {
    if (this.state === 'IDLE') return;
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.roadClosureRerouting(), VoicePriority.P2_ROAD_CLOSURE, 'road_closure_ahead', true);
  }

  public announceOffRoute() {
    if (this.state === 'IDLE') return;
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.offRouteRecalculating(), VoicePriority.P3_REROUTE, 'off_route', true);
  }

  public announceRerouteConfirmed() {
    if (this.state === 'IDLE') return;
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.rerouteConfirmed(), VoicePriority.P3_REROUTE, 'reroute_confirmed', true);
  }

  public announceArrival() {
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.arrived(), VoicePriority.P4_MANEUVER, 'arrival', true);
  }

  public announceHazardAhead(description?: string) {
    if (this.state === 'IDLE') return;
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.hazardAhead(description), VoicePriority.P1_SAFETY_HAZARD, 'hazard_ahead', true);
  }

  public announceTrafficDelay(delayMinutes: number) {
    if (this.state === 'IDLE' || delayMinutes < 4) return;
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.heavyTraffic(Math.round(delayMinutes)), VoicePriority.P5_TRAFFIC, 'traffic_delay');
  }

  public announceTakeTransit(mode: string, route: string) {
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.takeTransit(mode, route), VoicePriority.P4_MANEUVER, 'take_transit', true);
  }

  public announceWalkToStop(dist: string, stop: string) {
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.walkToStop(dist, stop), VoicePriority.P4_MANEUVER, 'walk_to_stop');
  }

  public announceTransitArriving(route: string, min: number) {
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.transitArriving(route, min), VoicePriority.P4_MANEUVER, 'transit_arriving');
  }

  public announceTransitTransfer(route: string, station: string) {
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.transitTransfer(route, station), VoicePriority.P4_MANEUVER, 'transit_transfer', true);
  }

  public announceTightTransfer(min: number) {
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.tightTransfer(min), VoicePriority.P1_SAFETY_HAZARD, 'tight_transfer', true);
  }

  public announceTripBudgetStatus(cost: number, budget: number) {
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.tripBudgetStatus(cost, budget), VoicePriority.P7_INFO, 'budget_status');
  }

  public announceNextDeliveryStop(customer: string) {
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.nextDeliveryStop(customer), VoicePriority.P4_MANEUVER, 'next_delivery', true);
  }

  public announceDeliveryArrived() {
    const phrases = PHRASES[this.language] || PHRASES.en;
    this.speak(phrases.deliveryArrived(), VoicePriority.P4_MANEUVER, 'delivery_arrived', true);
  }

  // Development & Manual Audible Test API (Mandated by P0 Spec Sections 15 & 16)
  public testVoice(specificLang?: VoiceLanguage): boolean {
    const lang = specificLang ? this.normalizeLang(specificLang) : this.language;
    const sampleText =
      lang === 'te'
        ? 'వాయిస్ పరీక్ష విజయవంతమైంది. రోడ్‌రిస్క్ నావిగేషన్ వాయిస్ పనిచేస్తోంది.'
        : lang === 'hi'
        ? 'वॉयस टेस्ट सफल रहा. रोडरिस्क नेविगेशन आवाज काम कर रही है.'
        : lang === 'ta'
        ? 'குரல் சோதனை வெற்றிகரமாக முடிந்தது. ரோட்ரிஸ்க் வழிசெலுத்தல் குரல் இயங்குகிறது.'
        : lang === 'kn'
        ? 'ಧ್ವನಿ ಪರೀಕ್ಷೆ ಯಶಸ್ವಿಯಾಗಿದೆ. ರೋಡ್‌ರಿಸ್ಕ್ ನ್ಯಾವಿಗೇಷನ್ ಧ್ವನಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತಿದೆ.'
        : 'Voice test successful. RoadRisk navigation voice is working.';

    console.log(`[VOICE] manual testVoice triggered for language="${lang}" text="${sampleText}"`);
    return this.speak(sampleText, VoicePriority.P0_EMERGENCY, `test_${Date.now()}`, true, lang);
  }

  private bindEventBus() {
    eventBus.subscribe('EMERGENCY_VEHICLE_APPROACHING', (payload) => {
      this.announceEmergencyVehicleApproaching(payload.data?.callsign, payload.data?.distanceMeters);
    });

    eventBus.subscribe('ROUTE_INVALIDATED', () => {
      this.announceRoadClosureAhead();
    });

    eventBus.subscribe('REROUTE_SUGGESTED', () => {
      this.announceOffRoute();
    });
  }
}

export const navigationVoiceService = new NavigationVoiceService();
export default navigationVoiceService;
