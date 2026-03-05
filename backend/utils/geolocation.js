/**
 * Egyptian Cities with coordinates and mapping logic
 * Maps latitude/longitude to nearest city
 */

const egyptianCities = [
  {
    city_name: 'Cairo',
    city_id: 'CIT001',
    latitude: 30.0444,
    longitude: 31.2357,
  },
  {
    city_name: 'Alexandria',
    city_id: 'CIT002',
    latitude: 31.2001,
    longitude: 29.9187,
  },
  {
    city_name: 'Giza',
    city_id: 'CIT003',
    latitude: 29.9792,
    longitude: 31.1342,
  },
  {
    city_name: 'Aswan',
    city_id: 'CIT004',
    latitude: 24.0889,
    longitude: 32.8998,
  },
  {
    city_name: 'Luxor',
    city_id: 'CIT005',
    latitude: 25.6872,
    longitude: 32.6396,
  },
  {
    city_name: 'South Sinai',
    city_id: 'CIT006',
    latitude: 27.7171,
    longitude: 34.2922,
  },
  {
    city_name: 'Red Sea',
    city_id: 'CIT007',
    latitude: 27.1317,
    longitude: 33.6346,
  },
  {
    city_name: 'Ismailia',
    city_id: 'CIT008',
    latitude: 30.5948,
    longitude: 32.2729,
  },
  {
    city_name: 'Fayoum',
    city_id: 'CIT009',
    latitude: 29.3084,
    longitude: 30.8425,
  },
  {
    city_name: 'New Valley',
    city_id: 'CIT010',
    latitude: 25.3765,
    longitude: 30.7565,
  },
  {
    city_name: 'North Coast',
    city_id: 'CIT011',
    latitude: 31.2704,
    longitude: 30.3572,
  },
  {
    city_name: 'Matrouh',
    city_id: 'CIT012',
    latitude: 31.3423,
    longitude: 27.2373,
  },
  {
    city_name: 'Abu Simbel',
    city_id: 'CIT013',
    latitude: 22.3474,
    longitude: 31.6061,
  },
];

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - First latitude
 * @param {number} lon1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lon2 - Second longitude
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find nearest city based on coordinates
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @returns {Object} Nearest city object {city_name, city_id, latitude, longitude, distance}
 */
export function getNearestCity(latitude, longitude) {
  if (!latitude || !longitude) {
    return {
      city_name: 'Cairo',
      city_id: 'CIT001',
      latitude: 30.0444,
      longitude: 31.2357,
      distance: null,
    };
  }

  let nearestCity = null;
  let minDistance = Infinity;

  for (const city of egyptianCities) {
    const distance = calculateDistance(
      latitude,
      longitude,
      city.latitude,
      city.longitude
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestCity = { ...city, distance };
    }
  }

  return nearestCity || egyptianCities[0]; // Default to Cairo if something goes wrong
}

/**
 * Validate coordinates are in Egypt
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {boolean} True if coordinates are within Egypt
 */
export function isInEgypt(latitude, longitude) {
  // Egypt bounding box: ~19 to 32 latitude, 24 to 35 longitude
  return latitude >= 19 && latitude <= 32 && longitude >= 24 && longitude <= 35;
}

export default {
  getNearestCity,
  isInEgypt,
  egyptianCities,
};
