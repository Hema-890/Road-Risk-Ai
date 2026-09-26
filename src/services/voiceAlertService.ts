// ==============================================================================
// ROADRISK AI — ENTERPRISE MULTILINGUAL VOICE SAFETY & NAVIGATION ENGINE
// Semantic Navigation Events & Safety Alerts with Natural Idiomatic Templates
// Supported Languages: English (en), Telugu (te), Hindi (hi), Tamil (ta), Kannada (kn)
// Priority-Gated Preemption (P0: Emergency -> P5: Informational)
// ==============================================================================

import { speechService } from './speechService.ts';
import { eventBus } from './eventBus.ts';
import type { DataProvenance } from '../types/dataStatus.ts';

export type SupportedLanguage = 'en' | 'te' | 'hi' | 'ta' | 'kn';

export const LANGUAGE_METADATA: Record<
  SupportedLanguage,
  { name: string; nativeName: string; bcp47: string }
> = {
  en: { name: 'English', nativeName: 'English', bcp47: 'en-US' },
  te: { name: 'Telugu', nativeName: 'తెలుగు', bcp47: 'te-IN' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', bcp47: 'hi-IN' },
  ta: { name: 'Tamil', nativeName: 'தமிழ்', bcp47: 'ta-IN' },
  kn: { name: 'Kannada', nativeName: 'ಕನ್ನಡ', bcp47: 'kn-IN' },
};

export type VoicePriority = 0 | 1 | 2 | 3 | 4 | 5;

export type VoiceTemplateKey =
  // P0 - Emergency
  | 'EMERGENCY_VEHICLE_APPROACHING'
  | 'AMBULANCE_APPROACHING_BEHIND'
  | 'AMBULANCE_APPROACHING_INTERSECTION'
  // P1 - Critical Road Hazards
  | 'ACCIDENT_AHEAD'
  | 'ACCIDENT_ALERT'
  | 'ROAD_CLOSED'
  | 'ROAD_CLOSED_DETOUR'
  | 'FLOOD_ALERT'
  | 'FLOODING_AHEAD'
  | 'HIGH_RISK_ALERT'
  | 'HARSH_DECELERATION_WARNING'
  // P2 - Navigation Maneuvers
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'ROUNDABOUT'
  | 'ARRIVAL'
  | 'OFF_ROUTE'
  // P3 - Route Updates
  | 'CONTINUE'
  | 'REROUTING'
  | 'REROUTE_OPTIMIZED'
  // P4 - Traffic Information
  | 'TRAFFIC_ALERT'
  | 'HEAVY_CONGESTION'
  // P5 - Informational & Weather
  | 'LOW_VISIBILITY'
  | 'WEATHER_WARNING';

export interface VoiceAlertParams {
  distanceMeters?: number;
  roadName?: string;
  delayMinutes?: number;
  exitNumber?: number;
  hazardType?: string;
  details?: string;
}

export interface VoiceAlertPayload {
  templateKey: VoiceTemplateKey;
  params?: VoiceAlertParams;
  priority?: VoicePriority;
}

// Map each event to its authoritative priority level
export const EVENT_PRIORITY_MAP: Record<VoiceTemplateKey, VoicePriority> = {
  EMERGENCY_VEHICLE_APPROACHING: 0,
  AMBULANCE_APPROACHING_BEHIND: 0,
  AMBULANCE_APPROACHING_INTERSECTION: 0,
  ROAD_CLOSED: 1,
  ROAD_CLOSED_DETOUR: 1,
  ACCIDENT_AHEAD: 1,
  ACCIDENT_ALERT: 1,
  FLOOD_ALERT: 1,
  FLOODING_AHEAD: 1,
  HIGH_RISK_ALERT: 1,
  HARSH_DECELERATION_WARNING: 1,
  TURN_LEFT: 2,
  TURN_RIGHT: 2,
  ROUNDABOUT: 2,
  ARRIVAL: 2,
  OFF_ROUTE: 2,
  REROUTING: 3,
  REROUTE_OPTIMIZED: 3,
  CONTINUE: 3,
  TRAFFIC_ALERT: 4,
  HEAVY_CONGESTION: 4,
  LOW_VISIBILITY: 5,
  WEATHER_WARNING: 5,
};

// Natural idiomatic templates per language (No mechanical Google Translate)
const TRANSLATION_TEMPLATES: Record<
  SupportedLanguage,
  Record<VoiceTemplateKey, (p: VoiceAlertParams) => string>
> = {
  en: {
    EMERGENCY_VEHICLE_APPROACHING: () =>
      'Emergency vehicle approaching rapidly. Please move safely to the left and yield right-of-way.',
    AMBULANCE_APPROACHING_BEHIND: () =>
      'Emergency ambulance approaching rapidly from behind. Please move safely to the left curb and yield right-of-way.',
    AMBULANCE_APPROACHING_INTERSECTION: () =>
      'Emergency siren detected approaching nearby intersection. Prepare to stop and yield right-of-way.',
    ROAD_CLOSED: (p) =>
      `Confirmed road closure ${p.distanceMeters ? `${p.distanceMeters} meters ahead` : 'ahead'}. Recalculating route.`,
    ROAD_CLOSED_DETOUR: (p) =>
      `Warning. Confirmed road closure ${p.distanceMeters ? `${p.distanceMeters} meters ahead` : 'ahead'}. Recalculating clear detour.`,
    ACCIDENT_AHEAD: (p) =>
      `Caution. Accident reported ${p.distanceMeters ? `${p.distanceMeters} meters ahead` : 'ahead'}${p.roadName ? ` on ${p.roadName}` : ''}. Consider alternative route.`,
    ACCIDENT_ALERT: (p) =>
      `Caution. Traffic incident reported ${p.distanceMeters ? `${p.distanceMeters} meters ahead` : 'ahead'}. Slow down.`,
    FLOOD_ALERT: (p) =>
      `Flood warning. Standing water ${p.distanceMeters ? `${p.distanceMeters} meters ahead` : 'ahead'}. Reduce speed.`,
    FLOODING_AHEAD: (p) =>
      `Alert. Waterlogging detected ${p.distanceMeters ? `${p.distanceMeters} meters ahead` : 'ahead'}${p.delayMinutes ? ` causing ${p.delayMinutes} minutes delay` : ''}. Drive with extreme caution.`,
    HIGH_RISK_ALERT: (p) =>
      `Caution. Approaching high risk accident-prone segment${p.roadName ? ` on ${p.roadName}` : ''}. Maintain safe braking distance.`,
    HARSH_DECELERATION_WARNING: () =>
      'Abrupt deceleration detected. Active collision avoidance activated.',
    TURN_LEFT: (p) =>
      `In ${p.distanceMeters ? `${p.distanceMeters} meters` : '100 meters'}, turn left${p.roadName ? ` onto ${p.roadName}` : ''}.`,
    TURN_RIGHT: (p) =>
      `In ${p.distanceMeters ? `${p.distanceMeters} meters` : '100 meters'}, turn right${p.roadName ? ` onto ${p.roadName}` : ''}.`,
    ROUNDABOUT: (p) =>
      `At the roundabout, take the ${p.exitNumber ? `${p.exitNumber} exit` : 'first exit'}.`,
    ARRIVAL: (p) =>
      `You have arrived at your destination${p.roadName ? `, ${p.roadName}` : ''}.`,
    OFF_ROUTE: () =>
      'You are off route. Recalculating navigation path.',
    CONTINUE: (p) =>
      `Continue straight${p.roadName ? ` on ${p.roadName}` : ''} for ${p.distanceMeters ? `${(p.distanceMeters / 1000).toFixed(1)} kilometers` : 'ahead'}.`,
    REROUTING: () =>
      'Recalculating route based on real-time traffic and hazard conditions.',
    REROUTE_OPTIMIZED: (p) =>
      `Faster and safer route found. Recalculated path saves ${p.delayMinutes || 4} minutes.`,
    TRAFFIC_ALERT: (p) =>
      `Traffic congestion ahead${p.delayMinutes ? `, expected delay ${p.delayMinutes} minutes` : ''}.`,
    HEAVY_CONGESTION: (p) =>
      `Heavy traffic congestion ahead. Estimated delay is ${p.delayMinutes || 5} minutes.`,
    LOW_VISIBILITY: () =>
      'Low visibility detected. Turn on fog lights and maintain safe distance.',
    WEATHER_WARNING: (p) =>
      `Adverse weather condition detected${p.details ? `: ${p.details}` : ''}. Drive cautiously.`,
  },
  te: {
    EMERGENCY_VEHICLE_APPROACHING: () =>
      'అత్యవసర వాహనం వేగంగా వస్తోంది. దయచేసి ఎడమ వైపునకు జరిగి దారి ఇవ్వండి.',
    AMBULANCE_APPROACHING_BEHIND: () =>
      'వెనుక నుండి అత్యవసర అంబులెన్స్ వేగంగా వస్తోంది. దయచేసి ఎడమ వైపునకు జరిగి దారి ఇవ్వండి.',
    AMBULANCE_APPROACHING_INTERSECTION: () =>
      'ముందు కూడలి వద్ద అంబులెన్స్ సైరన్ మోగుతోంది. వాహనాన్ని నెమ్మదించి దారి ఇవ్వడానికి సిద్ధంగా ఉండండి.',
    ROAD_CLOSED: () =>
      'ముందు రోడ్డు మూసివేయబడింది. ప్రత్యామ్నాయ మార్గాన్ని లెక్కించడం జరుగుతోంది.',
    ROAD_CLOSED_DETOUR: () =>
      'హెచ్చరిక. ముందు రోడ్డు మూసివేయబడింది. సురక్షితమైన ప్రత్యామ్నాయ మార్గాన్ని లెక్కించడం జరుగుతోంది.',
    ACCIDENT_AHEAD: (p) =>
      `జాగ్రత్త. ముందు ${p.distanceMeters ? `${p.distanceMeters} మీటర్ల దూరంలో` : ''} ప్రమాదం నమోదైంది. ప్రత్యామ్నాయ మార్గాన్ని పరిశీలించండి.`,
    ACCIDENT_ALERT: (p) =>
      `హెచ్చరిక. ముందు ${p.distanceMeters ? `${p.distanceMeters} మీటర్ల దూరంలో` : ''} ప్రమాదం ఉంది. వేగాన్ని తగ్గించండి.`,
    FLOOD_ALERT: (p) =>
      `వరద హెచ్చరిక. ముందు ${p.distanceMeters ? `${p.distanceMeters} మీటర్లలో` : ''} రోడ్డుపై నీరు నిలిచి ఉంది. జాగ్రత్తగా వెళ్లండి.`,
    FLOODING_AHEAD: (p) =>
      `అలర్ట్. ముందు రోడ్డుపై నీరు నిలిచి ఉంది${p.distanceMeters ? ` (${p.distanceMeters} మీటర్లు)` : ''}. జాగ్రత్తగా వాహనం నడపండి.`,
    HIGH_RISK_ALERT: () =>
      'ప్రమాదకర రహదారి సమీపిస్తోంది. సురక్షిత బ్రేకింగ్ దూరం పాటించండి.',
    HARSH_DECELERATION_WARNING: () =>
      'హఠాత్తుగా బ్రేకింగ్ నమోదైంది. సురక్షిత దూరం పాటించండి.',
    TURN_LEFT: (p) =>
      `${p.distanceMeters ? `${p.distanceMeters} మీటర్లలో ` : ''}ఎడమవైపునకు తిరగండి.`,
    TURN_RIGHT: (p) =>
      `${p.distanceMeters ? `${p.distanceMeters} మీటర్లలో ` : ''}కుడివైపునకు తిరగండి.`,
    ROUNDABOUT: () =>
      'వృత్తాకార కూడలి వద్ద సూచించిన మార్గంలో వెళ్ళండి.',
    ARRIVAL: () =>
      'మీరు మీ గమ్యస్థానానికి చేరుకున్నారు.',
    OFF_ROUTE: () =>
      'మీరు నిర్దేశిత మార్గం నుండి వైదొలిగారు. మార్గాన్ని తిరిగి లెక్కిస్తున్నాము.',
    CONTINUE: () =>
      'ఇదే మార్గంలో సూటిగా ముందుకు సాగండి.',
    REROUTING: () =>
      'తాజా పరిస్థితుల ప్రకారం కొత్త మార్గాన్ని లెక్కిస్తున్నాము.',
    REROUTE_OPTIMIZED: (p) =>
      `మెరుగైన సురక్షిత మార్గం దొరికింది. ఇది ${p.delayMinutes || 4} నిమిషాలు ఆదా చేస్తుంది.`,
    TRAFFIC_ALERT: (p) =>
      `ముందు ట్రాఫిక్ రద్దీ ఉంది${p.delayMinutes ? `, దాదాపు ${p.delayMinutes} నిమిషాల ఆలస్యం కావచ్చు` : ''}.`,
    HEAVY_CONGESTION: (p) =>
      `ముందు భారీ ట్రాఫిక్ రద్దీ ఉంది. అంచనా ఆలస్యం ${p.delayMinutes || 5} నిమిషాలు.`,
    LOW_VISIBILITY: () =>
      'దట్టమైన పొగమంచు ఉంది. వాహన లైట్లు వెలిగించి జాగ్రత్తగా నడపండి.',
    WEATHER_WARNING: () =>
      'వాతావరణం ప్రతికూలంగా ఉంది. నెమ్మదిగా వాహనం నడపండి.',
  },
  hi: {
    EMERGENCY_VEHICLE_APPROACHING: () =>
      'आपातकालीन वाहन तेजी से आ रहा है। कृपया सुरक्षित रूप से साइड होकर रास्ता दें।',
    AMBULANCE_APPROACHING_BEHIND: () =>
      'पीछे से आपातकालीन एम्बुलेंस आ रही है। कृपया सुरक्षित रूप से साइड होकर रास्ता दें।',
    AMBULANCE_APPROACHING_INTERSECTION: () =>
      'आगे चौराहे पर आपातकालीन वाहन आ रहा है। कृपया रुककर रास्ता देने के लिए तैयार रहें।',
    ROAD_CLOSED: () =>
      'आगे सड़क बंद है। नया रास्ता खोजा जा रहा है।',
    ROAD_CLOSED_DETOUR: () =>
      'चेतावनी। आगे सड़क बंद है। नया सुरक्षित रास्ता खोजा जा रहा है।',
    ACCIDENT_AHEAD: (p) =>
      `सावधान। आगे ${p.distanceMeters ? `${p.distanceMeters} मीटर की दूरी पर` : ''} दुर्घटना की सूचना है। वैकल्पिक मार्ग पर विचार करें।`,
    ACCIDENT_ALERT: (p) =>
      `सावधान। आगे ${p.distanceMeters ? `${p.distanceMeters} मीटर पर` : ''} दुर्घटना हुई है। गति धीमी करें।`,
    FLOOD_ALERT: (p) =>
      `जलभराव की चेतावनी। आगे ${p.distanceMeters ? `${p.distanceMeters} मीटर पर` : ''} पानी भरा है। सतर्क रहें।`,
    FLOODING_AHEAD: (p) =>
      `अलर्ट। आगे सड़क पर जलभराव है${p.distanceMeters ? ` (${p.distanceMeters} मीटर आगे)` : ''}। कृपया धीमी गति से चलें।`,
    HIGH_RISK_ALERT: () =>
      'आगे उच्च जोखिम वाला सड़क खंड है। सुरक्षित दूरी बनाए रखें।',
    HARSH_DECELERATION_WARNING: () =>
      'अचानक ब्रेक लगाया गया है। कृपया सतर्क रहें।',
    TURN_LEFT: (p) =>
      `${p.distanceMeters ? `${p.distanceMeters} मीटर में ` : ''}बाएं मुड़ें।`,
    TURN_RIGHT: (p) =>
      `${p.distanceMeters ? `${p.distanceMeters} मीटर में ` : ''}दाएं मुड़ें।`,
    ROUNDABOUT: () =>
      'गोल चक्कर पर उपयुक्त निकास लें।',
    ARRIVAL: () =>
      'आप अपने गंतव्य पर पहुंच गए हैं।',
    OFF_ROUTE: () =>
      'आप सही रास्ते से भटक गए हैं। नया रास्ता तैयार किया जा रहा है।',
    CONTINUE: () =>
      'सीधे आगे बढ़ते रहें।',
    REROUTING: () =>
      'यातायात के आधार पर नए मार्ग की गणना की जा रही है।',
    REROUTE_OPTIMIZED: (p) =>
      `नया सुरक्षित मार्ग मिल गया है। यह ${p.delayMinutes || 4} मिनट बचाएगा।`,
    TRAFFIC_ALERT: (p) =>
      `आगे यातायात जाम है${p.delayMinutes ? `, लगभग ${p.delayMinutes} मिनट की देरी होगी` : ''}।`,
    HEAVY_CONGESTION: (p) =>
      `आगे भारी ट्रैफिक जाम है। अनुमानित देरी ${p.delayMinutes || 5} मिनट है।`,
    LOW_VISIBILITY: () =>
      'दृश्यता कम है। कोहरा बत्ती जलाएं और सुरक्षित दूरी रखें।',
    WEATHER_WARNING: () =>
      'खराब मौसम की चेतावनी। सावधानी से गाड़ी चलाएं।',
  },
  ta: {
    EMERGENCY_VEHICLE_APPROACHING: () =>
      'அவசர வாகனம் வேகமாக வருகிறது. தயவுசெய்து ஓரமாக ஒதுங்கி வழிவிடவும்.',
    AMBULANCE_APPROACHING_BEHIND: () =>
      'பின்னால் அவசர ஆம்புலன்ஸ் வேகமாக வருகிறது. தயவுசெய்து ஓரமாக நின்று வழிவிடவும்.',
    AMBULANCE_APPROACHING_INTERSECTION: () =>
      'சந்தியில் அவசர வாகனம் வருகிறது. வழிவிடத் தயாராக இருங்கள்.',
    ROAD_CLOSED: () =>
      'முன்னால் சாலை மூடப்பட்டுள்ளது. மாற்று வழி கணக்கிடப்படுகிறது.',
    ROAD_CLOSED_DETOUR: () =>
      'எச்சரிக்கை. முன்னால் சாலை மூடப்பட்டுள்ளது. மாற்று வழி கணக்கிடப்படுகிறது.',
    ACCIDENT_AHEAD: (p) =>
      `எச்சரிக்கை. முன்னால் ${p.distanceMeters ? `${p.distanceMeters} மீட்டரில்` : ''} விபத்து பதிவாகியுள்ளது. மாற்று வழியைப் பரிசீலிக்கவும்.`,
    ACCIDENT_ALERT: (p) =>
      `எச்சரிக்கை. முன்னால் ${p.distanceMeters ? `${p.distanceMeters} மீட்டரில்` : ''} விபத்து ஏற்பட்டுள்ளது. வேகத்தைக் குறைக்கவும்.`,
    FLOOD_ALERT: (p) =>
      `வெள்ள அபாயம். முன்னால் சாலையில் தண்ணீர் தேங்கியுள்ளது. கவனமாக செல்லவும்.`,
    FLOODING_AHEAD: (p) =>
      `கவனம். முன்னால் சாலையில் வெள்ளப்பெருக்கு உள்ளது. கவனமாக வாகனத்தை ஓட்டவும்.`,
    HIGH_RISK_ALERT: () =>
      'அபாயகரமான பகுதி நெருங்குகிறது. பாதுகாப்பான இடைவெளியைப் பராமரிக்கவும்.',
    HARSH_DECELERATION_WARNING: () =>
      'திடீர் பிரேக் கண்டறியப்பட்டது. எச்சரிக்கையாக இருக்கவும்.',
    TURN_LEFT: (p) =>
      `${p.distanceMeters ? `${p.distanceMeters} மீட்டரில் ` : ''}இடதுபுறம் திரும்பவும்.`,
    TURN_RIGHT: (p) =>
      `${p.distanceMeters ? `${p.distanceMeters} மீட்டரில் ` : ''}வலதுபுறம் திரும்பவும்.`,
    ROUNDABOUT: () =>
      'வட்டச் சந்திப்பில் சரியான வெளியேறும் வழியை எடுக்கவும்.',
    ARRIVAL: () =>
      'நீங்கள் இலக்கை அடைந்துவிட்டீர்கள்.',
    OFF_ROUTE: () =>
      'நீங்கள் வழியிலிருந்து விலகிவிட்டீர்கள். புதிய பாதை கணக்கிடப்படுகிறது.',
    CONTINUE: () =>
      'நேராக தொடர்ந்து செல்லவும்.',
    REROUTING: () =>
      'மாற்றுப் பாதை கணக்கிடப்படுகிறது.',
    REROUTE_OPTIMIZED: (p) =>
      `புதிய பாதுகாப்பான பாதை கண்டறியப்பட்டது. இது ${p.delayMinutes || 4} நிமிடங்களைச் சேமிக்கும்.`,
    TRAFFIC_ALERT: (p) =>
      `முன்னால் போக்குவரத்து நெரிசல் உள்ளது${p.delayMinutes ? `, தாமதம் ${p.delayMinutes} நிமிடங்கள்` : ''}.`,
    HEAVY_CONGESTION: (p) =>
      `முன்னால் கடுமையான போக்குவரத்து நெரிசல் உள்ளது. எதிர்பார்க்கப்படும் தாமதம் ${p.delayMinutes || 5} நிமிடங்கள்.`,
    LOW_VISIBILITY: () =>
      'பனிமூட்டம் அதிகமாக உள்ளது. வாகன விளக்குகளைப் பயன்படுத்தி கவனமாக ஓட்டவும்.',
    WEATHER_WARNING: () =>
      'மோசமான வானிலை எச்சரிக்கை. கவனமாக வாகனத்தை இயக்கவும்.',
  },
  kn: {
    EMERGENCY_VEHICLE_APPROACHING: () =>
      'ತುರ್ತು ವಾಹನ ವೇಗವಾಗಿ ಬರುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಎಡಕ್ಕೆ ಸರಿದು ದಾರಿ ನೀಡಿ.',
    AMBULANCE_APPROACHING_BEHIND: () =>
      'ಹಿಂದಿನಿಂದ ತುರ್ತು ಆಂಬ್ಯುಲೆನ್ಸ್ ಬರುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಬದಿಗೆ ಸರಿದು ದಾರಿ ನೀಡಿ.',
    AMBULANCE_APPROACHING_INTERSECTION: () =>
      'ಮುಂದಿನ ವೃತ್ತದಲ್ಲಿ ತುರ್ತು ವಾಹನ ಬರುತ್ತಿದೆ. ದಾರಿ ನೀಡಲು ಸಿದ್ಧರಾಗಿರಿ.',
    ROAD_CLOSED: () =>
      'ಮುಂದೆ ರಸ್ತೆ ಮುಚ್ಚಲಾಗಿದೆ. ಪರ್ಯಾಯ ಮಾರ್ಗ ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತಿದೆ.',
    ROAD_CLOSED_DETOUR: () =>
      'ಎಚ್ಚರಿಕೆ. ಮುಂದೆ ರಸ್ತೆ ಮುಚ್ಚಲಾಗಿದೆ. ಪರ್ಯಾಯ ಮಾರ್ಗ ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತಿದೆ.',
    ACCIDENT_AHEAD: (p) =>
      `ಎಚ್ಚರಿಕೆ. ಮುಂದೆ ${p.distanceMeters ? `${p.distanceMeters} ಮೀಟರ್ ದೂರದಲ್ಲಿ` : ''} ಅಪಘಾತ ವರದಿಯಾಗಿದೆ. ಪರ್ಯಾಯ ಮಾರ್ಗವನ್ನು ಪರಿಗಣಿಸಿ.`,
    ACCIDENT_ALERT: (p) =>
      `ಎಚ್ಚರಿಕೆ. ಮುಂದೆ ${p.distanceMeters ? `${p.distanceMeters} ಮೀಟರ್ ದೂರದಲ್ಲಿ` : ''} ಅಪಘಾತ ಸಂಭವಿಸಿದೆ. ವೇಗ ಕಡಿಮೆ ಮಾಡಿ.`,
    FLOOD_ALERT: (p) =>
      `ಪ್ರವಾಹ ಎಚ್ಚರಿಕೆ. ಮುಂದೆ ರಸ್ತೆಯಲ್ಲಿ ನೀರು ನಿಂತಿದೆ. ಎಚ್ಚರಿಕೆಯಿಂದ ಚಲಿಸಿ.`,
    FLOODING_AHEAD: (p) =>
      `ಗಮನಿಸಿ. ಮುಂದೆ ರಸ್ತೆಯಲ್ಲಿ ನೀರು ನಿಂತಿದೆ. ಎಚ್ಚರಿಕೆಯಿಂದ ವಾಹನ ಚಲಾಯಿಸಿ.`,
    HIGH_RISK_ALERT: () =>
      'ಅಪಘಾತ ವಲಯ ಸಮೀಪಿಸುತ್ತಿದೆ. ಸುರಕ್ಷಿತ ಅಂತರ ಕಾಪಾಡಿಕೊಳ್ಳಿ.',
    HARSH_DECELERATION_WARNING: () =>
      'ಹಠಾತ್ ಬ್ರೇಕಿಂಗ್ ಪತ್ತೆಯಾಗಿದೆ. ಜಾಗರೂಕರಾಗಿರಿ.',
    TURN_LEFT: (p) =>
      `${p.distanceMeters ? `${p.distanceMeters} ಮೀಟರ್‌ನಲ್ಲಿ ` : ''}ಎಡಕ್ಕೆ ತಿರುಗಿ.`,
    TURN_RIGHT: (p) =>
      `${p.distanceMeters ? `${p.distanceMeters} ಮೀಟರ್‌ನಲ್ಲಿ ` : ''}ಬಲಕ್ಕೆ ತಿರುಗಿ.`,
    ROUNDABOUT: () =>
      'ವೃತ್ತದಲ್ಲಿ ಸರಿಯಾದ ನಿರ್ಗಮನವನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ.',
    ARRIVAL: () =>
      'ನೀವು ನಿಮ್ಮ ಗಮ್ಯಸ್ಥಾನವನ್ನು ತಲುಪಿದ್ದೀರಿ.',
    OFF_ROUTE: () =>
      'ನೀವು ನಿಗದಿತ ಮಾರ್ಗದಿಂದ ಹೊರಬಂದಿದ್ದೀರಿ. ಹೊಸ ಮಾರ್ಗವನ್ನು ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತಿದೆ.',
    CONTINUE: () =>
      'ನೇರವಾಗಿ ಮುಂದುವರಿಯಿರಿ.',
    REROUTING: () =>
      'ಟ್ರಾಫಿಕ್ ಆಧಾರದ ಮೇಲೆ ಹೊಸ ಮಾರ್ಗವನ್ನು ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತಿದೆ.',
    REROUTE_OPTIMIZED: (p) =>
      `ಸುರಕ್ಷಿತವಾದ ಹೊಸ ಮಾರ್ಗ ಕಂಡುಹಿಡಿಯಲಾಗಿದೆ. ಇದು ${p.delayMinutes || 4} ನಿಮಿಷ ಉಳಿಸುತ್ತದೆ.`,
    TRAFFIC_ALERT: (p) =>
      `ಮುಂದೆ ಸಂಚಾರ ದಟ್ಟಣೆ ಇದೆ${p.delayMinutes ? `, ಸುಮಾರು ${p.delayMinutes} ನಿಮಿಷ ವಿಳಂಬವಾಗಬಹುದು` : ''}.`,
    HEAVY_CONGESTION: (p) =>
      `ಮುಂದೆ ಭಾರೀ ಸಂಚಾರ ದಟ್ಟಣೆ ಇದೆ. ನಿರೀಕ್ಷಿತ ವಿಳಂಬ ${p.delayMinutes || 5} ನಿಮಿಷಗಳು.`,
    LOW_VISIBILITY: () =>
      'ದಟ್ಟ ಮಂಜು ಕವಿದಿದೆ. ಫಾಗ್ ದೀಪಗಳನ್ನು ಬೆಳಗಿಸಿ ನಿಧಾನವಾಗಿ ಚಲಿಸಿ.',
    WEATHER_WARNING: () =>
      'ಪ್ರತಿಕೂಲ ಹವಾಮಾನ ಎಚ್ಚರಿಕೆ. ಜಾಗರೂಕರಾಗಿ ವಾಹನ ಚಲಾಯಿಸಿ.',
  },
};

class VoiceAlertService {
  private currentLanguage: SupportedLanguage = 'en';
  private cooldownMap: Map<string, number> = new Map();
  private cooldownWindowMs: number = 20000; // 20s cooldown per unique message key

  constructor() {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      try {
        const savedLang = localStorage.getItem('roadrisk_voice_language') as SupportedLanguage;
        if (savedLang && ['en', 'te', 'hi', 'ta', 'kn'].includes(savedLang)) {
          this.currentLanguage = savedLang;
        }
      } catch {}
    }
  }

  public setLanguage(lang: SupportedLanguage) {
    if (['en', 'te', 'hi', 'ta', 'kn'].includes(lang)) {
      this.currentLanguage = lang;
      try {
        localStorage.setItem('roadrisk_voice_language', lang);
      } catch {}
    }
  }

  public getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  public getAvailableLanguages(): Array<{ code: SupportedLanguage; name: string; nativeName: string }> {
    return (Object.keys(LANGUAGE_METADATA) as SupportedLanguage[]).map((code) => ({
      code,
      name: LANGUAGE_METADATA[code].name,
      nativeName: LANGUAGE_METADATA[code].nativeName,
    }));
  }

  /**
   * Reports genuine browser speech synthesis voice availability
   */
  public getVoiceReadiness(lang: SupportedLanguage = this.currentLanguage): {
    lang: SupportedLanguage;
    hasVoice: boolean;
    bcp47: string;
    voiceName?: string;
  } {
    const meta = LANGUAGE_METADATA[lang];
    const voice = speechService.getBestVoiceForLanguage(meta.bcp47);
    return {
      lang,
      hasVoice: Boolean(voice),
      bcp47: meta.bcp47,
      voiceName: voice?.name,
    };
  }

  /**
   * Dispatches a semantic navigation or hazard event through the multilingual pipeline
   */
  public dispatchVoiceAlert(alert: VoiceAlertPayload, force?: boolean): string {
    const lang = this.currentLanguage;
    const meta = LANGUAGE_METADATA[lang];
    const params = alert.params || {};
    const priority = alert.priority ?? EVENT_PRIORITY_MAP[alert.templateKey] ?? 3;

    // Deduplication check: prevent spamming the exact same audio event
    const now = Date.now();
    const eventSignature = `${lang}_${alert.templateKey}_${params.roadName || ''}_${params.exitNumber || ''}`;
    const lastSpoken = this.cooldownMap.get(eventSignature) || 0;
    const shouldSuppressAudio = force !== true && now - lastSpoken < this.cooldownWindowMs && priority > 1;
    this.cooldownMap.set(eventSignature, now);

    // Resolve natural template for active language
    const langTemplates = TRANSLATION_TEMPLATES[lang] || TRANSLATION_TEMPLATES['en'];
    const templateFn = langTemplates[alert.templateKey] || TRANSLATION_TEMPLATES['en'][alert.templateKey];
    const spokenMessage = templateFn ? templateFn(params) : '';

    if (!spokenMessage) return '';

    // Dispatch via SpeechService with priority preemption if not suppressed
    if (!shouldSuppressAudio) {
      speechService.speak(spokenMessage, {
        lang: meta.bcp47,
        priority,
        force: force ?? (priority <= 1),
      });
    }

    const provenance: DataProvenance = {
      source: `RoadRisk Multilingual Voice Dispatcher (${meta.name} / ${meta.bcp47})`,
      status: 'LIVE',
      updatedAt: new Date().toISOString(),
      freshness: 'LIVE',
      confidence: 1.0,
      coverageRegion: meta.bcp47,
    };

    // Emit event bus notification
    eventBus.publish('VOICE_ALERT_DISPATCHED', { message: spokenMessage, lang, alert, priority }, provenance);

    return spokenMessage;
  }
}

export const voiceAlertService = new VoiceAlertService();
