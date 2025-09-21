import axios from 'axios';
const MAPS_KEY = process.env.MAPS_KEY;

export async function fetchTopPOIs(city, categories = ['heritage','food','nightlife'], limit=6) {
  const results = [];
  for (const cat of categories) {
    const q = `${city} ${cat}`;
    const resp = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: { query: q, key: MAPS_KEY, region: 'in' }
    });
    if (resp.data.results) {
      resp.data.results.slice(0, limit).forEach(p => results.push({
        place_id: p.place_id,
        name: p.name,
        lat: p.geometry.location.lat,
        lng: p.geometry.location.lng,
        formatted_address: p.formatted_address,
        rating: p.rating,
        types: p.types
      }));
    }
  }
  return results;
}
