// frontend/api.ts
import axios from 'axios';

const raw = process.env.EXPO_PUBLIC_API_URL ?? 'localhost';
const baseURL = raw.startsWith('http') ? `${raw}/api` : `http://${raw}:3000/api`;

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export { api };