import axios from 'axios';

const baseURL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export { api };