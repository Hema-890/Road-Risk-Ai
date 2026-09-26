# Google Maps Platform Setup & Migration Guide

RoadRisk AI has been architected with a modular, pluggable **Map Engine Adapter**. It natively supports both **Google Maps Platform** and **MapTiler / MapLibre GL JS** worldwide vector tiles.

---

## 1. Required Google Maps Platform APIs

To use Google Maps Platform as the active rendering and search engine, activate the following APIs in the [Google Cloud Console](https://console.cloud.google.com/google/maps-apis):

1. **Maps JavaScript API** — Required for interactive map canvas, vector streets, 3D buildings, gestures, and markers.
2. **Places API (New) / Places Autocomplete** — Required for rapid global place search, business discovery, and place details.
3. **Routes API / Directions API** — Required for real road routing with alternatives and turn maneuvers.
4. **Geocoding API** — Required for reverse geocoding and coordinate lookup.

---

## 2. Required Environment Variable

Add the following key to your local `.env` file in the project root:

```env
# Google Maps Platform Client API Key
VITE_GOOGLE_MAPS_API_KEY=AIzaSyYourActualGoogleMapsAPIKeyHere
```

> **Security Note:**  
> Never commit `.env` to source control. The `.gitignore` file is already configured to exclude `.env` and `.env.*`.

---

## 3. Browser Key Restrictions (Recommended)

In the [Google Cloud Credentials Console](https://console.cloud.google.com/apis/credentials):
1. Under **Application restrictions**, select **Websites**.
2. Add your development and production domains:
   - `http://localhost:5173/*`
   - `http://localhost:4173/*`
   - `http://127.0.0.1:5173/*`
   - `https://your-production-domain.com/*`
3. Under **API restrictions**, select **Restrict key** and check:
   - Maps JavaScript API
   - Places API (New)
   - Directions API
   - Geocoding API

---

## 4. Map Provider Automatic Detection

RoadRisk AI checks for `VITE_GOOGLE_MAPS_API_KEY` on startup:
- **If `VITE_GOOGLE_MAPS_API_KEY` is present:** The application loads the Google Maps JavaScript API script dynamically and switches the map engine to Google Maps.
- **If `VITE_GOOGLE_MAPS_API_KEY` is absent:** The application smoothly runs on the verified worldwide **MapTiler Streets v2 + MapLibre GL JS** vector engine, providing complete global street coverage without interruption or fake mock tiles.
