import React, { useState } from "react";
import axios from "axios";

export default function PlanForm({ user }) {
  const [destination, setDestination] = useState("");
  const [budget, setBudget] = useState("");
  const [interests, setInterests] = useState("");
  const [trip, setTrip] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const resp = await axios.post(
      import.meta.env.VITE_BACKEND_URL + "/api/v1/plan",
      {
        userId: user.uid,
        destination,
        dates: ["2025-12-01", "2025-12-05"],
        budget,
        interests: interests.split(",")
      }
    );
    setTrip(resp.data.itinerary);
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">✨ AI Trip Planner</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input className="border p-2 w-full"
          placeholder="Destination (e.g. Goa)" 
          value={destination} 
          onChange={e => setDestination(e.target.value)} />
        <input className="border p-2 w-full"
          placeholder="Budget (₹)" 
          value={budget} 
          onChange={e => setBudget(e.target.value)} />
        <input className="border p-2 w-full"
          placeholder="Interests (e.g. beach, nightlife)" 
          value={interests} 
          onChange={e => setInterests(e.target.value)} />
        <button className="bg-blue-500 text-white px-4 py-2 rounded">
          Generate Plan
        </button>
      </form>

      {trip && (
        <div className="mt-4">
          <h3 className="text-lg font-bold">Your Itinerary</h3>
          <pre className="bg-gray-100 p-2">{JSON.stringify(trip, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
