# RoadRisk AI — Complete Zero-to-Production Setup Guide

This guide walks through running RoadRisk AI from zero accounts to local development and cloud production.

---

## 1. Local Development (Zero Accounts Required)

The platform has been engineered to work immediately out of the box with zero external accounts or API keys:

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start Backend REST API:**
   ```bash
   node server/index.cjs
   # Running on http://localhost:3001
   ```
   *Uses built-in native Node.js SQLite (`roadrisk.db`). Auto-seeds roads, vehicles, and hospitals.*

3. **Start Frontend Dev Server:**
   ```bash
   npm run dev
   # Running on http://localhost:5174
   ```
   *MapLibre GL JS immediately renders OpenFreeMap vector tiles with zero authentication required.*

4. **Verify Health:**
   Visit `http://localhost:3001/api/health` in your browser or run:
   ```bash
   node scripts/test-end-to-end.mjs
   ```

---

## 2. Cloud Production Deployment (Supabase + MapTiler + Gemini)

If deploying to a cloud hosting environment (e.g. Vercel + Supabase), follow these exact steps:

### Step 1: Supabase Setup (Database & Authentication)
1. Navigate to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New project**, select an organization, name it `roadrisk-ai`, set a database password, and choose your preferred region (e.g., `South Asia (Mumbai)`).
3. Open **SQL Editor** from the left sidebar.
4. Open the migration file generated in this repository:
   [`supabase/migrations/20260919000000_roadrisk_core_schema.sql`](file:///Users/jagadesh/Desktop/Road%20Risk%20Ai/supabase/migrations/20260919000000_roadrisk_core_schema.sql).
5. Copy and paste the entire SQL content into the SQL Editor and click **Run**.
   - *This creates all 10 tables, enums, indexes, and Row Level Security policies.*
6. Open **Project Settings ➔ API**.
   - Copy **Project URL** (e.g. `https://xyzcompany.supabase.co`).
   - Copy **anon public key** (`eyJhbGci...`).
   - Copy **service_role secret key** (`eyJhbGci...`).

### Step 2: MapTiler Setup (Optional Custom Vector Tiles)
1. Navigate to [https://cloud.maptiler.com/](https://cloud.maptiler.com/) and create a free account.
2. In the dashboard, click **API Keys**.
3. Copy your key.
4. Under **Key Restrictions**, add your allowed domains:
   - `localhost:5174`
   - `https://your-production-domain.com`

### Step 3: Google Gemini API (Optional Narrative Debriefs)
1. Navigate to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Click **Create API Key**.
3. Copy the key (`AIzaSy...`).

### Step 4: Configure Environment Variables
Create `.env.local` in the project root:
```env
# Map Rendering
VITE_MAP_PROVIDER=vector
VITE_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
VITE_MAPTILER_KEY=your_maptiler_key_here

# Routing & Geocoding
VITE_OSRM_BASE_URL=https://router.project-osrm.org
VITE_BACKEND_API_URL=http://localhost:3001

# Supabase Cloud Database (Optional)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# AI Debriefs (Optional Backend Only)
GEMINI_API_KEY=your_gemini_key_here
```

### Step 5: Build & Production Verification
```bash
npm run build
node scripts/test-end-to-end.mjs
```
Everything is production-ready!
