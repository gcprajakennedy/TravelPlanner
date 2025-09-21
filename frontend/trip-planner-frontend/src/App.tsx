// src/App.tsx
import { useRef, useState } from "react";
import axios from "axios";
import { auth, provider, signInWithPopup, signOut } from "./firebase.ts";
import html2canvas from "html2canvas";

type ItineraryDay = {
  title: string;
  activities: string[];
  weather: string;
  hospital: string;
  pharmacy: string;
  tip: string;
};

type POI = {
  place_id?: string;
  name: string;
  lat?: number;
  lng?: number;
  formatted_address?: string;
  address?: string;
  rating?: number;
  types?: string[];
};

type TripSummary = {
  id: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  theme?: string;
  budget?: number;
};

export default function App() {

  // Form states
  const [destination, setDestination] = useState("");
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState<number | "">(3);
  const [startDate, setStartDate] = useState("");
  const [themeChoice, setThemeChoice] = useState("Adventure");
  const [interests, setInterests] = useState("");
  const [origin, setOrigin] = useState("");
  const [travelers, setTravelers] = useState<number>(2);
  const [flightClass, setFlightClass] = useState("Economy");
  const [hotelRating, setHotelRating] = useState<number>(3);

  // Runtime states
  const [loading, setLoading] = useState(false);
  const [itinerary, setItinerary] = useState<ItineraryDay[] | null>(null);
  const [booking, setBooking] = useState<any | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pois, setPois] = useState<POI[] | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [community, setCommunity] = useState<TripSummary[] | null>(null);
  const [ackSources, setAckSources] = useState<boolean>(false);
  const [payOpen, setPayOpen] = useState<boolean>(false);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [payment, setPayment] = useState<{ paymentId?: string; status?: string } | null>(null);
  const bookingRef = useRef<HTMLDivElement>(null);

  const downloadReceipt = () => {
    if (!booking) return;
    const data = {
      bookingId: booking.bookingId,
      paymentId: booking.paymentId || payment?.paymentId,
      status: booking.order?.status,
      amount: booking.order?.amount,
      details: booking.details,
      flights: booking.flights,
      hotel: booking.hotel,
      transport: booking.transport,
      totals: booking.totals,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt_${booking.bookingId || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // API base (use env or fallback)
  const API_BASE = (import.meta.env && (import.meta.env.VITE_BACKEND_URL as string)) || "http://localhost:8080";

  // Helper: compute end date (YYYY-MM-DD) from startDate + (days - 1)
  const computeEndDate = (start: string, numDays: number): string => {
    try {
      const d = new Date(start);
      if (isNaN(d.getTime())) return start;
      d.setDate(d.getDate() + Math.max(0, numDays - 1));
      return d.toISOString().slice(0, 10);
    } catch {
      return start;
    }
  };

  // Dummy payment submit
  const submitPayment = async () => {
    if (!booking?.bookingId) {
      setToastMsg("No booking to pay for yet");
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/v1/pay`, {
        bookingId: booking.bookingId,
        card: {
          name: cardName,
          number: cardNumber,
          expiry: cardExpiry,
          cvv: cardCvv,
        },
      }, { timeout: 10000 });
      setPayment(res.data);
      // reflect status in booking order if present
      setBooking((prev: any) => prev ? { ...prev, order: { ...(prev.order||{}), status: res.data?.status }, paymentId: res.data?.paymentId } : prev);
      setToastMsg("Payment processed (dummy)");
      setPayOpen(false);
      // bring confirmation into focus
      setTimeout(() => {
        try { bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch {}
      }, 100);
    } catch (e) {
      console.warn("Payment failed", e);
      setToastMsg("Payment failed. Check details and retry.");
    }
  };

  // Load recent community trips
  const loadPublicTrips = async () => {
    try {
      const res = await axios.get(`${API_BASE}/v1/trips`, { params: { limit: 12 }, timeout: 10000 });
      setCommunity(res.data?.trips || []);
    } catch (e) {
      console.warn("Load trips failed", e);
    }
  };

  // Copy helpers
  const itineraryAsText = (): string => {
    if (!itinerary) return "";
    const lines: string[] = [];
    lines.push(`Trip to ${destination} (${startDate} → ${computeEndDate(startDate, Number(days || 1))})`);
    lines.push(`Budget: ₹${budget}  Theme: ${themeChoice}`);
    lines.push("");
    itinerary.forEach((d, idx) => {
      lines.push(`Day ${idx + 1}: ${d.title || "Highlights"}`);
      lines.push(`  Weather: ${d.weather}`);
      lines.push(`  Hospital: ${d.hospital}`);
      lines.push(`  Pharmacy: ${d.pharmacy}`);
      lines.push(`  Tip: ${d.tip}`);
      if (Array.isArray(d.activities)) {
        d.activities.forEach((a) => lines.push(`   • ${a}`));
      }
      lines.push("");
    });
    return lines.join("\n");
  };

  const itineraryAsMarkdown = (): string => {
    if (!itinerary) return "";
    const lines: string[] = [];
    lines.push(`# Trip to ${destination}`);
    lines.push(`**Dates:** ${startDate} → ${computeEndDate(startDate, Number(days || 1))}`);
    lines.push(`**Budget:** ₹${budget}  
**Theme:** ${themeChoice}`);
    lines.push("");
    itinerary.forEach((d, idx) => {
      lines.push(`## Day ${idx + 1} — ${d.title || "Highlights"}`);
      lines.push(`- **Weather:** ${d.weather}`);
      lines.push(`- **Nearest Hospital:** ${d.hospital}`);
      lines.push(`- **Pharmacy:** ${d.pharmacy}`);
      lines.push(`- **Tip:** ${d.tip}`);
      if (Array.isArray(d.activities) && d.activities.length) {
        lines.push(`- **Activities:**`);
        d.activities.forEach((a) => lines.push(`  - ${a}`));
      }
      lines.push("");
    });
    return lines.join("\n");
  };

  const copyText = async () => {
    const txt = itineraryAsText();
    if (!txt) return;
    await navigator.clipboard.writeText(txt);
    setToastMsg("Copied itinerary as text");
  };

  const copyMarkdown = async () => {
    const md = itineraryAsMarkdown();
    if (!md) return;
    await navigator.clipboard.writeText(md);
    setToastMsg("Copied itinerary as Markdown");
  };

  // Share to community (save trip to backend)
  const shareToCommunity = async () => {
    try {
      if (!itinerary) return;
      const endDate = computeEndDate(startDate, Number(days || 1));
      const payload = {
        userId: user?.uid || "anon",
        destination,
        startDate,
        endDate,
        budget: Number(budget) || null,
        days: Number(days) || itinerary.length,
        theme: themeChoice,
        interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
        itinerary,
      };
      const res = await axios.post(`${API_BASE}/v1/trips`, payload, { timeout: 10000 });
      setShareLink(res.data?.url);
      setToastMsg("Trip shared to community. Link copied to clipboard.");
      if (res.data?.url && navigator.clipboard) {
        await navigator.clipboard.writeText(res.data.url);
      }
      if ((navigator as any).share && res.data?.url) {
        try { await (navigator as any).share({ title: `Trip to ${destination}`, url: res.data.url }); } catch {}
      }
    } catch (e) {
      console.warn("Share trip failed", e);
      setToastMsg("Unable to share trip right now.");
    }
  };

  // Create poster image (png) from itinerary capture area
  const downloadPoster = async () => {
    try {
      const el = captureRef.current;
      if (!el) return;
      const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `trip_${destination}_${Date.now()}.png`;
      a.click();
    } catch (e) {
      console.warn("Poster generation failed", e);
      setToastMsg("Could not generate poster");
    }
  };

  // Mock itinerary (fallback)
  const mockItinerary: ItineraryDay[] = [
    {
      title: "Day 1 — Arrival & Explore",
      activities: ["Check-in", "Walk at the beach", "Local street food crawl"],
      weather: "Sunny, 30°C",
      hospital: "City General Hospital (2.1 km)",
      pharmacy: "Sunrise Pharmacy (600 m)",
      tip: "Carry sunscreen and a water bottle.",
    },
    {
      title: "Day 2 — Adventure",
      activities: ["Island hopping", "Kayaking", "Sunset viewpoint"],
      weather: "Partly cloudy, 28°C",
      hospital: "Metro Care Clinic (3.2 km)",
      pharmacy: "MediQuick Store (900 m)",
      tip: "Book water activities in the morning for calmer seas.",
    },
    {
      title: "Day 3 — Culture & Relax",
      activities: ["Visit heritage site", "Local market", "Evening live music"],
      weather: "Light breeze, 27°C",
      hospital: "Sunrise Medical (2.0 km)",
      pharmacy: "CareWell Chemist (400 m)",
      tip: "Try the local dessert — it’s a crowd favorite!",
    },
  ];

  // Generate itinerary (calls backend; falls back to mock on error)
  const generateItinerary = async () => {
    if (!destination || !budget || !days || !startDate) {
      setToastMsg("Please fill all required fields");
      return;
    }
    if (!ackSources) {
      setToastMsg("Please acknowledge the data sources before generating.");
      return;
    }

    setLoading(true);
    setItinerary(null);
    setBooking(null);
    setPois(null);

    try {
      const endDate = computeEndDate(startDate, Number(days));
      const res = await axios.post(`${API_BASE}/v1/plan`, {
        destination,
        budget: Number(budget),
        days: Number(days),
        theme: themeChoice,
        startDate,
        endDate,
        interests: interests.split(",").map(s => s.trim()).filter(Boolean),
      }, { timeout: 15000 });

      // Backend expected to return { days: [...] } or a similar structure
      // Try to normalize
      const data = res.data;
      if (data && Array.isArray(data.days)) {
        setItinerary(data.days);
      } else if (data && Array.isArray(data.itinerary)) {
        setItinerary(data.itinerary);
      } else {
        // If structure unknown, attempt to parse and fallback to mock
        console.warn("Unexpected itinerary shape from backend:", data);
        setItinerary(mockItinerary);
        setToastMsg("Using fallback itinerary (unexpected backend format)");
      }

      // Fetch POIs as an added USP
      try {
        const poiRes = await axios.get(`${API_BASE}/v1/pois`, {
          params: { city: destination, categories: "heritage,food,nightlife" },
          timeout: 10000,
        });
        const list: POI[] = poiRes.data?.pois || [];
        setPois(list);
      } catch (e) {
        console.warn("POIs fetch failed", e);
      }
    } catch (err) {
      console.error("Itinerary fetch failed:", err);
      setToastMsg("Backend unreachable — showing mock data");
      setItinerary(mockItinerary);
    } finally {
      setLoading(false);
    }
  };

  // Book trip (dummy flow)
  const bookTrip = async () => {
    if (!itinerary) return;
    try {
      const payload = {
        userId: "demoUser",
        bookingItems: itinerary.map((d) => ({ day: d.title, activities: d.activities })),
        details: {
          origin,
          destination,
          startDate,
          endDate: computeEndDate(startDate, Number(days || 1)),
          travelers,
          flightClass,
          hotelRating,
        }
      };
      const res = await axios.post(`${API_BASE}/v1/book`, payload, { timeout: 10000 });
      setBooking(res.data);
      setToastMsg(`Booking created — ID: ${res.data.bookingId}`);
    } catch (err) {
      console.warn("Booking API failed — using mock confirmation", err);
      // Mock confirmation
      const end = computeEndDate(startDate, Number(days || 1));
      const mockFlights = [
        { vendor: "IndiGo", route: `${origin || "BLR"} → ${destination || "GOI"}`, class: flightClass, price: 5200, date: startDate },
        { vendor: "IndiGo", route: `${destination || "GOI"} → ${origin || "BLR"}`, class: flightClass, price: 5100, date: end },
      ];
      const mockHotel = { name: `${hotelRating}-Star City Hotel`, checkIn: startDate, checkOut: end, rating: hotelRating, pricePerNight: 2800, nights: Math.max(1, Number(days || 1)) };
      const mockTransport = [ { type: "Airport Pickup", vendor: "CityCabs", date: startDate, price: 800 } ];
      const totals = {
        flights: mockFlights.reduce((s, f) => s + f.price * travelers, 0),
        hotel: mockHotel.pricePerNight * mockHotel.nights,
        transport: mockTransport.reduce((s, t) => s + t.price, 0),
        activities: 0,
      };
      const mock = {
        bookingId: `mock_${Date.now()}`,
        details: { origin, destination, startDate, endDate: end, travelers, flightClass, hotelRating },
        flights: mockFlights,
        hotel: mockHotel,
        transport: mockTransport,
        totals: { ...totals, grandTotal: Object.values(totals).reduce((s, v) => s + v, 0) },
        order: { orderId: `mock_order_${Date.now()}`, amount: Object.values(totals).reduce((s, v) => s + v, 0), status: "CONFIRMED" },
      };
      setBooking(mock as any);
      setToastMsg("Mock booking confirmed");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F8FAFF 0%, #F1F7FF 100%)" }}>
      <header style={{ background: "linear-gradient(90deg,#1f94ff 0%,#36b3ff 100%)", color: "white", padding: "18px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 8px 24px rgba(31,148,255,0.35)" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: 0.3 }}>✨ AI Trip Planner</h1>
          <p style={{ marginTop: 4, fontSize: 12, opacity: 0.95 }}>Smart itineraries, safety-first tips, and instant sharing — powered by Vertex AI.</p>
        </div>
        <div>
          {user ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12 }}>Hi, {user.displayName || user.email}</span>
              <button onClick={() => signOut(auth).then(() => setUser(null))} style={{ background: "#fff", color: "#1f94ff", padding: "8px 10px", borderRadius: 8, border: 0 }}>Sign out</button>
            </div>
          ) : (
            <button onClick={() => signInWithPopup(auth, provider).then((res: any) => setUser(res.user))} style={{ background: "#fff", color: "#1f94ff", padding: "8px 10px", borderRadius: 8, border: 0 }}>Sign in with Google</button>
          )}

        {/* Community Gallery */}
        {community && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ margin: "8px 0 12px" }}>Community Trips</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {community.map((t) => (
                <div key={t.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, overflow: "hidden", boxShadow: "0 6px 18px rgba(0,0,0,0.06)" }}>
                  <img alt="OG" src={`${API_BASE}/v1/trips/${t.id}/og`} style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                  <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: 700 }}>{t.destination || "Trip"}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{[t.startDate, t.endDate].filter(Boolean).join(" → ")}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{t.theme ? `Theme: ${t.theme}` : ""}</div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <a href={`${API_BASE}/v1/trips/${t.id}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#1f94ff", fontWeight: 600 }}>Open JSON →</a>
                      <a href={`${API_BASE}/v1/trips/${t.id}/og`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>Open Image →</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "16px auto 24px", padding: "0 16px" }}>
        {!user && (
          <section style={{ background: "#fff", padding: 20, borderRadius: 12, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <h2 style={{ marginTop: 0 }}>Welcome</h2>
            <p>Please sign in to plan your trip and save bookings.</p>
            <button onClick={() => signInWithPopup(auth, provider).then((res: any) => setUser(res.user))} style={{ background: "#1f94ff", color: "#fff", padding: "10px 14px", borderRadius: 8, border: 0 }}>Sign in with Google</button>
          </section>
        )}

        {user && (
        <section style={{ background: "white", padding: 16, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          <h2 style={{ marginTop: 0 }}>Plan a Trip</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <label>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Destination *</div>
              <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g., Goa" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12 }}>
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Start Date *</div>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }} />
              </label>
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Days *</div>
                <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                  <option value={7}>7</option>
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12 }}>
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Budget (INR) *</div>
                <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g., 25000" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }} />
              </label>
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Theme</div>
                <select value={themeChoice} onChange={(e) => setThemeChoice(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}>
                  <option value="Adventure">Adventure</option>
                  <option value="Heritage">Heritage</option>
                  <option value="Nightlife">Nightlife</option>
                  <option value="Relaxation">Relaxation</option>
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Origin (City / Airport Code)</div>
                <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g., BLR (Bengaluru)" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }} />
              </label>
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Travelers</div>
                <input type="number" min={1} value={travelers} onChange={(e) => setTravelers(Number(e.target.value))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Flight Class</div>
                <select value={flightClass} onChange={(e) => setFlightClass(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}>
                  <option>Economy</option>
                  <option>Premium Economy</option>
                  <option>Business</option>
                </select>
              </label>
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Hotel Rating</div>
                <select value={hotelRating} onChange={(e) => setHotelRating(Number(e.target.value))} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}>
                  <option value={3}>3 Star</option>
                  <option value={4}>4 Star</option>
                  <option value={5}>5 Star</option>
                </select>
              </label>
            </div>

            <label>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Interests (comma-separated)</div>
              <input value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="beach, nightlife, food" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }} />
            </label>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={generateItinerary} disabled={loading || !ackSources} style={{ background: ackSources ? "#1f94ff" : "#94c8ff", color: "white", padding: "10px 14px", borderRadius: 8, border: 0 }}>
                {loading ? "Generating..." : "Generate Itinerary"}
              </button>
              <button onClick={() => { setDestination(""); setBudget(""); setDays(3); setStartDate(""); setThemeChoice("Adventure"); setOrigin(""); setTravelers(2); setFlightClass("Economy"); setHotelRating(3); setItinerary(null); setBooking(null); }} style={{ background: "transparent", color: "#333", padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}>
                Reset
              </button>
              {toastMsg && <span style={{ marginLeft: 8, fontSize: 12, color: "#0a6" }}>{toastMsg}</span>}
            </div>

            {/* Data sources acknowledgement */}
            <div style={{ marginTop: 8, background: "#f8fbff", border: "1px solid #e2eeff", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 12, color: "#334", marginBottom: 6 }}><b>Sources used</b> — Vertex AI (itinerary), OpenWeather (weather), Google Places (POIs), and public web content may inform suggestions. Always verify critical details.</div>
              <label style={{ fontSize: 12, color: "#234", display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={ackSources} onChange={(e) => setAckSources(e.target.checked)} /> I acknowledge these sources and understand results may include AI-generated content.
              </label>
            </div>
          </div>
        </section>
        )}

        {/* ITINERARY */}
        {user && (
        <section style={{ marginTop: 16 }}>
          {loading && (
            <div style={{ background: "white", padding: 16, borderRadius: 12, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              Generating itinerary — this may take a few seconds...
            </div>
          )}

          {itinerary && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <h2 style={{ margin: "8px 0 12px" }}>Your Itinerary</h2>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={shareToCommunity} style={{ background: "#6f42c1", color: "#fff", padding: "8px 12px", borderRadius: 8, border: 0 }}>
                    Share to Community
                  </button>
                  <button onClick={downloadPoster} style={{ background: "#ff7b00", color: "#fff", padding: "8px 12px", borderRadius: 8, border: 0 }}>
                    Download Poster
                  </button>
                  <button onClick={copyText} style={{ background: "#0ea5e9", color: "#fff", padding: "8px 12px", borderRadius: 8, border: 0 }}>
                    Copy as Text
                  </button>
                  <button onClick={copyMarkdown} style={{ background: "#10b981", color: "#fff", padding: "8px 12px", borderRadius: 8, border: 0 }}>
                    Copy as Markdown
                  </button>
                  <button onClick={loadPublicTrips} style={{ background: "#111827", color: "#fff", padding: "8px 12px", borderRadius: 8, border: 0 }}>
                    Browse Public Trips
                  </button>
                </div>
              </div>
              {shareLink && (
                <div style={{ background: "#f0f4ff", border: "1px solid #d7e1ff", color: "#234", padding: "10px 12px", borderRadius: 8, marginBottom: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span>Shared link:</span>
                  <a href={shareLink} target="_blank" rel="noreferrer" style={{ color: "#1f94ff", fontWeight: 600 }}>{shareLink}</a>
                  <span style={{ marginLeft: 8, fontSize: 12, color: "#567" }}>Share:</span>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Trip to ${destination}`)}&url=${encodeURIComponent(shareLink)}`}
                    target="_blank" rel="noreferrer"
                    style={{ background: "#1DA1F2", color: "#fff", padding: "6px 10px", borderRadius: 6, textDecoration: "none", fontSize: 12 }}
                  >Twitter</a>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Trip to ${destination} - ${shareLink}`)}`}
                    target="_blank" rel="noreferrer"
                    style={{ background: "#25D366", color: "#fff", padding: "6px 10px", borderRadius: 6, textDecoration: "none", fontSize: 12 }}
                  >WhatsApp</a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareLink)}`}
                    target="_blank" rel="noreferrer"
                    style={{ background: "#0A66C2", color: "#fff", padding: "6px 10px", borderRadius: 6, textDecoration: "none", fontSize: 12 }}
                  >LinkedIn</a>
                </div>
              )}

              <div ref={captureRef} style={{ display: "grid", gap: 12, background: "#fdfdfd", padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
                {itinerary.map((d, idx) => (
                  <div key={idx} style={{ background: "linear-gradient(180deg,#ffffff 0%,#fafcff 100%)", padding: 16, borderRadius: 16, boxShadow: "0 6px 24px rgba(0,0,0,0.08)", borderLeft: "5px solid #1f94ff", display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 18 }}>
                        <span style={{ background: "#1f94ff", color: "white", padding: "2px 8px", borderRadius: 6, marginRight: 8 }}>Day {idx + 1}</span>
                        {d.title || `Highlights`}
                      </h3>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "6px 0 10px" }}>
                        <div style={{ background: "#eef7ff", border: "1px solid #d6ebff", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}>
                          ☁️ <b>Weather:</b> {d.weather || "—"}
                        </div>
                        <div style={{ background: "#fff8ef", border: "1px solid #ffe0b2", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}>
                          🏥 <b>Nearest Hospital:</b> {d.hospital || "—"}
                        </div>
                        <div style={{ background: "#f6ffef", border: "1px solid #cceec2", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}>
                          💊 <b>Pharmacy:</b> {d.pharmacy || "—"}
                        </div>
                      </div>

                      <div style={{ background: "#f6f8ff", border: "1px dashed #b7c6ff", padding: 10, borderRadius: 10, marginBottom: 8, color: "#334" }}>
                        🧭 <b>Hidden Gem:</b> {Array.isArray(d.activities) && d.activities.length ? d.activities[0] : "Ask locals for lesser-known spots!"}
                      </div>

                      <div style={{ marginTop: 8, fontWeight: 600 }}>Activities:</div>
                      <ul style={{ margin: "6px 0 0 16px" }}>
                        {Array.isArray(d.activities) ? d.activities.map((a: string, i: number) => <li key={i}>{a}</li>) : <li>-</li>}
                      </ul>
                    </div>
                    <div style={{ width: 200, textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#777" }}>Estimated</div>
                        <div style={{ fontWeight: 800, fontSize: 20, color: "#0a5" }}>₹{1000 + idx * 500}</div>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, color: "#666" }}>Safety tip</div>
                        <div style={{ fontSize: 13, color: "#333" }}>{d.tip || "Carry water and sunscreen."}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                <button onClick={bookTrip} disabled={!!booking} style={{ background: "teal", color: "white", padding: "10px 14px", borderRadius: 8, border: 0 }}>
                  {booking ? "Booked" : "Book This Trip (Simulated)"}
                </button>
                {booking && (
                  <div ref={bookingRef} style={{ background: "#ffffff", padding: "12px", borderRadius: 12, display: "grid", gap: 10, border: "1px solid #e6f4ec", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
                    {booking.order?.status === "CONFIRMED" && (
                      <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: 10, borderRadius: 10 }}>
                        ✅ Your booking is confirmed • Ref: <b>{booking.bookingId}</b>{booking.paymentId ? ` • Payment: ${booking.paymentId}` : ""} • Amount: ₹{booking.order?.amount}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>Booking confirmation</div>
                      <div style={{ fontSize: 12, color: booking.order?.status === "CONFIRMED" ? "#0a5" : "#a36" }}>Status: <b>{booking.order?.status || "PENDING"}</b></div>
                    </div>
                    <div style={{ fontSize: 12, color: "#345" }}>Ref: {booking.bookingId || booking.order?.orderId}</div>
                    {booking.details && (
                      <div style={{ background: "#f7fbff", border: "1px solid #e1f0ff", borderRadius: 10, padding: 8 }}>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
                          <div>✈️ {booking.details.origin} → {booking.details.destination}</div>
                          <div>📅 {booking.details.startDate} → {booking.details.endDate}</div>
                          <div>👥 {booking.details.travelers} travelers</div>
                          <div>🛫 {booking.details.flightClass}</div>
                          <div>🏨 {booking.details.hotelRating}-Star</div>
                        </div>
                      </div>
                    )}
                    {booking.flights && (
                      <div style={{ background: "#fffdfa", border: "1px solid #ffecd1", borderRadius: 10, padding: 8 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Flights</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {booking.flights.map((f: any, i: number) => (
                            <li key={i}>{f.vendor} • {f.route} • {f.class} • ₹{f.price} • {f.date}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {booking.hotel && (
                      <div style={{ background: "#f9fffa", border: "1px solid #d8f2e1", borderRadius: 10, padding: 8 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Hotel</div>
                        <div>{booking.hotel.name} • {booking.hotel.rating}-Star • {booking.hotel.nights} nights • ₹{booking.hotel.pricePerNight}/night</div>
                      </div>
                    )}
                    {booking.transport && (
                      <div style={{ background: "#f7faff", border: "1px solid #e2ebff", borderRadius: 10, padding: 8 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Transport</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {booking.transport.map((t: any, i: number) => (
                            <li key={i}>{t.type} • {t.vendor} • ₹{t.price} • {t.date}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {booking.totals && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, alignItems: "stretch" }}>
                        <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 8 }}>Flights<br/><b>₹{booking.totals.flights}</b></div>
                        <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 8 }}>Hotel<br/><b>₹{booking.totals.hotel}</b></div>
                        <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 8 }}>Transport<br/><b>₹{booking.totals.transport}</b></div>
                        <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 8 }}>Activities<br/><b>₹{booking.totals.activities}</b></div>
                        <div style={{ background: "#f2fff5", border: "1px solid #d9f5df", borderRadius: 8, padding: 8 }}>Total<br/><b style={{ color: "#0a5" }}>₹{booking.totals.grandTotal}</b></div>
                      </div>
                    )}

                    {/* Payment action */}
                    <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                      <button onClick={() => setPayOpen(true)} style={{ background: "#111827", color: "#fff", padding: "8px 12px", borderRadius: 8, border: 0 }}>Pay (Dummy)</button>
                      {payment?.status === "CONFIRMED" && <span style={{ fontSize: 12, color: "#0a5" }}>Payment: {payment.paymentId} — CONFIRMED</span>}
                      <button onClick={downloadReceipt} style={{ background: "#1f94ff", color: "#fff", padding: "8px 12px", borderRadius: 8, border: 0 }}>Download Receipt</button>
                    </div>

                    {/* Simple inline payment form */}
                    {payOpen && (
                      <div style={{ marginTop: 8, background: "#f9f9fb", border: "1px solid #ececec", borderRadius: 10, padding: 10 }}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>Enter Card Details (Dummy)</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span style={{ fontSize: 12 }}>Cardholder Name</span>
                            <input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Name on card" style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
                          </label>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span style={{ fontSize: 12 }}>Card Number</span>
                            <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4111 1111 1111 1111" style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
                          </label>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span style={{ fontSize: 12 }}>Expiry (MM/YY)</span>
                            <input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="10/28" style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
                          </label>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span style={{ fontSize: 12 }}>CVV</span>
                            <input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="123" style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }} />
                          </label>
                        </div>
                        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                          <button onClick={submitPayment} style={{ background: "#0a5", color: "#fff", padding: "8px 12px", borderRadius: 8, border: 0 }}>Pay Now</button>
                          <button onClick={() => setPayOpen(false)} style={{ background: "transparent", color: "#333", padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd" }}>Cancel</button>
                        </div>
                        <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>This is a dummy payment. Do not enter real card details.</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
        )}

        {/* POIs USP */}
        {user && pois && pois.length > 0 && (
          <section style={{ marginTop: 16 }}>
            <h2 style={{ margin: "8px 0 12px" }}>Top Places in {destination}</h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
            }}>
              {pois.map((p, idx) => (
                <div key={idx} style={{ background: "white", padding: 12, borderRadius: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.08)", border: "1px solid #eee" }}>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    {p.formatted_address || p.address || ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    {typeof p.rating === "number" ? `⭐ ${p.rating}` : ""}
                  </div>
                  {(typeof p.lat === "number" && typeof p.lng === "number") && (
                    <div style={{ marginTop: 8 }}>
                      <a
                        href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: "#1f94ff", fontWeight: 600 }}
                      >
                        View on Maps →
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer style={{ textAlign: "center", padding: 24, background: "#f7f7f7" }}>
        <small>© {new Date().getFullYear()} AI Trip Planner • Demo</small>
      </footer>
    </div>
  );
}

