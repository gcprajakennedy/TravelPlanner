import axios from 'axios';

const EMT_BASE = process.env.EMT_API_BASE; // for sandbox or real
const EMT_KEY = process.env.EMT_KEY;

export async function getEMTQuote(item) {
  if (process.env.EMT_SIMULATE === 'true') {
    // Simple simulated quote
    return { quoteId: `sim-${Date.now()}`, amount: Math.round(Math.random()*3000) + 500 };
  }
  const resp = await axios.post(`${EMT_BASE}/quote`, item, { headers: { Authorization: `Bearer ${EMT_KEY}` }});
  return resp.data;
}

export async function confirmEMTBooking(quoteId, passenger) {
  if (process.env.EMT_SIMULATE === 'true') {
    return { bookingId: `BK-${Date.now()}`, status: 'CONFIRMED' };
  }
  const resp = await axios.post(`${EMT_BASE}/confirm`, { quoteId, passenger }, { headers: { Authorization: `Bearer ${EMT_KEY}` }});
  return resp.data;
}
