# AI Trip Planner — Dev, Test, and Deploy

This repo contains a React (Vite) frontend and a Node/Express backend with integrations to Vertex AI, Firestore, OpenWeather, and Google Places.

- Frontend: `frontend/trip-planner-frontend/`
- Backend: `backend/`

## Quick Start — Local Test

### 1) Backend (http://localhost:8080)

Prereqs if you want full functionality locally:
- Set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON with Vertex AI + Firestore access
- Set `GCP_PROJECT` to your GCP project ID
- Optional but recommended: `WEATHER_API_KEY` (OpenWeather), `MAPS_KEY` (Google Places)

Commands (PowerShell):
```powershell
# From repo root
npm install --prefix .\backend

# ENV (adjust paths/values)
$env:PORT = "8080"
$env:GCP_PROJECT = "your-project-id"
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"
$env:WEATHER_API_KEY = "<openweather_key>"
$env:MAPS_KEY = "<google_places_key>"

npm start --prefix .\backend
```

### 2) Frontend (Vite dev server)

Use helper scripts to toggle between local and cloud backend URLs.

- Switch to LOCAL backend:

```powershell
# Creates/overwrites .env to use http://localhost:8080 and copies Firebase keys from .env.cloud
.\frontend\trip-planner-frontend\scripts\use-local.ps1
# or specify another port
.\frontend\trip-planner-frontend\scripts\use-local.ps1 -Port 8081
```

- Start dev server:

```powershell
npm install --prefix .\frontend\trip-planner-frontend
npm run --prefix .\frontend\trip-planner-frontend dev
```

Open the URL printed by Vite (e.g., http://localhost:5173).

### 3) What to test in the UI
- Sign in with Google (header).
- Fill Destination, Start Date, Days, Budget, Theme, Interests.
- Click "Generate Itinerary".
  - You should see a summary card (Destination, Date range, Budget, Theme)
  - Day-by-day itinerary (weather, hospital, pharmacy, tips, activities)
  - POIs section (requires `MAPS_KEY`) with "View on Maps" links
- Click "Book This Trip (Simulated)".
  - Booking confirmation shown; if credentials set, a Firestore doc appears in `bookings`.

## Toggle back to Cloud

Set frontend to use Cloud Run URL stored in `.env.cloud`:

```powershell
.\frontend\trip-planner-frontend\scripts\use-cloud.ps1
```

`.env.cloud` example:

```
VITE_BACKEND_URL=https://trip-backend-xxxxxxxx-asia-south1.run.app
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Deploy Backend (Cloud Run, asia-south1)

Enable APIs, create secrets, build, and deploy.

```powershell
# Auth & project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable APIs
gcloud services enable `
  run.googleapis.com `
  aiplatform.googleapis.com `
  firestore.googleapis.com `
  secretmanager.googleapis.com `
  artifactregistry.googleapis.com `
  cloudbuild.googleapis.com

# Ensure dependency (FireStore client)
npm install --prefix .\backend @google-cloud/firestore

# Create secrets
"YOUR_OPENWEATHER_KEY" | Out-File -NoNewline -Encoding ascii "$env:TEMP\weather.txt"
"YOUR_GOOGLE_PLACES_KEY" | Out-File -NoNewline -Encoding ascii "$env:TEMP\maps.txt"

gcloud secrets create WEATHER_API_KEY --data-file="$env:TEMP\weather.txt"
gcloud secrets create MAPS_KEY --data-file="$env:TEMP\maps.txt"

# Service account & roles
gcloud iam service-accounts create trip-backend-sa --display-name "Trip Backend SA"
$SA="trip-backend-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:$SA" --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:$SA" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"

# Artifact Registry
gcloud artifacts repositories create trip-backend-repo --repository-format=docker --location=asia-south1

# Build & deploy
gcloud builds submit .\backend --tag asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/trip-backend-repo/trip-backend:latest

gcloud run deploy trip-backend `
  --image asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/trip-backend-repo/trip-backend:latest `
  --region asia-south1 `
  --allow-unauthenticated `
  --service-account $SA `
  --set-env-vars GCP_PROJECT=YOUR_PROJECT_ID `
  --set-secrets WEATHER_API_KEY=WEATHER_API_KEY:latest,MAPS_KEY=MAPS_KEY:latest
```

## Deploy Frontend (Firebase Hosting)

```powershell
npm install --prefix .\frontend\trip-planner-frontend
npm run --prefix .\frontend\trip-planner-frontend build

firebase login
firebase use YOUR_PROJECT_ID
# If needed: firebase init hosting  (public directory: dist, SPA: yes)
firebase deploy --only hosting
```

## Troubleshooting
- Itinerary shows fallback: likely Vertex/Weather env or API enablement. Check Cloud Run logs.
- Empty POIs: ensure `MAPS_KEY` secret exists and Places API + billing are enabled.
- Firestore write fails: ensure Firestore is created (Native mode) and service account has Datastore User.
- TypeScript warning for `./firebase`: repo contains `src/firebase.d.ts` and `src/firebase.js.d.ts`. Restart TS server/dev server if warning persists.
