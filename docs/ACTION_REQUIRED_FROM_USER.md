# External Setup Required from User (Supabase & Firebase)

> [!IMPORTANT]
> **LOCAL DEVELOPMENT & TESTING IS FULLY FUNCTIONAL RIGHT NOW.**
> All local services (SQLite database, local session auth, MapLibre vector maps, OSRM real driving routing, OpenStreetMap Photon geocoding with distance filtering, audio speech synthesis, and dual-mode data fallbacks) are **100% operational and verified**.
>
> The codebase has been fully architected, implemented, and compiled for cloud connectivity. To transition from `local` to live `cloud` mode, follow the external setup steps below.

> [!CAUTION]
> **SECURITY MANDATE:**
> **NEVER SEND PASSWORDS, SERVICE-ROLE KEYS, OR PRIVATE CERTIFICATE KEYS IN CHAT.**
> Enter all credentials directly into your local `.env` or deployment environment.

---

## 1. Supabase External Cloud Setup

Because the automated Supabase CLI reached the free account's 2-project quota, please perform the following in your Supabase dashboard:

1. **Open Supabase Dashboard**: Navigate to [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. **Select Organization**: Open an existing organization (or remove an unused project / upgrade organization).
3. **Create Project**:
   - Name: `RoadRisk AI` (or `roadrisk-ai`)
   - Database Password: Create and store a secure password
   - Region: Select closest region (e.g., `South Asia (Mumbai) - ap-south-1` or `Singapore - ap-southeast-1`)
4. **Copy API Credentials**:
   - Go to **Project Settings** ➔ **API**
   - Copy **Project URL**
   - Copy **anon / public** key
   - Copy **service_role** key (keep secret!)
5. **Apply Database Migration**:
   - Go to **SQL Editor** in your Supabase project
   - Open the file: `supabase/migrations/20260919000000_roadrisk_core_schema.sql`
   - Paste the contents into the SQL Editor and click **Run**
   - This creates all 16 tables, indexes, RLS policies, and enables `supabase_realtime` publication.
6. **Verify Realtime**:
   - Go to **Database** ➔ **Publications**
   - Ensure `supabase_realtime` includes `missions`, `hazard_reports`, `risk_events`, and `telemetry_stream`.
7. **Populate Environment Variables**:
   Add the copied values to your local `.env` file:
   ```bash
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-public-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-backend-service-role-key
   ```

---

## 2. Firebase Cloud Messaging (FCM) & Web Push Setup

Because the automated Google Cloud project creation was blocked by your GCP project quota, please perform the following in your Firebase console:

1. **Open Firebase Console**: Navigate to [https://console.firebase.google.com/](https://console.firebase.google.com/).
2. **Create / Select Project**:
   - Use an existing project or create a project named `roadrisk-ai`.
3. **Register Web App**:
   - In Project Overview, click the **Web** icon (`</>`) to add an app.
   - App nickname: `RoadRisk AI Web`
   - Click **Register app** and copy the `firebaseConfig` keys.
4. **Enable Cloud Messaging**:
   - Go to **Project Settings** ➔ **Cloud Messaging** tab.
   - Under **Web configuration**, locate **Web Push certificates**.
   - Click **Generate key pair** to generate your **VAPID Key**.
5. **Generate Admin SDK Service Account (Backend Only)**:
   - Go to **Project Settings** ➔ **Service accounts** tab.
   - Ensure Node.js is selected, then click **Generate new private key**.
   - Download the JSON file. Extract:
     - `project_id`
     - `client_email`
     - `private_key`
6. **Populate Environment Variables**:
   Add the credentials to your local `.env` file:
   ```bash
   # Frontend Web Push Client Credentials
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_FIREBASE_VAPID_KEY=your-generated-vapid-public-key

   # Backend Server Admin Credentials (NEVER expose to Vite client)
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

---

## 3. Activation Verification

Once you have added these credentials to your `.env` file:

1. Restart the server:
   ```bash
   npm run server
   ```
2. Restart Vite dev server:
   ```bash
   npm run dev
   ```
3. Run the automated cloud verification script:
   ```bash
   node scripts/test-cloud-infrastructure.mjs
   ```
4. Query the live health check:
   ```bash
   curl http://localhost:3001/api/health
   ```
   Both `supabase` and `firebase` will transition from `NOT_CONFIGURED` to `READY`!
