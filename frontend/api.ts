// frontend/api.ts
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'localhost';

const api = axios.create({
  baseURL: `http://${API_URL}:3000/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export { api };