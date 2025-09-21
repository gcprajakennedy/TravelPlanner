import {GoogleAuth} from 'google-auth-library';
import axios from 'axios';

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = 'asia-south1'; // or us-central1 depending on model availability
const MODEL = 'gemini-pro'; // replace with exact model resource if required

async function getAccessToken() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

export async function generateItineraryWithGemini({ user, destination, dates, budget, interests, pois }) {
  const prompt = `You are a professional travel planner. Generate a JSON itinerary matching schema...
  Schema:
  {
    "destination": "string",
    "budget": number,
    "days": [ { "day": 1, "title":"", "activities": [{"time":"morning","desc":"", "poi_id":"", "est_cost": 0}], "est_total": 0 } ],
    "cost_breakdown": { "flights":0, "hotel":0, "experiences":0, "food": 0 },
    "notes": "string"
  }
  User: ${JSON.stringify(user)}
  Preferences: destination=${destination}, dates=${JSON.stringify(dates)}, budget=${budget}, interests=${interests.join(',')}
  POIs: ${JSON.stringify(pois)}
  Return only valid JSON.
  `;

  const token = await getAccessToken();
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:predict`;
  const resp = await axios.post(url, {
    instances: [{ content: prompt }],
    parameters: { temperature: 0.2, maxOutputTokens: 1200 }
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });

  // resp.data.predictions[0] may contain the model output; parse accordingly
  const text = resp.data?.predictions?.[0]?.content ?? resp.data?.predictions?.[0]?.output;
  // You may need to adapt parsing depending on the exact returned shape.
  return JSON.parse(text);
}
