// frontend/api.ts
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '192.168.1.21';

const api = axios.create({
  baseURL: `http://${API_URL}:3000/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Fetch popular attractions with primary images
 */
export const fetchPopularAttractions = async (limit = 5) => {
  try {
    const response = await api.get('/attractions/popular', {
      params: { limit }
    });
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching popular attractions:', error);
    return [];
  }
};

/**
 * Fetch nearest attractions with images
 */
export const fetchNearestAttractions = async (latitude, longitude, limit = 5) => {
  try {
    const response = await api.get('/attractions/nearest', {
      params: { latitude, longitude, limit }
    });
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching nearest attractions:', error);
    return [];
  }
};

/**
 * Fetch attractions by city with images
 */
export const fetchAttractionsByCity = async (cityId, limit = null) => {
  try {
    const response = await api.get(`/attractions/city/${cityId}`, {
      params: limit ? { limit } : {}
    });
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching attractions by city:', error);
    return [];
  }
};

/**
 * Fetch all attractions with primary images
 */
export const fetchAllAttractionsWithImages = async (limit = null) => {
  try {
    const response = await api.get('/attractions/with-images', {
      params: limit ? { limit } : {}
    });
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching attractions with images:', error);
    return [];
  }
};

/**
 * Fetch attraction details with all images
 */
export const fetchAttractionDetails = async (attractionId) => {
  try {
    const response = await api.get(`/attractions/${attractionId}`);
    return response.data.data;
  } catch (error) {
    console.error('Error fetching attraction details:', error);
    return null;
  }
};

/**
 * Search attractions by name
 */
export const searchAttractions = async (query) => {
  try {
    const response = await api.get('/attractions/with-images', {
      params: { search: query }
    });
    // Filter results by matching name
    const results = response.data.data.filter((a) =>
      a.name.toLowerCase().includes(query.toLowerCase())
    );
    return results;
  } catch (error) {
    console.error('Error searching attractions:', error);
    return [];
  }
};

export { api };