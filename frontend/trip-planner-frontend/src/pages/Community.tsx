import { useEffect, useState } from "react";
import axios from "axios";

type TripItem = {
  id: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  theme?: string;
  budget?: number;
};

export default function Community() {
  const API_BASE = (import.meta.env && (import.meta.env.VITE_BACKEND_URL as string)) || "http://localhost:8080";
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_BASE}/v1/trips`, { params: { limit: 24 }, timeout: 10000 });
      setTrips(res.data?.trips || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f7f9fc" }}>
      <header style={{ background: "#1f94ff", color: "white", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>🌍 Community Trips</h1>
          <p style={{ marginTop: 4, fontSize: 12, opacity: 0.9 }}>Browse recently shared public itineraries</p>
        </div>
        <a href="/" style={{ background: "#fff", color: "#1f94ff", padding: "8px 10px", borderRadius: 8, border: 0, textDecoration: "none", fontWeight: 600 }}>← Back to Planner</a>
      </header>

      <main style={{ maxWidth: 1100, margin: "16px auto 24px", padding: "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Recent</h2>
          <button onClick={loadTrips} style={{ background: "#1f94ff", color: "#fff", padding: "8px 12px", borderRadius: 8, border: 0 }}>Refresh</button>
        </div>

        {loading && <div style={{ background: "#fff", padding: 16, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>Loading trips…</div>}
        {error && <div style={{ background: "#fff6f6", padding: 16, borderRadius: 12, border: "1px solid #ffd6d6", color: "#a00" }}>{error}</div>}

        {!loading && !error && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {trips.map((t) => (
              <div key={t.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, overflow: "hidden", boxShadow: "0 6px 18px rgba(0,0,0,0.06)" }}>
                <img alt="OG" src={`${API_BASE}/v1/trips/${t.id}/og`} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                <div style={{ padding: 12 }}>
                  <div style={{ fontWeight: 700 }}>{t.destination || "Trip"}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{[t.startDate, t.endDate].filter(Boolean).join(" → ")}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{t.theme ? `Theme: ${t.theme}` : ""}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <a href={`/community?id=${t.id}`} style={{ fontSize: 12, color: "#111", fontWeight: 600, textDecoration: "none" }}>Details</a>
                    <a href={`${API_BASE}/v1/trips/${t.id}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#1f94ff", fontWeight: 600 }}>Open JSON →</a>
                    <a href={`${API_BASE}/v1/trips/${t.id}/og`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>Open Image →</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
