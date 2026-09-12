import axios from 'axios';

// Target FastAPI ASGI server on port 5000
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
export const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:5000';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});