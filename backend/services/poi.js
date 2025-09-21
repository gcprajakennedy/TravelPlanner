const axios = require('axios');
async function getPOIs(city, interests) {
  const query = `${city}+${interests.join('+')}+India`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&region=in&key=${process.env.MAPS_KEY}`;
  const resp = await axios.get(url);

  return resp.data.results.slice(0,5).map(p => ({
    name: p.name,
    lat: p.geometry.location.lat,
    lng: p.geometry.location.lng,
    address: p.formatted_address || "India"
  }));
}
module.exports = { getPOIs };
