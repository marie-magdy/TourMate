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

export { api };