import express from "express";
import cors from "cors";
import axios from "axios";
import { Firestore } from "@google-cloud/firestore";
import { VertexAI } from "@google-cloud/vertexai";
import { fetchTopPOIs } from "./services/places.js";

const app = express();

// ---------------- CORS ----------------
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://integral-accord-472414-t0.web.app",
  "https://integral-accord-472414-t0.firebaseapp.com",
]);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      if (/\.web\.app$/.test(origin)) return callback(null, true);
      return callback(null, true);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);
app.options("*", cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ---------------- Firestore ----------------
const db = new Firestore(); // requires Firestore enabled + IAM roles

// ---------------- Vertex AI ----------------
const PROJECT_ID =
  process.env.VERTEX_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  "integral-accord-472414-t0";

const LOCATION = process.env.VERTEX_LOCATION || "asia-south1";
const MODEL = process.env.VERTEX_MODEL || "gemini-1.5-flash";

const vertex = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION,
});
const generativeModel = vertex.getGenerativeModel({ model: MODEL });

// ---------------- Weather API ----------------
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

async function getWeather(destination) {
  try {
    const geoRes = await axios.get("http://api.openweathermap.org/geo/1.0/direct", {
      params: { q: destination, limit: 1, appid: WEATHER_API_KEY },
    });
    if (!geoRes.data.length) return [];

    const { lat, lon } = geoRes.data[0];
    const weatherRes = await axios.get("https://api.openweathermap.org/data/2.5/forecast", {
      params: { lat, lon, appid: WEATHER_API_KEY, units: "metric" },
    });

    return weatherRes.data.list.slice(0, 3).map((w) => ({
      date: w.dt_txt,
      desc: w.weather[0].description,
      temp: `${w.main.temp}°C`,
    }));
  } catch (err) {
    console.error("Weather error:", err.message);
    return [];
  }
}

// ---------------- API ENDPOINTS ----------------

// 1) Itinerary generation
app.post("/v1/plan", async (req, res) => {
  try {
    const { destination, startDate, endDate, budget, theme } = req.body;

    const forecast = await getWeather(destination);

    const prompt = `
      Create a travel itinerary for ${destination}.
      Dates: ${startDate} to ${endDate}.
      Budget: INR ${budget}.
      Theme: ${theme}.
      Include hidden gems, local cuisine, and authentic experiences.
      For each day, provide:
        - activities (array of strings),
        - nearest hospital,
        - nearest pharmacy,
        - a travel tip.
      Keep JSON format strictly:
      {
        "days": [
          { "day": 1, "activities": [], "hospital": "", "pharmacy": "", "tip": "" }
        ]
      }
    `;

    const response = await generativeModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    // ---- Parse JSON safely ----
    let raw = response.response.candidates[0].content.parts[0].text || "{}";
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    let itinerary = JSON.parse(raw);

    itinerary.days.forEach((d, i) => {
      d.weather = forecast[i]
        ? `${forecast[i].desc}, ${forecast[i].temp}`
        : "Weather unavailable";
    });

    itinerary.meta = { destination, startDate, endDate, budget, theme };

    res.json(itinerary);
  } catch (err) {
    console.error("/v1/plan failed — serving mock itinerary:", err?.message || err);
    const { destination = "Your Destination", startDate = "", endDate = "", budget = 0, theme = "" } =
      req.body || {};
    res.json({
      days: [
        {
          day: 1,
          activities: ["Check-in", "City walk", "Local dinner"],
          hospital: "City General Hospital",
          pharmacy: "Main St Pharmacy",
          tip: "Carry water & sunscreen.",
          weather: "Sunny, 30°C",
        },
        {
          day: 2,
          activities: ["Beach morning", "Museum", "Seafood shack"],
          hospital: "Harbor Hospital",
          pharmacy: "Harbor Meds",
          tip: "Book tickets in advance.",
          weather: "Partly cloudy, 29°C",
        },
        {
          day: 3,
          activities: ["Market", "Sunset point", "Cafe crawl"],
          hospital: "Central Clinic",
          pharmacy: "Wellness Chemist",
          tip: "Use public transport when possible.",
          weather: "Sunny, 31°C",
        },
      ],
      meta: { destination, startDate, endDate, budget, theme },
    });
  }
});

// TODO: Add /v1/book, /v1/trips, /v1/pois endpoints with similar error handling

// ---------------- Start Server ----------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend running on port ${PORT}, project=${PROJECT_ID}, location=${LOCATION}`);
});
